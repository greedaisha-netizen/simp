-- SQL Migration Script
-- Run this in the Supabase SQL Editor to add the job_manpower column and make time/duration optional.

-- 1. Add the job_manpower column if it doesn't exist yet
ALTER TABLE jobs.job ADD COLUMN IF NOT EXISTS job_manpower integer NOT NULL DEFAULT 1;

-- 2. Make job_time and job_duration nullable/optional
ALTER TABLE jobs.job ALTER COLUMN job_time DROP NOT NULL;
ALTER TABLE jobs.job ALTER COLUMN job_duration DROP NOT NULL;

-- 3. Populate existing rows with manpower data stored inside the JSON description, if present
UPDATE jobs.job
SET job_manpower = COALESCE(
  CASE
    WHEN job_description LIKE '{%' THEN (job_description::jsonb->>'manpower')::integer
    ELSE 1
  END,
  1
)
WHERE job_description LIKE '{%';
