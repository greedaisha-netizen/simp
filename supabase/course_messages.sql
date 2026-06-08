create schema if not exists course;

create extension if not exists pgcrypto;

create table if not exists course.course_message_thread (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null unique,
  learner_name text not null default 'Learner',
  learner_email text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_message_at timestamptz not null default timezone('utc', now()),
  admin_last_read_at timestamptz,
  learner_last_read_at timestamptz
);

create table if not exists course.course_private_message (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references course.course_message_thread(id) on delete cascade,
  sender_role text not null check (sender_role in ('admin', 'learner')),
  author_id uuid not null,
  author_name text not null,
  body text not null,
  reply_to_message_id uuid references course.course_private_message(id) on delete set null,
  lesson_context jsonb,
  review_context jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz
);

create index if not exists course_message_thread_last_message_idx
  on course.course_message_thread (last_message_at desc);

create index if not exists course_private_message_thread_created_idx
  on course.course_private_message (thread_id, created_at asc);

grant usage on schema course to authenticated;
grant select, insert, update, delete on course.course_message_thread to authenticated;
grant select, insert, update, delete on course.course_private_message to authenticated;

alter table course.course_message_thread enable row level security;
alter table course.course_private_message enable row level security;

do $$
begin
  create policy "course_admins_manage_message_threads"
  on course.course_message_thread
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.admin
      where public.admin.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin
      where public.admin.id = auth.uid()
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_view_own_message_thread"
  on course.course_message_thread
  for select
  to authenticated
  using (learner_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_insert_own_message_thread"
  on course.course_message_thread
  for insert
  to authenticated
  with check (learner_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_update_own_message_thread"
  on course.course_message_thread
  for update
  to authenticated
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_private_messages"
  on course.course_private_message
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.admin
      where public.admin.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin
      where public.admin.id = auth.uid()
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_view_own_private_messages"
  on course.course_private_message
  for select
  to authenticated
  using (
    exists (
      select 1
      from course.course_message_thread
      where course.course_message_thread.id = thread_id
        and course.course_message_thread.learner_id = auth.uid()
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_insert_own_private_messages"
  on course.course_private_message
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from course.course_message_thread
      where course.course_message_thread.id = thread_id
        and course.course_message_thread.learner_id = auth.uid()
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_update_own_private_messages"
  on course.course_private_message
  for update
  to authenticated
  using (
    author_id = auth.uid()
    and sender_role = 'learner'
    and exists (
      select 1
      from course.course_message_thread
      where course.course_message_thread.id = thread_id
        and course.course_message_thread.learner_id = auth.uid()
    )
  )
  with check (
    author_id = auth.uid()
    and sender_role = 'learner'
    and exists (
      select 1
      from course.course_message_thread
      where course.course_message_thread.id = thread_id
        and course.course_message_thread.learner_id = auth.uid()
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_delete_own_private_messages"
  on course.course_private_message
  for delete
  to authenticated
  using (
    author_id = auth.uid()
    and sender_role = 'learner'
    and exists (
      select 1
      from course.course_message_thread
      where course.course_message_thread.id = thread_id
        and course.course_message_thread.learner_id = auth.uid()
    )
  );
exception
  when duplicate_object then null;
end
$$;
