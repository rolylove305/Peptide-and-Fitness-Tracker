# BioTrack AI V5 — Workout AI Phase 6

## Status

Workout AI now supports an explicit, audited progression workflow:

1. calculate an explainable recommendation
2. locate the matching saved routine exercise
3. compare current and proposed targets
4. require explicit user approval
5. revalidate the recommendation inside PostgreSQL
6. apply the change atomically
7. preserve before-and-after values
8. allow a protected undo when no later edit would be overwritten

Production V4 remains on `main`. All Phase 6 work remains isolated in `agent/v5-sync-foundation` and draft pull request #5.

## Applied migrations

- `20260712051751_add_progression_approval_workflow`
- `20260712052825_harden_progression_load_application`
- `20260712052923_prevent_reusing_progression_evidence`
- `20260712053246_index_progression_changes_exercise`

The matching SQL files are versioned under `supabase/migrations/`.

## Routine load targets

`workout_routine_exercises` now stores:

- optional `target_weight`
- `weight_unit` (`lb` or `kg`)

The Routine Builder can create and edit both values. Existing routines remain valid because target weight is optional and the unit defaults to pounds.

`workout_session_exercises` now snapshots:

- `target_weight_snapshot`
- `weight_unit_snapshot`

When a new workout starts, BioTrack copies the saved target into the session snapshot and prefills every generated working set. Completed historical sessions remain immutable.

## Change audit table

`workout_progression_changes` records:

- owning user
- routine exercise reference
- exercise, routine and day names at application time
- recommendation type and confidence
- complete recommendation evidence snapshot
- before target weight, unit and repetition range
- after target weight, unit and repetition range
- applied or undone status
- applied and undone timestamps

RLS restricts records to the owning authenticated user. Anonymous access is revoked.

## Apply workflow

`apply_workout_progression_change(...)` is `SECURITY INVOKER` with an empty `search_path`.

Before applying, it:

- requires authentication
- locks the selected routine exercise
- confirms ownership through the routine hierarchy
- checks that the current target still matches the preview
- recalculates the progression recommendation
- confirms the recommendation type is still current
- confirms the programmed repetition range still matches the analyzed sessions
- allows only `increase_load` and `increase_reps`
- prevents a load change from also changing repetitions
- prevents a repetition change from also changing load
- rejects lower or unchanged repetition targets
- requires a proposed load above both recent comparable performance and the current saved target

The routine update and audit insert occur in one database transaction.

## Duplicate-evidence protection

A partial unique index prevents the same active recommendation evidence from being applied more than once to the same routine exercise.

The uniqueness key contains:

- routine exercise
- recommendation type
- latest performed timestamp from the recommendation snapshot

Once a change is undone, that active uniqueness lock is released.

## Protected undo

`undo_workout_progression_change(uuid)` is also `SECURITY INVOKER` with an empty `search_path`.

Undo succeeds only when:

- the change belongs to the authenticated user
- the change is still applied
- the original routine exercise still exists
- the current routine target still equals the recorded after-values

If a manual or newer automated edit changed the target after approval, undo raises SQLSTATE `40001` and refuses to overwrite that newer work.

## User interface

The Progression tab now includes:

- routine occurrence selection
- current versus proposed target comparison
- editable proposed load or repetition range
- explicit `Approve and apply` action
- final confirmation before mutation
- success and error feedback
- approval history with before and after values
- applied or undone status
- protected undo action

The Routine Builder now includes optional target weight and lb/kg selection. New workout sets are prefilled from those targets.

## Verification performed

### Apply and undo

A rollback-only test created two comparable squat sessions at:

- 100 lb
- 3 sets of 10 repetitions
- average RPE 8
- programmed range 8–10

The approval RPC changed the routine target from 100 lb to 105 lb and created an applied audit record. Undo restored 100 lb, marked the record `undone` and recorded `undone_at`.

### Later-edit protection

After applying 100 → 105 lb, the test manually changed the target to 110 lb. Undo returned SQLSTATE `40001` and refused to overwrite the newer target.

### Cross-user isolation

After User A created a temporary routine and change record, the JWT context switched to User B. User B saw:

- zero change records
- zero matching routines

### Duplicate evidence

Two active audit inserts using the same routine exercise, recommendation type and evidence timestamp were attempted. The second insert was rejected by the unique index.

### Future workout prefill

A temporary routine target of 77.5 kg generated:

- a 77.5 kg exercise snapshot
- three working sets
- all three sets prefilled with 77.5 kg

### Residue

All verification transactions were rolled back. Final checks returned zero temporary routines and zero temporary change records.

## Security verification

Confirmed:

- apply function is `SECURITY INVOKER`
- undo function is `SECURITY INVOKER`
- both functions use an empty `search_path`
- `anon` cannot execute either function
- `authenticated` can execute both functions
- change table has RLS enabled
- duplicate-evidence index exists
- no Phase 6 security advisory was reported

## Performance advisor

The advisor initially identified the audit table's `exercise_id` foreign key as unindexed. Migration `20260712053246_index_progression_changes_exercise` added the covering index. A second advisor run no longer reported that issue.

Remaining warnings relate to older TMS policies, the legacy `workout_plan` table and newly created indexes that have not accumulated production usage.

## Build limitation

A full dependency-resolved Vite production build has still not been observed. GitHub Actions does not run because the workflow exists only on the head branch, and the current execution environment cannot resolve GitHub to clone or install the project.

The database migrations, permissions, RLS behavior, transactional operations and rollback-only integration scenarios were verified directly. The React and TypeScript changes received manual structural review, but the branch must still receive a real `npm run typecheck` and `npm run build` before release.

## Next milestone

The next safe milestone should focus on release readiness rather than adding more Workout AI behavior:

1. reconcile the protected V5 branch with the four newer `main` commits
2. generate and commit a dependency lockfile
3. run a real TypeScript and Vite build
4. fix any build findings
5. create a controlled preview deployment separate from production V4
6. perform mobile and signed-in user acceptance testing
