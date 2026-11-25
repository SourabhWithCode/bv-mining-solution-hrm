create table if not exists public.active_device_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.active_device_sessions enable row level security;
revoke all on table public.active_device_sessions from anon, authenticated;

drop policy if exists active_device_sessions_no_direct_access on public.active_device_sessions;

create or replace function public.claim_active_device_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_session_id is null then
    raise exception 'Device session id is required';
  end if;

  insert into public.active_device_sessions(user_id, session_id, updated_at)
  values (auth.uid(), p_session_id, now())
  on conflict (user_id) do update
    set session_id = excluded.session_id,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.is_active_device_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.active_device_sessions s
    where s.user_id = auth.uid()
      and s.session_id = p_session_id
  );
$$;

create or replace function public.release_active_device_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.active_device_sessions s
  where s.user_id = auth.uid()
    and s.session_id = p_session_id;
$$;

revoke all on function public.claim_active_device_session(uuid) from public, anon;
revoke all on function public.is_active_device_session(uuid) from public, anon;
revoke all on function public.release_active_device_session(uuid) from public, anon;
grant execute on function public.claim_active_device_session(uuid) to authenticated;
grant execute on function public.is_active_device_session(uuid) to authenticated;
grant execute on function public.release_active_device_session(uuid) to authenticated;
