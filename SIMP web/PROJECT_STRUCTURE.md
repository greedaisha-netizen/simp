# Project Structure Guide

This project currently works as a local standalone web app.

The goal of this file is to help the next person quickly understand:
- where the admin side lives
- where the learner side lives
- which shared files support both sides
- which files were kept separate on purpose

## Main folders

### `ADDING_COURSE/`
Admin-side pages and tools.

Use this folder for:
- creating courses
- editing lessons
- admin dashboard views
- admin messages and discussions
- admin classroom preview

Main files:
- `admin.html` / `admin.css` / `admin-shell.js`
  Main admin workspace
- `addcourse.html` / `addcourse.css` / `addcourse.js`
  Course builder
- `addlesson.html` / `addlesson.css` / `addlesson.js`
  Lesson editor
- `coursemanagement.html` / `coursemanagement.css` / `coursemanagement.js`
  Course list and management page

### `enroll/`
Learner-facing pages.

Use this folder for:
- public landing page
- learner classroom
- learner library
- assessments
- learner discussions and private messages

Main files:
- `learn.html` / `learn.css` / `learn.js`
  Public landing page
- `classroom/classroom.html` / `classroom.css` / `classroom.js`
  Main learner workspace after enrollment

### `shared/`
Files used by both admin and learner sides.

Main files:
- `course-store.js`
  Shared course data source and helper methods
- `media-store.js`
  Shared browser media storage helper
- `vendor/live2d/`
  Live2D viewer libraries used by Steqyy

## Lesson player files

### `ADDING_COURSE/classroom/class_platform/`
Admin lesson preview player

### `enroll/classroom/class_platform/`
Learner lesson player

These two folders are separate because:
- one is used from admin preview
- one is used from learner sessions

They should stay very similar.
If one side gets a lesson-player fix, the other side usually needs the same update too.

## Files that were combined

The learner landing page styles were previously split into many small CSS files.
They are now combined into:

- `enroll/learn.css`

This makes the public landing page easier to maintain because all landing-page styles are in one place.

## Files that should stay separate

These areas are clearer when kept separate:

- `learn.js`
  Public landing logic
- `classroom.js`
  Main learner app logic
- `class_platform/class.js`
  Actual lesson session logic
- `admin-shell.js`
  Main admin workspace logic
- `course-store.js`
  Shared course data logic

They are large, but each one owns a different part of the app.
Combining them further would make debugging harder.

## Local data used right now

The project currently stores most working data in the browser.

Examples:
- published courses
- enrolled lessons
- lesson progress
- reviews
- discussion posts
- private messages

This is fine for local testing.
For a real online deployment, these parts would later move to a real backend and database.

## Suggested reading order for a new developer

If someone is new to the project, this is the easiest order:

1. `PROJECT_STRUCTURE.md`
2. `shared/course-store.js`
3. `enroll/learn.html`, `enroll/learn.css`, `enroll/learn.js`
4. `enroll/classroom/classroom.html`, `classroom.css`, `classroom.js`
5. `enroll/classroom/class_platform/class.js`
6. `ADDING_COURSE/admin.html`, `admin.css`, `admin-shell.js`

## Simple rule for future cleanup

When deciding whether to combine or separate files:

- combine files when they only belong to one page and are small or tightly related
- keep files separate when they power different app areas or different user roles
- keep shared logic in `shared/` when both admin and learner use it
