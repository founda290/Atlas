export interface ArticleSection {
  id: string
  heading: string
  paragraphs: string[]
  code?: string
  language?: string
}
export interface Article {
  id: string
  title: string
  description: string
  sections: ArticleSection[]
}
export const articles: Article[] = [
  {
    id: 'introduction',
    title: 'Introduction to Atlas',
    description: 'A browser workspace for working with a local AI coding agent.',
    sections: [
      {
        id: 'what-is-atlas',
        heading: 'What is Atlas?',
        paragraphs: [
          'Atlas brings project context, coding sessions and an OpenCode agent into a browser interface. The React frontend calls a Node.js API; only the backend communicates with the local OpenCode SDK.',
          'This is a trusted local development preview. You do not need an account. Account creation, billing and hosted execution are not enabled.',
        ],
      },
      {
        id: 'available-today',
        heading: 'Available today',
        paragraphs: [
          'Inspect the dedicated local workspace inventory, create a real agent session, submit instructions, read message history, follow events and cancel an active operation.',
          'Atlas uses one fixed workspace. Project CRUD, file-content editing, on-demand filesystem diffs, model selection and direct external connectors are not exposed by the API.',
        ],
      },
      {
        id: 'before-starting',
        heading: 'Before you start',
        paragraphs: [
          'Use a dedicated workspace without secrets. A local agent can execute code and modify files with your machine’s permissions. Atlas is not a security sandbox or approval gate.',
        ],
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Run the frontend, API and local runtime on your machine.',
    sections: [
      {
        id: 'requirements',
        heading: 'Requirements',
        paragraphs: [
          'Use Node.js 22.12 or later for the current Vite toolchain, npm, a supported OpenCode CLI installation and a configured model provider.',
          'Install OpenCode locally. The SDK is already pinned in package.json; the CLI executable must also be on your PATH.',
        ],
        code: 'npm install -g opencode-ai\nopencode --version',
        language: 'bash',
      },
      {
        id: 'install',
        heading: 'Install and build',
        paragraphs: [
          'From the repository root, install dependencies and validate both applications.',
        ],
        code: 'npm ci\nnpm run lint\nnpm run build\nnpm run server:build',
        language: 'bash',
      },
      {
        id: 'run',
        heading: 'Start the two processes',
        paragraphs: [
          'Start the backend in one terminal and the Vite frontend in another. The backend listens on loopback port 8787 by default. Vite proxies relative /api requests to it.',
          'Open the frontend, visit Projects and open the local test workspace. Start a session only after the runtime is ready.',
        ],
        code: '# Terminal 1\nnpm run server:start\n\n# Terminal 2\nnpm run dev',
        language: 'bash',
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Understanding the workspace',
    description: 'Files, conversation and activity with explicit execution boundaries.',
    sections: [
      {
        id: 'layout',
        heading: 'Find your way around',
        paragraphs: [
          'The desktop workspace shows a file explorer beside a read-only detail area and agent conversation. Activity and Changes are separate views. On smaller screens, switch among Agent, Files, Activity and Changes using the workspace tabs.',
        ],
      },
      {
        id: 'files',
        heading: 'Workspace inventory',
        paragraphs: [
          'File paths and sizes come from the API, not sample frontend data. Expand folders, search paths and select a file to inspect its metadata.',
          'The API does not expose file contents or save operations. The editor region explains this limitation rather than showing invented code. Read and edit files with your local editor.',
        ],
      },
      {
        id: 'activity',
        heading: 'Activity is not a terminal',
        paragraphs: [
          'Activity records the real lifecycle and tool events received during the current connection. It is not persisted or replayed by the server. Message history is fetched separately when you return to a session.',
          'No verified terminal stream is exposed. Atlas can display observed diffs from actual message summaries or session.diff events. There is no on-demand diff endpoint, so inspect authoritative changes in your local version-control tools.',
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Creating projects',
    description: 'What “project” means in the current single-workspace preview.',
    sections: [
      {
        id: 'local-project',
        heading: 'The dedicated local project',
        paragraphs: [
          'Atlas currently exposes one real workspace, atlas-test-workspace. Its project entry is derived from the workspace inventory endpoint. A failed request is shown as an error, not replaced with sample projects.',
        ],
      },
      {
        id: 'configuration',
        heading: 'Configure the workspace at startup',
        paragraphs: [
          'The default is test-workspace/ inside the repository. To change it, set ATLAS_TEST_WORKSPACE on the backend before starting it. This changes the configured directory, not the fixed API workspace identifier.',
          'Changing the directory requires a backend restart; Atlas session mappings will be lost. Only use a dedicated directory you trust.',
        ],
        code: 'ATLAS_TEST_WORKSPACE=/absolute/path/to/dedicated-workspace npm run server:start',
        language: 'bash',
      },
      {
        id: 'project-actions',
        heading: 'Creation, rename and deletion',
        paragraphs: [
          'The API has no project CRUD operations. New project opens an explanation and setup guidance, not a simulated creation form. Rename and delete are not presented as working actions.',
          'The browser keeps an index of sessions it actually created. This is not project persistence or a global list of server sessions.',
        ],
      },
    ],
  },
  {
    id: 'sessions',
    title: 'Starting coding sessions',
    description: 'Create, instruct, continue and cancel a real local agent session.',
    sections: [
      {
        id: 'create',
        heading: 'Create a session',
        paragraphs: [
          'Open the local project and choose New coding session. Give it a descriptive title. Atlas asks the backend to create a real OpenCode session and opens its session URL only after the API succeeds.',
          'Creation fails visibly when the backend or OpenCode runtime is unavailable. No local success is fabricated.',
        ],
      },
      {
        id: 'instruct',
        heading: 'Send a clear instruction',
        paragraphs: [
          'Use the multiline composer. Enter sends; Shift + Enter adds a line. Instructions must contain text and be under 20,000 characters. Only one operation may run in a session at a time.',
          'Assistant messages support Markdown and copyable code blocks. Tool and lifecycle events appear in Activity. Do not treat displayed agent text as proof that a file was changed; inspect the actual workspace.',
        ],
      },
      {
        id: 'continue',
        heading: 'Continue or cancel',
        paragraphs: [
          'Sessions created in this browser appear in recent sessions. They remain usable while the same backend is running. Stop requests cancellation through the API, and a failed cancellation is shown as an error.',
          'The backend stores Atlas-to-runtime session mappings in memory. After a restart, an old Atlas URL can return Session not found. Create a new session rather than assuming durable recovery.',
        ],
      },
    ],
  },
  {
    id: 'runtime',
    title: 'OpenCode runtime',
    description: 'How the browser, backend and execution engine fit together.',
    sections: [
      {
        id: 'architecture',
        heading: 'A backend-owned engine',
        paragraphs: [
          'AgentRuntime defines status, session creation, prompt, abort, messages, diff, events and close. OpenCodeLocalRuntime implements this contract with the official @opencode-ai/sdk.',
          'The backend starts OpenCode on loopback. The browser never connects directly to the engine. The API currently exposes only a subset of AgentRuntime; diff is not an HTTP endpoint.',
        ],
      },
      {
        id: 'requests',
        heading: 'The existing API',
        paragraphs: [
          'All browser requests use relative URLs. Health reports runtime status and provider entries. Sessions expose create, messages, events and cancel. The fixed workspace exposes status/inventory.',
        ],
        code: 'GET  /api/v1/health\nPOST /api/v1/sessions\nGET  /api/v1/sessions/:id/messages\nPOST /api/v1/sessions/:id/messages\nGET  /api/v1/sessions/:id/events\nPOST /api/v1/sessions/:id/cancel\nGET  /api/v1/workspaces/atlas-test-workspace/status',
        language: 'http',
      },
      {
        id: 'limits',
        heading: 'Current limits',
        paragraphs: [
          'Session mappings and live activity are not durable. No cloud worker, job queue, multi-user isolation, direct MCP management or arbitrary command API is implemented.',
          'A static deployment can render the website but does not provision the local Node API. Start both processes locally for real execution.',
        ],
      },
    ],
  },
  {
    id: 'providers',
    title: 'Provider and model configuration',
    description: 'Keep credentials in OpenCode, not in the browser.',
    sections: [
      {
        id: 'configure',
        heading: 'Configure OpenCode locally',
        paragraphs: [
          'Use OpenCode’s supported local provider configuration flow, including its /connect command where available. Follow the documentation for your installed OpenCode version.',
          'Atlas reads the provider entries returned by runtime status. A listed provider does not prove valid credentials or model availability.',
        ],
      },
      {
        id: 'models',
        heading: 'Default model',
        paragraphs: [
          'Choose your default model in OpenCode. Atlas does not currently expose model discovery, per-session model selection or a provider-key form.',
          'The Models page will show runtime-discovered providers and explicitly explain why the model list and selected model are unavailable. No model names are invented.',
        ],
      },
      {
        id: 'secrets',
        heading: 'Secret handling',
        paragraphs: [
          'Do not add provider keys to frontend environment variables, localStorage, repository files or prompts. Never share a workspace containing credentials with an agent.',
          'Browser display preferences contain only theme, density and code wrapping. They are not an API-key vault.',
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Work from the failing boundary instead of guessing.',
    sections: [
      {
        id: 'api',
        heading: 'The API is unreachable',
        paragraphs: [
          'Run npm run server:start from the repository root. Confirm the API port and check that Vite is proxying /api to it. A static website deployment alone does not include this local server.',
        ],
        code: 'curl http://127.0.0.1:8787/api/v1/health',
        language: 'bash',
      },
      {
        id: 'runtime',
        heading: 'OpenCode is unavailable',
        paragraphs: [
          'Run opencode --version in the same environment as the backend. Check PATH, your local provider configuration and runtime logs. Provider discovery is not a credential test.',
          'A real model acceptance test requires valid credentials and access to your provider. Type checks and UI tests do not prove that the agent can generate code.',
        ],
      },
      {
        id: 'sessions',
        heading: 'A session disappeared',
        paragraphs: [
          'Restarting the backend clears Atlas session mappings. The browser may retain its local index, but those URLs can no longer resolve. Start a new session.',
          'If the event stream disconnects, Atlas reports it and reloads history on reconnect. It cannot replay missed tool activity. If an operation may still be active, do not send duplicate instructions blindly.',
        ],
      },
    ],
  },
  {
    id: 'security',
    title: 'Security and execution limitations',
    description: 'A trusted local preview, not a hosted isolation boundary.',
    sections: [
      {
        id: 'execution',
        heading: 'Local code execution',
        paragraphs: [
          'OpenCode can execute commands and modify files with local process permissions. The configured workspace is a context boundary, not an operating-system sandbox.',
          'Review instructions carefully, use a disposable or dedicated workspace, and keep secrets outside it. Atlas does not currently implement an approval system, apply/revert UI or execution isolation.',
        ],
      },
      {
        id: 'network',
        heading: 'Local network boundary',
        paragraphs: [
          'The API binds to 127.0.0.1 by default. Do not expose it publicly. It has no real account authentication or multi-user authorisation.',
          'The development frontend uses a same-origin API proxy. Do not expose the preview to untrusted users or change the backend to listen publicly without a separate security review.',
        ],
      },
      {
        id: 'data',
        heading: 'What is stored',
        paragraphs: [
          'Atlas keeps session mappings in server memory. This browser may store a list of actually created session IDs and titles, plus display preferences. Clear site data to remove these browser records.',
          'Prompts and provider credentials are not stored in Atlas browser preferences. OpenCode and the selected provider have their own storage and retention behaviour. No legal policies or privacy guarantees are implied by this preview.',
        ],
      },
    ],
  },
]
