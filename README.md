# Atlas

Atlas is a chat-first software workspace with optional project editing. The signed-in destination is `/chat`; creating a project is not required to enter the workspace.

## Current product status

- **Hosted Chat is not enabled yet.** No isolated coding worker is deployed, so sending is disabled. The product does not show sample conversations or pretend assistant replies.
- **Browser-local projects are optional.** They support real text-file editing, conflict checks, import and export in the current browser profile. They do not run an AI agent, Git or background jobs, and they are not synced with an account.
- **Neon email/password signup and sign-in flows are implemented.** Live provider configuration, email delivery, trusted origins and browser-cookie acceptance remain unverified.
- **Cloud projects and billing are unavailable.** The control-plane gate remains closed. No cloud resources were provisioned.
- The legacy local execution implementation remains in the repository for engineering and regression coverage; it is not a customer setup requirement and is not connected by the hosted site.

The main release boundary and live account checklist are in the [operator acceptance guide](docs/ACCOUNTS-LOCAL-CLOUD-SETUP.md). Implementation and verification evidence are in the [delivery notes](docs/ACCOUNTS-LOCAL-CLOUD-DELIVERY.md).

## What works in the hosted interface

- Chat-first application entry and sign-in redirect, with no seeded conversations.
- Optional browser-local project create, edit, rename, delete, import and export with bounded text storage and stale-save conflict checks.
- Browser preferences and account session controls, including visible sign-out when signed in.
- Clear unavailable states for hosted execution and pages that require the legacy local API; the hosted app does not attempt to parse its own SPA fallback HTML as API JSON.

## Contributor checks

These commands validate the repository; they are not required for Atlas users:

```bash
npm ci
npm run lint
npm test
npm run build
npm run server:build
npm run format:check
npm audit --audit-level=high
ATLAS_BUNDLED_CHROMIUM=1 npm run test:e2e
```

The Playwright suite starts isolated test services and uses explicit fixtures. Green fixture tests are not evidence of live Neon signup, email delivery, cookie compatibility or real model generation.

## Deployment boundary

The public Vercel deployment serves the Vite application and the `/api/cloud` control-plane endpoint. It does not host the persistent `/api/v1` local execution server. The prior “Unable to load this information” page occurred because a hosted route called `/api/v1` and Vercel returned a plain-text `404 NOT_FOUND` instead of API JSON. The application now routes hosted users to Chat and presents a clear unavailable state instead of calling that missing API.

Do not enable cloud creation until a real isolated worker is implemented, deployed and independently tested for tenant isolation, resource and time limits, lifecycle/cancellation, cleanup, quotas and safety. Vercel static hosting and Neon Postgres are not coding sandboxes.
