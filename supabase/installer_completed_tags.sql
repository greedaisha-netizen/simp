-- 1. Add completed_tags column to public.installer
ALTER TABLE public.installer ADD COLUMN IF NOT EXISTS completed_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Update apply_or_reapply_to_job function to check qualifications (tags, experience, application mode)
CREATE OR REPLACE FUNCTION public.apply_or_reapply_to_job(job_id_to_apply text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = jobs, public
AS $$
DECLARE
  target_job_id jobs.job.job_id%type;
  target_installer_id uuid;
  existing_application_id text := null;
  existing_status text := null;
  
  v_app_mode text;
  v_req_tags jsonb;
  v_req_exp jsonb;
  v_min_reqs int;
  
  v_completed_tags jsonb;
  v_installer_exp jsonb;
  
  v_met_count int := 0;
  v_total_count int := 0;
  v_tag text;
  v_exp_item jsonb;
  v_exp_category text;
  v_exp_req_count int;
  v_installer_exp_count int;
  v_eligible boolean := false;
BEGIN
  -- 1. Get job and details
  SELECT j.job_id,
         j.application_mode,
         j.required_course_tags,
         j.required_experience,
         j.min_requirements_met
    INTO target_job_id, v_app_mode, v_req_tags, v_req_exp, v_min_reqs
  FROM jobs.job j
  WHERE j.job_id::text = job_id_to_apply
    AND lower(coalesce(j.job_status::text, '')) = 'active'
  LIMIT 1;

  IF target_job_id IS NULL THEN
    RAISE EXCEPTION 'This job is no longer active or does not exist.';
  END IF;

  -- 2. Get installer profile qualifications
  SELECT i.id,
         i.completed_tags,
         i.experience
    INTO target_installer_id, v_completed_tags, v_installer_exp
  FROM public.installer i
  WHERE i.id = auth.uid()
     OR lower(coalesce(i.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;

  IF target_installer_id IS NULL THEN
    RAISE EXCEPTION 'Installer profile does not exist.';
  END IF;

  -- 3. Evaluate eligibility
  IF v_app_mode = 'beginner-friendly' THEN
    v_eligible := true;
  ELSE
    -- Evaluate course tags
    IF v_req_tags IS NOT NULL THEN
      FOR v_tag IN SELECT jsonb_array_elements_text(v_req_tags) LOOP
        v_total_count := v_total_count + 1;
        IF v_completed_tags IS NOT NULL AND (
          v_completed_tags ? v_tag
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v_completed_tags) ct
            WHERE (ct LIKE '% Course Completed' OR ct LIKE '% Completed')
              AND v_tag LIKE (split_part(split_part(ct, ' Course Completed', 1), ' Completed', 1) || '%')
          )
        ) THEN
          v_met_count := v_met_count + 1;
        END IF;
      END LOOP;
    END IF;

    -- Evaluate project experience
    IF v_req_exp IS NOT NULL THEN
      FOR v_exp_item IN SELECT jsonb_array_elements(v_req_exp) LOOP
        v_total_count := v_total_count + 1;
        v_exp_category := v_exp_item->>'category';
        v_exp_req_count := coalesce((v_exp_item->>'count')::int, 0);
        
        IF v_installer_exp IS NOT NULL THEN
          SELECT coalesce(sum(val::int), 0) INTO v_installer_exp_count
          FROM jsonb_each_text(v_installer_exp) AS x(key, val)
          WHERE lower(x.key) = lower(v_exp_category);
        ELSE
          v_installer_exp_count := 0;
        END IF;
        
        IF v_installer_exp_count >= v_exp_req_count THEN
          v_met_count := v_met_count + 1;
        END IF;
      END LOOP;
    END IF;

    -- Check modes
    IF v_app_mode = 'strict' THEN
      v_eligible := (v_met_count = v_total_count);
    ELSIF v_app_mode = 'flexible' THEN
      v_eligible := (v_met_count >= v_min_reqs);
    ELSE
      v_eligible := (v_met_count = v_total_count);
    END IF;
  END IF;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'Installer does not meet the required qualifications for this job (Met % of % requirements).',
      v_met_count, v_total_count;
  END IF;

  -- 4. Check for existing applications
  SELECT ja.application_id::text,
         lower(coalesce(ja.status::text, ''))
    INTO existing_application_id, existing_status
  FROM jobs.job_application ja
  WHERE ja.job_id = target_job_id
    AND ja.installer_id = target_installer_id
    AND lower(coalesce(ja.status::text, '')) <> 'cancelled'
  LIMIT 1;

  IF existing_application_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_applied',
      'application_id', existing_application_id,
      'application_status', existing_status
    );
  END IF;

  -- Reapply if application was cancelled
  UPDATE jobs.job_application ja
     SET status = 'pending',
         updated_at = now()
  WHERE ja.job_id = target_job_id
    AND ja.installer_id = target_installer_id
    AND lower(coalesce(ja.status::text, '')) = 'cancelled'
  RETURNING ja.application_id::text INTO existing_application_id;

  IF existing_application_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'reapplied',
      'application_id', existing_application_id,
      'application_status', 'pending'
    );
  END IF;

  -- Create new application
  INSERT INTO jobs.job_application (job_id, installer_id, status)
  VALUES (target_job_id, target_installer_id, 'pending')
  RETURNING application_id::text INTO existing_application_id;

  RETURN jsonb_build_object(
    'status', 'applied',
    'application_id', existing_application_id,
    'application_status', 'pending'
  );
END;
$$;

-- 3. Update validate_installer_application_eligibility trigger function
CREATE OR REPLACE FUNCTION jobs.validate_installer_application_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = jobs, public
AS $$
DECLARE
  target_status text := '';
  
  v_app_mode text;
  v_req_tags jsonb;
  v_req_exp jsonb;
  v_min_reqs int;
  
  v_completed_tags jsonb;
  v_installer_exp jsonb;
  
  v_met_count int := 0;
  v_total_count int := 0;
  v_tag text;
  v_exp_item jsonb;
  v_exp_category text;
  v_exp_req_count int;
  v_installer_exp_count int;
  v_eligible boolean := false;
BEGIN
  -- 1. Get job details
  SELECT lower(coalesce(j.job_status::text, '')),
         j.application_mode,
         j.required_course_tags,
         j.required_experience,
         j.min_requirements_met
    INTO target_status, v_app_mode, v_req_tags, v_req_exp, v_min_reqs
  FROM jobs.job j
  WHERE j.job_id = new.job_id;

  IF target_status = '' THEN
    RAISE EXCEPTION 'Job does not exist.';
  END IF;

  IF target_status <> 'active' THEN
    RAISE EXCEPTION 'Installers can only apply to active jobs.';
  END IF;

  -- 2. Get installer qualifications
  SELECT i.completed_tags,
         i.experience
    INTO v_completed_tags, v_installer_exp
  FROM public.installer i
  WHERE i.id = new.installer_id;

  IF v_installer_exp IS NULL AND v_completed_tags IS NULL THEN
    RAISE EXCEPTION 'Installer profile does not exist.';
  END IF;

  -- 3. Evaluate eligibility
  IF v_app_mode = 'beginner-friendly' THEN
    v_eligible := true;
  ELSE
    -- Evaluate course tags
    IF v_req_tags IS NOT NULL THEN
      FOR v_tag IN SELECT jsonb_array_elements_text(v_req_tags) LOOP
        v_total_count := v_total_count + 1;
        IF v_completed_tags IS NOT NULL AND (
          v_completed_tags ? v_tag
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v_completed_tags) ct
            WHERE (ct LIKE '% Course Completed' OR ct LIKE '% Completed')
              AND v_tag LIKE (split_part(split_part(ct, ' Course Completed', 1), ' Completed', 1) || '%')
          )
        ) THEN
          v_met_count := v_met_count + 1;
        END IF;
      END LOOP;
    END IF;

    -- Evaluate project experience
    IF v_req_exp IS NOT NULL THEN
      FOR v_exp_item IN SELECT jsonb_array_elements(v_req_exp) LOOP
        v_total_count := v_total_count + 1;
        v_exp_category := v_exp_item->>'category';
        v_exp_req_count := coalesce((v_exp_item->>'count')::int, 0);
        
        IF v_installer_exp IS NOT NULL THEN
          SELECT coalesce(sum(val::int), 0) INTO v_installer_exp_count
          FROM jsonb_each_text(v_installer_exp) AS x(key, val)
          WHERE lower(x.key) = lower(v_exp_category);
        ELSE
          v_installer_exp_count := 0;
        END IF;
        
        IF v_installer_exp_count >= v_exp_req_count THEN
          v_met_count := v_met_count + 1;
        END IF;
      END LOOP;
    END IF;

    -- Check modes
    IF v_app_mode = 'strict' THEN
      v_eligible := (v_met_count = v_total_count);
    ELSIF v_app_mode = 'flexible' THEN
      v_eligible := (v_met_count >= v_min_reqs);
    ELSE
      v_eligible := (v_met_count = v_total_count);
    END IF;
  END IF;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'Installer does not meet the required qualifications for this job (Met % of % requirements).',
      v_met_count, v_total_count;
  END IF;

  RETURN NEW;
END;
$$;
