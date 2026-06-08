-- Allow admins to set the matching fee inside the existing payment credentials row
-- and review matching payment requests.
-- Allow customers to create/read their own matching payment requests.
-- Allow customers to upload matching payment proof screenshots.
-- Run this in the Supabase SQL editor.

alter table public.simp_course_state enable row level security;

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

drop policy if exists "Admins can manage matching payment credentials"
on public.simp_course_state;

create policy "Admins can manage matching payment credentials"
on public.simp_course_state
for all
to authenticated
using (
  owner_key = 'global:payment-settings'
  and state_key in ('credentials', 'password')
  and public.is_approved_admin(auth.uid())
)
with check (
  owner_key = 'global:payment-settings'
  and state_key in ('credentials', 'password')
  and public.is_approved_admin(auth.uid())
);

drop policy if exists "Admins can read matching payment requests"
on public.simp_course_state;

create policy "Admins can read matching payment requests"
on public.simp_course_state
for select
to authenticated
using (
  state_key = 'matchingPaymentRequests'
  and public.is_approved_admin(auth.uid())
);

drop policy if exists "Admins can update matching payment requests"
on public.simp_course_state;

create policy "Admins can update matching payment requests"
on public.simp_course_state
for update
to authenticated
using (
  state_key = 'matchingPaymentRequests'
  and public.is_approved_admin(auth.uid())
)
with check (
  state_key = 'matchingPaymentRequests'
  and public.is_approved_admin(auth.uid())
);

drop policy if exists "Customers can manage own matching payment requests"
on public.simp_course_state;

create policy "Customers can manage own matching payment requests"
on public.simp_course_state
for all
to authenticated
using (
  owner_key = ('user:' || auth.uid()::text)
  and state_key = 'matchingPaymentRequests'
)
with check (
  owner_key = ('user:' || auth.uid()::text)
  and state_key = 'matchingPaymentRequests'
);

drop policy if exists "Customers can read payment credentials for matching"
on public.simp_course_state;

create policy "Customers can read payment credentials for matching"
on public.simp_course_state
for select
to authenticated
using (
  owner_key = 'global:payment-settings'
  and state_key = 'credentials'
);

drop policy if exists "Customers can upload own matching payment receipts"
on storage.objects;

create policy "Customers can upload own matching payment receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents_review'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'matching_receipts'
);

drop policy if exists "Customers can replace own matching payment receipts"
on storage.objects;

create policy "Customers can replace own matching payment receipts"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents_review'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'matching_receipts'
)
with check (
  bucket_id = 'documents_review'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'matching_receipts'
);

drop policy if exists "Customers can read own matching payment receipts"
on storage.objects;

create policy "Customers can read own matching payment receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents_review'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'matching_receipts'
);

drop policy if exists "Admins can read matching payment receipts"
on storage.objects;

create policy "Admins can read matching payment receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents_review'
  and (storage.foldername(name))[2] = 'matching_receipts'
  and public.is_approved_admin(auth.uid())
);
