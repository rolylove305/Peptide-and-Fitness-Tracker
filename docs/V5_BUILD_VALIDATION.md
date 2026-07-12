# BioTrack AI V5 build validation

This temporary validation marker exists to trigger the V5 pull-request checks against the protected development branch.

It does not change production behavior and must never be used as a release signal by itself. The required checks are:

- dependency installation
- TypeScript typecheck
- Vite production build
