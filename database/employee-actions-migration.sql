-- Employee warnings and employment status history.
-- Run after supabase-schema.sql and the existing access-control migrations.

alter table public.employees
  add column if not exists employment_status text not null default 'Active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_employment_status_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees add constraint employees_employment_status_check
      check (employment_status in ('Active','Suspended','Resigned','Transferred'));
  end if;
end;
$$;

create table if not exists public.employee_warnings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  warning_date date not null default current_date,
  reason text not null check (length(trim(reason)) > 0),
  issued_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists employee_warnings_employee_date_idx
  on public.employee_warnings(employee_id, warning_date desc);

create table if not exists public.employee_status_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  old_status text not null,
  new_status text not null,
  reason text not null check (length(trim(reason)) > 0),
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now()
);

create index if not exists employee_status_history_employee_date_idx
  on public.employee_status_history(employee_id, changed_at desc);

alter table public.employee_warnings enable row level security;
alter table public.employee_status_history enable row level security;
revoke all on public.employee_warnings, public.employee_status_history from anon, authenticated;
grant select, insert on public.employee_warnings to authenticated;
grant select on public.employee_status_history to authenticated;

drop policy if exists employee_warnings_read_hr on public.employee_warnings;
create policy employee_warnings_read_hr on public.employee_warnings
  for select to authenticated using (public.has_any_role(array['admin','hr']));
drop policy if exists employee_warnings_insert_hr on public.employee_warnings;
create policy employee_warnings_insert_hr on public.employee_warnings
  for insert to authenticated
  with check (
    public.has_any_role(array['admin','hr'])
    and issued_by = (select auth.uid())
  );

drop policy if exists employee_status_history_read_hr on public.employee_status_history;
create policy employee_status_history_read_hr on public.employee_status_history
  for select to authenticated using (public.has_any_role(array['admin','hr']));

create or replace function public.set_employee_status(
  p_employee_id uuid,
  p_status text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_old_status text;
  v_history_id uuid;
begin
  if v_actor is null or not public.has_any_role(array['admin']) then
    raise exception 'Only an Admin can change employee status.' using errcode = '42501';
  end if;
  if p_status not in ('Active','Suspended','Resigned','Transferred') then
    raise exception 'Choose a valid employment status.' using errcode = '22023';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Enter a reason for the status change.' using errcode = '22023';
  end if;

  select coalesce(employment_status, 'Active') into v_old_status
    from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Employee record was not found.' using errcode = 'P0002';
  end if;
  if v_old_status = p_status then
    raise exception 'Employee already has this status.' using errcode = '22023';
  end if;

  update public.employees
    set employment_status = p_status,
        is_active = p_status not in ('Suspended','Resigned'),
        updated_at = now()
    where id = p_employee_id;

  insert into public.employee_status_history(employee_id,old_status,new_status,reason,changed_by)
    values(p_employee_id,v_old_status,p_status,trim(p_reason),v_actor)
    returning id into v_history_id;
  return v_history_id;
end;
$$;

revoke all on function public.set_employee_status(uuid,text,text) from public, anon;
grant execute on function public.set_employee_status(uuid,text,text) to authenticated;

-- Include warning and status history records in the admin audit trail when it exists.
do $$
declare
  v_table text;
begin
  if to_regprocedure('public.capture_audit_event()') is not null then
    foreach v_table in array array['employee_warnings','employee_status_history'] loop
      execute format('drop trigger if exists audit_%I on public.%I',v_table,v_table);
      execute format(
        'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.capture_audit_event()',
        v_table,v_table
      );
    end loop;
  end if;
end;
$$;
