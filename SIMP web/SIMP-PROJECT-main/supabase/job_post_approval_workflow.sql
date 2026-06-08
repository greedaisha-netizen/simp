-- Job post approval lifecycle guardrails.
-- Run this in Supabase SQL editor before deploying the updated UI.

do $$
declare
  status_type regtype;
  status_values text[] := array[
    'pending_review',
    'suggestion_sent',
    'customer_accepted',
    'appeal_submitted',
    'approved',
    'active',
    'cancellation_pending',
    'cancelled',
    'rejected',
    'archived',
    'done',
    'completed',
    'overdue'
  ];
  value text;
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

  if status_type is not null then
    foreach value in array status_values loop
      if not exists (
        select 1
        from pg_enum
        where enumtypid = status_type::oid
          and enumlabel = value
      ) then
        execute format('alter type %s add value %L', status_type, value);
      end if;
    end loop;
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

create or replace function jobs.validate_job_post_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = jobs, public
as $$
declare
  old_status text := '';
  new_status text := lower(coalesce(new.job_status::text, ''));
  is_owner boolean := new.posted_by = auth.uid();
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

drop trigger if exists trg_validate_job_post_lifecycle on jobs.job;

create trigger trg_validate_job_post_lifecycle
before insert or update of job_status on jobs.job
for each row
execute function jobs.validate_job_post_lifecycle();
