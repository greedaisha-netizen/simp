create schema if not exists course;

alter table if exists course.courses enable row level security;
alter table if exists course.sections enable row level security;
alter table if exists course.section_contents enable row level security;
alter table if exists course.quizzes enable row level security;
alter table if exists course.quiz_questions enable row level security;

do $$
begin
  create policy "course_admins_manage_courses"
  on course.courses
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
  create policy "published_courses_are_readable"
  on course.courses
  for select
  to authenticated, anon
  using (true);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_sections"
  on course.sections
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
  create policy "published_course_sections_are_readable"
  on course.sections
  for select
  to authenticated, anon
  using (true);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_section_contents"
  on course.section_contents
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
  create policy "published_course_section_contents_are_readable"
  on course.section_contents
  for select
  to authenticated, anon
  using (true);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_quizzes"
  on course.quizzes
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
  create policy "published_course_quizzes_are_readable"
  on course.quizzes
  for select
  to authenticated, anon
  using (true);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create policy "course_admins_manage_quiz_questions"
  on course.quiz_questions
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
  create policy "published_course_quiz_questions_are_readable"
  on course.quiz_questions
  for select
  to authenticated, anon
  using (true);
exception
  when duplicate_object then null;
end
$$;

grant usage on schema course to anon, authenticated;

grant select on course.courses to anon, authenticated;
grant select on course.sections to anon, authenticated;
grant select on course.section_contents to anon, authenticated;
grant select on course.quizzes to anon, authenticated;
grant select on course.quiz_questions to anon, authenticated;

grant all on course.courses to authenticated;
grant all on course.sections to authenticated;
grant all on course.section_contents to authenticated;
grant all on course.quizzes to authenticated;
grant all on course.quiz_questions to authenticated;
