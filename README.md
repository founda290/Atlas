# Atlas

Atlas is a React/Vite browser interface for a local AI coding agent powered by OpenCode. The public website retains its warm editorial design; the application is a separate dark developer workspace with an optional light theme.

**Status:** local development preview, not a hosted or authenticated service. The interface never fabricates projects, model availability, terminal output or execution results.

## Requirements

- Node.js **22.12 or later** and npm (the current Vite toolchain requires this).
- A locally installed OpenCode CLI on the backend process's PATH.
- A provider configured through OpenCode's supported local credential flow.

```bash
npm install -g opencode-ai
opencode --version
npm ci
```

The backend uses official `@opencode-ai/sdk` **1.19.5** through `AgentRuntime` / `OpenCodeLocalRuntime`. The browser never imports the SDK or receives provider credentials. SDK version is not a claim about your installed CLI version.

Configure the default model and credentials in OpenCode (its `/connect` command where supported). Never add provider keys to frontend environment variables, browser storage, repository files or prompts.

## Run locally

In separate terminals, from the repository root:

```bash
# Backend: loopback only, port 8787 by default
npm run server:start
```

```bash
# Frontend: port 5173, same-origin /api proxy to the backend
npm run dev
```

Open `/dashboard` or `/projects`. The frontend binds to `0.0.0.0` for development previews and accepts `*.e2b.app` hosts. **This is not an authentication boundary. Do not share access with untrusted users or expose the API publicly.**

The configured workspace defaults to `test-workspace/`. To choose a dedicated directory at backend startup:

```bash
ATLAS_TEST_WORKSPACE=/absolute/path/to/trusted-workspace npm run server:start
```

The public API identifier remains `atlas-test-workspace`. Changing the directory is not a project-creation operation. A backend restart clears Atlas session mappings.

## Pages

Public: `/`, `/features`, `/integrations`, `/pricing`, `/docs`, `/docs/:articleId`, `/login`, `/signup`.

Application: `/dashboard`, `/projects`, `/projects/:projectId`, `/projects/:projectId/sessions/:sessionId`, `/models`, `/integrations/manage`, `/settings`.

The existing system-response routes (`/400`, `/401`, `/403`, `/404`, `/408`, `/429`, `/500`, `/502`, `/503`, `/offline`) and unknown-route handling are preserved. Application routes are **not authenticated**.

## What works

- API-backed health and workspace inventory, project search/sorting/grid/list presentation.
- Real session creation, instruction submission, SSE messages/tool activity/lifecycle, history, cancellation and return navigation.
- Markdown messages, copyable code, file-tree expansion/search/selection and metadata.
- Observed diffs when the runtime actually supplies them through message summaries or `session.diff` events. No “no changes” claim is made when diff data is absent.
- Runtime-discovered provider entries (not a credential or model-availability test).
- Nine documentation articles with search, navigation and code copy.
- Account-form validation and password visibility, with an explicitly unavailable auth service. No credentials are sent or stored.
- Browser-persisted theme, density and code-wrapping preferences, save/cancel and error feedback.

## Existing API

```text
GET  /api/v1/health
POST /api/v1/sessions
GET  /api/v1/sessions/:id/messages
POST /api/v1/sessions/:id/messages
GET  /api/v1/sessions/:id/events
POST /api/v1/sessions/:id/cancel
GET  /api/v1/workspaces/atlas-test-workspace/status
```

No speculative frontend endpoints were added. `server/src/app.ts` owns the unchanged HTTP contract and accepts an `AgentRuntime` for deterministic regression tests; `server/src/index.ts` configures the real local adapter.

Session creation no longer awaits the infinite event loop. SDK global events are unwrapped and runtime session IDs are mapped to their owning Atlas IDs. Cancellation cannot incorrectly emit completion for a later operation. Inventory skips symlinks, `.git`, `node_modules` and `.env*` entries. These safeguards are **not OS-level execution isolation**.

## Persistence and unavailable capabilities

Atlas session mappings are **in server memory**. The browser keeps a bounded index of session IDs/titles it actually created; it is not a server session list or durable session recovery. Clear browser site data to remove the index and display preferences. Live activity is not persisted/replayed.

The backend has no project CRUD, file-content read/write, current-diff endpoint, model catalogue/selection, authentication, password reset, external connector management, billing or hosted workspaces. These controls explain the limitation or link to configuration guidance; they do not simulate success. File code/editing stays in local tools until a safe content API is implemented.

A static deployment renders the website but does not provision the Node API or OpenCode engine. The existing SPA fallback is preserved. Do not treat a public frontend deployment as a working remote agent service.

## Validation

```bash
npm run lint          # Existing convention: strict TypeScript checks; now includes tests
npm run build         # Frontend type-check + production bundle
npm run server:build  # Strict backend compile
npm test              # Vitest component/data/API regression tests
npm run format:check
npm audit
npm run test:e2e      # Playwright routes, viewports, interactions, accessibility
```

For the normal Playwright browser, first run `npx playwright install chromium`. A restricted Linux environment can instead use the npm-packaged Chromium fallback:

```bash
ATLAS_BUNDLED_CHROMIUM=1 npm run test:e2e
```

Start the local backend before the full browser suite. Playwright starts/reuses Vite. Screenshots and traces are ignored in `test-results/`. Browser session fixtures and injected `TestRuntime` exist **only in test files**; they are not acceptance evidence of real model execution. A real-model acceptance run requires an installed CLI, provider access/credentials and actual file-change review.

See [the Phase 3 ledger](docs/PHASE-3.md) for scope, validation results and remaining backend boundaries.
