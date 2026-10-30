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
          'Accounts use Neon Auth when configured. Browser-local projects require no account or backend and stay on this device. Local OpenCode execution requires the trusted loopback backend. Cloud execution and billing remain disabled.',
        ],
      },
      {
        id: 'available-today',
        heading: 'Available today',
        paragraphs: [
          'Create persistent projects, inspect scoped inventory, start real sessions, submit instructions, reopen saved history and observe genuine tool/lifecycle events.',
          'Create managed projects, edit actual files with version-checked saves, review authoritative Git changes and select runtime-reported coding models. Direct external connector management remains unavailable.',
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
          'Open the frontend, visit Projects and create a managed workspace. Its standalone editor works without model access; coding sessions require the local runtime and a reachable provider.',
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
          'The desktop workspace provides a file explorer, CodeMirror editor, agent conversation and authoritative Git review. Activity and Changes are separate views. On smaller screens, switch among Agent, Files, Activity and Changes using the workspace tabs.',
        ],
      },
      {
        id: 'files',
        heading: 'Workspace inventory',
        paragraphs: [
          'File paths and sizes come from the API, not sample frontend data. Expand folders, search paths and select a file to inspect its metadata.',
          'Read and edit supported UTF-8 text files up to 256 KiB. Sensitive paths, symlinks, hardlinks, binary and malformed UTF-8 files are blocked. Ctrl/Cmd+S saves with a content version check. Conflicts preserve the draft and require reconciliation. Folder rename/delete supports empty folders only.',
        ],
      },
      {
        id: 'activity',
        heading: 'Activity is not a terminal',
        paragraphs: [
          'Activity shows genuine events from this connection. Bounded metadata is persisted on the project overview; complete tool-output replay is not implemented. Ordered message history is saved separately and reloaded on reconnect.',
          'No verified terminal-output stream is exposed. Changes reads actual Git working-tree/index/HEAD diffs, with explicit refresh and selected stage/unstage. Discard requires the exact path and restores only a supported existing tracked file from the index. Changes may contain pre-existing user work; they are not automatically agent-attributed.',
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Creating projects',
    description: 'Persistent managed workspaces, bounded paths and retained source directories.',
    sections: [
      {
        id: 'local-project',
        heading: 'Managed project boundaries',
        paragraphs: [
          'Each project has a generated ID, independent managed directory and Git repository. Projects are created through the backend; no demo workspace is seeded and host paths are not exposed in browser responses.',
        ],
      },
      {
        id: 'configuration',
        heading: 'Configure the workspace at startup',
        paragraphs: [
          'Local metadata defaults to .atlas/atlas.sqlite and project directories to .atlas/projects/. ATLAS_DATA_DIR and ATLAS_WORKSPACE_ROOT configure these backend-only locations. Use one trusted backend for a given data/workspace root.',
          'Preserve the data directory and matching workspace root across restarts. Roots from a different host fail closed; a shared database does not provision or synchronize source files.',
        ],
        code: 'ATLAS_WORKSPACE_ROOT=/absolute/path/to/managed-projects npm run server:start',
        language: 'bash',
      },
      {
        id: 'project-actions',
        heading: 'Creation, rename and deletion',
        paragraphs: [
          'New project creates a real managed Git workspace. Edit updates the name/description; archive makes it read-only. Deleting requires its exact name and removes its registration while retaining source files and historical data.',
          'Projects, sessions, messages and bounded activity metadata are server-persisted. Lists come from the backend rather than browser storage. Display preferences remain browser-local.',
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
          'Use the multiline composer. Enter sends; Shift + Enter adds a line. Instructions must contain text and be under 20,000 characters. Only one coding operation may run in a project at a time. Manual file/Git mutations are blocked while it is active.',
          'Assistant messages support Markdown and copyable code blocks. Tool and lifecycle events appear in Activity. Do not treat displayed agent text as proof that a file was changed; inspect the actual workspace.',
        ],
      },
      {
        id: 'continue',
        heading: 'Continue or cancel',
        paragraphs: [
          'Saved project sessions appear in server-backed history. Stop invalidates the local operation and requests native cancellation. Cancellation needs a native acknowledgement and idle state; unconfirmed cancellation keeps the project locked.',
          'Mappings and messages persist after restart. Stale running sessions become interrupted. A session is resumable only after native reconciliation; otherwise stored messages remain visible as historical and continuation is rejected.',
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
          'The backend shares one managed loopback OpenCode engine across project adapters. It detects lost connections, restarts without replaying prompts, bounds requests and shuts down its owned runtime. Independent Git services, not assistant claims, supply change review.',
        ],
      },
      {
        id: 'requests',
        heading: 'The existing API',
        paragraphs: [
          'All browser requests use relative URLs. Projects own files, Git operations and sessions. Global session routes require a matching projectId query parameter; cross-project access fails. Models/providers are discovered through the backend.',
        ],
        code: 'GET  /api/v1/health\nGET  /api/v1/projects\nPOST /api/v1/projects\nPOST /api/v1/projects/:projectId/sessions\nGET  /api/v1/sessions/:id/messages?projectId=:projectId\nPOST /api/v1/sessions/:id/messages?projectId=:projectId\nGET  /api/v1/sessions/:id/events?projectId=:projectId\nPOST /api/v1/sessions/:id/cancel?projectId=:projectId\nGET  /api/v1/projects/:projectId/files\nPUT  /api/v1/projects/:projectId/files/content\nGET  /api/v1/projects/:projectId/diff?comparison=working',
        language: 'http',
      },
      {
        id: 'limits',
        heading: 'Current limits',
        paragraphs: [
          'Session mappings, messages and bounded event metadata are durable. Full event replay, cloud workers, job queues, multi-user isolation, direct MCP management and arbitrary command endpoints are not implemented.',
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
          'Select an actually reported connected tool-capable model during session creation. In an existing workspace, choose a pending model and explicitly apply it; the current model changes only after backend confirmation. Global defaults and credentials remain OpenCode-owned.',
          'The Models page displays real provider/model metadata. Runtime-connected means reported configured, not independently authenticated or network-tested. Unsupported or failed discovery stays an error; no model names or specifications are invented.',
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
          'Preserve the configured metadata/workspace directories across restarts. Historical sessions retain saved messages; continuation requires actual native runtime reconciliation. A different workspace root is not an automatic source-file migration.',
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
          'Review instructions carefully, use a disposable or dedicated workspace, and keep secrets outside it. Atlas provides explicit Git staging/unstaging and narrow confirmed unstaged discard, not an execution approval gate or operating-system isolation.',
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
          'Atlas stores project metadata, session mappings, ordered messages and bounded event metadata in SQLite by default, or an explicitly configured PostgreSQL database. Browser storage is not the authority for session history and stores only display preferences in the current workflow.',
          'Prompts and provider credentials are not stored in Atlas browser preferences. OpenCode and the selected provider have their own storage and retention behaviour. No legal policies or privacy guarantees are implied by this preview.',
        ],
      },
    ],
  },
]
