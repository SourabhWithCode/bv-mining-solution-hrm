-- Run once on an existing project to support deleting an auto-marked attendance
-- entry without having the assigned shift recreate it on the next page load.
alter table public.attendance alter column status drop not null;
