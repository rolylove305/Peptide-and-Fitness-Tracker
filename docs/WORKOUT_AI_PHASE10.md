# BioTrack AI V5 — Workout AI Phase 10

## Status

A new immutable public preview has been published from the browser-accepted V5 build.

Production V4 on `main` remains unchanged. V5 remains isolated in `agent/v5-sync-foundation` and draft PR #5.

## Published preview

Preview branch:

`temp/v5-built-preview-latest`

Immutable preview commit:

`5803a6572337b27ace9544c35e17f1033dba5a07`

Preview URL:

`https://raw.githack.com/rolylove305/Peptide-and-Fitness-Tracker/5803a6572337b27ace9544c35e17f1033dba5a07/index.html`

The branch contains only the compiled static application:

- `index.html`
- `assets/index-CdChOElP.js`
- `assets/index-BDtb6RjV.css`
- source map
- `.nojekyll`

## Included fixes

The preview includes:

- sign in and account creation
- password reset request UI
- incoming password recovery and new-password UI
- routine target weight and lb/kg support
- active workout, set persistence and rest timer
- workout completion and cancellation
- History, records and muscle volume
- explainable progression
- explicit progression approval
- audit history and protected undo
- duplicate-evidence protection
- populated Progression mobile overflow correction

## Publication verification

The publication workflow completed successfully and pushed the orphan static branch.

The published `index.html` references:

- `./assets/index-CdChOElP.js`
- `./assets/index-BDtb6RjV.css`

The source workflow was immediately restored to read-only repository permissions after publication.

Post-restoration validation completed successfully:

- BioTrack V5 Check #128
- BioTrack V5 Check #129
- BioTrack V5 Validation #27

## Security boundary

- `main` was not modified.
- GitHub Pages production was not replaced.
- The preview branch contains compiled static assets only.
- The temporary workflow permission increase was removed.
- The normal workflow again uses `contents: read`.
- The browser contains only the Supabase publishable key, never a service-role secret.

## Live acceptance

The preview is intended for the remaining tests tracked in issue #11:

- real authenticated session persistence
- real recovery email and redirect allow-list
- real routine and workout writes
- real History results
- real progression generation, application and undo
- physical iPhone behavior

Test data should be deliberate because the preview connects to the existing Supabase project.
