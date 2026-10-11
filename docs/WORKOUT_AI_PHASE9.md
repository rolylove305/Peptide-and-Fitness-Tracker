# BioTrack AI V5 — Workout AI Phase 9

## Status

The compiled V5 preview has completed automated browser acceptance for its principal Workout AI flows using a stateful simulated Supabase backend.

Production V4 on `main` remains unchanged. V5 remains isolated in `agent/v5-sync-foundation` and draft PR #5.

## Acceptance environment

- GitHub Actions production artifact from commit `2beb067f3a586c1281e7251bc1636f151ae433ea`
- Chromium desktop and iPhone-sized viewports
- Locked dependencies from `package-lock.json`
- In-memory authenticated session
- Stateful HTTP interception that reproduces the Supabase REST and RPC response shapes used by the application
- No writes to real user data during browser acceptance

Database RPC behavior and RLS isolation were tested separately against the connected Supabase project in earlier phases.

## Workout cancellation

Verified:

- a saved routine day starts a workout
- the active-workout screen appears
- the cancel confirmation is required
- `cancel_workout_session` is called exactly once
- the active session is removed from the UI state
- the launcher returns with `Workout cancelled.`
- no console or page errors
- no horizontal overflow at 390px

## History and progress

Verified with two completed sessions:

- workout count
- working-set count
- total repetitions
- combined training volume
- recent-session cards
- session duration, exercise count and set count
- expandable session details
- weight, repetitions and RPE per set
- 90-day muscle-group aggregation for Chest and Back
- personal records for Barbell Bench Press and Lat Pulldown
- no console or page errors
- no horizontal overflow at 390px

## Progression approval

Verified:

- recommendation type, confidence, rationale and evidence render
- all three evidence sessions expand correctly
- the matching saved routine target is located
- current target displays as `135 lb · 6–8 reps`
- proposed target displays as `140 lb · 6–8 reps`
- approval requires a browser confirmation
- the apply RPC receives the exact expected and proposed values
- the audited applied change appears in history
- protected undo restores the prior values
- an intentional later-edit conflict returns SQLSTATE `40001`
- the conflict message is shown without losing the audit row
- no page errors

The browser console reports the expected HTTP 409 resource message during the intentional conflict test; this represents the protected server refusal rather than an unhandled application error.

## Mobile overflow finding and fix

The first populated Progression acceptance run exposed a real layout defect:

- viewport width: 390px
- document width: 448px

The root cause was intrinsic grid sizing from the horizontally scrollable workspace tabs and populated progression content.

The fix adds:

- `grid-template-columns: minmax(0, 1fr)` to the workspace
- explicit zero minimum widths for shrinkable grid items
- a 100%-wide internal scrolling tab rail on narrow screens
- width constraints for the progression dashboard and its direct children

After rebuilding:

- viewport width: 390px
- document width: 390px
- body width: 390px

The fix is versioned in:

- `v5/src/styles/workspace-mobile.css`
- `v5/src/main.tsx`

## Build verification

The post-fix commit passed:

- BioTrack V5 Check run #117
- BioTrack V5 Check run #118
- BioTrack V5 Validation run #23

All completed successfully, including locked installation, TypeScript, Vite build, public preview verification and artifact creation.

Artifact digest:

`sha256:d3c382c286952a2cd609a757b3024814d0f69a461783b77cd6cda7f8334b402b`

## Automated browser acceptance completed

- public sign-in and signup screens
- password-reset request and incoming recovery UI
- routine creation and reopening
- target weight, unit, sets, rep range, rest and tempo persistence
- active set completion and update
- rest timer, add 30 seconds and skip
- workout completion
- workout cancellation
- History summaries, detail, records and muscle volume
- progression evidence, approval, audit, undo and conflict protection
- narrow mobile layouts
- keyboard-height simulation without horizontal overflow

## Live acceptance still required

These items require a real user session and are intentionally not claimed as complete:

- real sign in, refresh persistence and sign out
- real recovery email delivery and redirect allow-list confirmation
- real password replacement and subsequent sign in
- real routine creation and reload in Supabase
- real workout completion and History appearance
- real progression generation after sufficient comparable sessions
- real apply and undo through the browser against the authenticated user's records
- physical iPhone testing with the native keyboard and browser chrome
