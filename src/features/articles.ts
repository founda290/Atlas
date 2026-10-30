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
    description: 'A chat-first workspace, with projects as an optional extra.',
    sections: [
      {
        id: 'what-is-atlas',
        heading: 'Start in Chat',
        paragraphs: [
          'After sign-in, Atlas opens the Chat workspace. Creating a project is optional; the project editor is a separate browser-local tool.',
          'Hosted AI execution is not available yet. The Chat composer remains disabled until a real isolated worker and its safety controls are deployed. Atlas does not show sample conversations or simulated replies.',
        ],
      },
      {
        id: 'available-today',
        heading: 'Available today',
        paragraphs: [
          'Neon email/password signup, sign-in, verification and password-reset flows are implemented. Their live provider configuration, email delivery and browser-cookie behavior still need acceptance testing.',
          'Browser-local projects support real text-file editing, conflict checks, import and export. They stay in the current browser profile and are not synced with your account.',
        ],
      },
      {
        id: 'not-yet-available',
        heading: 'Not available yet',
        paragraphs: [
          'Hosted AI chat, cloud coding projects and billing are not available. Atlas does not accept provider keys in the browser or send prompts to a model at this time.',
        ],
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Use Atlas in the browser—no local coding runtime setup is required.',
    sections: [
      {
        id: 'sign-in',
        heading: 'Sign in to Chat',
        paragraphs: [
          'Choose Sign in or Create account. After successful sign-in, Atlas opens Chat. The account form uses Neon Auth when the deployment is configured; live account and email behavior is still awaiting acceptance testing.',
          'Sign out is available in the workspace sidebar. Signing out does not remove browser-local project files.',
        ],
      },
      {
        id: 'chat-status',
        heading: 'Hosted chat status',
        paragraphs: [
          'The chat screen is the intended starting point, but sending is disabled until hosted execution is implemented. No messages are sent while this boundary is in place.',
        ],
      },
      {
        id: 'optional-project',
        heading: 'Create a project only if you need one',
        paragraphs: [
          'Choose Create project to use the optional browser-local editor. It can edit source files and import/export backups, but it does not run an AI agent, Git or background jobs.',
        ],
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Understanding the workspace',
    description: 'Where to find Chat, account controls and optional projects.',
    sections: [
      {
        id: 'layout',
        heading: 'Navigation',
        paragraphs: [
          'Chat is the primary workspace destination. Projects opens files saved in this browser. Settings controls display preferences, and the account page shows sign-in and verification status.',
        ],
      },
      {
        id: 'availability',
        heading: 'Why the composer is disabled',
        paragraphs: [
          'Atlas currently has no hosted coding worker. Sending is disabled rather than routed to a developer machine or a fake assistant. Cloud projects and model usage are also unavailable.',
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Creating projects',
    description: 'Optional source editing and backups in this browser.',
    sections: [
      {
        id: 'browser-project',
        heading: 'Browser-local storage',
        paragraphs: [
          'Create a browser project when you want to edit or keep a set of source files. Atlas stores it in browser storage on this device; it is not uploaded or synchronized by account sign-in.',
          'Use export to save a portable backup and import to restore a compatible Atlas project. Clearing browser data or using private browsing can remove the project.',
        ],
      },
      {
        id: 'project-limits',
        heading: 'What projects do not do',
        paragraphs: [
          'Browser-local projects do not execute code, start conversations, run Git or provide cloud storage. Hosted project execution is not available yet.',
        ],
      },
    ],
  },
  {
    id: 'sessions',
    title: 'Conversations and sessions',
    description: 'Hosted coding conversations are not available yet.',
    sections: [
      {
        id: 'session-status',
        heading: 'No hosted sessions yet',
        paragraphs: [
          'The Chat interface is ready as the primary workspace entry, but the hosted execution worker has not been deployed. Atlas therefore cannot create, continue or cancel hosted coding sessions.',
          'There is no seeded session history and no assistant response is simulated. The composer will remain disabled until the service is available and tested.',
        ],
      },
    ],
  },
  {
    id: 'runtime',
    title: 'Hosted execution boundary',
    description: 'What must exist before Atlas can send a coding instruction.',
    sections: [
      {
        id: 'worker',
        heading: 'A real isolated worker is required',
        paragraphs: [
          'Atlas will not send code tasks to a user’s computer as a substitute for hosted execution. The cloud worker has not been implemented or deployed.',
          'Before enabling Chat, the service needs tenant isolation, resource and time limits, safe cancellation, lifecycle and cleanup controls, quota handling, and security testing.',
        ],
      },
      {
        id: 'not-a-runtime',
        heading: 'No prompt is sent today',
        paragraphs: [
          'The hosted Chat composer is disabled. Provider keys are not requested in the browser, and Atlas does not claim that a model has run.',
        ],
        code: 'GET /api/cloud\n\n{"data":{"enabled":false}}',
        language: 'http',
      },
    ],
  },
  {
    id: 'providers',
    title: 'Accounts and AI providers',
    description:
      'Browse the provider directory; account identity is separate from model execution.',
    sections: [
      {
        id: 'account',
        heading: 'Account setup',
        paragraphs: [
          'Neon Auth signup, sign-in, verification and reset flows are implemented in the application. Live deployment acceptance must still verify trusted origins, email delivery, cookies, refresh and sign-out behavior.',
          'An Atlas account does not enable cloud execution or synchronize browser-local project files.',
        ],
      },
      {
        id: 'provider',
        heading: 'Browse providers; wait to add credentials',
        paragraphs: [
          'Atlas includes a real provider and agent-model catalog for browsing. BYOK credential entry and hosted model execution are not available yet. Do not enter provider secrets into Atlas until an authenticated worker and protected server-side credential store are deployed.',
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Understand current availability and common browser messages.',
    sections: [
      {
        id: 'api-error',
        heading: 'Unable to load information',
        paragraphs: [
          'The hosted app does not expose the local execution API. A page that needs that API should now show an unavailable state instead of trying to parse the website as an API response.',
          'If account sign-in fails, check that the deployment’s Neon Auth URL, trusted origin, email provider and cookie settings are correct. Live acceptance is still pending.',
        ],
      },
      {
        id: 'browser-storage',
        heading: 'Browser project not found',
        paragraphs: [
          'Browser-local projects exist only in the browser profile where they were created. Try importing an exported backup or return to the project list. Atlas does not replace a missing project with sample data.',
        ],
      },
    ],
  },
  {
    id: 'security',
    title: 'Security and data boundaries',
    description: 'Understand what Atlas stores and what it does not run.',
    sections: [
      {
        id: 'browser-data',
        heading: 'Browser-local project data',
        paragraphs: [
          'Project files and display preferences are saved in browser storage. They are not encrypted or synchronized by account login. Export important work and protect access to the browser profile.',
        ],
      },
      {
        id: 'execution',
        heading: 'Hosted execution remains disabled',
        paragraphs: [
          'Atlas does not currently execute code in the hosted app. A properly isolated and tested worker is a launch requirement, not a setting a user should enable.',
        ],
      },
    ],
  },
]
