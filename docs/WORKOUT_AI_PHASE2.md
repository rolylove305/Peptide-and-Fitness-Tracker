# BioTrack AI V5 — Workout AI Phase 2

## Status

Workout AI now has a secure, normalized database foundation and a first connected exercise-library experience in the V5 workspace.

Production V4 remains available from `main`. V5 work remains isolated in `agent/v5-sync-foundation`.

## Applied Supabase migrations

- `20260712040541_create_workout_ai_foundation`
- `20260712040926_seed_workout_exercise_library`

Matching SQL files are versioned under `supabase/migrations/`.

## Workout AI tables

- `exercise_library`
- `workout_routines`
- `workout_routine_days`
- `workout_routine_exercises`
- `workout_sessions`
- `workout_session_exercises`
- `workout_sets`

The legacy `workout_plan` table remains untouched for compatibility with the current application.

## Security model

- RLS is enabled on all new tables.
- The shared exercise library is read-only for authenticated users.
- Routine and session headers are protected by `user_id = auth.uid()` ownership checks.
- Child tables verify ownership through their parent routine or session.
- UPDATE policies use both `USING` and `WITH CHECK`.
- Anonymous access is revoked from all new Workout AI tables.
- The browser uses only a publishable Supabase key.

## Verification performed

A rollback-only database test simulated two authenticated users.

1. User A created a routine, routine day, routine exercise, workout session, session exercise and completed set.
2. User A could access the created hierarchy.
3. The JWT subject was changed to User B.
4. User B saw zero rows from User A's routine, day, session and set.
5. The transaction was rolled back, leaving no test records.

An authenticated library query also confirmed that all 35 active exercises are visible through RLS.

## Exercise library

The initial library contains 35 exercises across 11 primary muscle groups. Each record includes:

- name and stable slug
- primary and secondary muscle groups
- equipment
- step-by-step instructions
- difficulty
- future media fields for image, GIF or video demonstrations

Media fields are intentionally nullable until licensed or internally hosted demonstrations are selected.

## V5 frontend completed

- Typed Supabase client for Workout AI.
- Feature repository layer; UI components do not query Supabase directly.
- Loading, ready, empty and error states.
- Search by exercise, muscle or equipment.
- Muscle-group and equipment filters.
- Responsive exercise cards.
- Expandable instructions.
- Image/GIF/video support with a fallback until media is added.
- Online/offline and authenticated-session shell.

## Automated verification

`.github/workflows/v5-check.yml` is prepared to run TypeScript checking and the Vite production build on normal developer pushes and pull requests that modify V5 or its migrations.

GitHub does not trigger a workflow from the same app credential that creates or updates the workflow, so the first run must come from a normal GitHub push or pull-request event.

## Existing project advisories

Supabase advisors did not identify new RLS problems in the Workout AI tables. Existing advisories outside this migration remain for later cleanup, including:

- `meal_templates` has RLS enabled without a policy.
- `public.rls_auto_enable()` is a pre-existing executable `SECURITY DEFINER` function.
- Some older TMS and legacy Workout policies use the non-optimized `auth.uid()` form.
- Leaked-password protection is disabled in Auth settings.

These were not changed during the Workout AI foundation to avoid mixing unrelated modifications into this milestone.

## Next milestone — Routine Builder

1. Create routine repository/service methods.
2. Build routine list and empty state.
3. Add routine creation form.
4. Add ordered workout days.
5. Select exercises from the connected library.
6. Configure sets, rep range and rest time.
7. Save the complete routine through RLS-protected tables.
8. Add edit, duplicate, archive and delete flows.
