-- Let users manage their own leave requests and edit their own mining reports
-- for 24 hours after submission. Admin access stays unchanged.

-- Leave owners may update request details without changing approval status,
-- and may delete their own request. Existing Admin/Director approval policies
-- remain in place.
drop policy if exists leave_update_owner on public.leave_requests;
create policy leave_update_owner on public.leave_requests
  for update to authenticated
  using (
    public.user_has_page_access('leave')
    and submitted_by = (select auth.uid())
    and status = 'Pending'
  )
  with check (
    public.user_has_page_access('leave')
    and submitted_by = (select auth.uid())
    and status = 'Pending'
  );

drop policy if exists leave_delete_owner on public.leave_requests;
create policy leave_delete_owner on public.leave_requests
  for delete to authenticated
  using (
    public.user_has_page_access('leave')
    and submitted_by = (select auth.uid())
    and status = 'Pending'
  );

create or replace function public.guard_owner_leave_edit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.has_any_role(array['admin']) then
    return new;
  end if;

  if public.has_any_role(array['director']) then
    if old.submitted_by = (select auth.uid()) then
      if old.status <> 'Pending'
        or new.status is distinct from old.status
        or (to_jsonb(new) - array['employee_id','leave_type','start_date','end_date','reason','updated_at'])
          is distinct from
           (to_jsonb(old) - array['employee_id','leave_type','start_date','end_date','reason','updated_at']) then
        raise exception 'You may edit your own leave details, but cannot approve your own request.' using errcode = '42501';
      end if;
    elsif (to_jsonb(new) - array['status','reviewed_by','updated_at'])
        is distinct from
          (to_jsonb(old) - array['status','reviewed_by','updated_at']) then
      raise exception 'Directors may change only a leave approval status.' using errcode = '42501';
    end if;
    if new.status not in ('Pending','Approved','Rejected') then
      raise exception 'Directors may set leave status to Pending, Approved, or Rejected.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.submitted_by is distinct from (select auth.uid())
    or old.status <> 'Pending'
    or new.status is distinct from old.status
    or (to_jsonb(new) - array['employee_id','leave_type','start_date','end_date','reason','updated_at'])
      is distinct from
       (to_jsonb(old) - array['employee_id','leave_type','start_date','end_date','reason','updated_at']) then
    raise exception 'You may edit only your own leave details and cannot change its approval status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_owner_leave_edit on public.leave_requests;
drop trigger if exists guard_director_leave_approval on public.leave_requests;
create trigger guard_owner_leave_edit
  before update on public.leave_requests
  for each row execute function public.guard_owner_leave_edit();
revoke all on function public.guard_owner_leave_edit() from public, anon, authenticated;

-- Mine Mate/Foreman (or any user granted Mining Report) may edit a report
-- they submitted while it is less than 24 hours old. Report deletion remains
-- Admin-only.
drop policy if exists mining_reports_update_owner_24h on public.mining_reports;
create policy mining_reports_update_owner_24h on public.mining_reports
  for update to authenticated
  using (
    public.user_has_page_access('mining_report')
    and reporter_id = (select auth.uid())
    and created_at > now() - interval '24 hours'
  )
  with check (
    public.user_has_page_access('mining_report')
    and reporter_id = (select auth.uid())
    and created_at > now() - interval '24 hours'
  );

create or replace function public.guard_owner_mining_report_edit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.has_any_role(array['admin']) then
    return new;
  end if;
  if old.reporter_id is distinct from (select auth.uid())
    or old.created_at <= now() - interval '24 hours'
    or old.created_at > now()
    or new.reporter_id is distinct from old.reporter_id
    or new.created_at is distinct from old.created_at
    or new.reporter_name is distinct from old.reporter_name then
    raise exception 'Only the report author may edit a report within 24 hours of submission.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_owner_mining_report_edit on public.mining_reports;
create trigger guard_owner_mining_report_edit
  before update on public.mining_reports
  for each row execute function public.guard_owner_mining_report_edit();
revoke all on function public.guard_owner_mining_report_edit() from public, anon, authenticated;
