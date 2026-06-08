create schema if not exists course;

create extension if not exists pgcrypto;

create table if not exists course.course_review (
  id text primary key,
  author_id uuid not null,
  author_name text not null default 'Learner',
  course_id text not null default '',
  level_id text not null default '',
  lesson_id text not null default '',
  course_title text not null default '',
  level_title text not null default '',
  lesson_title text not null default '',
  rating integer not null check (rating between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists course_review_author_lesson_uidx
  on course.course_review (author_id, course_id, level_id, lesson_id);

create table if not exists course.course_assessment_submission (
  id text primary key,
  result_id text not null default '',
  author_id uuid not null,
  author_name text not null default 'Learner',
  library_id text not null default '',
  course_id text not null default '',
  level_id text not null default '',
  lesson_id text not null default '',
  assessment_id text not null default '',
  assessment_version text not null default 'v1',
  course_title text not null default '',
  level_title text not null default '',
  lesson_title text not null default '',
  status text not null default 'pending' check (status in ('pending', 'graded')),
  objective_correct integer not null default 0,
  objective_total integer not null default 0,
  score_total integer not null default 0,
  passing_score integer not null default 0,
  score_earned integer,
  pending_essay_count integer not null default 0,
  submitted_at timestamptz not null default timezone('utc', now()),
  graded_at timestamptz,
  graded_by text not null default '',
  essay_responses jsonb not null default '[]'::jsonb,
  review_notes text not null default ''
);

create index if not exists course_assessment_submission_author_idx
  on course.course_assessment_submission (author_id, submitted_at desc);

create index if not exists course_assessment_submission_status_idx
  on course.course_assessment_submission (status, submitted_at desc);

create table if not exists course.course_forum_post (
  id text primary key,
  author_id uuid not null,
  author_name text not null default 'Learner',
  type text not null default 'discussion',
  course_id text not null default 'all',
  course_title text not null default '',
  title text not null default '',
  body text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by text not null default ''
);

create index if not exists course_forum_post_status_idx
  on course.course_forum_post (status, submitted_at desc);

create table if not exists course.course_forum_reply (
  id text primary key,
  post_id text not null references course.course_forum_post(id) on delete cascade,
  parent_reply_id text references course.course_forum_reply(id) on delete cascade,
  author_id uuid not null,
  author_name text not null default 'Learner',
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists course_forum_reply_post_idx
  on course.course_forum_reply (post_id, created_at asc);

create table if not exists course.course_forum_post_like (
  post_id text not null references course.course_forum_post(id) on delete cascade,
  actor_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, actor_id)
);

create table if not exists course.course_forum_reply_like (
  reply_id text not null references course.course_forum_reply(id) on delete cascade,
  actor_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (reply_id, actor_id)
);

create table if not exists course.course_lesson_progress (
  id text primary key,
  learner_id uuid not null,
  course_id text not null default '',
  level_id text not null default '',
  lesson_id text not null default '',
  course_title text not null default '',
  level_title text not null default '',
  lesson_title text not null default '',
  total_slides integer not null default 0,
  current_slide_index integer not null default 0,
  max_slide_reached integer not null default 0,
  viewed_slides jsonb not null default '[]'::jsonb,
  progress_percent integer not null default 0,
  started_at timestamptz,
  last_visited_at timestamptz,
  completed_at timestamptz,
  time_spent_ms bigint not null default 0,
  session_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists course_lesson_progress_learner_lesson_uidx
  on course.course_lesson_progress (learner_id, course_id, level_id, lesson_id);

create table if not exists course.course_schedule_session (
  id text primary key,
  learner_id uuid not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null default 60,
  course_id text not null default '',
  level_id text not null default '',
  lesson_id text not null default '',
  course_title text not null default '',
  level_title text not null default '',
  lesson_title text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists course_schedule_session_learner_date_idx
  on course.course_schedule_session (learner_id, date asc, start_time asc);

grant usage on schema course to authenticated;
grant select, insert, update, delete on course.course_review to authenticated;
grant select, insert, update, delete on course.course_assessment_submission to authenticated;
grant select, insert, update, delete on course.course_forum_post to authenticated;
grant select, insert, update, delete on course.course_forum_reply to authenticated;
grant select, insert, update, delete on course.course_forum_post_like to authenticated;
grant select, insert, update, delete on course.course_forum_reply_like to authenticated;
grant select, insert, update, delete on course.course_lesson_progress to authenticated;
grant select, insert, update, delete on course.course_schedule_session to authenticated;

alter table course.course_review enable row level security;
alter table course.course_assessment_submission enable row level security;
alter table course.course_forum_post enable row level security;
alter table course.course_forum_reply enable row level security;
alter table course.course_forum_post_like enable row level security;
alter table course.course_forum_reply_like enable row level security;
alter table course.course_lesson_progress enable row level security;
alter table course.course_schedule_session enable row level security;

do $$
begin
  create policy "course_admins_manage_reviews"
  on course.course_review
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
  create policy "authenticated users read reviews"
  on course.course_review
  for select
  to authenticated
  using (true);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_insert_own_reviews"
  on course.course_review
  for insert
  to authenticated
  with check (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_update_own_reviews"
  on course.course_review
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_delete_own_reviews"
  on course.course_review
  for delete
  to authenticated
  using (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_assessment_submissions"
  on course.course_assessment_submission
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
  create policy "learners_view_own_assessment_submissions"
  on course.course_assessment_submission
  for select
  to authenticated
  using (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "learners_insert_own_assessment_submissions"
  on course.course_assessment_submission
  for insert
  to authenticated
  with check (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_forum_posts"
  on course.course_forum_post
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
  create policy "authenticated users read visible forum posts"
  on course.course_forum_post
  for select
  to authenticated
  using (
    status = 'approved'
    or author_id = auth.uid()
    or exists (
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
  create policy "authenticated users insert own forum posts"
  on course.course_forum_post
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1
        from public.admin
        where public.admin.id = auth.uid()
      )
      or status = 'pending'
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authors_update_own_forum_posts"
  on course.course_forum_post
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1
        from public.admin
        where public.admin.id = auth.uid()
      )
      or status = 'pending'
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authors_delete_own_forum_posts"
  on course.course_forum_post
  for delete
  to authenticated
  using (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_forum_replies"
  on course.course_forum_reply
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
  create policy "authenticated users read visible forum replies"
  on course.course_forum_reply
  for select
  to authenticated
  using (
    exists (
      select 1
      from course.course_forum_post
      where course.course_forum_post.id = post_id
        and (
          course.course_forum_post.status = 'approved'
          or course.course_forum_post.author_id = auth.uid()
          or exists (
            select 1
            from public.admin
            where public.admin.id = auth.uid()
          )
        )
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authenticated users insert own forum replies"
  on course.course_forum_reply
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from course.course_forum_post
      where course.course_forum_post.id = post_id
        and (
          course.course_forum_post.status = 'approved'
          or course.course_forum_post.author_id = auth.uid()
          or exists (
            select 1
            from public.admin
            where public.admin.id = auth.uid()
          )
        )
    )
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authors_update_own_forum_replies"
  on course.course_forum_reply
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authors_delete_own_forum_replies"
  on course.course_forum_reply
  for delete
  to authenticated
  using (author_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authenticated users read forum post likes"
  on course.course_forum_post_like
  for select
  to authenticated
  using (true);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authenticated users manage own forum post likes"
  on course.course_forum_post_like
  for all
  to authenticated
  using (actor_id = auth.uid())
  with check (actor_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authenticated users read forum reply likes"
  on course.course_forum_reply_like
  for select
  to authenticated
  using (true);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "authenticated users manage own forum reply likes"
  on course.course_forum_reply_like
  for all
  to authenticated
  using (actor_id = auth.uid())
  with check (actor_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_lesson_progress"
  on course.course_lesson_progress
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
  create policy "learners_manage_own_lesson_progress"
  on course.course_lesson_progress
  for all
  to authenticated
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_schedule_sessions"
  on course.course_schedule_session
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
  create policy "learners_manage_own_schedule_sessions"
  on course.course_schedule_session
  for all
  to authenticated
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid());
exception
  when duplicate_object then null;
end
$$;
