# BioTrack AI V5 — Production Smoke Test

Manual iPhone / PWA verification runbook and results log for a production deploy.

> **Privacy:** Do not record medical information, credentials, real emails,
> passwords, or private workout values (weight/reps/RPE/notes) in this file.
> Use placeholder accounts and redact anything sensitive in screenshots.

---

## Test session metadata

| Field | Value |
|-------|-------|
| Commit under test | `2c35399` (`agent/v5-sync-foundation`) |
| Production URL (Pages) | https://biotrack-ai.pages.dev |
| Production URL (custom domain) | https://app.biotrackai.online |
| Deploy-specific alias | https://850c7de7.biotrack-ai.pages.dev |
| Device | _e.g. iPhone 15 Pro_ |
| iOS version | _e.g. iOS 18.x_ |
| Browser / mode | Safari → Add to Home Screen (standalone PWA) |
| Tester | _your name_ |
| Date | _YYYY-MM-DD_ |

---

## Phase 1 — Automated deploy audit (already completed)

These were verified automatically from this machine (no iPhone needed). Values
that require the Cloudflare dashboard are marked as **needs dashboard**.

| Check | Result | Evidence |
|-------|--------|----------|
| Cloudflare Pages deployed commit `2c35399` | ✅ Pass | Pages check-run "Deployed successfully", `Latest commit: 2c35399` |
| `biotrack-ai.pages.dev/` returns 200 | ✅ Pass | Network 200, title "BioTrack AI V5" |
| `app.biotrackai.online/` returns 200 (custom domain connected) | ✅ Pass | Network 200, serves same bundle |
| App renders (login/auth screen, no runtime error) | ✅ Pass | "Welcome back" auth screen renders on desktop and 375×812 mobile viewport |
| Console errors on load | ✅ None | `read_console_messages` empty on both URLs |
| JS/CSS assets load | ✅ Pass | `assets/index-E9otbIx7.js` 200, `assets/index-DynWBe2N.css` 200 (identical on both URLs) |
| `manifest.json` valid | ✅ Pass | 200; `id:"/"`, `name:"BioTrack AI V5"`, `display:standalone`, icons present, theme `#07111f` |
| `sw.js` served + controlling page | ✅ Pass | 200 `application/javascript`; `navigator.serviceWorker.controller` present |
| `apple-touch-icon.png` (180×180) | ✅ Pass | 200 `image/png` |
| `biotrack-icon.svg` (maskable) | ✅ Pass | 200 `image/svg+xml` |
| Deep route `/workout` (SPA fallback) | ✅ Pass | 200 `text/html` (index shell) |
| Production branch `agent/v5-sync-foundation` | ⚠️ needs dashboard | Consistent with production-branch push behavior; confirm in CF dashboard |
| Root dir `v5`, build `npm run build`, output `dist` | ⚠️ needs dashboard | Consistent with a Vite `dist` build being served; confirm in CF dashboard |

**Bundle-hash caveat (honest note):** PR #51 (CI-only) and PR #52 (test-only)
did not change any app source, so the production JS/CSS bundle hashes are
identical across commits `b088885 → 1db88f5 → 2c35399`. The hash alone therefore
cannot uniquely prove "2c35399 vs b088885". The proof that `2c35399` is live is
Cloudflare's own deployment record (check-run names `2c35399`) plus it being the
latest successful production-branch push.

**What still requires a physical iPhone:** everything in Phase 2 below
(install-to-home-screen, real login, workout flows, airplane-mode offline
recovery, update prompt behavior, error-boundary UX, and authenticated
observability writes). These cannot be exercised headlessly.

---

## Phase 2 — iPhone runbook

For each step, mark **Pass / Fail**, record **Actual result**, attach a
screenshot, and note anything unexpected.

### A. Installation

| # | Step | Expected | Pass/Fail | Actual / notes |
|---|------|----------|-----------|----------------|
| A1 | Open `app.biotrackai.online` in Safari | Login screen "Welcome back" loads, no error | | |
| A2 | Share → **Add to Home Screen** | BioTrack icon + name added to home screen | | |
| A3 | Launch from home screen | Opens standalone (no Safari chrome / address bar) | | |
| A4 | Sign in with a test account | Auth succeeds, lands on main app | | |
| A5 | Navigate tabs + open Profile | Navigation works, profile loads without error | | |

### B. Normal workout

| # | Step | Expected | Pass/Fail | Actual / notes |
|---|------|----------|-----------|----------------|
| B1 | Start a workout | Active workout screen opens | | |
| B2 | Complete several sets | Sets marked complete, persist on screen | | |
| B3 | Enter weight, reps, RPE | Values save per set | | |
| B4 | Use the rest timer | Timer starts/counts/ends as expected | | |
| B5 | Skip a set, then restore it | Skip hides/marks it; restore returns it | | |
| B6 | Fully close the app, reopen | App reopens to the still-active session | | |
| B7 | Confirm session still active | Same workout + entered values are present | | |

### C. Offline recovery (core reliability path)

| # | Step | Expected | Pass/Fail | Actual / notes |
|---|------|----------|-----------|----------------|
| C1 | Start a workout while online | Active workout loads | | |
| C2 | Enable Airplane Mode | App stays usable; offline notice may appear | | |
| C3 | Complete a set while offline | Set saved locally (queued in outbox) | | |
| C4 | Fully close the PWA | — | | |
| C5 | Reopen still offline | Workout + the offline set are still there | | |
| C6 | Try **Finish** (offline, pending set) | **Blocked**, message: _"Reconnect before finishing so every saved set reaches your history."_ | | |
| C7 | Try **Cancel** (offline, pending set) | **Blocked**, message: _"Reconnect before cancelling this workout."_ | | |
| C8 | Reconnect (disable Airplane Mode) | Pending set syncs automatically | | |
| C9 | Confirm no duplicate set | The set appears exactly once (not duplicated) | | |
| C10 | Finish the workout | Completes successfully | | |
| C11 | Check History | Workout appears exactly **once** | | |

> Note: when **online with pending sets**, Finish/Cancel are still blocked but
> with the syncing message, e.g. _"BioTrack is still syncing 1 saved set. Retry
> sync before finishing."_ / _"Sync or finish saving the pending sets before
> cancelling."_ (covered by automated tests `workoutClosureGuards.test.ts` and
> `useActiveWorkout.closure.test.tsx`).

### D. Safe update behavior

| # | Step | Expected | Pass/Fail | Actual / notes |
|---|------|----------|-----------|----------------|
| D1 | Observe the update prompt when a new version is available | A non-intrusive "update available" affordance shows | | |
| D2 | During an **active workout** | Does **not** auto-reload | | |
| D3 | With **pending (unsynced) sets** | Does **not** auto-reload | | |
| D4 | Apply update after syncing/finishing | Update applies cleanly on user action | | |
| D5 | After update | Local session/state is **not** lost | | |

### E. Error recovery (Global Error Boundary) — dev/preview only

> Do **not** try to force a crash in production. Exercise this on a local
> `npm run dev` / preview build using a safe, temporary render-error trigger
> (removed before shipping). No crash-trigger should ever be committed.

| # | Step | Expected | Pass/Fail | Actual / notes |
|---|------|----------|-----------|----------------|
| E1 | Trigger a render error (dev/preview) | Global Error Boundary screen appears (not a white screen) | | |
| E2 | Tap **Reload BioTrack** | `window.location.reload()`; app recovers | | |
| E3 | Tap **Repair app files** | Removes only `biotrack-v5-*` caches + unregisters SW, then reloads | | |
| E4 | Confirm data preserved | `localStorage` and the recovery outbox (`biotrack-v5-workout-set-outbox:*`) are **kept** (Repair touches caches/SW only) | | |

### F. Observability (authenticated error reporting)

| # | Step | Expected | Pass/Fail | Actual / notes |
|---|------|----------|-----------|----------------|
| F1 | While signed in, a test error is reported | Row lands in the private client-error table | | |
| F2 | Confirm RLS | Only the owning user can read their rows; no cross-account leakage | | |
| F3 | Confirm payload is minimal | **No** weight/reps/RPE/notes, **no** credentials, **no** sensitive params stored | | |

---

## Issues found

| ID | Scenario | Severity (Blocker/High/Med/Low) | Summary | Steps to reproduce | Expected | Actual |
|----|----------|-------------------------------|---------|--------------------|----------|--------|
| | | | | | | |

---

## Sign-off

- [ ] All Phase 1 automated checks green (see above)
- [ ] Scenarios A–F executed on device
- [ ] Any Blocker/High issues filed and linked
- [ ] No sensitive data recorded in this document

**Result:** _Pass / Pass-with-issues / Fail_

**If issues are found:** fix on a technical branch `agent/v5-production-smoke-fixes`
(branched from the official tip), add a regression test when reasonable, run the
full local gate (`npm ci`, `format:check`, `lint:ci`, `test -- --run`,
`typecheck`, `build`), and open a **draft PR against `agent/v5-sync-foundation`**.
Never commit fixes directly to the official branch or to `main`.
