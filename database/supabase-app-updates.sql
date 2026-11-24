-- Apply after supabase-schema.sql. Safe to re-run.

alter table public.ppe_items
  add column if not exists category text not null default 'PPE';
alter table public.ppe_items
  add column if not exists minimum_stock integer not null default 0 check (minimum_stock >= 0);

create table if not exists public.overtime_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  reason text not null default '',
  approval_status text not null default 'Pending',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

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

create index if not exists overtime_entries_work_date_idx
  on public.overtime_entries(work_date);

alter table public.overtime_entries enable row level security;
revoke all on public.overtime_entries from anon, authenticated;
grant select, insert, update, delete on public.overtime_entries to authenticated;

drop policy if exists "overtime read authenticated roles" on public.overtime_entries;
create policy "overtime read authenticated roles" on public.overtime_entries
  for select to authenticated
  using (public.has_any_role(array['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']));

drop policy if exists "overtime manage by HR or supervisor" on public.overtime_entries;
create policy "overtime manage by HR or supervisor" on public.overtime_entries
  for insert to authenticated with check (
    public.has_any_role(array['admin'])
    or (
      public.has_any_role(array['mine_mate','foreman'])
      and approval_status = 'Pending'
      and approved_by is null
      and approved_at is null
    )
  );
drop policy if exists "overtime update by admin" on public.overtime_entries;
create policy "overtime update by admin" on public.overtime_entries
  for update to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
drop policy if exists "overtime delete by admin" on public.overtime_entries;
create policy "overtime delete by admin" on public.overtime_entries
  for delete to authenticated using (public.has_any_role(array['admin']));
