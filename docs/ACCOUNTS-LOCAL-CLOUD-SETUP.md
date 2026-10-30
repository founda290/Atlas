# Atlas operator guide: account acceptance and hosted launch

Current status: Atlas now opens to a chat-first workspace, but hosted AI execution is not deployed and the composer remains disabled. Browser-local projects are optional source editing, not an agent. Neon email/password flows are implemented but have not passed live account acceptance.

See [delivery evidence](ACCOUNTS-LOCAL-CLOUD-DELIVERY.md) for the implementation and test boundaries. The older Phase 4B reports describe earlier milestones and are historical.

## Current hosted modes

| Surface                | Current behavior                                      | Data and limits                                                                         |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Chat                   | Primary workspace after sign-in. Sending is disabled. | No demo conversations or simulated replies; no hosted worker exists.                    |
| Browser-local projects | Optional create/edit/import/export in the browser.    | IndexedDB in one browser profile; not account-synced; no agent, Git or background jobs. |
| Cloud projects         | Disabled on the server.                               | No project, VM, container or paid worker is created.                                    |
| Accounts               | Neon email/password client flows are implemented.     | Live provider, email, trusted-origin and browser-cookie behavior remain unverified.     |

An Atlas account is identity, not file synchronization. Signing in does not upload browser-local projects; signing out does not delete them. People sharing the same browser profile can access its project data.

## What is configured—and what is not verified

Metadata inspection of the connected Vercel `atlas` project previously confirmed:

- Production domain: **https://atlascody.vercel.app**.
- Integration-managed `VITE_NEON_AUTH_URL`, Neon Auth base URL, database and Postgres variables exist in preview/production.
- Vercel serves the React/Vite application and the hosted `/api/cloud` control-plane function. It does not provide the persistent `/api/v1` execution API.

No Neon account was created, no live password was submitted, no production schema was migrated, and no paid worker was started. Environment metadata alone does not prove email delivery, trusted-origin setup, session cookies or successful sign-in.

The live production response confirms the API boundary: `GET https://atlascody.vercel.app/api/v1/health` returns `404 text/plain` with Vercel `NOT_FOUND`; `GET https://atlascody.vercel.app/api/cloud` returns `200 application/json` and `enabled: false`. The old “Atlas API did not return JSON” message appeared because a hosted page called the missing `/api/v1` route and attempted to parse Vercel’s plain-text 404 as JSON. The chat-first route no longer calls that endpoint.

## Live account acceptance checklist

### 1. Confirm Neon Auth settings

1. In the Neon console, select the project/branch linked to the Atlas Vercel integration and open Auth settings.
2. Confirm that Auth is enabled for email/password and is the Better Auth service expected by the current client. A legacy Stack Auth service is not interchangeable by changing only the URL.
3. Privately compare the public HTTPS Auth base URL, including its auth path, with Vercel’s integration-managed `VITE_NEON_AUTH_URL`. It is not a database URL, secret key or signing key.
4. Add the exact production trusted origin `https://atlascody.vercel.app`. Add any custom domain as its own exact HTTPS origin. Do not allow every Vercel preview or arbitrary origin.
5. Confirm `/account` callback and `/reset-password` redirect handling in the provider’s supported trusted-origin configuration.
6. Choose the email-verification policy. Configure and verify the provider’s sender, SMTP and required SPF/DKIM/DMARC records. Atlas does not fabricate email delivery or bypass verification.
7. Review signup protection, rate limits and email/reset expiry. Do not weaken security to force a test to pass.

### 2. Confirm Vercel configuration and deployment

1. In Vercel → Atlas → Settings → Environment Variables, confirm the integration-managed `VITE_NEON_AUTH_URL` is assigned to the intended production/preview environments. Vite embeds `VITE_*` values at build time, so changes need a new deployment.
2. Never expose `DATABASE_URL`, Neon administrative keys, SMTP passwords, model/provider secrets or `ATLAS_CLOUD_WORKER_SECRET` through any `VITE_*` variable.
3. Deploy the merged application. CI/Vercel build checks do not verify real signup or email delivery. The `/api/` rewrite deliberately excludes API paths from the SPA fallback; only `/api/cloud` is currently deployed.
4. Confirm `/api/cloud` still returns JSON with `enabled: false`. A browser-side change or a cloud flag must not enable project creation.

### 3. Test with an inbox you control

Use a test address and inbox you control. Do not post passwords, verification links or reset links in chat, issues or logs.

- On `/signup`, enter a name, valid email, unique 12–128 character password, matching confirmation and acknowledgement. Submit and observe whether Neon establishes a session or requires email verification.
- Follow the real verification email. On `/account`, confirm the actual email and verification state; use **Send verification email** only if needed.
- Sign out, reload and sign back in. Confirm the visible sidebar action and account page. Reopen another tab and focus it to test session refresh.
- Use **Forgot password?** and confirm the generic response. Follow the real reset email, change the password, then sign in with the new password. Confirm the reset token is removed from the URL after success.
- Submit a wrong password; it must report an error and must not show an authenticated state.
- Test Chrome and Safari/Firefox. If cross-site cookie restrictions block sessions, use Neon’s supported same-site/custom Auth domain or a supported server-side auth design. Do not store auth tokens/passwords in localStorage or disable browser privacy controls.

Before public account launch, publish the real privacy policy, terms, contact method, and retention/deletion process. OAuth/social sign-in, profile editing, in-account password change, MFA UI and self-service account deletion are not implemented; use provider administration until these are deliberately added.

## Optional browser-local projects

1. Open **Projects** or `/browser-projects` and choose **New browser project**. No example source is seeded.
2. Create files and use **Save browser file** or Ctrl/Cmd+S. A successful save means the IndexedDB transaction completed; it does not upload, sync or run code.
3. Export a JSON backup before clearing site data or using private browsing. Import creates a fresh project identity; it does not overwrite another project.
4. Another tab’s save increments the revision. A stale save is refused and the draft remains visible; export/copy it before reloading.
5. Delete requires the exact project name and permanently removes that browser copy. Export first.

Projects are scoped to the browser profile and website origin. Data does not follow a user between preview and production origins, browsers or devices. The path policy is not a content-secret scanner; do not put credentials in source files or exported backups.

## Hosted AI execution: keep disabled

No isolated coding worker or hosted `/api/v1` service is deployed. Do not tell customers to install or configure a local coding runtime as a substitute. Do not enable Chat sending or cloud creation until a real hosted service is implemented and independently accepted.

The existing control-plane contract and separate migration are groundwork only. A real worker must, at minimum:

- Implement authenticated, idempotent provision/stop operations and verify the signed request (timestamp plus endpoint path plus exact raw body) with constant-time HMAC comparison and a short validity window.
- Bind each project to its verified owner and enforce a real per-tenant VM/container/sandbox boundary, restricted egress, non-root permissions, CPU/memory/process/time limits and tested cleanup.
- Persist job/session state; reconcile ambiguous provisioning, stop and cancellation outcomes; enforce leases and cleanup if the control plane fails; never silently retry a prompt.
- Add distributed concurrency/rate limits, abuse protections, quotas, cost caps and operational alerting.
- Integrate actual source storage, file/Git/session APIs, provider credential isolation and owner checks. Neon Postgres and Vercel static hosting do not supply a coding sandbox.
- Pass live database, multi-tenant, lifecycle, cancellation, restart, network-isolation and security tests before any release gate is opened.

The production release gate in `cloudPolicy` intentionally short-circuits cloud mutations. There is no environment-variable shortcut to activate it. No cloud resources have been provisioned.

## Next order

1. Finish Neon trusted-origin, verification-email, session-cookie and live inbox checks above.
2. Deploy the chat-first UI and verify `/chat` loads without calling `/api/v1`; confirm `/api/cloud` remains disabled.
3. Publish privacy/terms/support and account retention/deletion policies before general account rollout.
4. Choose and build a hosted worker platform, source-storage design and cost/safety policy. Only then implement live Chat execution and browser cloud-project routes.
5. Keep the composer and cloud mutations disabled until the full hosted worker acceptance suite passes.
