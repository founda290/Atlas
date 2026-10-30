# Accounts and project modes — implementation plan

Date: 2026-10-30. Baseline: Phase 4B merge f30cbed. Work stays on `arena/b43198a0-atlas`.

## Audit and decisions

- The current signup/login screens deliberately never submit credentials; they are not authentication. Replace these stubs with real Neon-compatible Better Auth client operations, session loading, sign-out, email verification and password reset. Preserve React/Vite and visual design.
- Existing Vercel project `atlas` has integration-managed `VITE_NEON_AUTH_URL`, `NEON_AUTH_BASE_URL`, and database variables for preview/production. Values were not decrypted. No new identity provider or password database is needed.
- Use the maintained Better Auth client against Neon's Better Auth API for email/password flows. Do not implement a password vault. Account creation success must come from the provider. Missing configuration and provider failures remain explicit.
- Browser-local and backend-local are different. Existing local OpenCode execution stays loopback-only. Add an IndexedDB project/file editor usable on the deployed site without a local server. It does not pretend to run Node, Git, OpenCode, or background jobs. Offer an optional screen wake lock and export/import; a browser can still suspend/terminate a tab.
- Cloud projects stay **server-side disabled**. Implement contracts, owned PostgreSQL metadata repository, migration, authenticated serverless control-plane boundary and worker provisioning adapter. No paid infrastructure, production database migrations, or runner provisioning during this change. Enabling a frontend flag must never enable execution.
- Do not connect the public API to the trusted single-user local execution backend. Authenticated account identity does not turn that backend into a multi-tenant sandbox.

## Delivery checklist

- [x] Account create/sign-in/session/sign-out/verify/reset flows; explicit provider errors and configuration state. Live provider acceptance is an operator action, not claimed by fixtures.
- [x] Browser project CRUD, durable source editing and concurrency checks, export/import, awake lifecycle and limitations.
- [x] Project mode choice and account/settings/sidebar integration; cloud disabled with exact reason.
- [x] Cloud schema/control-plane/ownership/signed worker client plus security-negative tests; no secret values in client builds. Actual worker/runtime and live database integration remain future engineering.
- [x] 104 unit/API/component tests, 33 browser tests, type checks, builds, formatting and zero-vulnerability audit; detailed implementation and operator Markdown guides.
- GitHub delivery: commit/push fixed branch, PR, wait for checks, merge and verify; actual identifiers/results are recorded in the PR and final session report.
