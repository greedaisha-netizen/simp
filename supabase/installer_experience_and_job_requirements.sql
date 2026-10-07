-- 1. Add experience column to public.installer
ALTER TABLE public.installer ADD COLUMN IF NOT EXISTS experience jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Add qualification columns to jobs.job
ALTER TABLE jobs.job ADD COLUMN IF NOT EXISTS required_course_tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE jobs.job ADD COLUMN IF NOT EXISTS required_experience jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE jobs.job ADD COLUMN IF NOT EXISTS application_mode text NOT NULL DEFAULT 'strict';
ALTER TABLE jobs.job ADD COLUMN IF NOT EXISTS min_requirements_met integer NOT NULL DEFAULT 0;

-- 3. Create experience auto-increment function and trigger
CREATE OR REPLACE FUNCTION jobs.increment_installer_experience()
RETURNS trigger AS $$
DECLARE
  v_category text;
  v_installer_id uuid;
BEGIN
  IF (NEW.job_status IN ('done', 'completed') AND (OLD.job_status IS NULL OR OLD.job_status NOT IN ('done', 'completed'))) THEN
    v_category := NEW.job_category;
    v_installer_id := NEW.installer_id_assigned;
    
    IF v_installer_id IS NOT NULL AND v_category IS NOT NULL THEN
      UPDATE public.installer
      SET experience = jsonb_set(
        coalesce(experience, '{}'::jsonb),
        ARRAY[v_category],
        to_jsonb(coalesce((experience->>v_category)::int, 0) + 1)
      )
      WHERE id = v_installer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_installer_experience ON jobs.job;
CREATE TRIGGER trg_increment_installer_experience
AFTER UPDATE ON jobs.job
FOR EACH ROW
EXECUTE FUNCTION jobs.increment_installer_experience();

-- 4. Backfill installer experience counts from existing completed jobs
WITH completed_counts AS (
  SELECT
    ja.installer_id,
    j.job_category,
    count(*) as project_count
  FROM jobs.job_application ja
  JOIN jobs.job j ON j.job_id = ja.job_id
  WHERE lower(coalesce(ja.status::text, '')) IN ('approved', 'accepted', 'customer_accepted', 'done', 'completed')
    AND lower(coalesce(j.job_status::text, '')) IN ('done', 'completed')
    AND j.job_category IS NOT NULL
  GROUP BY ja.installer_id, j.job_category
),
grouped_experience AS (
  SELECT
    installer_id,
    jsonb_object_agg(job_category, project_count) as exp_json
  FROM completed_counts
  GROUP BY installer_id
)
UPDATE public.installer inst
SET experience = coalesce(ge.exp_json, '{}'::jsonb)
FROM grouped_experience ge
WHERE inst.id = ge.installer_id;
