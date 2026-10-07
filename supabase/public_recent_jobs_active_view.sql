-- Public homepage feed for customer-posted jobs.
-- Run this in the Supabase SQL editor if the homepage needs to use
-- /rest/v1/public_recent_jobs as its public fallback endpoint.

create or replace function public.try_parse_jsonb(value text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' or left(btrim(value), 1) <> '{' then
    return null;
  end if;

  return value::jsonb;
exception
  when others then
    return null;
end;
$$;

drop view if exists public.public_recent_jobs;

create view public.public_recent_jobs as
select
  j.job_id,
  j.posted_by,
  j.job_title,
  coalesce(
    meta.payload ->> 'current_description',
    meta.payload ->> 'description',
    meta.payload #>> '{customer_version,description}',
    meta.payload #>> '{admin_suggested_version,description}',
    meta.payload #>> '{original_customer_version,description}',
    meta.payload ->> 'original_description',
    j.job_description
  ) as job_description,
  j.job_difficulty,
  j.job_category,
  j.job_location,
  j.job_date,
  j.job_time,
  j.job_pay,
  j.job_picture_url,
  j.created_at,
  j.job_status,
  j.installer_id_assigned
from jobs.job j
cross join lateral (
  select public.try_parse_jsonb(j.job_description) as payload
) meta
where (
    lower(coalesce(j.job_status::text, '')) = 'active'
    or (
      lower(coalesce(j.job_status::text, '')) = 'approved'
      and lower(coalesce(meta.payload ->> 'is_posted', 'false')) = 'true'
    )
  )
  and (
    j.installer_id_assigned is null
    or btrim(j.installer_id_assigned::text) = ''
  );

grant execute on function public.try_parse_jsonb(text) to anon, authenticated;
grant select on public.public_recent_jobs to anon, authenticated;
