# Accounts, browser-local projects and disabled cloud — delivery analysis

Date: 2026-10-30. Baseline: merged Phase 4B (`f30cbed`). Session branch: `arena/b43198a0-atlas`. See [operator setup and exact manual steps](ACCOUNTS-LOCAL-CLOUD-SETUP.md) and [audit/plan](ACCOUNTS-AND-PROJECT-MODES-PLAN.md).

## Executive result

The account screens no longer deliberately refuse every valid submission. They now use real email/password signup, sign-in, session lookup, sign-out, verification-email and password-reset client operations against the configured Neon-compatible Better Auth service. Missing configuration or provider rejection remains an error—not fabricated account success.

Atlas now offers **browser-local**, **local-backend**, and **cloud** project choices. Browser-local projects are a functioning IndexedDB source editor/project store. The existing local OpenCode backend is preserved. Cloud creation is disabled both in the UI and the server; the schema, owned control-plane dispatch and signed worker integration foundations are installed, but a real isolated cloud execution service is not deployed or claimed complete.

**Important acceptance boundary:** automated account tests deliberately mock the external provider. No live Neon account, email delivery, cookie session, password reset or cloud worker was exercised from this sandbox. The operator must complete the live checklist. The existence of Vercel environment variables is configuration evidence only.

## What changed

### 1. Accounts

- Replaced `authenticate()`/`register()` unconditional failure stubs with a dedicated `src/services/account.ts` service.
- Uses maintained `better-auth/client` and its JWT plugin against the actual configured HTTPS `VITE_NEON_AUTH_URL`. Standard email/password endpoints match Neon's Better Auth API. No self-built password database, fake user table, browser password vault or fabricated session flag.
- Signup validates name/email, unique-password length 12–128, confirmation and storage/limitations acknowledgement before calling the provider. Confirmation is not sent as an additional credential field. Name length is bounded.
- Provider signup acknowledgement is not equated with a session: Atlas explicitly fetches the current session, navigates to browser projects only after a session is observed, or requests verification/checking email when no session exists.
- Account context loads real sessions, refreshes on focus/visibility/cross-tab sign-out, clears local identity on sign-out, and invalidates stale in-flight refreshes after sign-out.
- `/account` displays actual returned identity/email verification, supports verification resend, refresh and sign-out. Sidebar/settings use real account status instead of hard-coded “No account”.
- Forgot-password submits the real request-reset endpoint; `/reset-password` consumes the provider token and submits a new password. The token is removed from the URL after successful reset.
- Account failures are sanitized; raw provider diagnostics are not rendered. Requests use credentials/cookies and bounded fetch timeout. No account passwords/JWTs are written by Atlas to localStorage, sessionStorage or IndexedDB.
- OAuth/social login, MFA/profile/password-change/account-deletion UI and custom auth-cookie proxy are **not** implemented. Provider-side policies, trusted origins, email delivery, privacy/terms and cross-site cookie compatibility need operator review.

### 2. Browser-local projects

- New `/browser-projects` and `/browser-projects/:browserId` routes work independently of the local API and account availability.
- Real IndexedDB schema/store; UUID project identity, name/description, created/updated timestamps, ordered listing, revision and source files. Data is persisted only after transaction completion.
- Create/reopen/rename/description/permanent exact-name-confirmed deletion. No demo project/files are seeded.
- Create/select/edit/save/rename/delete source files using the existing lazy CodeMirror implementation. Virtual nested folders are represented by relative file paths.
- Project-level revision CAS makes cross-tab changes fail safely without overwriting committed work. Failed saves retain the visible draft. Reload and ordinary navigation/unload guards are explicit.
- Export/import portable versioned JSON. Exports include the current editor draft; import creates a new identity instead of replacing another project. Imported source remains text and is never executed or inserted as HTML.
- Limits: 200 files, 256 KiB/file, 8 MiB source/project, 12 MiB JSON import. Validate traversal, secrets/Git/dependency path patterns, UTF-8 round-tripping, NUL text, duplicates and file/folder collisions. These are not a content-secret scanner.
- Optional visible-tab screen wake lock with release/reacquisition/status handling and explicit unsupported/denied states. This is **not background agent execution**, a terminal or a guarantee against suspension/device sleep.
- Browser source is not synchronized to Neon, attached to account ownership, encrypted by account login, or written to a host folder. Shared browser profiles are shared access. Export/backups remain necessary; browser termination can lose unsaved drafts.

### 3. Project modes and existing functionality

- Existing New project dialog supports real browser-local creation or the original managed backend project. Hosted origins default to browser-local; localhost keeps backend mode as the default. Cloud option is disabled.
- Added mode navigation on dashboard/projects/sidebar and a dedicated cloud-readiness page.
- Existing managed filesystem/Git/OpenCode/session services and security boundaries remain unchanged. The public frontend never calls the user's localhost or forwards public traffic to the local execution backend.
- Existing React/Vite routing, warm public pages, technical dark application design, shared controls and preferences are retained.

### 4. Cloud foundations — present, intentionally inactive

| Component              | Present behavior                                                                                                                                                                     | What it does not claim                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `api/cloud.ts`         | Separate Vercel Node entry point; `/api/cloud` readiness returns JSON                                                                                                                | Does not expose local OpenCode/files/shell                                                           |
| Release gate           | `cloudPolicy.enabled` is false; mutation requests fail HTTP 503 before body/SQL/worker operations                                                                                    | No frontend/environment toggle can activate cloud                                                    |
| HTTP control plane     | Owned project list/create/stop/archive dispatch, origin validation, 64 KiB JSON limit, strict allowed fields and ID validation; enabled paths tested with explicit test dependencies | Production remains gated; no active cloud-create UI                                                  |
| Identity               | JWT signature/issuer/audience/expiry/subject validation via configured remote JWKS; bounded verification; no body-supplied owner accepted                                            | No live Neon token acceptance was tested                                                             |
| PostgreSQL             | Parameterized owner-scoped repository; dedicated `atlas_cloud` migration and schema version                                                                                          | Migration not run; no live Neon query/write validation                                               |
| Worker contract/client | HTTPS/HMAC requests, 10-second deadline, idempotency/project/owner binding, network/time-policy request, bounded identity-matched acknowledgements; failure is not marked ready      | It is not a sandbox/VM/container provider or complete cloud coding worker                            |
| Lifecycle              | Pending → provisioning or failed metadata; stop acknowledgement required before stopped/archive state                                                                                | No distributed queue, agent/session/files/streaming integration, worker reconciliation or quotas yet |

A worker must enforce isolation and actual termination, persist source, implement job/session/file/Git/streaming integration, reconcile ambiguous calls and enforce distributed budgets. Merely provisioning a PostgreSQL database does none of those. Full details and an activation checklist are in the setup guide. **Do not enable the gate to discover whether these capabilities exist.**

## External configuration inspection

The connected Vercel `atlas` project was queried for metadata. Its existing Neon-managed Auth/database variables and verified `atlascody.vercel.app` domain were confirmed. No values were decrypted, no new auth provider was installed externally, and no production database/worker/account was changed. The operator guide uses that actual domain rather than an invented deployment URL.

## Validation ledger

Clean install and complete local regression passed on 2026-10-30:

| Command/check                               | Result                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm ci`                                    | Passed from lockfile                                                                           |
| `npm run lint`                              | Passed strict frontend/backend/test and Vercel-entry TypeScript checks                         |
| `npm test`                                  | **104/104 passed, 11 files**                                                                   |
| `npm run build`                             | Passed; existing large-chunk advisory remains (main/editor approximately 653/656 KiB minified) |
| `npm run server:build`                      | Passed                                                                                         |
| `npm run format:check`                      | Passed                                                                                         |
| `npm audit --audit-level=high`              | **0 vulnerabilities**                                                                          |
| `git diff --check`                          | Passed                                                                                         |
| `ATLAS_BUNDLED_CHROMIUM=1 npm run test:e2e` | **33/33 passed**, including the existing 29-test regression and 4 new mode/account tests       |

Evidence classification:

- **Real browser storage/UI:** mobile 390px and desktop 1440px browser project creation, save, reload, rename/details, export/import, confirmed deletion, unsaved-navigation preservation, cross-tab conflicting saves and cloud rejection. These use actual Chromium IndexedDB and the application.
- **Explicit external auth fixture:** a separately configured test Vite server uses an `.invalid` test-only Auth origin, intercepted by Playwright. Actual maintained client calls and complete signup/sign-in/error/session/verification/logout/reset UI paths are exercised; no real account or inbox is used.
- **Real cryptography with test keys:** JWT signing/verification and wrong-audience rejection are tested; remote JWKS resolution is mocked. Owner-scoped SQL query protocol is tested, not a live Neon database.
- **Explicit worker mock:** signed request construction, owner-matched acknowledgement, oversized/mismatched responses, provisioning failure and owned lifecycle tested. No cloud resource is provisioned.
- **Wake lock:** lifecycle test uses an explicitly mocked browser API. Actual browser/OS wake permission and sleep behavior cannot be guaranteed by this test.
- **Preserved Phase 4B:** real local filesystem/Git/SQLite integration and API/component/browser regression remain passing. Genuine model coding remains blocked as previously documented, not solved by account activation.

Warnings are not hidden: Node 22 SQLite is experimental; the production bundle has large-chunk advisories; the installed test dependency emits a deprecated `whatwg-encoding` warning. No dependency vulnerabilities were reported. Final GitHub PR/check/merge/deployment identifiers are reported from their actual results, not predicted here.

## What is next

### Operator actions now

1. Confirm the existing Neon Auth service is the supported Better Auth variant; configure exact production/local trusted origins, callback/reset paths and email sender/verification policies.
2. Redeploy after configuration changes and perform real signup, verification, sign-in/out and password-reset acceptance using an inbox you control. Check browser cookie compatibility. Publish actual privacy/terms/support before public rollout.
3. Use browser-local projects with export backups, or run the local backend and configure a reachable OpenCode provider through its supported local credential flow.
4. Leave cloud disabled. Optionally review/apply the additive schema to an isolated Neon development branch, never production as an acceptance target.

### Engineering after this delivery

- Choose and implement an isolated durable cloud coding worker and its source/session/Git/streaming integration, distributed queue/concurrency/leases, abuse controls, cost caps, credentials isolation and failure recovery.
- Perform real multi-user owner-boundary, network-isolation, coding, cancellation, restart, cleanup and backup/restore acceptance.
- Add the actual cloud project/editor/session UI and activate only via a deliberately reviewed release. This is more than toggling an environment variable.
- Consider supported same-site auth hosting for privacy-restricted browsers, account profile/MFA/deletion flows, browser crash recovery/draft journaling and frontend bundle splitting as subsequent work.

The detailed, step-by-step manual runbook is [ACCOUNTS-LOCAL-CLOUD-SETUP.md](ACCOUNTS-LOCAL-CLOUD-SETUP.md).
