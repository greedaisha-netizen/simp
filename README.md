# SIMP Project

SIMP is a Vite-powered static web application for a service marketplace and learning platform. It includes public landing/auth pages, customer job posting and tracking pages, installer job/course/document pages, admin verification and management pages, Supabase SQL setup files, and shared browser-side utilities.

The project is already prepared for GitHub and Vercel. When the updated repository is pushed to the connected GitHub branch, Vercel can automatically rebuild and publish the newest version.

## Tech Stack

- HTML, CSS, and vanilla JavaScript for the frontend.
- Vite for local development and production builds.
- Supabase for authentication, database access, storage-backed workflows, and SQL policies.
- Live2D runtime files for the Steqyy assistant/mascot experience.

## Local Development

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## GitHub And Vercel Deployment

This repository is structured so Vercel can deploy it directly from the project root.

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Vite
- Root directory: repository root

The `dist`, `node_modules`, `.vercel`, and environment files are ignored by Git through `.gitignore`. Commit the source files, `package.json`, `package-lock.json`, `vite.config.js`, assets, shared scripts, and Supabase SQL files.

## Supabase Configuration

The browser app reads Supabase settings from `supabase.js`. The current file contains the Supabase project URL and anon key used by the frontend. SQL files in `supabase/` are database setup or migration scripts and must be applied in Supabase separately; Vercel does not automatically run those SQL files.

## Project Structure

```text
.
+-- ADDING_COURSE/              # Original/admin course creation pages
+-- enroll/                     # Learner course and classroom pages
+-- img/                        # General visual assets
+-- pages/                      # Role-based app pages
+-- shared/                     # Shared frontend data and vendor scripts
+-- supabase/                   # Database migration and policy SQL scripts
+-- Steqyy_model.2048/          # Live2D texture assets
+-- *.html                      # Public entry pages
+-- package.json                # Node/Vite scripts and dependencies
+-- vite.config.js              # Multi-page Vite build configuration
+-- README.md                   # Project documentation
```

## Root Files

| File | Purpose |
| --- | --- |
| `.gitignore` | Keeps generated folders, local Vercel files, environment files, and debug logs out of Git. |
| `adminLogin.html` | Admin login and sign-up entry page. |
| `forgotPassword.html` | Password recovery page for requesting a reset link. |
| `index.html` | Public landing page and primary website entry point. |
| `login.html` | User login page for the SIMP app. |
| `package-lock.json` | Locked dependency tree for reproducible installs. |
| `package.json` | Project metadata, Vite scripts, and development dependency list. |
| `README.md` | Explains setup, deployment, folders, and file purposes. |
| `resetPassword.html` | Password reset form for users coming from a reset link. |
| `scratch_db.js` | Optional local diagnostic script for checking installer `completed_tags` data in Supabase. Not used by Vercel. |
| `scratch_db_fetch.js` | Optional local diagnostic script for fetching course section content through the Supabase REST API. Not used by Vercel. |
| `signup.html` | Public user registration page. |
| `Steqyy_model.cdi3.json` | Live2D display information for the Steqyy model. |
| `Steqyy_model.moc3` | Live2D Cubism model binary for Steqyy. |
| `Steqyy_model.model3.json` | Live2D model manifest that connects the model and texture assets. |
| `style.css` | Shared/global styling for the public pages and common UI elements. |
| `supabase.js` | Shared Supabase URL and anon key configuration used by browser modules and local diagnostics. |
| `vite.config.js` | Vite configuration that builds every HTML page, copies runtime assets, and restores sidebar stylesheet order. |

## Course Authoring Pages

| File | Purpose |
| --- | --- |
| `ADDING_COURSE/admin.html` | Course/admin management page for the e-learning system. |
| `ADDING_COURSE/addcourse.html` | Page for creating course records and course media. |
| `ADDING_COURSE/addlesson.html` | Page for adding or editing lessons inside courses. |
| `ADDING_COURSE/class.html` | Course browsing/learning page from the original course module. |
| `ADDING_COURSE/edit.html` | Course editing page for modifying existing course content. |
| `ADDING_COURSE/voice-test.html` | Test page for Steqyy voice or speech-related interactions. |

## Learner Enrollment Pages

| File | Purpose |
| --- | --- |
| `enroll/assessment.html` | Assessment session page for course checks or quizzes. |
| `enroll/class.html` | Learner-facing course list or class page. |
| `enroll/classroom.html` | Main classroom page for consuming course material. |
| `enroll/course-images/certified.png` | Course section image for certification messaging. |
| `enroll/course-images/enhance.png` | Course section image for skills improvement messaging. |
| `enroll/course-images/learn.png` | Course section image for learning messaging. |
| `enroll/course-images/logo.png` | Course module logo asset. |
| `enroll/course-images/logo2.png` | Alternate course module logo asset. |
| `enroll/course-images/title_background.png` | Header/background image for course screens. |

## General App Scripts

| File | Purpose |
| --- | --- |
| `pages/general_files/index.js` | Shared browser logic for public/auth pages, profile routing, and general Supabase-backed behavior. |
| `pages/general_files/session.js` | Session helper that reads Supabase auth state and supports protected-page routing. |

## Admin Pages

| File | Purpose |
| --- | --- |
| `pages/admin_pages/css_files/sideBar.css` | Sidebar and layout styling for admin pages. |
| `pages/admin_pages/html_files/adminVerification.html` | Admin account verification page. |
| `pages/admin_pages/html_files/courseBuilder.html` | Admin course publishing and builder interface. |
| `pages/admin_pages/html_files/courses.html` | Admin course management page. |
| `pages/admin_pages/html_files/dashboard.html` | Admin dashboard overview. |
| `pages/admin_pages/html_files/jobApplicationVerification.html` | Admin page for reviewing applicants and selecting the best applicant. |
| `pages/admin_pages/html_files/jobVerification.html` | Admin page for reviewing and approving submitted jobs. |
| `pages/admin_pages/html_files/manageShop.html` | Admin shop management page. |
| `pages/admin_pages/html_files/paymentsRequest.html` | Admin page for payment and matching-fee requests. |
| `pages/admin_pages/html_files/settings.html` | Admin settings page. |
| `pages/admin_pages/html_files/waiting.html` | Waiting screen for admins pending approval. |
| `pages/admin_pages/html_files/workerVerification.html` | Admin page for reviewing installer/worker verification documents. |

## Customer Pages

| File | Purpose |
| --- | --- |
| `pages/customer_pages/css_files/sideBar.css` | Sidebar and layout styling for customer pages. |
| `pages/customer_pages/html_files/createPost.html` | Customer page for creating a new job post. |
| `pages/customer_pages/html_files/jobTracker.html` | Customer page for tracking job progress, completion, and reviews. |
| `pages/customer_pages/html_files/myJobPosts.html` | Customer page for viewing and managing posted jobs and applicants. |
| `pages/customer_pages/html_files/settings.html` | Customer profile and settings page. |

## Installer Pages

| File | Purpose |
| --- | --- |
| `pages/installer_pages/css_files/sideBar.css` | Sidebar and layout styling for installer pages. |
| `pages/installer_pages/html_files/approved.html` | Installer document status page for approved accounts. |
| `pages/installer_pages/html_files/courseMaterial.html` | Installer course material page. |
| `pages/installer_pages/html_files/courses.html` | Installer course browsing and progress page. |
| `pages/installer_pages/html_files/dashboard.html` | Installer dashboard overview. |
| `pages/installer_pages/html_files/documents.html` | Installer document upload and management page. |
| `pages/installer_pages/html_files/earnings.html` | Installer earnings page. |
| `pages/installer_pages/html_files/job.html` | Installer job marketplace page. |
| `pages/installer_pages/html_files/myApplication.html` | Installer page for tracking job applications. |
| `pages/installer_pages/html_files/rejected.html` | Installer document status page for rejected documents. |
| `pages/installer_pages/html_files/review.html` | Installer document status page for documents under review. |
| `pages/installer_pages/html_files/settings.html` | Installer profile and settings page. |
| `pages/installer_pages/html_files/shop.html` | Installer shop page. |
| `pages/installer_pages/html_files/upload.html` | Installer document upload entry page. |

## Shared Frontend Modules

| File | Purpose |
| --- | --- |
| `shared/course-cloud-state.js` | Supabase-backed persistence helper for course state. |
| `shared/course-engagement-supabase.js` | Supabase helpers for course progress, engagement, and completion data. |
| `shared/course-messaging-supabase.js` | Supabase helpers for course message/comment workflows. |
| `shared/course-store.js` | Browser-side course data store used by course pages. |
| `shared/course-store-supabase.js` | Supabase-backed course store implementation. |
| `shared/media-store.js` | Shared browser-side media storage helper used by course authoring pages. |
| `shared/vendor/live2d/live2dcubismcore.min.js` | Minified Live2D Cubism runtime dependency. |
| `shared/vendor/live2d/pixi-live2d-display.min.js` | Minified Pixi Live2D display integration dependency. |
| `shared/vendor/live2d/pixi.min.js` | Minified Pixi rendering dependency used by Live2D. |

## Image And Model Assets

| File | Purpose |
| --- | --- |
| `img/bgg.jpg` | Landing or auth background image. |
| `img/createProfile.svg` | Illustration/icon for profile creation. |
| `img/find&apply.svg` | Illustration/icon for finding and applying to jobs. |
| `img/getHired.svg` | Illustration/icon for getting hired. |
| `img/installer.jpg` | Installer-related photo asset. |
| `img/levelUp.svg` | Illustration/icon for leveling up skills. |
| `img/logo2.png` | Main SIMP logo image. |
| `img/logowhite.png` | White logo variant. |
| `img/logowhitebold.png` | Bold white logo variant. |
| `img/simpHappyMascotLogo.png` | SIMP happy mascot logo image. |
| `Steqyy_model.2048/texture_00.png` | Texture image used by the Steqyy Live2D model. |

## Supabase SQL Files

| File | Purpose |
| --- | --- |
| `supabase/add_job_manpower_column.sql` | Migration for adding job manpower support. |
| `supabase/admin_customer_contact_policy.sql` | Policy allowing approved admins to read customer contact/profile rows during job review. |
| `supabase/admin_job_application_policy.sql` | Policy allowing approved admins to read and update job applications for posted jobs. |
| `supabase/course_catalog.sql` | Course schema/table setup for course catalog data. |
| `supabase/course_engagement.sql` | Course schema/table setup for engagement and progress data. |
| `supabase/course_messages.sql` | Course schema/table setup for course messages. |
| `supabase/course_state.sql` | Course state table setup in the public schema. |
| `supabase/customer_applicant_documents_policy.sql` | Policy allowing customers to view applicant resume/certificate records for their jobs. |
| `supabase/customer_job_tracker_reviews.sql` | Migration and policies for customer job tracking and reviews. |
| `supabase/installer_completed_tags.sql` | Migration for installer completed course/job tags. |
| `supabase/installer_experience_and_job_requirements.sql` | Migration for installer experience and job requirement matching. |
| `supabase/job_application_installer_flow.sql` | Guardrails for installer job application flow and admin recommendation status. |
| `supabase/job_post_approval_workflow.sql` | Job post approval lifecycle guardrails and states. |
| `supabase/matching_payment_state_policy.sql` | Policy allowing admins to set matching fees inside payment credential rows. |
| `supabase/public_recent_jobs_active_view.sql` | Public homepage view for recent active customer-posted jobs. |

## Scratch Diagnostics

| File | Purpose |
| --- | --- |
| `scratch/check_schema.js` | Optional local script for checking Supabase REST schema access. |
| `scratch/test_create_job.js` | Optional local script for inserting a test job into Supabase. |

The scratch scripts are useful for developer checks only. They are not required for Vercel deployment, and some may require local Node packages such as `@supabase/supabase-js` and `ws` if you run them directly.

## Deployment Checklist

1. Run `npm install` if dependencies are missing.
2. Run `npm run build` and confirm the Vite build completes.
3. Check `git status` and review the files that will be committed.
4. Commit the updated project files.
5. Push to the GitHub branch connected to Vercel.
6. Check the Vercel deployment logs and live URL after the automatic deployment finishes.
