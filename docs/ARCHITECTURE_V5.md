# BioTrack AI V5 — Architecture Foundation

## Project status

BioTrack AI V5 will be developed in the protected branch:

`agent/v5-sync-foundation`

The current application deployed from `main` remains available while V5 is built and tested separately. No production table or working V4 feature should be removed during the V5 foundation phase.

## Product goal

Build BioTrack AI as a professional, installable health and fitness PWA with secure per-user cloud data, reliable synchronization, modular features, and a foundation capable of supporting AI-assisted insights.

The first complete product module is **Workout AI**.

## Current-state audit

The existing application is a static single-page PWA using:

- HTML and CSS in the repository root
- Vanilla JavaScript
- Supabase Auth and Postgres
- GitHub Pages deployment
- `app.js` as the main application
- additive patch scripts such as `app-fix.js`, `daily-v2.js`, and `sync-v5.js`

This approach allowed fast progress, but the application now has multiple scripts modifying the same interface and event handlers. V5 must stop growing through overlay patches.

## V5 migration strategy

V5 will be built alongside the current app instead of replacing it all at once.

1. Preserve the current root application as the production fallback.
2. Build the new application in a dedicated `v5/` workspace.
3. Reuse the existing Supabase project and user accounts.
4. Introduce new database tables through versioned migrations.
5. Migrate one feature at a time.
6. Test V5 independently before changing the production deployment.

## Target frontend architecture

V5 will use:

- Vite
- React
- TypeScript
- Supabase JavaScript client
- Installable PWA configuration
- Feature-based modules
- A shared design system
- Explicit loading, success, empty, offline, and error states

The application will not store business logic directly inside page markup.

### Proposed workspace

```text
v5/
  src/
    app/
      App.tsx
      routes.tsx
      providers/
    components/
      ui/
      feedback/
      layout/
    features/
      auth/
      dashboard/
      workout/
      progress/
      protocols/
      inventory/
      nutrition/
      reminders/
      ai-coach/
    lib/
      supabase/
      validation/
      dates/
      units/
    styles/
    types/
  public/
  tests/
  package.json
```

## Data-access rules

- UI components do not call Supabase directly.
- Each feature uses a typed repository/service layer.
- Every request returns a consistent success or error result.
- Mutations update the screen only after a confirmed database result.
- Sync status must distinguish loading, synced, offline, and failed states.
- Existing data must be read without destructive conversion.

## Supabase separation

The connected Supabase project currently contains both BioTrack tables and dispatch/TMS tables.

### Protected unrelated tables

The following business tables are outside BioTrack and must not be modified by BioTrack migrations:

- `brokers`
- `carriers`
- `expenses`
- `loads`

BioTrack V5 migrations will affect only explicitly named BioTrack tables.

## Existing BioTrack tables

The current application uses:

- `user_profiles`
- `peptide_items`
- `daily_logs`
- `vial_inventory`
- `progress_logs`
- `workout_plan`
- `meal_templates`

Existing records will remain intact during the V5 foundation.

## Workout AI domain model

The existing `workout_plan` table stores only a day name, workout name, exercises text, and notes. It is insufficient for exercise history, sets, repetitions, progression, or analytics.

Workout AI will use normalized tables rather than storing an entire workout as one text field.

### Proposed tables

#### `exercise_library`

Canonical exercise definitions.

- `id`
- `name`
- `slug`
- `primary_muscle_group`
- `secondary_muscle_groups`
- `equipment`
- `instructions`
- `media_url`
- `difficulty`
- `is_active`

Library rows may be readable by authenticated users but are not owned by individual users.

#### `workout_routines`

User-created or AI-created routine headers.

- `id`
- `user_id`
- `name`
- `description`
- `goal`
- `difficulty`
- `is_active`
- `created_at`
- `updated_at`

#### `workout_routine_days`

Days or sessions within a routine.

- `id`
- `routine_id`
- `day_order`
- `name`
- `focus`

#### `workout_routine_exercises`

Ordered exercises and targets for a routine day.

- `id`
- `routine_day_id`
- `exercise_id`
- `exercise_order`
- `target_sets`
- `target_reps_min`
- `target_reps_max`
- `target_rest_seconds`
- `notes`

#### `workout_sessions`

One actual completed or in-progress workout.

- `id`
- `user_id`
- `routine_day_id`
- `started_at`
- `completed_at`
- `status`
- `notes`

#### `workout_session_exercises`

Exercise-level results inside a workout session.

- `id`
- `session_id`
- `exercise_id`
- `exercise_order`
- `notes`

#### `workout_sets`

Individual set history.

- `id`
- `session_exercise_id`
- `set_number`
- `weight`
- `weight_unit`
- `reps`
- `duration_seconds`
- `distance`
- `distance_unit`
- `rpe`
- `is_warmup`
- `completed_at`

This structure supports weight and repetition history, personal records, rest timers, muscle-group volume, and future AI recommendations.

## Security requirements

- RLS must be enabled on every user-owned table.
- User-owned records require `user_id = auth.uid()` checks.
- UPDATE policies require both `USING` and `WITH CHECK`.
- Shared exercise-library content must not allow normal users to modify canonical rows.
- The browser may contain only a publishable/anon key, never a service-role key.
- Medical or protocol tracking remains organizational and must not present automated dosing as medical direction.

## Workout AI first milestone

The first usable Workout AI release must provide:

1. Exercise library with search and muscle/equipment filters.
2. Routine builder.
3. Start-workout screen.
4. Set-by-set weight and repetition logging.
5. Rest timer.
6. Previous-performance display for each exercise.
7. Completed-workout history.
8. Basic progress by exercise and muscle group.
9. Responsive mobile-first interface.
10. Clear cloud-sync and offline states.

## AI boundary

The first milestone stores structured training data before generating AI advice. AI recommendations will be added only after reliable history exists.

AI output should explain its reasoning using the user's recorded training data and must never silently overwrite routines or logs.

## Use of Claude

Claude may be used as a secondary technical reviewer for:

- architecture comparisons
- complex refactors
- bug analysis
- SQL and RLS review
- accessibility review
- test-case generation

This chat remains the official source of project decisions. Suggestions from any secondary model must be reviewed before implementation.

## Implementation phases

### Phase 1 — Foundation

- Architecture document
- V5 workspace scaffold
- Environment configuration
- Supabase typed client
- Authentication shell
- Routing and layout
- Error and sync-state system

### Phase 2 — Workout database

- Versioned SQL migration
- RLS policies
- Seed exercise-library structure
- Generated TypeScript database types
- Database verification and security advisors

### Phase 3 — Workout experience

- Library
- Routine builder
- Active workout
- Sets and timer
- History
- Progress

### Phase 4 — Existing feature migration

- Profile and dashboard
- Daily tracking
- Progress measurements
- Nutrition
- Inventory and protocols
- Reminders

### Phase 5 — AI Coach

- Weekly summaries
- Progression suggestions
- Plateau detection
- Routine recommendations
- User-controlled acceptance of every change

## Definition of a safe change

A V5 change is complete only when:

- it is committed to the V5 branch
- it does not alter the production app unexpectedly
- database changes are versioned
- RLS is verified
- the primary mobile flow is tested
- loading and failure states are handled
- the implementation is documented
