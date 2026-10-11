# BioTrack AI V5 — Workout AI Phase 5

## Status

Workout AI now converts recent completed working sets into deterministic, explainable progression guidance.

Production V4 remains on `main`. All V5 work remains isolated in `agent/v5-sync-foundation` and draft pull request #5. Nothing in this phase automatically changes a routine, target repetition range or training load.

## Applied migration

- `20260712045817_add_workout_progression_guidance`

The matching migration is versioned at:

- `supabase/migrations/20260712045817_add_workout_progression_guidance.sql`

## Database function

The migration adds:

- `get_workout_progression_recommendations(uuid[], integer)`

The function:

- runs as `SECURITY INVOKER`
- uses an empty `search_path`
- is executable by `authenticated` and `service_role`
- is not executable by `anon`
- filters all workout history by `auth.uid()`
- analyzes between two and six recent sessions, with three as the application default
- keeps pounds and kilograms separated
- excludes warm-up sets, incomplete sets and sets without recorded repetitions
- returns structured evidence as JSON for every recommendation
- never updates workout or routine data

The migration also adds a partial index for completed workout history:

- `workout_sessions_user_completed_idx`

## Progression rules

The first version intentionally uses conservative, transparent rules instead of an opaque model.

### Consider a small load increase

Returned when:

- at least two comparable completed sessions exist
- every working set reached the top of its programmed repetition range in both recent sessions
- the latest average RPE is absent or no higher than 8.5

The application does not select or apply a new weight. It tells the user to consider the smallest available load increase.

### Add repetitions

Returned when:

- the latest working sets stayed inside the programmed repetition range
- the average repetitions have not yet reached the top of the range
- the latest average RPE is absent or no higher than 8.5

The visible suggestion is to add one repetition to one or more working sets.

### Review before progressing

Returned when:

- the latest minimum repetitions fell below the programmed minimum, or
- the latest average RPE is 9.5 or higher

BioTrack does not diagnose a cause. It holds progression and suggests reviewing recovery, form and recorded effort.

### Hold steady

Returned when the available sessions do not provide clear evidence for a load or repetition change.

### More data needed

Returned when fewer than two comparable sessions exist, the programmed repetition range is missing or the latest session contains fewer than two completed working sets.

## Confidence

Each recommendation includes a confidence level:

- `low`: fewer than two usable sessions
- `medium`: at least two usable sessions
- `high`: at least three usable sessions with RPE recorded in at least two of them

Confidence describes the amount of comparable evidence. It is not a medical or safety rating.

## User experience

### Progression tab

The new `Progression` tab includes:

- load opportunities
- repetition opportunities
- review-before-progressing items
- hold and more-data items
- filters by recommendation type
- latest weight, average repetitions, average RPE and programmed range
- expandable evidence for every analyzed session
- confidence labels
- explicit notices that no changes were applied

### During Active Workout

The existing previous-performance provider now retrieves progression recommendations in one batched request for all exercises in the active session.

Under each exercise, BioTrack can show:

- the previous completed working sets
- a compact progression action
- the rationale
- confidence
- a reminder that no target, repetition, load or routine was changed

No request is made per individual exercise.

## Frontend architecture

The phase adds:

- `v5/src/features/workout/repositories/progressionRepository.ts`
- `v5/src/features/workout/hooks/useProgressionRecommendations.ts`
- `v5/src/features/workout/ProgressionDashboard.tsx`
- `v5/src/styles/progression.css`

The repository extends the current database contract locally with the new RPC signature. It validates recommendation type, confidence, weight unit, numeric values and JSON evidence before exposing data to React.

The central generated database type should be regenerated or synchronized again when the next schema consolidation is performed.

## Verification performed

A rollback-only functional test created six temporary completed sessions covering three exercises.

The function returned:

- `increase_load` after two sessions where all working sets reached 10 repetitions in an 8–10 range at average RPE 8
- `increase_reps` when the latest session averaged 9 repetitions in an 8–10 range at average RPE 8
- `review_recovery` when the latest session averaged 7 repetitions in an 8–10 range at average RPE 9.5

Each result included:

- the expected action label
- medium confidence
- two evidence sessions

The transaction was rolled back.

## Isolation verification

A second rollback-only test simulated two authenticated users.

User A created two completed sessions that qualified for load progression. The JWT context was then changed to User B. User B received:

- `0` progression recommendations from User A's data

The transaction was rolled back.

## Security verification

Direct database checks confirmed:

- `SECURITY INVOKER`: true
- empty `search_path`: true
- `anon` execute privilege: false
- `authenticated` execute privilege: true
- temporary test residue: zero rows

## Supabase advisors

No new security or performance warning was reported for the progression function.

Existing unrelated project advisories remain, including:

- `meal_templates` with RLS enabled but no policy
- the pre-existing public `SECURITY DEFINER` function `rls_auto_enable()`
- leaked-password protection disabled in Auth
- older TMS RLS policies that do not use `(select auth.uid())`
- older indexes currently reported as unused

Those advisories were not introduced by Workout AI Phase 5.

## Build limitation

The V5 GitHub Actions workflow still exists only on the V5 branch, so the draft pull request cannot run that workflow from the `main` base branch.

The local execution environment could not resolve GitHub to clone the repository and therefore could not run the full Vite production build. The TypeScript and React files were reviewed directly after being written, but this phase must not be described as having passed a full automated build.

## Next milestone

The next safe step is an explicit approval workflow:

1. let the user open a recommendation
2. identify the exact routine exercise that could be modified
3. show the current value and proposed value side by side
4. require a clear confirmation
5. apply the change atomically through an owned RPC
6. record an audit entry describing what changed and why
7. provide an undo action

No automatic routine editing should be added before that approval and audit path exists.
