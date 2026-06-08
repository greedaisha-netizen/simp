-- Allow customers to see resume/certificate records for applicants on jobs they posted.
-- Run this in the Supabase SQL editor for the project.

alter table public.installer_documents enable row level security;

drop policy if exists "Customers can view applicant documents for owned jobs"
on public.installer_documents;

create policy "Customers can view applicant documents for owned jobs"
on public.installer_documents
for select
to authenticated
using (
  installer_id = auth.uid()
  or exists (
    select 1
    from jobs.job_application ja
    join jobs.job j on j.job_id = ja.job_id
    where ja.installer_id = installer_documents.installer_id
      and j.posted_by = auth.uid()
      and lower(coalesce(ja.status::text, '')) in (
        'pending',
        'viewed',
        'approved',
        'active',
        'done',
        'completed'
      )
  )
);

drop policy if exists "Customers can open applicant resume certificates for owned jobs"
on storage.objects;

create policy "Customers can open applicant resume certificates for owned jobs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents_review'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.installer_documents d
      join jobs.job_application ja on ja.installer_id = d.installer_id
      join jobs.job j on j.job_id = ja.job_id
      where j.posted_by = auth.uid()
        and lower(coalesce(ja.status::text, '')) in (
          'pending',
          'viewed',
          'approved',
          'active',
          'done',
          'completed'
        )
        and (
          name = d.resume
          or coalesce(to_jsonb(d.certificates), '[]'::jsonb) ? name
        )
    )
  )
);
