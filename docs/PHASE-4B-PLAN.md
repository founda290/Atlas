# Phase 4B — Full Workspace Engineering plan

## Audit (2026-10-30)

Branch `arena/131cf52f-atlas` starts at `3293f78`, the verified merge of PR #2. Working tree was clean. Phase 3 and 4A ledgers, backend routes/runtime/event normalizer/file policy, frontend routes/services/hooks/session index, tests, scripts, package versions and environment/deployment configuration were inspected before implementation.

Architecture: React 19 + TypeScript + Vite; Node HTTP API; official OpenCode SDK 1.19.5 behind AgentRuntime. Existing createAtlasServer supports dependency injection. Existing project/workspace identifier is fixed, Atlas session mappings are memory-only, browser history is only an index. File reads are bounded UTF-8 previews. Diffs are runtime reports, not independent Git observations.

Working: real session creation, prompts/events/cancel contract, history access, source preview and bounded runtime diff. Missing: persistent projects/sessions/messages, managed project roots, controlled writes/tree operations, editor, Git review/actions, provider/model catalogue and selection, useful lifecycle diagnostics. Authentication is outside the local execution boundary; frontend account forms remain unavailable unless a real service is integrated separately.

Known issues: provider-backed acceptance timed out in Phase 4A without identifying the cause; SDK prompt has no Atlas deadline; cancellation can race a later prompt; no process health/restart model; stale running sessions are lost at restart; origin restrictions inadequate; hardcoded test workspace is not a product project list. No OS isolation or multi-tenant ownership exists.

Vercel inspection confirms Atlas uses Vite and has Neon integration-managed DATABASE_URL/Postgres variables and NEON_AUTH_BASE_URL/VITE_NEON_AUTH_URL in preview/production. Secret values were not decrypted. This confirms configuration, NOT a database or auth connection test. No development-target connection is supplied to this sandbox. Do not migrate or write the production Neon database for tests. Neon cannot store local project files or run OpenCode. Existing SPA deployment stays separate from local execution.

## Dependency order / tracking

- [x] Verify PR #2 ancestry; audit architecture, runtime and existing Neon/Vercel configuration before implementation.
- [x] Runtime diagnosis, actual model metadata/schema investigation, bounded requests, lifecycle/restart/ownership and cancellation safeguards.
- [x] Versioned SQLite/PostgreSQL storage, explicit PostgreSQL migration gate/transaction/advisory lock; no production database testing.
- [x] Real project CRUD/archive/retained-directory deletion, private canonical roots, durable sessions/messages/relevant activity.
- [x] Scoped inventory/read/atomic CAS writes/create/file rename/confirmed delete; empty-folder controls and adverse path/file tests.
- [x] Lazy CodeMirror editor, common languages, tabs/find/save, conflicts, unsaved guards, preserved drafts on refresh errors and responsive accessibility.
- [x] Actual Git status/working/index/HEAD diffs and selected version-checked stage/unstage/narrow discard, with unsafe configuration/metadata refusal.
- [x] Actual provider/model discovery and selected-model propagation; provider credentials stay OpenCode-owned.
- [x] Existing dashboard/projects/overview/workspace/models/settings/docs connected to real services or honest unsupported boundaries.
- [x] Local-only request/proxy protections, project/session isolation, persistence reconciliation, operation locking and drained graceful shutdown.
- [x] Unit/API/component and browser regression checks, type checks/builds/format/dependency audit; see the exact validation ledger in PHASE-4B.md.
- [ ] Genuine tool-driven coding and active-tool cancellation acceptance: **blocked**, not simulated. CLI/SDK 1.19.5, explicit `opencode/glm-5.3-flash-free`, 15-second `model_timeout`, no tools/file changes. Observed endpoint `opencode.ai` is outside this sandbox's outbound allowlist. Retest in an approved reachable environment.
- Delivery: review the complete patch, commit/push this fixed session branch, submit PR, wait for checks, merge and verify. GitHub PR metadata/final session report records actual identifiers rather than predicting a merge SHA here.

## Implementation principles

Keep existing adapter and legacy endpoints for compatibility, but production entry uses managed project service, no seeded demo project. Each project is a backend-created UUID directory below one configured workspace root; no browser-supplied absolute locations. Local owner is the trusted backend operator, not a claimed multi-user account. Preserve directories on project deletion; keep tombstones/history. Services expose Atlas contracts and do not import backend SDK into the frontend.

Local SQLite is the development fallback; Neon/PostgreSQL is explicitly selected by server-only DATABASE_URL, not VITE_ variables. Schema upgrades must be versioned. Do not silently connect a local runtime to production project paths from another host. Interrupted sessions become historical/interrupted until actual runtime reconciliation succeeds. Never report process/model completion solely from a stale database status.

## Security

Loopback execution only by default; strict allowed origins/hosts and Fetch Metadata checks, bounded JSON and output; no generic shell/process endpoints. Use execFile argument arrays and literal Git pathspecs; disable hooks/external diff/text conversion and reject unsafe Git configuration. Every mutation checks project boundary, sensitive names, symlinks, size, expected version and destructive confirmation. Managed directories are not an OS sandbox: hostile local process/agent mutation requires stronger isolation. Provider credentials must never enter logs, browser storage or ordinary persistence tables. Do not remove test fixtures: they are regression tools, not product demos.

## Acceptance criteria

A clean local install can create a persistent project, create/read/edit/save actual files with conflicts detected, reopen after backend restart, initialize/use Git and review real working/index/untracked changes, stage/unstage/revert selected tracked files with confirmation, select an actually reported configured model and run a bounded real OpenCode session when a reachable provider is available. History survives restarts and failed reconciliation is clearly historical. Malicious paths/origins/cross-project session IDs and stale destructive requests fail in automated tests. All supported UI actions use confirmed backend responses. Full phase is not complete if any workstream is silently skipped or the real execution blocker is misrepresented.
