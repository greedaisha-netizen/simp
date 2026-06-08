-- Allow approved admins to read/update job applications when a posted job
-- is returned to review and active applications must be invalidated.
-- Run this in the Supabase SQL editor.

create or replace function public.is_approved_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin a
    where a.id = user_id
      and lower(coalesce(a.role::text, '')) in ('admin', 'superadmin')
  );
$$;

grant execute on function public.is_approved_admin(uuid) to authenticated;

alter table jobs.job_application enable row level security;

drop policy if exists "Admins can read job applications"
on jobs.job_application;

create policy "Admins can read job applications"
on jobs.job_application
for select
to authenticated
using (
  public.is_approved_admin(auth.uid())
);

drop policy if exists "Admins can update job applications"
on jobs.job_application;

create policy "Admins can update job applications"
on jobs.job_application
for update
to authenticated
using (
  public.is_approved_admin(auth.uid())
)
with check (
  public.is_approved_admin(auth.uid())
);
