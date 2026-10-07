-- Customer job tracker reviews.
-- Run this in Supabase SQL editor before using the Job Tracker review button.

create schema if not exists jobs;

do $$
declare
  status_type regtype;
begin
  select a.atttypid::regtype
    into status_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'jobs'
    and c.relname = 'job'
    and a.attname = 'job_status'
    and not a.attisdropped
    and t.typtype = 'e';

  if status_type is not null and not exists (
    select 1
    from pg_enum
    where enumtypid = status_type::oid
      and enumlabel = 'unfinished'
  ) then
    execute format('alter type %s add value %L', status_type, 'unfinished');
  end if;
end $$;

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

create table if not exists jobs.installer_reviews (
  review_id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs.job(job_id) on delete cascade,
  application_id text,
  customer_id uuid not null,
  installer_id uuid not null references public.installer(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installer_reviews_one_per_job_installer_customer
    unique (job_id, installer_id, customer_id)
);

alter table jobs.installer_reviews enable row level security;

create or replace function jobs.touch_installer_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_installer_review_updated_at
on jobs.installer_reviews;

create trigger touch_installer_review_updated_at
before update on jobs.installer_reviews
for each row
execute function jobs.touch_installer_review_updated_at();

drop policy if exists "Customers can read reviews for their jobs"
on jobs.installer_reviews;

create policy "Customers can read reviews for their jobs"
on jobs.installer_reviews
for select
to authenticated
using (
  customer_id = auth.uid()
  or installer_id = auth.uid()
  or public.is_approved_admin(auth.uid())
  or exists (
    select 1
    from jobs.job j
    where j.job_id = installer_reviews.job_id
      and j.posted_by::text = auth.uid()::text
  )
);

drop policy if exists "Customers can create completed job reviews"
on jobs.installer_reviews;

drop policy if exists "Customers can create assigned applicant reviews"
on jobs.installer_reviews;

create policy "Customers can create assigned applicant reviews"
on jobs.installer_reviews
for insert
to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1
    from jobs.job j
    left join jobs.job_application ja
      on ja.job_id = j.job_id
     and ja.installer_id::text = installer_reviews.installer_id::text
     and (
       installer_reviews.application_id is null
       or ja.application_id::text = installer_reviews.application_id
     )
    where j.job_id = installer_reviews.job_id
      and j.posted_by::text = auth.uid()::text
      and (
        j.installer_id_assigned::text = installer_reviews.installer_id::text
        or ja.installer_id::text = installer_reviews.installer_id::text
      )
      and (
        j.installer_id_assigned::text = installer_reviews.installer_id::text
        or lower(coalesce(ja.status::text, '')) in (
          'approved',
          'accepted',
          'customer_accepted',
          'done',
          'completed'
        )
      )
  )
);

drop policy if exists "Customers can update their own reviews"
on jobs.installer_reviews;

create policy "Customers can update their own reviews"
on jobs.installer_reviews
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

create or replace view jobs.installer_review_summary as
select
  installer_id,
  round(avg(rating)::numeric, 2) as average_rating,
  count(*)::integer as review_count,
  max(created_at) as latest_review_at
from jobs.installer_reviews
group by installer_id;

create or replace view jobs.installer_review_details as
select
  r.review_id,
  r.job_id,
  r.application_id,
  r.customer_id,
  r.installer_id,
  r.rating,
  r.comment,
  r.tags,
  r.created_at,
  j.job_title,
  j.job_category,
  j.job_date,
  j.job_location
from jobs.installer_reviews r
join jobs.job j on j.job_id = r.job_id;

create or replace function public.customer_mark_job_completed(target_job_id text)
returns void
language plpgsql
security definer
set search_path = jobs, public
as $$
declare
  target_job jobs.job%rowtype;
  target_installer_id uuid;
begin
  select *
    into target_job
  from jobs.job j
  where j.job_id::text = target_job_id
    and j.posted_by::text = auth.uid()::text
  limit 1;

  if target_job.job_id is null then
    raise exception 'Job was not found for this customer.';
  end if;

  target_installer_id := target_job.installer_id_assigned;

  if target_installer_id is null then
    select ja.installer_id
      into target_installer_id
    from jobs.job_application ja
    where ja.job_id = target_job.job_id
      and lower(coalesce(ja.status::text, '')) in (
        'approved',
        'accepted',
        'customer_accepted',
        'done',
        'completed'
      )
    order by
      case lower(coalesce(ja.status::text, ''))
        when 'done' then 1
        when 'completed' then 2
        when 'approved' then 3
        when 'accepted' then 4
        when 'customer_accepted' then 5
        else 9
      end,
      ja.updated_at desc nulls last,
      ja.applied_at desc nulls last
    limit 1;
  end if;

  if target_installer_id is null then
    raise exception 'This job has no approved or assigned installer yet.';
  end if;

  update jobs.job j
     set job_status = 'completed',
         installer_id_assigned = target_installer_id,
         updated_at = now()
   where j.job_id = target_job.job_id;

  update jobs.job_application ja
     set status = 'done',
         updated_at = now()
   where ja.job_id = target_job.job_id
     and ja.installer_id::text = target_installer_id::text;
end;
$$;

create or replace function public.customer_set_job_tracker_status(
  target_job_id text,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = jobs, public
as $$
declare
  target_job jobs.job%rowtype;
  target_installer_id uuid;
  normalized_status text := lower(btrim(coalesce(target_status, '')));
begin
  if normalized_status not in ('active', 'completed', 'unfinished') then
    raise exception 'Invalid tracker status: %. Use active, completed, or unfinished.', target_status;
  end if;

  select *
    into target_job
  from jobs.job j
  where j.job_id::text = target_job_id
    and j.posted_by::text = auth.uid()::text
  limit 1;

  if target_job.job_id is null then
    raise exception 'Job was not found for this customer.';
  end if;

  target_installer_id := target_job.installer_id_assigned;

  if target_installer_id is null then
    select ja.installer_id
      into target_installer_id
    from jobs.job_application ja
    where ja.job_id = target_job.job_id
      and lower(coalesce(ja.status::text, '')) in (
        'approved',
        'accepted',
        'customer_accepted',
        'done',
        'completed'
      )
    order by
      case lower(coalesce(ja.status::text, ''))
        when 'done' then 1
        when 'completed' then 2
        when 'approved' then 3
        when 'accepted' then 4
        when 'customer_accepted' then 5
        else 9
      end,
      ja.updated_at desc nulls last,
      ja.applied_at desc nulls last
    limit 1;
  end if;

  update jobs.job j
     set job_status = normalized_status::jobs.job_status,
         installer_id_assigned = coalesce(target_installer_id, j.installer_id_assigned),
         updated_at = now()
   where j.job_id = target_job.job_id;

  if target_installer_id is not null then
    update jobs.job_application ja
       set status = (case
             when normalized_status = 'completed' then 'done'
             else 'approved'
           end)::jobs.application_status,
           updated_at = now()
     where ja.job_id = target_job.job_id
       and ja.installer_id::text = target_installer_id::text;
  end if;
end;
$$;

create or replace function jobs.validate_job_post_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = jobs, public
as $$
declare
  old_status text := '';
  new_status text := lower(coalesce(new.job_status::text, ''));
  is_owner boolean := new.posted_by::text = auth.uid()::text;
  is_admin boolean := public.is_approved_admin(auth.uid());
begin
  if tg_op = 'INSERT' then
    if new_status = '' then
      new.job_status := 'pending_review';
      new_status := 'pending_review';
    end if;

    if new_status <> 'pending_review' then
      raise exception 'Invalid initial job status: %', new_status;
    end if;

    if not is_owner then
      raise exception 'Only the customer can create this job request.';
    end if;

    return new;
  end if;

  old_status := lower(coalesce(old.job_status::text, ''));

  if old_status = 'active'
    and new_status = 'active'
    and (
      old.job_title is distinct from new.job_title
      or old.job_description is distinct from new.job_description
      or old.job_difficulty is distinct from new.job_difficulty
      or old.job_category is distinct from new.job_category
      or old.job_location is distinct from new.job_location
      or old.job_date is distinct from new.job_date
      or old.job_time is distinct from new.job_time
      or old.job_pay is distinct from new.job_pay
      or old.job_picture_url is distinct from new.job_picture_url
      or old.job_duration is distinct from new.job_duration
    ) then
    raise exception 'Active job details cannot be edited. Request cancellation instead.';
  end if;

  if old_status = new_status then
    return new;
  end if;

  if new_status not in (
    'pending_review',
    'suggestion_sent',
    'customer_accepted',
    'appeal_submitted',
    'approved',
    'active',
    'unfinished',
    'cancellation_pending',
    'cancelled',
    'rejected',
    'archived',
    'done',
    'completed',
    'overdue'
  ) then
    raise exception 'Unknown job lifecycle status: %', new_status;
  end if;

  if old_status in ('approved', 'active', 'done', 'completed', 'unfinished')
    and new_status in ('active', 'done', 'completed', 'unfinished')
    and is_owner then
    return new;
  end if;

  if old_status in ('', 'pending') and new_status = 'pending_review' and is_owner then
    return new;
  end if;

  if old_status = 'viewed' and new_status = 'pending_review' and is_admin then
    return new;
  end if;

  if old_status in ('', 'pending', 'viewed', 'pending_review') and new_status in ('suggestion_sent', 'rejected') and is_admin then
    return new;
  end if;

  if old_status = 'pending_review' and new_status = 'cancelled' and is_owner then
    return new;
  end if;

  if old_status = 'suggestion_sent' and new_status in ('customer_accepted', 'appeal_submitted') and is_owner then
    return new;
  end if;

  if old_status in ('customer_accepted', 'appeal_submitted') and new_status in ('approved', 'suggestion_sent') and is_admin then
    return new;
  end if;

  if old_status = 'approved' and new_status = 'active' and is_owner then
    return new;
  end if;

  if old_status = 'active' and new_status = 'cancellation_pending' and is_owner then
    return new;
  end if;

  if old_status = 'active' and new_status in ('done', 'completed', 'overdue') then
    return new;
  end if;

  if old_status = 'cancellation_pending' and new_status in ('cancelled', 'active') and is_admin then
    return new;
  end if;

  if old_status = 'cancelled' and new_status = 'pending_review' and is_owner then
    return new;
  end if;

  raise exception 'Invalid job status transition from % to %.', old_status, new_status;
end;
$$;

drop view if exists jobs.installer_accomplishment_details;

create view jobs.installer_accomplishment_details as
select
  j.job_id,
  ja.installer_id,
  j.job_title,
  j.job_category,
  j.job_difficulty,
  j.job_date,
  j.job_location,
  j.job_status,
  j.updated_at as completed_at,
  r.review_id,
  r.rating,
  r.comment,
  r.tags,
  r.created_at as review_created_at
from jobs.job_application ja
join jobs.job j on j.job_id = ja.job_id
left join jobs.installer_reviews r
  on r.job_id = j.job_id
 and r.installer_id::text = ja.installer_id::text
where lower(coalesce(ja.status::text, '')) in (
    'approved',
    'accepted',
    'customer_accepted',
    'done',
    'completed'
  )
  and (
    lower(coalesce(j.job_status::text, '')) in ('done', 'completed')
  );

drop function if exists public.get_installer_accomplishments(text);

create function public.get_installer_accomplishments(target_installer_id text)
returns table (
  job_id text,
  installer_id text,
  job_title text,
  job_category text,
  job_difficulty text,
  job_date text,
  job_location text,
  job_status text,
  completed_at timestamptz,
  review_id text,
  rating integer,
  comment text,
  tags jsonb,
  review_created_at timestamptz
)
language plpgsql
security definer
set search_path = jobs, public
as $$
begin
  if not (
    public.is_approved_admin(auth.uid())
    or exists (
      select 1
      from public.installer i
      where i.id::text = target_installer_id
        and (
          i.id = auth.uid()
          or lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  ) then
    raise exception 'Installer accomplishments are only available to the installer account or approved administrators.';
  end if;

  return query
  select
    j.job_id::text,
    ja.installer_id::text,
    j.job_title::text,
    j.job_category::text,
    j.job_difficulty::text,
    j.job_date::text,
    j.job_location::text,
    j.job_status::text,
    j.updated_at,
    r.review_id::text,
    r.rating,
    r.comment,
    r.tags,
    r.created_at
  from jobs.job_application ja
  join jobs.job j
    on j.job_id = ja.job_id
  left join jobs.installer_reviews r
    on r.job_id = j.job_id
   and r.installer_id::text = ja.installer_id::text
  where ja.installer_id::text = target_installer_id
    and lower(coalesce(ja.status::text, '')) in (
      'approved',
      'accepted',
      'customer_accepted',
      'done',
      'completed'
    )
    and (
      lower(coalesce(j.job_status::text, '')) in ('done', 'completed')
    )
  order by j.updated_at desc nulls last, j.job_date desc nulls last;
end;
$$;

grant select, insert, update on jobs.installer_reviews to authenticated;
grant select on jobs.installer_review_summary to authenticated;
grant select on jobs.installer_review_details to authenticated;
grant select on jobs.installer_accomplishment_details to authenticated;
grant execute on function public.customer_mark_job_completed(text) to authenticated;
grant execute on function public.get_installer_accomplishments(text) to authenticated;
grant execute on function public.customer_set_job_tracker_status(text, text) to authenticated;

