# BioTrack AI V5 — Workout AI Phase 7

## Status

Workout AI has reached the controlled preview and user-acceptance stage.

The protected V5 branch remains isolated from production:

- source branch: `agent/v5-sync-foundation`
- release-candidate PR: `#5`
- repeatable validation lane: `#8`
- production V4 remains on `main`
- no V5 merge or production deployment has been performed

## Release-readiness work completed

Phase 7 completed the release-readiness items identified at the end of Phase 6:

1. reconciled the V5 branch with current `main`
2. committed a deterministic npm lockfile
3. executed dependency-resolved TypeScript checking
4. executed a real Vite production build
5. verified the intended Supabase project configuration inside the compiled JavaScript
6. generated a downloadable GitHub Actions artifact
7. published an immutable static preview from the verified build
8. restored the validation workflow after the one-time preview publication
9. removed or disabled temporary validation infrastructure

At the time this document was created, the V5 branch was:

- 107 commits ahead of `main`
- 0 commits behind `main`

## Automated validation

GitHub Actions uses:

- Ubuntu 24.04
- Node.js 22.16.0
- the committed `v5/package-lock.json`

The validation workflow performs:

1. `npm ci --ignore-scripts --no-audit --no-fund`
2. `npm run typecheck`
3. creation of the browser-safe `.env.production`
4. `npm run build`
5. verification that the compiled JavaScript contains the expected Supabase project reference
6. verification that the compiled JavaScript contains the browser-safe publishable key
7. upload of the `biotrack-v5-preview` artifact

The restored workflow completed successfully after the preview publication cleanup.

## Verified build artifact

The downloaded GitHub Actions artifact had:

- artifact name: `biotrack-v5-preview`
- ZIP size: 645,407 bytes
- ZIP SHA-256: `79e084f6261008914e4d09df9c6321601e3b1d8a4b5286fd38b13ded0002c032`

The compiled application contains:

- `index.html` — 573 bytes
- `assets/index-CBhTTFm3.css` — 35,594 bytes
- `assets/index-CPIuJPk6.js` — 487,217 bytes
- `assets/index-CPIuJPk6.js.map` — 2,328,424 bytes

The static preview branch is:

- `temp/v5-built-preview`

Its immutable preview commit is:

- `7b9215f6b265b4df37083b4f3d62c3a3dc95f52f`

## Controlled preview

The immutable preview URL is:

`https://raw.githack.com/rolylove305/Peptide-and-Fitness-Tracker/7b9215f6b265b4df37083b4f3d62c3a3dc95f52f/index.html`

The preview host may show a one-time confirmation screen before opening HTML from a repository. It is a validation and demonstration URL, not the final production host.

Direct verification confirmed:

- HTML returned HTTP 200 as `text/html; charset=utf-8`
- CSS returned HTTP 200 as `text/css; charset=utf-8`
- JavaScript returned HTTP 200 as `application/javascript; charset=utf-8`

## User acceptance checklist

### Authentication

- [ ] open the preview in a normal browser tab
- [ ] create a test account when appropriate
- [ ] sign in with an existing account
- [ ] confirm the authenticated workspace appears
- [ ] refresh the page and confirm the session remains valid
- [ ] sign out and confirm protected content disappears
- [ ] verify password-recovery messaging
- [ ] verify useful feedback for invalid credentials

### Exercise Library

- [ ] search by exercise name
- [ ] filter by muscle group
- [ ] open several exercise cards
- [ ] confirm the library remains readable on a narrow phone screen

### Routine Builder

- [ ] create a routine
- [ ] add multiple days
- [ ] add, remove and reorder exercises
- [ ] edit sets and repetition ranges
- [ ] enter an optional target weight
- [ ] switch between pounds and kilograms
- [ ] save the full routine
- [ ] reopen the routine and confirm all values persisted

### Active Workout

- [ ] start a workout from a saved routine day
- [ ] confirm target weights prefill working sets
- [ ] record weight, repetitions and RPE
- [ ] add and remove sets
- [ ] use the rest timer
- [ ] confirm previous performance is visible
- [ ] confirm progression guidance is visible when enough evidence exists
- [ ] complete the workout
- [ ] start a second workout and test cancellation

### History and analytics

- [ ] confirm the completed session appears in History
- [ ] expand session details
- [ ] verify set order, weights, repetitions and RPE
- [ ] verify total sets, repetitions and volume
- [ ] verify muscle-group volume
- [ ] verify exercise records
- [ ] confirm cancelled sessions do not appear as completed workouts

### Progression approval

- [ ] open the Progression tab
- [ ] inspect recommendation rationale and evidence
- [ ] confirm no recommendation silently changes a routine
- [ ] select a matching routine occurrence
- [ ] compare current and proposed values
- [ ] apply an allowed load or repetition change
- [ ] confirm the routine reflects the approved change
- [ ] confirm an audit record appears
- [ ] undo the change
- [ ] confirm the routine returns to its previous values
- [ ] verify a later manual edit is not overwritten by undo

### Mobile acceptance

Test at minimum:

- [ ] iPhone portrait
- [ ] Android-sized portrait viewport
- [ ] narrow width near 360 pixels
- [ ] keyboard open while editing sets
- [ ] long routine and exercise names
- [ ] scrolling while the active-workout controls are visible
- [ ] buttons near the bottom safe area
- [ ] no horizontal page overflow

## Release gate

V5 must remain unmerged until:

1. signed-in acceptance testing is completed
2. mobile findings are documented
3. blocking defects are fixed on the protected branch
4. migrations are reviewed one final time
5. the release candidate receives a fresh successful build
6. an explicit decision is made to replace or coexist with production V4

## Known preview limitations

- the preview uses a free third-party CDN and has no formal uptime guarantee
- the first HTML visit may require a confirmation click
- the preview is immutable; new source changes require a new build and preview commit
- it is connected to the configured Supabase project, so testers should use deliberate test data
- the preview is not a production deployment decision

## Cleanup completed

After publishing the preview:

- the temporary workflow modification was removed from the V5 branch
- workflow permissions returned to read-only content access
- the extra validation PR was closed without merging
- temporary Supabase HTTP access was removed
- temporary Edge Function installers and rendering experiments were disabled
- the duplicate Supabase preview bucket was returned to private access

## Next milestone

The next milestone is UAT-driven stabilization:

1. test the immutable preview on desktop and mobile
2. record exact screens and actions for every defect
3. fix only reproducible findings
4. rebuild and publish a new immutable preview
5. repeat the affected acceptance checks
6. prepare a release recommendation without merging automatically
