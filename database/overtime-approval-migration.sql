-- Add admin-controlled overtime approvals. Run after supabase-app-updates.sql.

alter table public.overtime_entries
  add column if not exists approval_status text not null default 'Pending';
alter table public.overtime_entries
  add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.overtime_entries
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'overtime_entries_approval_status_check'
      and conrelid = 'public.overtime_entries'::regclass
  ) then
    alter table public.overtime_entries add constraint overtime_entries_approval_status_check
      check (approval_status in ('Pending','Approved','Rejected'));
  end if;
end;
$$;

alter table public.overtime_entries enable row level security;
revoke all on public.overtime_entries from anon, authenticated;
grant select, insert, update, delete on public.overtime_entries to authenticated;

drop policy if exists "overtime manage by HR or supervisor" on public.overtime_entries;
drop policy if exists overtime_manage on public.overtime_entries;
drop policy if exists overtime_admin_manage on public.overtime_entries;
drop policy if exists overtime_insert on public.overtime_entries;
create policy overtime_insert on public.overtime_entries for insert to authenticated
  with check (
    public.has_any_role(array['admin'])
    or (
      public.has_any_role(array['mine_mate','foreman'])
      and approval_status = 'Pending'
      and approved_by is null
      and approved_at is null
    )
  );

drop policy if exists "overtime update by admin" on public.overtime_entries;
drop policy if exists overtime_update on public.overtime_entries;
create policy overtime_update on public.overtime_entries for update to authenticated
  using (public.has_any_role(array['admin']))
  with check (public.has_any_role(array['admin']));

drop policy if exists "overtime delete by admin" on public.overtime_entries;
drop policy if exists overtime_delete on public.overtime_entries;
create policy overtime_delete on public.overtime_entries for delete to authenticated
  using (public.has_any_role(array['admin']));
