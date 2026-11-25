-- Add Director accounts and let them approve leave and overtime requests.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check
  check (role in ('admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'));

-- Director needs the same dashboard data feeds already available to app roles.
drop policy if exists "shifts read authenticated roles" on public.shift_assignments;
create policy "shifts read authenticated roles" on public.shift_assignments
  for select to authenticated using (
    public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'])
  );
drop policy if exists "PPE items read authenticated roles" on public.ppe_items;
create policy "PPE items read authenticated roles" on public.ppe_items
  for select to authenticated using (
    public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'])
  );
drop policy if exists "PPE issues read authenticated roles" on public.ppe_issues;
create policy "PPE issues read authenticated roles" on public.ppe_issues
  for select to authenticated using (
    public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'])
  );
drop policy if exists "PPE movements read authenticated roles" on public.ppe_stock_movements;
create policy "PPE movements read authenticated roles" on public.ppe_stock_movements
  for select to authenticated using (
    public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'])
  );
drop policy if exists "overtime read authenticated roles" on public.overtime_entries;
create policy "overtime read authenticated roles" on public.overtime_entries
  for select to authenticated using (
    public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'])
  );

-- Director can review all leave requests only when the Leave page is granted.
drop policy if exists leave_read_by_page_access on public.leave_requests;
create policy leave_read_by_page_access on public.leave_requests
  for select to authenticated using (
    public.user_has_page_access('admin')
    or (public.has_any_role(array['director']) and public.user_has_page_access('leave'))
    or public.user_has_page_access('reports')
    or (public.user_has_page_access('leave') and submitted_by = (select auth.uid()))
  );

drop policy if exists leave_update on public.leave_requests;
drop policy if exists "leave review by HR" on public.leave_requests;
drop policy if exists leave_update_admin_or_director on public.leave_requests;
create policy leave_update_admin_or_director on public.leave_requests
  for update to authenticated
  using (
    public.has_any_role(array['admin'])
    or (public.has_any_role(array['director']) and public.user_has_page_access('leave'))
  )
  with check (
    public.has_any_role(array['admin'])
    or (public.has_any_role(array['director']) and public.user_has_page_access('leave'))
  );

create or replace function public.guard_director_leave_approval()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.has_any_role(array['director']) and not public.has_any_role(array['admin']) then
    if (to_jsonb(new) - array['status','updated_at']) is distinct from
       (to_jsonb(old) - array['status','updated_at']) then
      raise exception 'Directors may change only a leave request approval status.' using errcode = '42501';
    end if;
    if new.status not in ('Pending','Approved','Rejected') then
      raise exception 'Directors may set leave status to Pending, Approved, or Rejected.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_director_leave_approval on public.leave_requests;
create trigger guard_director_leave_approval
  before update on public.leave_requests
  for each row execute function public.guard_director_leave_approval();
revoke all on function public.guard_director_leave_approval() from public, anon, authenticated;

-- Director approvals are limited to the approval fields; request details stay protected.
drop policy if exists "overtime update by admin" on public.overtime_entries;
drop policy if exists overtime_update on public.overtime_entries;
drop policy if exists overtime_update_admin_or_director on public.overtime_entries;
create policy overtime_update_admin_or_director on public.overtime_entries
  for update to authenticated
  using (
    public.has_any_role(array['admin'])
    or (public.has_any_role(array['director']) and public.user_has_page_access('dashboard'))
  )
  with check (
    public.has_any_role(array['admin'])
    or (public.has_any_role(array['director']) and public.user_has_page_access('dashboard'))
  );

create or replace function public.guard_director_overtime_approval()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.has_any_role(array['director']) and not public.has_any_role(array['admin']) then
    if (to_jsonb(new) - array['approval_status','approved_by','approved_at','updated_at']) is distinct from
       (to_jsonb(old) - array['approval_status','approved_by','approved_at','updated_at']) then
      raise exception 'Directors may change only overtime approval fields.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_director_overtime_approval on public.overtime_entries;
create trigger guard_director_overtime_approval
  before update on public.overtime_entries
  for each row execute function public.guard_director_overtime_approval();
revoke all on function public.guard_director_overtime_approval() from public, anon, authenticated;
