# BioTrack AI V5 — Workout AI Phase 4

## Status

Workout AI now converts completed training sessions into reviewable history and measurable progress.

Production V4 remains on `main`. All V5 work remains isolated in `agent/v5-sync-foundation` and in draft pull request #5. The pull request must not be merged until the branch is reconciled with the latest production changes and the V5 release path is intentionally approved.

## Applied migration

- `20260712043902_add_workout_history_analytics`

The matching migration is versioned at:

- `supabase/migrations/20260712043902_add_workout_history_analytics.sql`

## Analytics layer

The migration adds three RLS-aware `security_invoker` views:

- `workout_session_summaries`
- `workout_exercise_records`
- `workout_muscle_volume_daily`

It also adds:

- `get_previous_exercise_performance(uuid[])`

The function returns the latest completed working sets for each requested exercise and only evaluates data belonging to the authenticated user.

No workout data is duplicated. The views calculate summaries from the normalized session, exercise and set tables already used by Active Workout.

## History experience

The new History tab includes:

- recent completed workouts
- workout duration
- exercise and working-set counts
- total repetitions
- training volume separated by weight unit
- expandable session details
- exercise-by-exercise set history
- weight, repetitions and RPE for each recorded set
- loading, error and empty states

## Previous performance during training

Active Workout now retrieves previous performance in one batched request for all exercises in the current session.

Under each exercise, BioTrack shows:

- date of the previous completed session
- previous working-set weights
- previous repetitions
- the correct weight unit

This is historical context only. BioTrack does not silently modify the routine or prescribe a new load.

## Personal records

Exercise records currently track:

- heaviest completed working-set weight
- highest completed repetition count
- best single-set volume
- total sessions
- total completed working sets
- total repetitions
- last performed date

Records remain separated by `lb` and `kg` so incompatible units are never summed together.

## Muscle-group progress

The History tab aggregates the latest 90 days by primary muscle group and weight unit.

Each group shows:

- completed working sets
- repetitions
- total load volume
- a relative visual progress bar

Warm-up and incomplete sets are excluded from records and muscle-volume calculations.

## Type safety

The central V5 database type now includes:

- Active Workout snapshot columns
- analytics views
- routine, workout and history RPC definitions

Routine, Active Workout and History repositories now use the typed Supabase client directly instead of provisional local RPC casts.

## Verification performed

A rollback-only analytics test created one temporary completed session with three working sets:

- 50 lb × 12
- 60 lb × 10
- 65 lb × 8

The analytics layer returned:

- 45-minute duration
- 3 working sets
- 30 total repetitions
- 1,720 lb total volume
- 65 lb heaviest set
- 600 lb best single-set volume
- all three previous-performance sets in order

A second rollback-only test simulated two authenticated users. After User A created a completed workout, the JWT context changed to User B. User B received zero rows from:

- session summaries
- exercise records
- muscle-volume history
- previous exercise performance

Both tests were rolled back and left no verification records.

## Supabase advisors

No new advisory was reported for the Phase 4 views or function. Existing unrelated project advisories remain tracked separately, including older RLS configuration, an existing event-trigger function and Auth password-protection settings.

## Automated build limitation

Draft pull request #5 was opened to trigger the V5 workflow without merging into `main`.

GitHub did not start the workflow because `.github/workflows/v5-check.yml` currently exists only on the head branch. Pull-request workflows are evaluated from the base branch, and adding the workflow to production solely to validate an unfinished V5 branch would violate the isolation strategy.

The draft PR remains open for review and is not mergeable in its current diverged state. No production code was changed.

## Next milestone

The next Workout AI phase should add explainable progression guidance based on real history:

1. compare the current session with previous performance
2. detect completed rep-range progression
3. identify plateaus without diagnosing medical causes
4. suggest small, transparent load or repetition changes
5. require the user to accept any routine modification
6. show the evidence used for every recommendation
