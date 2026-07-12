# BioTrack AI V5 — Workout AI Phase 8

## Status

The public authentication experience now includes a complete user-controlled password recovery flow.

Production V4 on `main` remains unchanged. All changes remain isolated in `agent/v5-sync-foundation` and draft PR #5.

## Added authentication capabilities

- `Forgot password?` action on the sign-in screen.
- Email-only password-reset request screen.
- Generic success feedback that does not reveal whether an account exists.
- Reset links redirect back to the exact current V5 URL.
- `PASSWORD_RECOVERY` auth events open a dedicated new-password screen.
- New-password and confirmation fields use browser password-manager metadata.
- Mismatched passwords are rejected before any network mutation.
- Recovery state is preserved in `sessionStorage` during a same-device refresh.
- Successful password updates clear recovery state and return the authenticated user to the app.
- Recovery can be cancelled safely through sign-out.

## Supabase implementation

The flow uses the official Supabase JavaScript methods:

- `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- `supabase.auth.updateUser({ password })`
- `onAuthStateChange` with the `PASSWORD_RECOVERY` event

The redirect URL must be included in the hosted project's allowed Auth redirect URLs before a public preview or release URL is used for live recovery-email acceptance testing.

## Automated acceptance completed

The compiled GitHub Actions artifact was exercised in headless Chromium at desktop and iPhone-sized viewports.

Verified:

- Sign-in screen renders with no console errors.
- Create-account screen renders and returns to sign in.
- Required fields, email formatting, name length and password length are enforced.
- Forgot-password screen contains only the email field.
- Forgot-password screen returns to sign in.
- Incoming recovery state renders two password fields.
- Password mismatch displays `The two passwords do not match.`
- Sign-in, signup, reset-request and password-update screens have no horizontal overflow at 390px.
- Desktop and mobile recovery layouts are visually coherent.

## Build verification

GitHub Actions completed successfully after the recovery implementation:

- BioTrack V5 Check run #109 — success
- BioTrack V5 Check run #110 — success
- BioTrack V5 Validation run #20 — success

The locked install, TypeScript check, Vite build, public preview configuration verification and artifact upload all passed.

## Manual acceptance still required

- Send a real recovery email from an allowed preview URL.
- Open the link on the same device.
- Save a new password.
- Sign out and sign back in using the new password.
- Confirm refresh persistence with a real authenticated session.
