# Atlas

Atlas is a React/Vite interface for a browser-based coding workspace powered by OpenCode. The public site preserves the warm editorial Phase 1 design; the authenticated workspace now contains a local Phase 2 proof of concept.

## Local requirements

Use Node.js 20 LTS or later. OpenCode is installed with the official package documented at [opencode.ai/docs](https://opencode.ai/docs/):

```bash
npm install -g opencode-ai
opencode --version
```

Atlas uses the official `@opencode-ai/sdk` package at version `1.19.5`. This is the Node-compatible network/service SDK. The newer embedded `@opencode/sdk` package was evaluated but is not used here because its current published runtime requires newer syntax than the available Node runtime. The backend starts OpenCode on loopback and owns the client; the browser only calls Atlas endpoints.

Configure a provider through OpenCode's supported local credential flow. The official provider guide recommends the `/connect` command in OpenCode, which stores credentials in OpenCode's local credential store. Do not put provider keys in Atlas source, browser code, or committed files.

## Run Atlas

```bash
npm install
npm run lint
npm run build
npm run server:build
```

In one terminal, start the backend:

```bash
npm run server:start
```

It binds to `127.0.0.1:8787` by default. In another terminal, start the Vite frontend:

```bash
npm run dev
```

The Vite development server proxies `/api/*` to the loopback backend. Open `/projects` to use the dedicated `test-workspace` session flow.

## API

The versioned local API exposes `GET /api/v1/health`, `POST /api/v1/sessions`, `POST /api/v1/sessions/:id/messages`, `GET /api/v1/sessions/:id/events` for session-scoped SSE, `POST /api/v1/sessions/:id/cancel`, `GET /api/v1/sessions/:id/messages`, and `GET /api/v1/workspaces/atlas-test-workspace/status`.

The backend validates the fixed workspace identifier, canonicalizes the workspace boundary, limits request bodies, binds to loopback, restricts the expected development origin, avoids arbitrary path/process endpoints, and does not return provider credentials. This is a trusted local development setup, not secure multi-tenant isolation.

## Test workspace and acceptance status

`test-workspace/` is separate from the Atlas source tree and contains only harmless sample files. The backend can create a real OpenCode session and submit a real prompt when the local provider is configured. Automated build and type checks pass. A complete real-model acceptance task requires a valid provider credential and should verify an actual file modification in `test-workspace`; do not treat mocked or unavailable-runtime checks as proof of completion.

## Architecture and limitations

`server/src/runtime.ts` defines the `AgentRuntime` boundary and implements `OpenCodeLocalRuntime`. A future isolated worker or `OpenCodeCloudRuntime` can implement the same application-level responsibilities without changing the browser API. The current runtime uses in-memory Atlas session state, so sessions do not survive backend restarts. The local OpenCode workspace is not a security sandbox and must not contain secrets.

Deferred work includes durable session storage, authentication, cloud isolation, multi-user execution, provider credential management, MCP execution, arbitrary CLI tools, billing, and public deployment.
