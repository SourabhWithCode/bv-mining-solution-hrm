-- Apply after supabase-schema.sql. Safe to re-run.

alter table public.ppe_items
  add column if not exists category text not null default 'PPE';

create table if not exists public.overtime_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  reason text not null default '',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists overtime_entries_work_date_idx
  on public.overtime_entries(work_date);

alter table public.overtime_entries enable row level security;
revoke all on public.overtime_entries from anon, authenticated;
grant select, insert, update, delete on public.overtime_entries to authenticated;

drop policy if exists "overtime read authenticated roles" on public.overtime_entries;
create policy "overtime read authenticated roles" on public.overtime_entries
  for select to authenticated
  using (public.has_any_role(array['admin', 'hr', 'supervisor', 'viewer']));

drop policy if exists "overtime manage by HR or supervisor" on public.overtime_entries;
create policy "overtime manage by HR or supervisor" on public.overtime_entries
  for all to authenticated
  using (public.has_any_role(array['admin', 'hr', 'supervisor']))
  with check (public.has_any_role(array['admin', 'hr', 'supervisor']));
