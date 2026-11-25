-- Accounting access is limited to Admin, HR, Accountant, and Director accounts.
update public.user_profiles
set page_access = coalesce(page_access, '{}'::jsonb) || '{"accounting": true}'::jsonb
where role in ('admin','hr','accountant','director')
  and not (coalesce(page_access, '{}'::jsonb) ? 'accounting');

create or replace function public.user_has_accounting_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','hr','accountant','director')
      and (p.role = 'admin' or p.page_access ->> 'accounting' = 'true')
  );
$$;

create or replace function public.user_can_manage_accounting()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','accountant')
      and (p.role = 'admin' or p.page_access ->> 'accounting' = 'true')
  );
$$;
revoke all on function public.user_has_accounting_access() from public, anon;
revoke all on function public.user_can_manage_accounting() from public, anon;
grant execute on function public.user_has_accounting_access() to authenticated;
grant execute on function public.user_can_manage_accounting() to authenticated;

create table if not exists public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  account_type text not null check (account_type in ('cash','bank')),
  bank_name text,
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  opening_balance_date date not null default current_date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint accounting_account_name_nonempty check (length(trim(account_name)) > 0)
);
create unique index if not exists accounting_accounts_name_lower_idx on public.accounting_accounts (lower(account_name));
alter table public.accounting_accounts add column if not exists opening_balance_date date not null default current_date;

create table if not exists public.accounting_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('income','expense','transfer')),
  transaction_date date not null default current_date,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_status text not null check (payment_status in ('received','paid','pending','completed')),
  source_account_id uuid references public.accounting_accounts(id) on delete restrict,
  destination_account_id uuid references public.accounting_accounts(id) on delete restrict,
  party_name text not null default '',
  reference_number text not null default '',
  description text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_transaction_shape check (
    (transaction_type = 'income' and payment_status in ('received','pending') and source_account_id is null and destination_account_id is not null)
    or (transaction_type = 'expense' and payment_status in ('paid','pending') and source_account_id is not null and destination_account_id is null)
    or (transaction_type = 'transfer' and payment_status = 'completed' and source_account_id is not null and destination_account_id is not null and source_account_id <> destination_account_id)
  ),
  constraint accounting_category_nonempty check (length(trim(category)) > 0)
);
create index if not exists accounting_transactions_date_idx on public.accounting_transactions(transaction_date desc);
create index if not exists accounting_transactions_type_status_idx on public.accounting_transactions(transaction_type, payment_status);

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  employee_name text not null,
  pay_period date not null,
  basic_pay numeric(14,2) not null default 0 check (basic_pay >= 0),
  overtime_pay numeric(14,2) not null default 0 check (overtime_pay >= 0),
  allowances numeric(14,2) not null default 0 check (allowances >= 0),
  deductions numeric(14,2) not null default 0 check (deductions >= 0),
  net_salary numeric(14,2) generated always as (basic_pay + overtime_pay + allowances - deductions) stored,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  paid_at date,
  payment_account_id uuid references public.accounting_accounts(id) on delete restrict,
  remarks text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_period_month_start check (extract(day from pay_period) = 1),
  constraint payroll_nonnegative_net check (basic_pay + overtime_pay + allowances >= deductions),
  constraint payroll_paid_details check (
    (payment_status = 'pending' and paid_at is null and payment_account_id is null)
    or (payment_status = 'paid' and paid_at is not null and payment_account_id is not null)
  ),
  unique(employee_id, pay_period)
);
create index if not exists payroll_records_period_idx on public.payroll_records(pay_period desc);
create index if not exists payroll_records_status_idx on public.payroll_records(payment_status, pay_period desc);

alter table public.accounting_accounts enable row level security;
alter table public.accounting_transactions enable row level security;
alter table public.payroll_records enable row level security;
revoke all on public.accounting_accounts, public.accounting_transactions, public.payroll_records from anon, authenticated;
grant select, insert, update, delete on public.accounting_accounts, public.accounting_transactions, public.payroll_records to authenticated;

drop policy if exists accounting_accounts_read on public.accounting_accounts;
create policy accounting_accounts_read on public.accounting_accounts for select to authenticated
  using (public.user_has_accounting_access());
drop policy if exists accounting_accounts_insert on public.accounting_accounts;
create policy accounting_accounts_insert on public.accounting_accounts for insert to authenticated
  with check (public.user_can_manage_accounting() and created_by = (select auth.uid()));
drop policy if exists accounting_accounts_update on public.accounting_accounts;
create policy accounting_accounts_update on public.accounting_accounts for update to authenticated
  using (public.user_can_manage_accounting()) with check (public.user_can_manage_accounting());
drop policy if exists accounting_accounts_delete on public.accounting_accounts;
create policy accounting_accounts_delete on public.accounting_accounts for delete to authenticated
  using (public.user_can_manage_accounting());

drop policy if exists accounting_transactions_read on public.accounting_transactions;
create policy accounting_transactions_read on public.accounting_transactions for select to authenticated
  using (public.user_has_accounting_access());
drop policy if exists accounting_transactions_insert on public.accounting_transactions;
create policy accounting_transactions_insert on public.accounting_transactions for insert to authenticated
  with check (public.user_can_manage_accounting() and created_by = (select auth.uid()));
drop policy if exists accounting_transactions_update on public.accounting_transactions;
create policy accounting_transactions_update on public.accounting_transactions for update to authenticated
  using (public.user_can_manage_accounting()) with check (public.user_can_manage_accounting());
drop policy if exists accounting_transactions_delete on public.accounting_transactions;
create policy accounting_transactions_delete on public.accounting_transactions for delete to authenticated
  using (public.user_can_manage_accounting());

drop policy if exists payroll_records_read on public.payroll_records;
create policy payroll_records_read on public.payroll_records for select to authenticated
  using (public.user_has_accounting_access());
drop policy if exists payroll_records_insert on public.payroll_records;
create policy payroll_records_insert on public.payroll_records for insert to authenticated
  with check (public.user_can_manage_accounting() and created_by = (select auth.uid()));
drop policy if exists payroll_records_update on public.payroll_records;
create policy payroll_records_update on public.payroll_records for update to authenticated
  using (public.user_can_manage_accounting()) with check (public.user_can_manage_accounting());
drop policy if exists payroll_records_delete on public.payroll_records;
create policy payroll_records_delete on public.payroll_records for delete to authenticated
  using (public.user_can_manage_accounting());

-- Include accounting entries in the existing admin-only audit history.
drop trigger if exists accounting_accounts_audit on public.accounting_accounts;
create trigger accounting_accounts_audit after insert or update or delete on public.accounting_accounts
  for each row execute function public.capture_audit_event();
drop trigger if exists accounting_transactions_audit on public.accounting_transactions;
create trigger accounting_transactions_audit after insert or update or delete on public.accounting_transactions
  for each row execute function public.capture_audit_event();
drop trigger if exists payroll_records_audit on public.payroll_records;
create trigger payroll_records_audit after insert or update or delete on public.payroll_records
  for each row execute function public.capture_audit_event();

