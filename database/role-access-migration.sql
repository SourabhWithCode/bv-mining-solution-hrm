-- Add BV Mining Solution's role set and safely map the older roles.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;

update public.user_profiles
set role = case role
  when 'supervisor' then 'foreman'
  when 'viewer' then 'accountant'
  else role
end
where role in ('supervisor','viewer');

alter table public.user_profiles alter column role set default 'accountant';
alter table public.user_profiles add constraint user_profiles_role_check
  check (role in ('admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager'));

-- Keep newly provisioned Auth users valid under the new role constraint.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, designation, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), ''),
    coalesce(nullif(new.raw_user_meta_data->>'designation',''), ''),
    'accountant'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when excluded.full_name <> '' then excluded.full_name else public.user_profiles.full_name end,
        designation = case when excluded.designation <> '' then excluded.designation else public.user_profiles.designation end;
  return new;
end;
$$;
