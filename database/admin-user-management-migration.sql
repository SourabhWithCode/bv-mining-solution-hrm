-- Server-side admin-manage-user Edge Function uses the service role to update
-- profiles and delete Auth users. Never expose the service role in browser code.
grant select, update, delete on public.user_profiles to service_role;
