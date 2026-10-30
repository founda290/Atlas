# Phase 4B — workspace engineering delivery evidence

Date: 2026-10-30. Branch: `arena/131cf52f-atlas`, based on verified PR #2 merge `3293f78bc6ad3643d381c20617a8d59c871ff8a5`. React/Vite, the visual foundation and Atlas-owned AgentRuntime remain intact. See the pre-implementation [audit/plan](PHASE-4B-PLAN.md).

## Status: implemented engineering; genuine provider acceptance blocked

This is not a claim that a model successfully coded in this sandbox. Project/file/editor/Git/persistence services are implemented and independently tested. Real runtime discovery, native session creation, event forwarding and durable user history were exercised. The selected provider request did not complete within its execution deadline, so genuine tool-driven changes and active-tool cancellation are **not accepted**.

## Implemented workstreams

| Area        | Implementation and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime     | Shared backend-owned loopback engine; stopped/starting/available/unavailable/degraded/stopping/error states; bounded health probe/startup/SDK calls; process-loss replacement without prompt replay; owned shutdown; selected model passed to actual SDK; native HTTP-200 assistant errors become failures. Adapter/lifecycle tests use an explicitly mocked SDK, not fake production execution.                                                                                                                                                                 |
| Projects    | Actual Git-initialized UUID directories, private canonical root validation, validated create/list/open/rename/description/archive/restore/delete. Exact-name deletion tombstones registration and retains code/history. Actual HTTP/SQLite/filesystem/Git integration tests, including restart and project isolation.                                                                                                                                                                                                                                            |
| Persistence | SQLite WAL/FK local default; server-only optional PostgreSQL with explicit migration opt-in, version check, one dedicated connection, transaction and advisory migration lock. Stable session/message IDs, ordered snapshots/outgoing turns, durable model/failure/status metadata and bounded event metadata. Running/cancelling sessions become interrupted at restart; history and native resumability are distinct.                                                                                                                                          |
| Files       | Dedicated bounded inventory/read/create/atomic CAS write/file rename/confirmed deletion; empty-folder controls; common UTF-8 source formats; exclusions and traversal/symlink/hardlink/special-file/type/size checks; operation metadata. Actual disk tests cover stale saves/deletes, conflicting creates, malformed UTF-8, binary/oversized files and replaced roots.                                                                                                                                                                                          |
| Editor      | CodeMirror only, lazy-loaded common language parsers; highlighting/line numbers/find/undo, tabs/current-file controls, keyboard save, explicit backend-confirmed saved state, loading/read-only/errors, conflict preservation, reload/discard guards, unsaved route/unload protection. Unique accessible model labels, roving file tabs and contrasting dark syntax colors. Real desktop/mobile browser save/Git/folder/project workflows and conflict/navigation checks.                                                                                        |
| Git         | Actual repository/branch/status, working/index/HEAD comparisons, untracked/staged/deleted/renamed text paths; literal non-shell argument arrays; selected version-checked stage/unstage; exact-path-confirmed supported unstaged discard. Hooks/pager/fsmonitor/external diff/textconv disabled. Filters/includes/external worktrees/object stores and linked/special Git metadata refused before status can execute a clean filter. Tests verify a malicious clean command never creates its marker.                                                            |
| Models      | Real project-aware discovery; live schema compatibility (`capabilities.toolcall/reasoning`) as well as older SDK fields; allowlisted metadata only; runtime-connected is explicitly not authentication/reachability validation. Explicit model creation/apply with server validation, current/pending distinction and propagation. No key form or browser credential vault.                                                                                                                                                                                      |
| Sessions/UI | Server-backed project/session history and selection, persisted model/failures, continue/historical behavior, cancel with operation invalidation and a per-operation signal, scoped SSE, reconnect/history refresh, event-ID deduplication, text deltas and live tool states. One active coding operation per project; unconfirmed cancellation remains locked until native idle reconciliation. Safe React Markdown/code/GFM rendering. Existing dashboard/projects/overview/workspace/models/settings/docs use the new services or truthful unsupported states. |
| Boundaries  | Loopback-only entry point, Host/origin/Fetch Metadata checks, media/body limits, narrow CORS, no shell API, cross-project session rejection. Vite rejects nonlocal/forwarded API requests instead of exposing the local engine through public previews. Private host roots and provider configuration objects are not serialized to the browser.                                                                                                                                                                                                                 |

## Real runtime diagnosis and acceptance

### Findings fixed in code

1. SDK and installed CLI are **1.19.5**, Node **22.22.3**. SDK session creation works; no default model was configured. Executing without an explicit/default selection now reports `model_required` rather than silently guessing.
2. Live discovery returns `capabilities.toolcall/reasoning`; generated SDK 1.19.5 declarations advertise older `tool_call/reasoning` fields. Filtering only declared fields incorrectly hid available tool-capable models. The adapter now handles both observed schemas, with a regression test.
3. Native prompt responses can carry an assistant error despite HTTP 200. These now map to safe authentication/rate/model/request failure codes rather than false completion.
4. Native messages are sorted using a six-byte timestamp-prefixed ID protocol. Atlas now produces compatible stable outgoing IDs rather than UUID order, preserving native user/assistant ordering. SDK coupling remains at the backend boundary and is version-pinned/tested.
5. Cancellation during preflight previously risked a later SDK prompt starting after the user had cancelled. Per-operation signals and ownership invalidation prevent this. Unconfirmed cancellation does not release the project for new coding/manual file changes.

### Confirmed environmental blocker

A separate real provider-list probe reported the selected model's endpoint hostname as **`opencode.ai`**. This sandbox permits outbound access only to GitHub, npm registry and Python package hosts; the inference hostname is outside that allowlist. Native model execution did not return a provider authentication/network response before the execution deadline. This establishes a concrete network constraint, **not** credential validity or an authenticated successful inference call. Runtime-connected configuration alone proves neither.

### Final genuine check

```bash
PATH="/home/user/.cache/atlas-opencode/node_modules/.bin:$PATH" \
  npm run runtime:check -- --execute \
  --model opencode/glm-5.3-flash-free --timeout-ms 15000
```

The script uses the actual engineering API, native SDK/CLI, disposable SQLite/directory/Git baseline, selected model and real SSE. It does not inject a test runtime. Safe observed result:

```json
{
  "cli": "1.19.5",
  "sdk": "1.19.5",
  "runtime": "ready",
  "model": "opencode/glm-5.3-flash-free",
  "projectCreated": true,
  "inventory": true,
  "fileRead": true,
  "sessionCreated": true,
  "eventStream": true,
  "modelExecution": "session.failed",
  "actualFileChange": false,
  "sourcePreserved": true,
  "examplePreserved": true,
  "functionVerified": false,
  "testVerified": false,
  "history": true,
  "historyDurable": true,
  "gitDiff": false,
  "activeCancellation": "not tested",
  "tools": [],
  "executionDiagnostic": "Model execution deadline exceeded; cancellation requested. Verify provider/network access before retrying.",
  "executionCode": "model_timeout",
  "persistedStatus": "failed"
}
```

Native events included message updates, session status/diff/idle and the Atlas failure event; these are not tool execution proof. The check exited **1**, closed its runtime and removed its disposable directory. Source/example preservation and durable user history passed. No required function/test addition or authoritative source change occurred. Deadline cancellation of this stalled provider call is not acceptance of cancelling a running coding tool.

To finish acceptance, run the same command locally with a reachable configured provider/model, or provide an approved environment with inference access. Do not add keys to chat or frontend storage. The script verifies actual function assertions/test edits, tool events, Git state and history; only after genuine coding success does it test an observed running shell tool's acknowledgement/idle cancellation.

## Existing Neon / Vercel

Metadata inspection confirmed the existing Atlas Vercel project has Neon integration-managed `DATABASE_URL`/Postgres variables and Neon Auth URL configuration in preview/production. No secret values were decrypted. **No live Neon connection, schema migration, production write or account authentication was tested.** SQLite is the local fallback, not a claim that Neon was absent. PostgreSQL migration/connection semantics have mocked protocol tests only; evaluate against an approved isolated Neon branch before enabling it. Source directories/OpenCode still need an appropriate local/worker filesystem. The Vercel SPA is not a persistent execution worker.

## Validation ledger

| Check                                       | Result                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                              | Passed strict frontend/backend/test TypeScript checks                                                                                                                                                                                                                                                                                                                |
| `npm test`                                  | **85/85 passed in 8 files**: 32 existing/extended API, 12 engineering API, 12 runtime protocol/lifecycle, 4 PostgreSQL protocol, 7 interface, 6 workspace, 9 data, 3 session-diff                                                                                                                                                                                    |
| `npm run build`                             | Passed; lazy editor/main chunk size advisory remains                                                                                                                                                                                                                                                                                                                 |
| `npm run server:build`                      | Passed                                                                                                                                                                                                                                                                                                                                                               |
| `npm run format:check`                      | Passed                                                                                                                                                                                                                                                                                                                                                               |
| `npm audit --audit-level=high`              | **0 vulnerabilities**                                                                                                                                                                                                                                                                                                                                                |
| `git diff --check`                          | Passed                                                                                                                                                                                                                                                                                                                                                               |
| `ATLAS_BUNDLED_CHROMIUM=1 npm run test:e2e` | **29/29 passed**: all 14 principal routes at 360/390/430/768/1024/1440 widths, docs/system/internal navigation, drawer/preferences/account boundaries, API failures, live text deltas/tools, model confirmation, local-proxy protection, actual mobile/desktop editor/file/folder/Git/project workflows, CAS/refresh-error/navigation preservation and accessibility |
| Screenshots                                 | Actual editor at 390px and 1440px reviewed; ignored `test-results/engineering/` artifacts, not production data                                                                                                                                                                                                                                                       |
| Genuine model execution                     | **Blocked / exits 1**, exact `model_timeout` evidence above; not included in passing mock/browser counts                                                                                                                                                                                                                                                             |
| Live Neon integration                       | **Not tested**; no production connections/writes                                                                                                                                                                                                                                                                                                                     |

API/file/Git/persistence tests use disposable actual SQLite/directories/repositories with explicitly test-only AgentRuntime injection. Runtime/PostgreSQL protocol tests mock external dependencies; session/model browser fixtures are explicitly labeled. Manual editor/Git browser tests use actual backend files and Git without requiring model execution. None of these substitutes for provider coding acceptance.

## Remaining limitations / safety decisions

- Genuine provider coding and active-tool cancellation are blocked as described, not completed by mocks or increasing timeouts.
- No live PostgreSQL/Neon integration test, cloud worker, portable/shared filesystem, account auth, billing, multi-user ownership or OS sandbox. Existing Neon Auth configuration does not activate the account forms.
- Project deletion retains source/history; no irreversible recursive erase. Folder rename/delete is empty-only; no arbitrary host-directory import or clone UI.
- One trusted backend owns a data/workspace root. Metadata and source both need backups. Individual file operations are atomic/version-checked, not a filesystem + Git + database transaction; hostile external process races and OS/power failure require stronger isolation/recovery.
- Native execution uses the operator's OS permissions. Filename exclusions are not a content-secret scanner. Do not put credentials in projects or prompts. OpenCode retains independent native history after disposable Atlas acceptance data is removed.
- Bounded text review: 256 KiB files, 10,000 inventory paths/depth 24, 100 Git entries/1 MiB combined diff, 10,000 Git metadata entries. Unsupported binary/mode-only/conflicted files, filters/includes, worktrees/external object stores and populated-folder mutations require local review/tools; no commit, blanket reset or fabricated ownership attribution.
- Live SSE is not a durable full replay log. Reconnect restores saved/native messages and current status; bounded metadata appears on project overview. Tool outputs and terminal output are not fully replayed. Permission responses remain local OpenCode actions.
- Browser drafts remain in memory and can be lost on browser termination; guards protect ordinary navigation, not crash recovery. Editor code is lazy-loaded but production build still emits a large-chunk advisory.
- SQLite on Node 22 reports its experimental warning. The production frontend is still a Vite SPA; local execution is intentionally unavailable in a public preview.

GitHub PR/check/merge metadata and the final session report are authoritative for delivery identifiers; this ledger does not predict a future merge SHA.
