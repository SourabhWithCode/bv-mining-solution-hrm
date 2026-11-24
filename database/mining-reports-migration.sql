-- Shift reports entered by Mine Mate and Foreman users.
create table if not exists public.mining_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  shift text not null check (shift in ('first','second','night')),
  location_level text not null,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reporter_name text not null,
  operator text not null default '',
  operator_name text not null default '',
  manpower integer not null default 0 check (manpower >= 0),
  manpower_names text not null default '',
  mechanic text not null default '',
  mechanic_names text not null default '',
  blast_count integer not null default 0 check (blast_count >= 0),
  work_done text not null default '',
  pending_work text not null default '',
  machine_status text not null default '',
  maintenance text not null default '',
  idle_time_hours numeric(5,2) not null default 0 check (idle_time_hours >= 0 and idle_time_hours <= 24),
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade the table too if the earlier Mining Report schema has already run.
alter table public.mining_reports add column if not exists operator_name text not null default '';
alter table public.mining_reports add column if not exists manpower_names text not null default '';
alter table public.mining_reports add column if not exists mechanic_names text not null default '';
update public.mining_reports set operator_name=operator where operator_name='' and operator<>'';
update public.mining_reports set mechanic_names=mechanic where mechanic_names='' and mechanic<>'';

create index if not exists mining_reports_date_shift_idx on public.mining_reports(report_date, shift);
create index if not exists mining_reports_reporter_idx on public.mining_reports(reporter_id);
alter table public.mining_reports enable row level security;
revoke all on public.mining_reports from anon, authenticated;
grant select, insert, update, delete on public.mining_reports to authenticated;

drop policy if exists mining_reports_read_operations on public.mining_reports;
create policy mining_reports_read_operations on public.mining_reports
  for select to authenticated
  using (public.has_any_role(array['admin','mine_mate','foreman']));

drop policy if exists mining_reports_insert_operations on public.mining_reports;
create policy mining_reports_insert_operations on public.mining_reports
  for insert to authenticated
  with check (
    public.has_any_role(array['admin','mine_mate','foreman'])
    and reporter_id = (select auth.uid())
  );

drop policy if exists mining_reports_update_admin on public.mining_reports;
create policy mining_reports_update_admin on public.mining_reports
  for update to authenticated
  using (public.has_any_role(array['admin']))
  with check (public.has_any_role(array['admin']));

drop policy if exists mining_reports_delete_admin on public.mining_reports;
create policy mining_reports_delete_admin on public.mining_reports
  for delete to authenticated
  using (public.has_any_role(array['admin']));

-- Dashboard users can see aggregate blast totals without gaining access to report details.
create or replace function public.get_mining_blast_summary(p_report_date date)
returns table(shift text, blast_count bigint, report_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to view blast totals.' using errcode = '42501';
  end if;
  return query
    select r.shift, sum(r.blast_count)::bigint, count(*)::bigint
    from public.mining_reports r
    where r.report_date = p_report_date
    group by r.shift;
end;
$$;
revoke all on function public.get_mining_blast_summary(date) from public, anon;
grant execute on function public.get_mining_blast_summary(date) to authenticated;

-- Add mining report events to the existing Admin audit trail when installed.
do $$
begin
  if to_regprocedure('public.capture_audit_event()') is not null then
    execute 'drop trigger if exists audit_mining_reports on public.mining_reports';
    execute 'create trigger audit_mining_reports after insert or update or delete on public.mining_reports for each row execute function public.capture_audit_event()';
  end if;
end;
$$;
