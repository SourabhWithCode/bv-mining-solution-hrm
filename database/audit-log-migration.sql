-- Admin-only audit trail for application data and a secure approvals view.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  event_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_name text not null default 'System',
  actor_email text,
  actor_role text,
  table_name text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  record_id text,
  record_label text,
  changes jsonb not null default '{}'::jsonb
);

alter table public.audit_logs add column if not exists actor_role text;
alter table public.audit_logs add column if not exists record_label text;

create index if not exists audit_logs_event_at_idx on public.audit_logs(event_at desc);
create index if not exists audit_logs_table_name_idx on public.audit_logs(table_name);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
drop policy if exists audit_logs_read_admin on public.audit_logs;
create policy audit_logs_read_admin on public.audit_logs
  for select to authenticated using (public.has_any_role(array['admin']));

-- Exclude app syncs that only refreshed metadata timestamps from the admin view.
create or replace view public.audit_logs_meaningful
with (security_invoker = true)
as
  select audit.* from public.audit_logs as audit
  where not (
    audit.action = 'UPDATE'
    and audit.changes ? 'updated_at'
    and (select count(*) from jsonb_object_keys(audit.changes)) = 1
  );
grant select on public.audit_logs_meaningful to authenticated;

-- Let an admin clear old history from the page while retaining a single audit
-- event that records who cleared it and how many entries were removed.
create or replace function public.clear_audit_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_email text;
  v_actor_role text;
  v_deleted integer;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to clear audit history.' using errcode = '42501';
  end if;

  select coalesce(nullif(full_name,''), email), email, role
    into v_actor_name, v_actor_email, v_actor_role
    from public.user_profiles where id = v_actor_id;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Only an admin can clear audit history.' using errcode = '42501';
  end if;

  delete from public.audit_logs where id is not null;
  get diagnostics v_deleted = row_count;

  insert into public.audit_logs(
    actor_user_id, actor_name, actor_email, actor_role,
    table_name, action, record_id, record_label, changes
  ) values (
    v_actor_id, coalesce(v_actor_name, 'Admin'), v_actor_email, v_actor_role,
    'audit_logs', 'DELETE', 'history', 'Audit history cleared',
    jsonb_build_object('deleted_entries', v_deleted)
  );

  return v_deleted;
end;
$$;

revoke all on function public.clear_audit_history() from public, anon;
grant execute on function public.clear_audit_history() to authenticated;

create or replace function public.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text := 'System';
  v_actor_email text;
  v_actor_role text;
  v_old jsonb;
  v_new jsonb;
  v_record jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_record_id text;
  v_record_label text;
  v_sensitive text[] := array[
    'aadhaar','pan','bank_account','mobile','uan_number','esic','ip','lwf',
    'present_address','permanent_address','emergency_contact_address',
    'emergency_contact_number','nominee_address','father_name','spouse_name',
    'dob','reason','note','remarks'
  ];
begin
  if v_actor_id is null then
    begin
      v_actor_id := nullif(current_setting('request.headers', true)::jsonb ->> 'x-audit-actor-id', '')::uuid;
    exception when others then
      v_actor_id := null;
    end;
  end if;

  if v_actor_id is not null then
    select coalesce(nullif(full_name,''), email), email, role
      into v_actor_name, v_actor_email, v_actor_role
      from public.user_profiles where id = v_actor_id;
    v_actor_name := coalesce(v_actor_name, v_actor_id::text);
  end if;

  if TG_OP = 'INSERT' then
    v_new := to_jsonb(NEW);
    v_record := v_new;
    v_changes := jsonb_build_object('after', v_new);
  elsif TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_record := v_old;
    v_changes := jsonb_build_object('before', v_old);
  else
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record := to_jsonb(NEW);
    for v_key in select jsonb_object_keys(v_old || v_new) loop
      -- App syncs may refresh this metadata field while upserting an unchanged row.
      if v_key = 'updated_at' then continue; end if;
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key,
          case when v_key = any(v_sensitive)
            then jsonb_build_object('before','[redacted]','after','[redacted]')
            else jsonb_build_object('before',v_old -> v_key,'after',v_new -> v_key)
          end
        );
      end if;
    end loop;
  end if;

  if TG_OP = 'INSERT' then v_changes := jsonb_build_object('after',v_new - v_sensitive); end if;
  if TG_OP = 'DELETE' then v_changes := jsonb_build_object('before',v_old - v_sensitive); end if;
  if TG_OP = 'UPDATE' and v_changes = '{}'::jsonb then return NEW; end if;

  v_record_id := coalesce(
    v_record ->> 'id',
    v_record ->> 'employee_code',
    v_record ->> 'email',
    concat_ws(':', v_record ->> 'employee_id', coalesce(v_record ->> 'work_date', v_record ->> 'attendance_date', v_record ->> 'issue_date'))
  );

  -- Build a human-readable subject from whichever identifying fields this table has.
  v_record_label := coalesce(
    nullif(concat_ws(' · ',
      nullif(v_record ->> 'employee_code',''),
      nullif(v_record ->> 'employee_name',''),
      nullif(v_record ->> 'name',''),
      nullif(v_record ->> 'item_name',''),
      nullif(v_record ->> 'leave_type',''),
      nullif(v_record ->> 'work_date',''),
      nullif(v_record ->> 'attendance_date',''),
      nullif(v_record ->> 'issue_date',''),
      nullif(v_record ->> 'start_date',''),
      nullif(v_record ->> 'shift',''),
      nullif(v_record ->> 'status','')
    ), ''),
    nullif(v_record ->> 'email',''),
    nullif(v_record ->> 'employee_id',''),
    v_record_id
  );

  insert into public.audit_logs(actor_user_id,actor_name,actor_email,actor_role,table_name,action,record_id,record_label,changes)
  values(v_actor_id,coalesce(v_actor_name,'System'),v_actor_email,v_actor_role,TG_TABLE_NAME,TG_OP,v_record_id,v_record_label,v_changes);

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

revoke all on function public.capture_audit_event() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'user_profiles','employees','shift_assignments','attendance','leave_requests',
    'ppe_items','ppe_issues','ppe_stock_movements','overtime_entries'
  ] loop
    execute format('drop trigger if exists audit_%I on public.%I', v_table, v_table);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.capture_audit_event()',
      v_table, v_table
    );
  end loop;
end;
$$;
