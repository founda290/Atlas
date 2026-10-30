# Atlas operator guide: accounts, browser-local, local backend and cloud

Updated: 2026-10-30. Read [delivery evidence](ACCOUNTS-LOCAL-CLOUD-DELIVERY.md) for exactly what was implemented/tested. Older Phase 4B documents describe the baseline and are historical, not the current account feature status.

## 1. Understand the modes first

| Mode          | Where source lives                                                                           | What runs                                                                                              | What happens when the browser closes?                                                                                                        | Account needed?                                    |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Browser-local | IndexedDB in this exact browser profile and website origin                                   | Source editor and project management only                                                              | Unsaved editor drafts can be lost. Committed files normally remain, subject to eviction/private-mode/site-data settings. No agent continues. | No                                                 |
| Local backend | Your machine's managed directories and SQLite (or explicitly configured PostgreSQL metadata) | Existing local OpenCode adapter, real Git and file services                                            | The separately running local backend has its own lifetime. Closing a tab is not a guarantee of cancellation. Reopen to inspect status.       | No; trusted single-user loopback boundary remains  |
| Cloud         | Future persistent worker volume/object storage plus owned Neon metadata                      | Control-plane code and worker integration contract are present, but creation/execution is **disabled** | No cloud jobs currently exist or run. Future workers must have enforced leases/quotas and survive browser disconnects appropriately.         | Verified account required before future operations |

An Atlas account is identity, **not** a file-sync service. Signing in never uploads browser-local or local-backend projects. Signing out does not remove their source. People sharing a browser profile can access browser projects even after sign-out. Do not store sensitive work in shared profiles.

“Keep this screen awake” requests the browser's **screen wake lock**, only while supported/allowed and the tab is visible. It is not a background task scheduler, WebContainer, terminal, Node runtime, or device-sleep guarantee. Browsers/operating systems can release it. Atlas reacquires it when the tab becomes visible if still selected. Turning it off or leaving the page releases the lock.

## 2. What is already configured externally

Metadata inspection of the connected Vercel `atlas` project confirmed:

- Production project domain: **https://atlascody.vercel.app** (verified in project domain metadata).
- Neon integration-managed `VITE_NEON_AUTH_URL`, `NEON_AUTH_BASE_URL`, database and Postgres variables exist in preview/production.
- The frontend remains React/Vite. A separate Vercel Node function exposes only `/api/cloud`, not local execution.

No secret values were decrypted, no Neon account was created for you, no live account/password was submitted, no production schema was migrated, and no paid worker was started. Environment metadata alone does not prove email delivery, trusted-origin configuration, session cookies or successful sign-in.

## 3. Manual actions you must do now for live accounts

### A. Confirm Neon Auth settings

1. In your existing Neon console, select the project/branch linked to the Vercel Atlas integration. Open **Auth** and its configuration/settings.
2. Confirm Auth is enabled and supports **email/password** signup and sign-in. This code targets Neon's Better Auth API, not a legacy Stack Auth project. If the integration points to legacy Stack Auth, migrate/choose the Better Auth service first; changing a URL alone cannot convert protocols.
3. Copy/check the **public Auth base URL**, including its actual auth path. Compare it privately with `VITE_NEON_AUTH_URL` in Vercel. It is an HTTPS service URL, not a PostgreSQL connection string, API secret or signing key.
4. Add the exact production trusted origin **`https://atlascody.vercel.app`**. If you use a custom domain, authorize that exact HTTPS origin too. Only authorize specific preview origins you trust—do not broadly allow every Vercel deployment or arbitrary origins.
5. Allow account callbacks to `/account` and password-reset redirects to `/reset-password` on the approved origin. Neon may configure this via trusted origins rather than a separate path list; follow your console's current controls. The application never accepts an arbitrary return URL from a query string.
6. Choose your email-verification policy. Configure the provider's supported email sender/SMTP, sender identity and any required DNS records (SPF/DKIM/DMARC). Complete sender verification in the email provider. Atlas does not fabricate mail delivery or bypass verification.
7. Review signup abuse protection/rate limiting with Neon, enable available protections, and check email/reset expiry settings. Do not disable security just to make a test pass.

### B. Confirm Vercel and redeploy

1. Open Vercel → Atlas → Settings → Environment Variables.
2. Confirm the existing integration-managed `VITE_NEON_AUTH_URL` is assigned to the environments you want to use. Do not overwrite a managed value with an example. Vite embeds `VITE_*` at **build time**, so environment changes require a new deployment.
3. Never add `DATABASE_URL`, Neon administrative keys, SMTP passwords, model/provider keys or `ATLAS_CLOUD_WORKER_SECRET` under a `VITE_` name. Database and worker secrets are server-only.
4. Deploy the merged code. GitHub/Vercel checks verify builds, not live registration. The API rewrite deliberately excludes `/api/` from SPA fallback.
5. Confirm `https://atlascody.vercel.app/api/cloud` returns JSON with `enabled: false`. Creating a cloud project must still fail with HTTP 503 even if someone edits the browser UI or adds a cloud environment flag.

### C. Run a real acceptance test yourself

Use a test address/inbox **you control**, without putting passwords or links in chat/issues/logs:

- `/signup`: enter a name, valid email, unique 12–128 character password, matching confirmation and acknowledgement. Submit. Provider acceptance may either establish a session or require email verification. No session is invented.
- Follow the verification email. `/account` should show your actual email and verification status. Use **Send verification email** there if needed.
- Sign out, refresh, then sign in again. Check the account sidebar/account page. Reopen another tab and focus it to refresh session state.
- Sign out and use **Forgot password?**. Submit your email. Generic inbox wording deliberately avoids revealing account existence.
- Follow the real reset link, choose a new matching password, and sign in with it. The reset token is removed from the page URL after successful reset.
- Test a wrong password: it must produce an error, not a dashboard success.
- Test in Chrome and Safari/Firefox. Cross-site cookie restrictions can block direct Neon Auth sessions even when signup succeeds. If this occurs, configure Neon's supported same-site/custom Auth domain or a supported server-side auth integration before launch. This change does **not** include a custom cookie-rewriting proxy. Do not solve it by storing auth tokens/passwords in localStorage or disabling browser privacy controls.

Before public launch, publish your real privacy policy/terms/contact and retention/deletion process. The checkbox currently acknowledges technical storage/execution limitations, not invented commercial terms. OAuth/social sign-in, profile editing, password-change-in-account, MFA UI and self-service account deletion are not implemented here; use provider administration until deliberately added.

## 4. Use browser-local projects now

1. Visit `/browser-projects`, or choose **Browser-local** in New project. The hosted site's new-project selector defaults to browser-local; localhost defaults to the existing backend mode.
2. Create a project. No example source is inserted. Create a file such as `src/main.ts`, edit it, then **Save browser file** or Ctrl/Cmd+S.
3. Saved means the IndexedDB transaction completed, not that files were uploaded, committed to Git or written into a host folder.
4. Nested paths represent virtual folders. Rename/delete individual files; update project name/description. Source is limited to 200 files, 256 KiB per UTF-8 text file and 8 MiB total. Traversal, sensitive path patterns, Git internals, NUL text, duplicate/file-folder collisions and invalid text are refused.
5. **Export project & draft** downloads a versioned JSON backup that includes the currently open draft. Keep copies outside browser storage. Import the bundle to create a new project identity on another browser/device/origin; it does not overwrite an existing project.
6. Another tab changing a project increments its revision. A stale save is refused and the losing draft remains visible. Export/copy the draft before reloading from storage; do not repeatedly force a stale save.
7. Delete requires the exact current project name. Unlike local-backend registration deletion, browser deletion permanently removes that browser copy. Export first.

Browser data does not follow you between `localhost`, `atlascody.vercel.app`, preview URLs, different browsers, or browser profiles. Clearing site data/private browsing/storage pressure can delete committed data. Unsaved-navigation guards do not protect against power loss or process termination. Do not put provider credentials in source or exported bundles; path filters are not a content-secret scanner.

## 5. Use real local OpenCode execution

```bash
npm ci
npm install -g opencode-ai@1.19.5
opencode --version

# In separate terminals, from this repository:
npm run server:start
npm run dev
```

Use **http://127.0.0.1:5173** for local-backend work. The hosted website does not silently connect to `localhost` on your device. Keep the execution API on loopback; do not expose it through a public tunnel or loosen the CORS/origin proxy protections to make a hosted page control it.

Configure your provider through OpenCode's supported local credential flow. Select a model actually discovered by your runtime. Run the genuine acceptance script in an environment where that provider endpoint is reachable:

```bash
npm run runtime:check -- --execute --model PROVIDER/MODEL --timeout-ms 120000
```

Replace `PROVIDER/MODEL` with a real discovered model. Increasing a timeout does not fix blocked outbound access or prove credentials. Phase 4B's actual `opencode.ai` model request timed out in Arena without tools/file changes; this account work does not resolve that provider/network constraint. See `docs/PHASE-4B.md`.

For local account development only, copy `.env.example` to `.env.local`, set the actual public Neon URL, authorize your exact local origin in Neon, and restart Vite. Vite reads that file; the separately launched Node backend does not automatically load it. Export backend environment variables explicitly. You can edit browser-local projects with `npm run dev` alone—no OpenCode CLI is required for that mode.

## 6. Cloud groundwork installed, but KEEP IT DISABLED

Installed components:

- `server/src/cloud/projects.ts`: server-side release gate, owned lifecycle service and worker contract.
- `server/src/cloud/control.ts`: readiness, authenticated list/create/stop/archive dispatch; strict origin/body/identity checks; bounded JWT verification. The production release gate short-circuits all mutations before SQL/worker calls.
- `server/src/cloud/repository.ts`: parameterized owner-scoped PostgreSQL repository.
- `server/src/cloud/worker.ts`: HTTPS/HMAC-signed worker client, bounded calls/acknowledgements, idempotent provisioning identity and acknowledgement checks.
- `cloud/migrations/001-projects.sql`: additive, separate schema. **Not applied automatically or to your production database.**
- `api/cloud.ts`: Vercel control-plane function; never imports the local OpenCode server.

### What you can configure manually, without enabling execution

1. Create an **isolated Neon development branch** and back up/identify the target database. Do not test migrations against production.
2. Review the SQL. If approved, execute it in that branch using the Neon SQL editor, or with a connection URL already stored securely in your shell:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f cloud/migrations/001-projects.sql
   ```

   This creates `atlas_cloud` only. It does not modify `neon_auth` or local Atlas tables. `IF NOT EXISTS` is not a replacement for checking schema drift. Create a least-privilege server role with only the necessary schema/table rights; do not expose it as a browser/anonymous role.

3. For future server-side identity validation, obtain the actual JWKS URL, issuer and audience from your Neon Auth service's documented metadata. Set `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`, `NEON_AUTH_AUDIENCE` server-side. Do not guess these values; they are not the database host or frontend URL.
4. Set the future server `ATLAS_APP_ORIGIN` to the exact approved app origin. Mutation dispatch rejects mismatched/missing origins.
5. If you have a real isolated worker service, configure its HTTPS base endpoint as server-only `ATLAS_CLOUD_WORKER_URL`, with a dedicated strong random `ATLAS_CLOUD_WORKER_SECRET` (at least 32 characters). Rotate it independently of auth/database/model credentials. **These variables do not activate cloud creation.**

### Engineering that must precede cloud activation (not merely dashboard switches)

A worker implementation is **not** provided by Vercel static hosting, Neon Postgres or this signing client. Choose/build a real isolated execution service before activation. It must:

- Implement `POST /v1/workspaces` and `POST /v1/workspaces/{projectId}/stop`.
- Verify the HMAC-SHA256 hex digest over `timestamp + '.' + endpoint suffix path + '.' + exact raw JSON body`, use constant-time comparison, enforce a short timestamp window, validate the request schema and enforce owner/project binding. Requests use `x-atlas-timestamp` and `x-atlas-signature`. Restrict the control-plane network identity as well; HMAC alone is not an OS sandbox.
- Enforce provisioning idempotency using the project UUID. Return `{ "accepted": true, "projectId": "...", "ownerId": "..." }` only for the correct operation. A stop acknowledgement must mean execution actually stopped, not merely a queued intent.
- Isolate tenants with a real sandbox/VM/container security boundary, separate durable source volumes, restricted egress, non-root permissions, resource/command/time limits and tested teardown. The requested `maxRuntimeSeconds: 900` and restricted network policy must be enforced by the worker, not treated as suggestions.
- Persist durable job/session/event state, reconcile failed/ambiguous provisioning, enforce leases after control-plane failure, avoid retrying prompts, cancel active tools safely, and clean up orphaned resources. A failed acknowledgement may leave an uncertain remote resource requiring reconciliation.
- Add distributed per-account/project concurrency limits, abuse controls, rate limits, quotas/cost caps and operational alerting. The current in-process/local protections are not a distributed cloud control system.
- Integrate actual cloud file/Git/session/streaming APIs with persistent storage, provider credential isolation and owner checks. These are not implemented by the cloud metadata scaffold.
- Complete real Neon migrations/integration tests and genuine multi-tenant coding/cancellation/restart/network-isolation tests. Current tests explicitly mock the external worker/provider.
- Add browser cloud project list/editor/session routes and enable controls **only after** the entire backend is operational. The current cloud page intentionally offers no active create control.

After all those gates pass, deliberately review/change the source release gate in `cloudPolicy`, wire the approved runtime and UI, run all acceptance/security tests, and deploy through a checked PR. There is intentionally no `VITE_CLOUD_ENABLED` or `ATLAS_CLOUD_ENABLED` shortcut. Cloud remains disabled in this delivery as requested.

## 7. Troubleshooting / next order

1. Finish the Neon origin/email/cookie checks and perform the live account checklist above.
2. Use browser projects immediately; test export/import before important work.
3. Test your chosen OpenCode model locally with actual tools/files, separate from account success.
4. Publish privacy/terms/support and provider-side signup protections before general account rollout.
5. Only then choose a cloud worker/storage provider, cost/security policies and build the missing execution integration. Do not enable cloud to test whether a worker exists.

If signup succeeds but no session appears, investigate Neon verification policy and browser cookies; do not mark a local boolean as authenticated. If the local API is unreachable from the hosted site, that is the intended execution boundary. If a browser project is missing on a different origin/profile, import your backup rather than assuming account sync exists.
