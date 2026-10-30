# Atlas

Atlas is a React/Vite local-first coding environment backed by Node and OpenCode. The existing warm public website and dark developer workspace are preserved. Project CRUD, durable history, a CodeMirror editor and authoritative Git operations use real backend services—not demo data.

**Status:** trusted local development software, not a public execution service or OS sandbox. Real model coding acceptance is **blocked in the Arena sandbox**: the selected `opencode/glm-5.3-flash-free` endpoint is `opencode.ai`, outside the available outbound allowlist. The 15-second attempt returned `model_timeout`, with no tool events/file edits. Do not confuse working discovery or passing mocks with successful generation. See [Phase 4B evidence](docs/PHASE-4B.md).

## Start locally

Requirements: Node **22.12+**, npm, Git, OpenCode CLI on the backend PATH, and a reachable configured provider. SDK and tested CLI: **1.19.5**; SDK version does not establish the installed CLI version.

```bash
npm ci
npm install -g opencode-ai@1.19.5
opencode --version

# Separate terminals, from the repository root:
npm run server:start
npm run dev
```

Visit `http://127.0.0.1:5173`. Create a project, open its editor, create files, edit/save and review Git changes. This works independently of model generation. Configure credentials through OpenCode's supported local flow (`/connect` where supported), then select an actually discovered coding model when creating a session. Existing sessions expose an explicit **Apply model to session** action.

Never put provider credentials in frontend environment variables, browser storage, prompts, Git or an Atlas vault. The runtime retains OpenCode's supported credential handling. No provider credential objects/options/headers are returned by model discovery.

## What works

- Managed UUID projects: create/list/open, rename/description, archive/restore, exact-name-confirmed deletion. Deletion **retains source directories** and history rather than erasing code.
- Independent canonical roots and Git repositories. No browser-supplied host paths or automatic demo project.
- SQLite persistence for projects, session mappings/models/status, ordered messages and bounded activity metadata; optional PostgreSQL storage. Interrupted sessions and history-only/native-resumable sessions are distinguished after restart.
- Scoped UTF-8 inventory/read/create/write/rename/delete. Atomic file installation and content-version checks prevent ordinary stale overwrites; symlinks/hardlinks, sensitive paths, binaries, malformed text and oversized content are rejected. Empty folder create/rename/confirmed delete; populated folders require individual operations/local tools.
- Lazy CodeMirror editor: TS/JS/TSX/JSX, JSON, CSS, HTML, Markdown, Python; tabs, line numbers, highlighting, undo/find, Ctrl/Cmd+S, backend-confirmed saves, conflict errors and unsaved navigation/unload guards. Drafts are not persisted after browser termination.
- Real Git working/index/HEAD comparisons, untracked and renamed paths, selected stage/unstage, exact-path-confirmed narrow unstaged discard. No commit/reset-all/apply-all action or fabricated agent attribution. Unsupported/omitted entries are disclosed.
- Real provider/model discovery and selection validation, exact selected-model propagation, bounded prompt/abort/history calls and native assistant-error handling.
- Scoped SSE and history reload on reconnect, stable event IDs, deduplication, actual text deltas/tool-state activity, safe Markdown/code/GFM tables. Full live event/tool-output replay and a terminal-output stream are **not** available.

## Configuration / persistence

| Backend-only variable    | Default / meaning                                           |
| ------------------------ | ----------------------------------------------------------- |
| `ATLAS_DATA_DIR`         | `.atlas` — local metadata directory                         |
| `ATLAS_WORKSPACE_ROOT`   | `<data dir>/projects` — managed UUID workspace parent       |
| `DATABASE_URL`           | unset — SQLite; set explicitly for approved PostgreSQL/Neon |
| `ATLAS_DATABASE_MIGRATE` | PostgreSQL schema changes require explicit `1`              |
| `ATLAS_API_HOST`         | `127.0.0.1`; only loopback values accepted                  |
| `ATLAS_API_PORT`         | `8787`; Vite proxy currently targets this port              |
| `ATLAS_ALLOWED_ORIGINS`  | narrow localhost/127.0.0.1 frontend/API origins             |
| `ATLAS_FILE_EXCLUDES`    | extra comma-separated excluded directory/path components    |

Keep the same data directory and matching workspace root after restart. Back up metadata **and** source directories. A remote database does not copy local files, provide a cloud worker or make private host paths portable. One trusted backend should own a given data/workspace root. Provider/OpenCode storage and retention remain separate.

### Existing Neon/Vercel integration

Vercel metadata confirmed Atlas already has Neon-managed database variables and Neon Auth URL configuration. **No secrets were decrypted and no production database was connected to, migrated or written during development.** This establishes configuration, not connectivity or working account authentication.

Use an approved isolated Neon branch/database before evaluating PostgreSQL. The Node backend reads server-only `DATABASE_URL`, never a `VITE_` credential. Existing schemas are read without DDL; an uninitialized/newer schema fails closed. Approved upgrades use versioned transactions, a dedicated connection and an advisory migration lock:

```bash
# Set DATABASE_URL securely in the server environment (do not paste it into chat/Git).
ATLAS_DATABASE_MIGRATE=1 npm run server:start
# After applying the approved schema, restart without migration opt-in.
```

Do not use production Neon as a disposable acceptance target. Remote PostgreSQL has protocol-level tests but **no live remote integration validation** in this environment. The Vercel SPA deployment cannot host the persistent local execution engine; do not publicly route `/api` to it. Neon Auth URLs do not activate Atlas account forms by themselves.

## Security / limits

- Execution API binds to loopback and validates Host, Origin, Fetch Metadata, JSON media type and body sizes. The dev proxy rejects non-local/forwarded API traffic; public previews can display the website but cannot execute local work.
- Managed file services exclude secrets and Git internals, bound text to **256 KiB**, inventory to **10,000 paths / depth 24**, and JSON mutations to **2 MiB**. A filename policy is not a secret-content scanner.
- Git uses argument arrays/literal pathspecs, no pager/hooks/fsmonitor/external diff/text conversion, bounded output/deadlines, and refuses unsafe filters/includes, external worktrees/object stores and metadata links before status/index work. Review is capped at 100 entries/1 MiB combined diff; Git metadata inspection is capped at 10,000 entries. Unsupported binary/mode-only/conflicted states can require local Git tools.
- One active coding operation per project. Manual file/Git mutations are blocked while running or cancellation is unconfirmed. A native acknowledgement **and idle state** are required before cancellation is confirmed. No automatic prompt replay occurs on engine restart.
- Atlas does not sandbox the agent or hostile local processes. OpenCode and tools use the operator's OS permissions; external filesystem races, malicious generated code and descendant-process behavior require stronger OS isolation. Atomic individual writes do not make multi-file/Git/database operations one transaction.
- Account signup/login/reset, billing, hosted execution, external connector management and permission-response UI remain honestly unsupported. Resolve OpenCode permission requests in its supported local environment. Do not expose the backend or dev proxy publicly.

## Validation

```bash
npm run lint
npm test
npm run build
npm run server:build
npm run format:check
npm audit --audit-level=high
npm run test:e2e
```

Playwright starts an isolated local API and Vite automatically (no production `DATABASE_URL`). Install Chromium with `npx playwright install chromium`, or use `ATLAS_BUNDLED_CHROMIUM=1 npm run test:e2e` in this sandbox. Fixtures are explicitly test-only; API/file/Git/editor integration tests use disposable actual SQLite/directories/Git repositories. CI runs these checks; genuine provider execution is a separate opt-in acceptance, never a simulated green check.

```bash
npm run runtime:check
npm run runtime:check -- --execute --model provider/model --timeout-ms 15000
```

The real check creates a disposable managed project and Git baseline, checks source/test/example preservation, actual tools, disk changes, function assertions, durable history and authoritative Git state. Only after genuine coding success does it attempt cancellation of an observed running shell tool. It cleans up the runtime and disposable directory. OpenCode maintains its independent native history. An incomplete/timeout check exits nonzero and prints observed fields rather than claiming completion.

See [Phase 4B plan](docs/PHASE-4B-PLAN.md), [delivery evidence and limitations](docs/PHASE-4B.md), and historical [Phase 3](docs/PHASE-3.md)/[Phase 4A](docs/PHASE-4A.md).
