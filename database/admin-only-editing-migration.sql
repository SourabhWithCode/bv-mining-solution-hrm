-- New records can still be created by the same working roles as before.
-- Only Admin can update or delete any saved application record.

drop policy if exists "shifts read authenticated roles" on public.shift_assignments;
create policy "shifts read authenticated roles" on public.shift_assignments for select to authenticated
  using (public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']));
drop policy if exists "attendance read authenticated roles" on public.attendance;
create policy "attendance read authenticated roles" on public.attendance for select to authenticated
  using (public.has_any_role(array['admin','hr','mine_mate','foreman']));
drop policy if exists "leave read HR or requester" on public.leave_requests;
create policy "leave read HR or requester" on public.leave_requests for select to authenticated
  using (public.has_any_role(array['admin']) or submitted_by = (select auth.uid()));
drop policy if exists "PPE items read authenticated roles" on public.ppe_items;
create policy "PPE items read authenticated roles" on public.ppe_items for select to authenticated
  using (public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']));
drop policy if exists "PPE issues read authenticated roles" on public.ppe_issues;
create policy "PPE issues read authenticated roles" on public.ppe_issues for select to authenticated
  using (public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']));
drop policy if exists "PPE movements read authenticated roles" on public.ppe_stock_movements;
create policy "PPE movements read authenticated roles" on public.ppe_stock_movements for select to authenticated
  using (public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']));
drop policy if exists "overtime read authenticated roles" on public.overtime_entries;
create policy "overtime read authenticated roles" on public.overtime_entries for select to authenticated
  using (public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']));

drop policy if exists "employees manage by HR" on public.employees;
drop policy if exists employees_manage on public.employees;
drop policy if exists employees_admin_manage on public.employees;
drop policy if exists employees_insert on public.employees;
drop policy if exists employees_update on public.employees;
drop policy if exists employees_delete on public.employees;
drop policy if exists "employees update by admin" on public.employees;
drop policy if exists "employees delete by admin" on public.employees;
create policy employees_insert on public.employees for insert to authenticated
  with check (public.has_any_role(array['admin','hr']));
create policy employees_update on public.employees for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy employees_delete on public.employees for delete to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "shifts manage by HR or supervisor" on public.shift_assignments;
drop policy if exists shifts_manage on public.shift_assignments;
drop policy if exists shifts_admin_manage on public.shift_assignments;
drop policy if exists shifts_insert on public.shift_assignments;
drop policy if exists shifts_update on public.shift_assignments;
drop policy if exists shifts_delete on public.shift_assignments;
drop policy if exists "shifts update by admin" on public.shift_assignments;
drop policy if exists "shifts delete by admin" on public.shift_assignments;
create policy shifts_insert on public.shift_assignments for insert to authenticated
  with check (public.has_any_role(array['admin','mine_mate','foreman']));
create policy shifts_update on public.shift_assignments for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy shifts_delete on public.shift_assignments for delete to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "attendance manage by HR or supervisor" on public.attendance;
drop policy if exists attendance_manage on public.attendance;
drop policy if exists attendance_admin_manage on public.attendance;
drop policy if exists attendance_insert on public.attendance;
drop policy if exists attendance_update on public.attendance;
drop policy if exists attendance_delete on public.attendance;
drop policy if exists "attendance update by admin" on public.attendance;
drop policy if exists "attendance delete by admin" on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
  with check (public.has_any_role(array['admin','hr','mine_mate','foreman']));
create policy attendance_update on public.attendance for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy attendance_delete on public.attendance for delete to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "leave submit authenticated" on public.leave_requests;
drop policy if exists "leave review by HR" on public.leave_requests;
drop policy if exists "leave delete by HR" on public.leave_requests;
drop policy if exists leave_insert on public.leave_requests;
drop policy if exists leave_update on public.leave_requests;
drop policy if exists leave_delete on public.leave_requests;
drop policy if exists leave_admin_manage on public.leave_requests;
drop policy if exists "leave review by HR" on public.leave_requests;
drop policy if exists "leave delete by HR" on public.leave_requests;
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']));
create policy leave_update on public.leave_requests for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy leave_delete on public.leave_requests for delete to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "PPE items manage by HR" on public.ppe_items;
drop policy if exists ppe_items_manage on public.ppe_items;
drop policy if exists ppe_items_admin_manage on public.ppe_items;
drop policy if exists ppe_items_insert on public.ppe_items;
drop policy if exists ppe_items_update on public.ppe_items;
drop policy if exists ppe_items_delete on public.ppe_items;
drop policy if exists "PPE items update by admin" on public.ppe_items;
drop policy if exists "PPE items delete by admin" on public.ppe_items;
create policy ppe_items_insert on public.ppe_items for insert to authenticated
  with check (public.has_any_role(array['admin','store']));
create policy ppe_items_update on public.ppe_items for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy ppe_items_delete on public.ppe_items for delete to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "PPE issues manage by HR" on public.ppe_issues;
drop policy if exists ppe_issues_manage on public.ppe_issues;
drop policy if exists ppe_issues_admin_manage on public.ppe_issues;
drop policy if exists ppe_issues_insert on public.ppe_issues;
drop policy if exists ppe_issues_update on public.ppe_issues;
drop policy if exists ppe_issues_delete on public.ppe_issues;
drop policy if exists "PPE issues update by admin" on public.ppe_issues;
drop policy if exists "PPE issues delete by admin" on public.ppe_issues;
create policy ppe_issues_insert on public.ppe_issues for insert to authenticated
  with check (public.has_any_role(array['admin','store']));
create policy ppe_issues_update on public.ppe_issues for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy ppe_issues_delete on public.ppe_issues for delete to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "PPE movements manage by HR" on public.ppe_stock_movements;
drop policy if exists ppe_movements_manage on public.ppe_stock_movements;
drop policy if exists ppe_movements_admin_manage on public.ppe_stock_movements;
drop policy if exists ppe_movements_insert on public.ppe_stock_movements;
drop policy if exists ppe_movements_update on public.ppe_stock_movements;
drop policy if exists ppe_movements_delete on public.ppe_stock_movements;
drop policy if exists "PPE movements update by admin" on public.ppe_stock_movements;
drop policy if exists "PPE movements delete by admin" on public.ppe_stock_movements;
create policy ppe_movements_insert on public.ppe_stock_movements for insert to authenticated
  with check (public.has_any_role(array['admin','store']));
create policy ppe_movements_update on public.ppe_stock_movements for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy ppe_movements_delete on public.ppe_stock_movements for delete to authenticated
  using (public.has_any_role(array['admin']));

drop policy if exists "overtime manage by HR or supervisor" on public.overtime_entries;
drop policy if exists overtime_manage on public.overtime_entries;
drop policy if exists overtime_admin_manage on public.overtime_entries;
drop policy if exists overtime_insert on public.overtime_entries;
drop policy if exists overtime_update on public.overtime_entries;
drop policy if exists overtime_delete on public.overtime_entries;
drop policy if exists "overtime update by admin" on public.overtime_entries;
drop policy if exists "overtime delete by admin" on public.overtime_entries;
create policy overtime_insert on public.overtime_entries for insert to authenticated
  with check (public.has_any_role(array['admin','mine_mate','foreman']));
create policy overtime_update on public.overtime_entries for update to authenticated
  using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
create policy overtime_delete on public.overtime_entries for delete to authenticated
  using (public.has_any_role(array['admin']));
