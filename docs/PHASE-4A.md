# Phase 4A — Runtime acceptance & read-only workspace core

Date: 2026-10-30. Branch: `arena/2025eac7-atlas`.

**Status: this bounded workspace-core increment is implemented; full real-model acceptance remains incomplete.** This is not delivery of every proposed Phase 4 capability. Phase 3 remains the historical interface baseline.

## Delivered

### Actual read-only source contents

`GET /api/v1/workspaces/atlas-test-workspace/file?path=sample.ts`

- Existing workspace guard and canonical root, strict relative paths, supported text extensions/names and shared sensitive-path policy.
- Blocks traversal, absolute/Windows-style paths, encoded separators, control characters, symlink components and known credential/config/key paths. Inventory uses the same sensitive-name exclusions, including `.env*` (case-insensitive).
- Regular files only; 256 KiB maximum, including a bounded read to catch file growth. Invalid UTF-8 and NUL-containing binary content fail explicitly. Unicode and UTF-8 BOM content are preserved; sizes describe bytes, not UTF-16 string length.
- Read-only descriptor, `O_NOFOLLOW`/`O_NONBLOCK` where available, descriptor closure in `finally`. Linux additionally checks the opened `/proc/self/fd` target for workspace containment. Changed path/inode identity fails rather than silently reading another file.
- Structured errors, request IDs and `no-store`; no arbitrary write/save route.
- Actual escaped text in the workspace, copy, refresh, loading/error/retry, empty-file feedback, request abort on selection, no late/stale-content substitution. Inventory metadata is collapsible and explicitly labelled; source preview respects wrapping preferences.

### On-demand runtime session diff

`GET /api/v1/sessions/:id/diff`

- Resolves the Atlas session's existing runtime ID and calls `AgentRuntime.diff`. No new execution engine or speculative SDK capability.
- Returns `source: "opencode-session"`, `authoritativeFilesystem: false`, `fetchedAt`, filtered `diffs` and an `omitted` count.
- Omits malformed, sensitive, unsupported, binary, duplicate, absolute and traversal paths/entries. Absolute paths are conservatively omitted even if they might be workspace-local. This filter validates reported paths/content; it does not independently reconstruct files or Git state.
- Examines at most 1,000 entries; returns at most 100, with 256 KiB per before+after pair and 1 MiB total text. The UI separately bounds render characters, lines, edit distance and computation time, with an explicit local-review fallback.
- Fetched when Changes is opened, with manual refresh and refresh after terminal lifecycle revisions. Errors are not converted into a fake empty-success state. An empty snapshot is explicitly not proof of no filesystem changes.
- No apply/revert/save controls or authoritative filesystem/Git diff claim. Activity and conversation remain real event/history views.

### Repeatable real-runtime check

`scripts/runtime-check.mjs`, exposed through `npm run runtime:check`.

- Uses the actual CLI, SDK adapter and Atlas HTTP server, not an injected test runtime.
- Ephemeral loopback API and disposable temporary workspace; default mode does not call a model.
- Verifies actual seeded-file inventory/content, real session creation, fresh empty history/diff responses and an SSE connection handshake.
- `--execute` sends one default-model instruction to replace one disposable file with a unique marker. Completion is not accepted as file-change proof: disk and file API contents are compared with the required text.
- Model-completion timeout defaults to 60 seconds (configurable 1–120 seconds), followed by best-effort cancellation. No provider credentials or conversation content is printed. Only whitelisted runtime event type names are recorded.
- Child server, stream and temporary directory are cleaned up. OpenCode can retain metadata in its own local storage; this is not an Atlas durable-session implementation.

The CLI was installed at a sandbox-local cache prefix, outside the repository, at **1.19.5**, matching the pinned SDK. No CLI dependency, binary, generated model output or credentials were added to Git. Reproduction outside this sandbox requires OpenCode on PATH; see README.

## Actual runtime acceptance results

The final smoke-only command passed. Two bounded model-backed attempts used a 20-second model-completion deadline; neither completed successfully. The latest execution-mode report was:

```json
{
  "cli": "1.19.5",
  "runtime": "ready",
  "inventory": true,
  "fileRead": true,
  "sessionCreated": true,
  "history": true,
  "diffEndpoint": true,
  "eventStream": true,
  "modelExecution": "not verified",
  "actualFileChange": false,
  "activeCancellation": "not tested",
  "runtimeEventTypes": [
    "message.updated",
    "message.part.updated",
    "session.status",
    "session.diff"
  ],
  "failure": "Real execution did not complete: timeout"
}
```

| Acceptance stage                                  | Evidence / outcome                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| CLI availability/version                          | Actual executable returned 1.19.5                                                                         |
| Local engine/SDK connection                       | Real runtime reported ready                                                                               |
| Workspace inventory and file read                 | Actual seeded filesystem content returned through HTTP                                                    |
| Create a real session                             | Runtime ID and Atlas ID returned                                                                          |
| Fresh history and diff access                     | Empty responses fetched from the actual runtime-backed routes                                             |
| SSE connection                                    | Actual HTTP connection/connected handshake                                                                |
| Runtime-native event delivery                     | Message, part, status and diff event types received through Atlas                                         |
| Provider credentials/model availability           | **Not verified**; provider entries are discovery, not credential proof                                    |
| Completed model response and real tool execution  | **Not verified**; event type names alone are not proof                                                    |
| Required agent-produced file contents             | **Not observed** in the disposable target at the deadline; no claim about all possible filesystem effects |
| Active cancellation                               | **Not verified**; timeout cleanup attempted cancellation, which is not proof of a stopped active model    |
| Reopen populated conversation while backend lives | **Not verified**; fresh history access is not populated-history recovery                                  |
| Durable recovery across backend restart           | **Not implemented**                                                                                       |

The timeout is the observed failure, not a confirmed diagnosis of provider credentials or network failure. This environment has restricted outbound access. Configure/verify a reachable provider locally, then rerun:

```bash
npm run runtime:check
npm run runtime:check -- --execute --timeout-ms 60000
```

After a successful file-changing turn, separately verify real tool activity, active cancellation and reopening populated history. Do not infer them from smoke success or test fixtures.

## Security boundary

This remains a trusted-local, unauthenticated application. File preview policy is **not a secret scanner**: permitted source/config text can contain secrets. Conversation/tool output is not sanitized by this policy. Do not select a secret-bearing workspace or expose the API/front-end proxy to untrusted users.

Read-only describes the file HTTP API, not the agent. OpenCode retains the backend user's OS permissions. Hard links, concurrent local filesystem mutation and arbitrary agent execution require stronger OS isolation for hostile/multi-user workloads. These path checks are not that isolation; non-Linux containment checks do not provide Linux's descriptor-target check.

No production execution backend was deployed. No authentication, authorization, account success, billing, cloud workspace or permission-response functionality was invented.

## Regression verification

- `npm run lint`: strict application, backend/test and browser-test TypeScript checks passed.
- `npm run build`: passed, 235 modules; JS 491.39 kB (gzip 150.14), CSS 54.57 kB (gzip 11.19).
- `npm run server:build`: passed.
- `npm test`: **56 tests passed across five files**, including traversal/secret/symlink rejection, byte limits, Unicode/BOM, binary/UTF-8/type/directory errors, no-write preservation, ownership/missing-session errors, diff response budgets/omissions, escaped source copy, cancellation of stale file requests, refresh/retry and non-fabricated empty/error states.
- `ATLAS_BUNDLED_CHROMIUM=1 npm run test:e2e`: **26 tests passed together**. Covers all 14 routes at six widths, workspace fixtures at six widths, navigation/focus, forms/preferences/search, HTTP error states, provider boundaries, SSE parts/activity, code copy and accessibility. The two new tests cover source/diff lifecycle at 390/1440px, stale-content removal, copy, refresh/retry, omission notice and serious/critical axe checks on source/diff/error states, including light diff review.
- The two new browser tests were also rerun after correcting screenshot scroll positioning; both passed. Desktop/light diff and mobile source screenshots were visually reviewed. These screenshots use explicitly test-only API fixtures, not real-model output.
- `npm run format:check`, `npm audit` (zero vulnerabilities) and `git diff --check`: passed.
- Real CLI smoke: passed; execution-mode acceptance: **failed / incomplete**, as detailed above.

## Deliberately deferred

Real model discovery/selection, durable project/session storage and project CRUD remain future increments. File writes, terminal output streaming, authoritative filesystem/Git comparisons, external connector management, authentication, hosted execution and cloud/billing are not included.

Implementation areas: `server/src/workspace-files.ts`, `server/src/session-diff.ts`, additive routes in `server/src/app.ts`; typed API services/contracts; `FileContent`, `SessionChanges`, explorer/workspace integration and targeted styles; CLI check script; API/policy/component/browser regressions; updated README and capability documentation. Existing React/Vite and AgentRuntime architecture is preserved.

Changes are on the active session branch. No Phase 4 commit, push, PR or merge is implied by this ledger; check Git/GitHub for subsequent delivery state.
