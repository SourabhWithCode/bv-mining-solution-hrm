-- Store per-account page visibility separately from the user's application role.
alter table public.user_profiles
  add column if not exists page_access jsonb not null default '{}'::jsonb;

update public.user_profiles
set page_access = case role
  when 'admin' then '{"dashboard":true,"employee_records":true,"employees_data":true,"shift_board":true,"mining_report":true,"attendance":true,"monthly_attendance":true,"leave":true,"stock_management":true,"ppe_issue_records":true,"stock_returns":true,"reports":true,"audit_log":true,"user_management":true}'::jsonb
  when 'hr' then '{"dashboard":true,"employee_records":true,"employees_data":true,"attendance":true,"monthly_attendance":true,"leave":true,"reports":true}'::jsonb
  when 'store' then '{"dashboard":true,"leave":true,"stock_management":true,"ppe_issue_records":true,"stock_returns":true}'::jsonb
  when 'mine_mate' then '{"dashboard":true,"leave":true,"shift_board":true,"mining_report":true}'::jsonb
  when 'foreman' then '{"dashboard":true,"leave":true,"shift_board":true,"mining_report":true}'::jsonb
  else '{"dashboard":true,"leave":true}'::jsonb
end
where page_access = '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_page_access_object'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_page_access_object
      check (jsonb_typeof(page_access) = 'object');
  end if;
end;
$$;

-- Page grants control which modules a user can read or enter data on,
-- independently of their job role. Editing/deleting saved data stays Admin-only.
create or replace function public.user_has_page_access(_page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and (p.role = 'admin' or p.page_access ->> _page = 'true')
  );
$$;
revoke all on function public.user_has_page_access(text) from public, anon;
grant execute on function public.user_has_page_access(text) to authenticated;

-- Employees / HR records.
drop policy if exists "employees read authenticated roles" on public.employees;
drop policy if exists employees_read_by_page_access on public.employees;
create policy employees_read_by_page_access on public.employees
  for select to authenticated using (
    public.user_has_page_access('employee_records')
    or public.user_has_page_access('employees_data')
  );
drop policy if exists "employees manage by HR" on public.employees;
drop policy if exists employees_insert on public.employees;
drop policy if exists employees_insert_by_page_access on public.employees;
create policy employees_insert_by_page_access on public.employees
  for insert to authenticated with check (public.user_has_page_access('employee_records'));

drop policy if exists employee_warnings_read_hr on public.employee_warnings;
drop policy if exists employee_warnings_read_by_page_access on public.employee_warnings;
create policy employee_warnings_read_by_page_access on public.employee_warnings
  for select to authenticated using (public.user_has_page_access('employee_records'));
drop policy if exists employee_warnings_insert_hr on public.employee_warnings;
drop policy if exists employee_warnings_insert_by_page_access on public.employee_warnings;
create policy employee_warnings_insert_by_page_access on public.employee_warnings
  for insert to authenticated with check (
    public.user_has_page_access('employee_records') and issued_by = (select auth.uid())
  );
drop policy if exists employee_status_history_read_hr on public.employee_status_history;
drop policy if exists employee_status_history_read_by_page_access on public.employee_status_history;
create policy employee_status_history_read_by_page_access on public.employee_status_history
  for select to authenticated using (public.user_has_page_access('employee_records'));

-- Shift board, attendance, and overtime entry.
drop policy if exists "shifts manage by HR or supervisor" on public.shift_assignments;
drop policy if exists shifts_insert on public.shift_assignments;
drop policy if exists shifts_insert_by_page_access on public.shift_assignments;
create policy shifts_insert_by_page_access on public.shift_assignments
  for insert to authenticated with check (public.user_has_page_access('shift_board'));

drop policy if exists "attendance read authenticated roles" on public.attendance;
drop policy if exists attendance_read_by_page_access on public.attendance;
create policy attendance_read_by_page_access on public.attendance
  for select to authenticated using (
    public.user_has_page_access('attendance')
    or public.user_has_page_access('monthly_attendance')
    or public.user_has_page_access('shift_board')
    or public.user_has_page_access('reports')
  );
drop policy if exists "attendance manage by HR or supervisor" on public.attendance;
drop policy if exists attendance_insert on public.attendance;
drop policy if exists attendance_insert_by_page_access on public.attendance;
create policy attendance_insert_by_page_access on public.attendance
  for insert to authenticated with check (
    public.user_has_page_access('attendance')
    or public.user_has_page_access('monthly_attendance')
    or public.user_has_page_access('shift_board')
  );

drop policy if exists "overtime manage by HR or supervisor" on public.overtime_entries;
drop policy if exists overtime_insert on public.overtime_entries;
drop policy if exists overtime_insert_by_page_access on public.overtime_entries;
create policy overtime_insert_by_page_access on public.overtime_entries
  for insert to authenticated with check (
    public.user_has_page_access('shift_board')
    and approval_status = 'Pending' and approved_by is null and approved_at is null
  );

-- Leave requests can be submitted only by accounts granted Leave. Reports access
-- lets a user see the report data needed by the Reports page.
drop policy if exists "leave read HR or requester" on public.leave_requests;
drop policy if exists leave_read_by_page_access on public.leave_requests;
create policy leave_read_by_page_access on public.leave_requests
  for select to authenticated using (
    public.user_has_page_access('admin')
    or public.user_has_page_access('reports')
    or (public.user_has_page_access('leave') and submitted_by = (select auth.uid()))
  );
drop policy if exists "leave submit authenticated" on public.leave_requests;
drop policy if exists leave_insert on public.leave_requests;
drop policy if exists leave_insert_by_page_access on public.leave_requests;
create policy leave_insert_by_page_access on public.leave_requests
  for insert to authenticated with check (public.user_has_page_access('leave'));

-- Store pages share catalogue reads; each write operation requires its page grant.
drop policy if exists "PPE items manage by HR" on public.ppe_items;
drop policy if exists ppe_items_insert on public.ppe_items;
drop policy if exists ppe_items_insert_by_page_access on public.ppe_items;
create policy ppe_items_insert_by_page_access on public.ppe_items
  for insert to authenticated with check (
    public.user_has_page_access('stock_management')
    or public.user_has_page_access('ppe_issue_records')
    or public.user_has_page_access('stock_returns')
  );
drop policy if exists "PPE issues manage by HR" on public.ppe_issues;
drop policy if exists ppe_issues_insert on public.ppe_issues;
drop policy if exists ppe_issues_insert_by_page_access on public.ppe_issues;
create policy ppe_issues_insert_by_page_access on public.ppe_issues
  for insert to authenticated with check (public.user_has_page_access('ppe_issue_records'));
drop policy if exists "PPE movements manage by HR" on public.ppe_stock_movements;
drop policy if exists ppe_movements_insert on public.ppe_stock_movements;
drop policy if exists ppe_movements_insert_by_page_access on public.ppe_stock_movements;
create policy ppe_movements_insert_by_page_access on public.ppe_stock_movements
  for insert to authenticated with check (
    public.user_has_page_access('stock_management')
    or public.user_has_page_access('stock_returns')
  );

-- Mining reports are available to any user specifically granted that page.
drop policy if exists mining_reports_read_operations on public.mining_reports;
drop policy if exists mining_reports_read_by_page_access on public.mining_reports;
create policy mining_reports_read_by_page_access on public.mining_reports
  for select to authenticated using (public.user_has_page_access('mining_report'));
drop policy if exists mining_reports_insert_operations on public.mining_reports;
drop policy if exists mining_reports_insert_by_page_access on public.mining_reports;
create policy mining_reports_insert_by_page_access on public.mining_reports
  for insert to authenticated with check (
    public.user_has_page_access('mining_report') and reporter_id = (select auth.uid())
  );
