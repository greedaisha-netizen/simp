create table if not exists public.simp_course_state (
  owner_key text not null,
  state_key text not null,
  state_value text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_key, state_key)
);

alter table public.simp_course_state enable row level security;

-- SELECT policy (safe to run, uses duplicate exception handling)
do $$
begin
  create policy "authenticated users can read course cloud state"
  on public.simp_course_state
  for select
  to authenticated
  using (true);
exception
  when duplicate_object then null;
end
$$;

-- Drop write, update, and delete policies to ensure they are recreated with the new admin condition
drop policy if exists "authenticated users can write their own course cloud state" on public.simp_course_state;
drop policy if exists "authenticated users can update their own course cloud state" on public.simp_course_state;
drop policy if exists "authenticated users can delete their own course cloud state" on public.simp_course_state;

-- INSERT policy with admin bypass
create policy "authenticated users can write their own course cloud state"
on public.simp_course_state
for insert
to authenticated
with check (
  owner_key = concat('user:', auth.uid()::text)
  or owner_key = 'global:course-module'
  or exists (
    select 1 from public.admin
    where public.admin.id = auth.uid()
  )
);

-- UPDATE policy with admin bypass
create policy "authenticated users can update their own course cloud state"
on public.simp_course_state
for update
to authenticated
using (
  owner_key = concat('user:', auth.uid()::text)
  or owner_key = 'global:course-module'
  or exists (
    select 1 from public.admin
    where public.admin.id = auth.uid()
  )
)
with check (
  owner_key = concat('user:', auth.uid()::text)
  or owner_key = 'global:course-module'
  or exists (
    select 1 from public.admin
    where public.admin.id = auth.uid()
  )
);

-- DELETE policy with admin bypass
create policy "authenticated users can delete their own course cloud state"
on public.simp_course_state
for delete
to authenticated
using (
  owner_key = concat('user:', auth.uid()::text)
  or owner_key = 'global:course-module'
  or exists (
    select 1 from public.admin
    where public.admin.id = auth.uid()
  )
);

