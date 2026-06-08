-- Installer application flow guardrails and admin recommendation marker.
-- Run this in Supabase SQL editor after job_post_approval_workflow.sql.

alter table jobs.job_application
  add column if not exists admin_recommended boolean not null default false,
  add column if not exists admin_recommended_at timestamptz,
  add column if not exists admin_recommended_by uuid,
  add column if not exists updated_at timestamptz;

do $$
declare
  app_status_type regtype;
begin
  select a.atttypid::regtype
    into app_status_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'jobs'
    and c.relname = 'job_application'
    and a.attname = 'status'
    and not a.attisdropped
    and t.typtype = 'e';

  if app_status_type is not null
    and not exists (
      select 1
      from pg_enum
      where enumtypid = app_status_type::oid
        and enumlabel = 'cancelled'
    ) then
    execute format('alter type %s add value %L', app_status_type, 'cancelled');
  end if;
end $$;

alter table jobs.job_application enable row level security;

drop policy if exists "Installers can read own job applications"
on jobs.job_application;

create policy "Installers can read own job applications"
on jobs.job_application
for select
to authenticated
using (
  installer_id = auth.uid()
  or exists (
    select 1
    from public.installer i
    where i.id = job_application.installer_id
      and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Installers can create own job applications"
on jobs.job_application;

create policy "Installers can create own job applications"
on jobs.job_application
for insert
to authenticated
with check (
  installer_id = auth.uid()
  or exists (
    select 1
    from public.installer i
    where i.id = job_application.installer_id
      and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Installers can cancel own open applications"
on jobs.job_application;

create policy "Installers can cancel own open applications"
on jobs.job_application
for delete
to authenticated
using (
  (
    installer_id = auth.uid()
    or exists (
      select 1
      from public.installer i
      where i.id = job_application.installer_id
        and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  and lower(coalesce(status::text, '')) in (
    'pending',
    'viewed',
    'rejected',
    'invalidated',
    'terminated',
    'overdue'
  )
);

drop policy if exists "Installers can mark own approved applications done"
on jobs.job_application;

create policy "Installers can mark own approved applications done"
on jobs.job_application
for update
to authenticated
using (
  (
    installer_id = auth.uid()
    or exists (
      select 1
      from public.installer i
      where i.id = job_application.installer_id
        and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  and lower(coalesce(status::text, '')) = 'approved'
)
with check (
  (
    installer_id = auth.uid()
    or exists (
      select 1
      from public.installer i
      where i.id = job_application.installer_id
        and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  and lower(coalesce(status::text, '')) = 'done'
);

drop policy if exists "Installers can mark own open applications cancelled"
on jobs.job_application;

create policy "Installers can mark own open applications cancelled"
on jobs.job_application
for update
to authenticated
using (
  (
    installer_id = auth.uid()
    or exists (
      select 1
      from public.installer i
      where i.id = job_application.installer_id
        and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  and lower(coalesce(status::text, '')) in (
    'pending',
    'viewed',
    'rejected',
    'invalidated',
    'terminated',
    'overdue'
  )
)
with check (
  (
    installer_id = auth.uid()
    or exists (
      select 1
      from public.installer i
      where i.id = job_application.installer_id
        and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  and lower(coalesce(status::text, '')) = 'cancelled'
);

create or replace function public.cancel_own_job_application(application_id_to_cancel text)
returns integer
language plpgsql
security definer
set search_path = jobs, public
as $$
declare
  deleted_count integer := 0;
begin
  update jobs.job_application ja
     set status = 'cancelled',
         updated_at = now()
  where ja.application_id::text = application_id_to_cancel
    and lower(coalesce(ja.status::text, '')) in (
      'pending',
      'viewed',
      'rejected',
      'invalidated',
      'terminated',
      'overdue',
      'cancelled'
    )
    and lower(coalesce(ja.status::text, '')) <> 'approved'
    and lower(coalesce(ja.status::text, '')) <> 'done'
    and lower(coalesce(ja.status::text, '')) <> 'completed'
    and (
      lower(coalesce(ja.status::text, '')) in ('rejected', 'invalidated', 'terminated', 'overdue', 'cancelled')
      or not exists (
        select 1
        from jobs.job j
        where j.job_id = ja.job_id
      )
      or exists (
        select 1
        from jobs.job j
        where j.job_id = ja.job_id
          and lower(coalesce(j.job_status::text, '')) in (
            'active',
            'cancelled',
            'cancellation_pending',
            'rejected',
            'overdue',
            'pending_review',
            'suggestion_sent',
            'customer_accepted',
            'appeal_submitted',
            'done',
            'completed',
            'archived'
          )
      )
    )
    and (
      ja.installer_id = auth.uid()
      or exists (
        select 1
        from public.installer i
        where i.id = ja.installer_id
          and lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.cancel_own_job_application(text) to authenticated;

create or replace function public.apply_or_reapply_to_job(job_id_to_apply text)
returns jsonb
language plpgsql
security definer
set search_path = jobs, public
as $$
declare
  target_job_id jobs.job.job_id%type;
  target_installer_id uuid;
  existing_application_id text := null;
  existing_status text := null;
  required_level numeric := 0;
  installer_level numeric := 0;
  raw_required text := '';
  raw_installer_level text := '';
begin
  select j.job_id,
         coalesce(j.job_difficulty::text, '0')
    into target_job_id, raw_required
  from jobs.job j
  where j.job_id::text = job_id_to_apply
    and lower(coalesce(j.job_status::text, '')) = 'active'
  limit 1;

  if target_job_id is null then
    raise exception 'This job is no longer active or does not exist.';
  end if;

  select i.id,
         coalesce(i.levelstatus::text, '0')
    into target_installer_id, raw_installer_level
  from public.installer i
  where i.id = auth.uid()
     or lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;

  if target_installer_id is null then
    raise exception 'Installer profile does not exist.';
  end if;

  begin
    required_level := coalesce(nullif(raw_required, '')::numeric, 0);
  exception when others then
    required_level := 0;
  end;

  begin
    installer_level := coalesce(nullif(raw_installer_level, '')::numeric, 0);
  exception when others then
    installer_level := 0;
  end;

  if installer_level < required_level then
    raise exception 'Installer level % does not meet required job level %.',
      installer_level, required_level;
  end if;

  select ja.application_id::text,
         lower(coalesce(ja.status::text, ''))
    into existing_application_id, existing_status
  from jobs.job_application ja
  where ja.job_id = target_job_id
    and ja.installer_id = target_installer_id
    and lower(coalesce(ja.status::text, '')) <> 'cancelled'
  limit 1;

  if existing_application_id is not null then
    return jsonb_build_object(
      'status', 'already_applied',
      'application_id', existing_application_id,
      'application_status', existing_status
    );
  end if;

  update jobs.job_application ja
     set status = 'pending',
         updated_at = now()
  where ja.job_id = target_job_id
    and ja.installer_id = target_installer_id
    and lower(coalesce(ja.status::text, '')) = 'cancelled'
  returning ja.application_id::text into existing_application_id;

  if existing_application_id is not null then
    return jsonb_build_object(
      'status', 'reapplied',
      'application_id', existing_application_id,
      'application_status', 'pending'
    );
  end if;

  insert into jobs.job_application (job_id, installer_id, status)
  values (target_job_id, target_installer_id, 'pending')
  returning application_id::text into existing_application_id;

  return jsonb_build_object(
    'status', 'applied',
    'application_id', existing_application_id,
    'application_status', 'pending'
  );
end;
$$;

grant execute on function public.apply_or_reapply_to_job(text) to authenticated;

create or replace function jobs.validate_installer_application_eligibility()
returns trigger
language plpgsql
security definer
set search_path = jobs, public
as $$
declare
  target_status text := '';
  required_level numeric := 0;
  installer_level numeric := 0;
  raw_required text := '';
  raw_installer_level text := '';
begin
  select lower(coalesce(j.job_status::text, '')),
         coalesce(j.job_difficulty::text, '0')
    into target_status, raw_required
  from jobs.job j
  where j.job_id = new.job_id;

  if target_status = '' then
    raise exception 'Job does not exist.';
  end if;

  if target_status <> 'active' then
    raise exception 'Installers can only apply to active jobs.';
  end if;

  select coalesce(i.levelstatus::text, '0')
    into raw_installer_level
  from public.installer i
  where i.id = new.installer_id;

  if raw_installer_level is null then
    raise exception 'Installer profile does not exist.';
  end if;

  begin
    required_level := coalesce(nullif(raw_required, '')::numeric, 0);
  exception when others then
    required_level := 0;
  end;

  begin
    installer_level := coalesce(nullif(raw_installer_level, '')::numeric, 0);
  exception when others then
    installer_level := 0;
  end;

  if installer_level < required_level then
    raise exception 'Installer level % does not meet required job level %.',
      installer_level, required_level;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_installer_application_eligibility
  on jobs.job_application;

create trigger trg_validate_installer_application_eligibility
before insert or update of job_id, installer_id on jobs.job_application
for each row
execute function jobs.validate_installer_application_eligibility();
