-- Adds display names for the admin-only account directory.
alter table public.user_profiles
  add column if not exists full_name text not null default '';
alter table public.user_profiles
  add column if not exists designation text not null default '';

-- Edge Function uses the server-only service role to save new user profiles.
grant select, insert, update on public.user_profiles to service_role;

update public.user_profiles p
set full_name = coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), p.email)
from auth.users u
where p.id = u.id and p.full_name = '';

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
