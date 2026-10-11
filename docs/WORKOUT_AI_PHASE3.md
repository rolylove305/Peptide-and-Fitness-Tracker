# BioTrack AI V5 — Workout AI Phase 3

## Status

Workout AI now supports the complete path from creating a structured routine to completing and saving an actual workout session.

Production V4 remains available from `main`. All V5 work remains isolated in `agent/v5-sync-foundation`.

## Applied Supabase migrations

- `20260712040541_create_workout_ai_foundation`
- `20260712040926_seed_workout_exercise_library`
- `20260712041851_save_workout_routine_tree`
- `20260712042820_add_active_workout_flow`

Matching SQL files are versioned under `supabase/migrations/`.

## Routine Builder

The V5 Routine Builder supports:

- create a routine
- edit an existing routine
- delete a routine and its child records
- add and remove ordered workout days
- add and remove ordered exercises
- choose exercises from the shared library
- configure target sets
- configure minimum and maximum repetitions
- configure programmed rest time
- record optional tempo and notes
- responsive mobile-first editing
- loading, empty, success and error states

### Atomic persistence

`public.save_workout_routine_tree(jsonb, uuid)` saves or replaces the complete routine hierarchy inside a single database transaction.

This prevents partial routines where the routine header is saved but one or more days or exercises fail. The function uses `SECURITY INVOKER`, requires an authenticated user and respects the existing RLS policies.

### Verification performed

Rollback-only tests verified that:

1. A routine with one day and one exercise could be created.
2. The complete hierarchy was visible to its owner.
3. The routine could be edited and replaced with two days and two exercises.
4. The update did not leave old days or exercises behind.
5. All temporary verification data was rolled back.

## Active Workout

The Train workspace supports:

- choose a day from a saved routine
- start one active workout at a time
- snapshot the routine exercises and targets into the session
- generate the planned set rows automatically
- record weight, repetitions and RPE per set
- update previously completed sets
- save each completed set immediately
- elapsed workout timer
- completed-set progress
- programmed rest timer
- add 30 seconds to rest
- skip or close the rest timer
- finish a workout
- cancel a workout
- responsive mobile-first gym interface

### Session integrity

The active-workout migration adds target snapshots to `workout_session_exercises`. Historical sessions therefore keep the targets that existed when the workout began, even if the original routine is edited later.

A partial unique index enforces a maximum of one `in_progress` workout per user.

### Database functions

- `public.start_workout_session_from_day(uuid)`
- `public.complete_workout_session(uuid)`
- `public.cancel_workout_session(uuid)`

All three functions use `SECURITY INVOKER`. Execution is revoked from `public` and `anon`, and granted only to `authenticated` and `service_role`.

### Verification performed

A rollback-only end-to-end test verified that:

1. A temporary routine day could start a workout session.
2. The session received one exercise snapshot.
3. Three planned set rows were generated.
4. A set could store weight, repetitions, RPE and completion time.
5. The workout could be completed after at least one completed set.
6. The completed session contained a completion timestamp.
7. All temporary verification data was rolled back.

## Frontend architecture

New V5 files include:

- `features/workout/RoutineBuilder.tsx`
- `features/workout/ActiveWorkout.tsx`
- `features/workout/WorkoutWorkspace.tsx`
- `features/workout/hooks/useRoutines.ts`
- `features/workout/hooks/useActiveWorkout.ts`
- `features/workout/repositories/routineRepository.ts`
- `features/workout/repositories/activeWorkoutRepository.ts`
- `styles/routine-builder.css`
- `styles/active-workout.css`

UI components remain separated from Supabase access through repositories and feature hooks.

## Security review

Supabase security advisors did not report a new warning caused by the Routine Builder or Active Workout functions.

Existing unrelated project advisories remain:

- `meal_templates` has RLS enabled without a policy.
- `public.rls_auto_enable()` is a pre-existing executable `SECURITY DEFINER` function.
- leaked-password protection is disabled in Auth settings.

These advisories were not mixed into this milestone because they predate Workout AI and require separate review.

## Validation limitation

The SQL functions and RLS behavior were tested directly against Supabase with rollback-only transactions. New TypeScript and TSX files passed syntax transpilation checks.

The complete Vite production build still needs a normal GitHub developer push or pull-request event because connector-created workflow commits do not trigger GitHub Actions automatically.

## Next milestone — History and Progress

1. Completed-workout history.
2. Workout detail view.
3. Previous performance beside each exercise.
4. Personal-record detection.
5. Exercise volume trends.
6. Muscle-group volume summaries.
7. First explainable progression suggestions.
