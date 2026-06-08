-- Allow approved admins to read customer contact/profile rows for job review.
-- Run this in the Supabase SQL editor.

alter table public.customer enable row level security;

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

drop policy if exists "Admins can read customer contact profiles"
on public.customer;

create policy "Admins can read customer contact profiles"
on public.customer
for select
to authenticated
using (
  public.is_approved_admin(auth.uid())
);
