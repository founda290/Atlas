import { Link } from 'react-router-dom'
import { Button, FeatureCard, PageContainer, ProductPreview, Section } from '../components'
import { Badge, PageHeader } from '../components/ui'

const features = [
  [
    'A conversation with context',
    'Create real OpenCode sessions and give the agent focused instructions in your local workspace.',
  ],
  [
    'A project, not a blank chat',
    'Keep the workspace inventory and session history next to the work. One dedicated local workspace is supported today.',
  ],
  [
    'An observable process',
    'Follow streamed messages, tool activity and lifecycle events. Cancel an active instruction when you need to stop.',
  ],
  [
    'Your provider, locally',
    'OpenCode owns provider credentials and runtime configuration. Atlas never asks for an API key in the browser.',
  ],
  [
    'A thread you can return to',
    'Continue sessions while the backend is running. Atlas session mappings are in memory, not durable storage.',
  ],
  [
    'Clear execution boundaries',
    'The backend owns the agent. Review your local files in your own tools; Atlas is not an execution sandbox.',
  ],
] as const
export function HomePage() {
  return (
    <>
      <section className="hero">
        <PageContainer>
          <div className="hero-copy">
            <p className="eyebrow">A quieter way to build</p>
            <h1>
              Make room for <em>better code.</em>
            </h1>
            <p className="hero-lede">
              Build, understand and manage software with an AI coding agent. Atlas brings your
              project context, coding sessions and local OpenCode runtime into one focused browser
              workspace.
            </p>
            <div className="hero-actions">
              <Button href="/dashboard">
                Open the local workspace <span aria-hidden="true">↗</span>
              </Button>
              <Button href="/docs/getting-started" secondary>
                Read the setup guide <span aria-hidden="true">→</span>
              </Button>
            </div>
            <div className="trust">
              <p className="trust-kicker">Local first. Deliberate by design.</p>
              <p>Real sessions. Your own runtime. No simulated execution.</p>
              <span className="principle-note">
                Development preview · requires a local backend and configured OpenCode provider.
              </span>
            </div>
          </div>
        </PageContainer>
      </section>
      <Section className="preview-section" eyebrow="The workspace, at a glance">
        <ProductPreview />
      </Section>
      <Section
        eyebrow="Built around the work"
        title="The useful parts. In one considered space."
        intro="A practical interface for working with code and its context—not another disconnected chat window."
      >
        <div className="feature-grid">
          {features.map(([title, description], index) => (
            <FeatureCard key={title} index={index + 1} title={title} description={description} />
          ))}
        </div>
      </Section>
      <Section
        className="workflow"
        eyebrow="How Atlas works"
        title="From intention to a real coding session."
      >
        <div className="workflow-grid">
          {[
            [
              '01',
              'Prepare your environment',
              'Start Atlas locally and configure a provider in OpenCode. Keep secrets outside the workspace.',
            ],
            [
              '02',
              'Open your project',
              'Inspect the dedicated test workspace and establish the context for your instruction.',
            ],
            [
              '03',
              'Work with the agent',
              'Start a session, submit an instruction and follow messages and tool activity as they arrive.',
            ],
            [
              '04',
              'Review on your machine',
              'Inspect changes with your local editor and Git. Atlas can show observed runtime diffs, but cannot read or edit files.',
            ],
          ].map(([number, title, text]) => (
            <article className="workflow-step" key={number}>
              <div className="step-number">{number}</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </Section>
      <Section
        eyebrow="A clear integration boundary"
        title="OpenCode at the core. Room to grow."
        intro="The local OpenCode engine is implemented. Provider discovery comes from the runtime. Direct MCP, CLI and external-service connections in Atlas are planned, not connected."
      >
        <div className="public-split">
          <article className="editorial-card">
            <Badge tone="success">Implemented</Badge>
            <h3>OpenCode local runtime</h3>
            <p>
              A backend-owned SDK connection for sessions, instructions, streaming events,
              cancellation and message history.
            </p>
            <Button href="/integrations" secondary>
              Explore integrations
            </Button>
          </article>
          <article className="editorial-card">
            <Badge>Planned</Badge>
            <h3>More tools. Same clarity.</h3>
            <p>
              MCP management, Git connections, model selection and hosted workspaces will need real
              implementation before appearing as connected.
            </p>
            <Link className="text-link" to="/docs/runtime">
              Understand the runtime →
            </Link>
          </article>
        </div>
      </Section>
      <Section eyebrow="For deliberate development" title="Keep the decisions close to the code.">
        <div className="benefit-list">
          <article>
            <span>01 / Focus</span>
            <h3>One place for the thread of work.</h3>
            <p>Separate projects, sessions and runtime details without losing your place.</p>
          </article>
          <article>
            <span>02 / Ownership</span>
            <h3>Your environment remains yours.</h3>
            <p>Provider setup stays in OpenCode. Atlas does not store secrets in your browser.</p>
          </article>
          <article>
            <span>03 / Honesty</span>
            <h3>Know what the product can do.</h3>
            <p>
              No invented terminal output, automatic approval gates or connected-service claims.
            </p>
          </article>
        </div>
      </Section>
      <Section className="final-cta">
        <div className="cta-box">
          <p className="eyebrow">A local development preview</p>
          <h2>Give your next idea some context.</h2>
          <p>
            Explore Atlas now. Accounts, cloud isolation, durable storage and billing are not
            enabled. Only run it with a trusted local workspace.
          </p>
          <Button href="/dashboard">
            Open Atlas <span aria-hidden="true">↗</span>
          </Button>
        </div>
      </Section>
    </>
  )
}
const capabilityDetails = [
  {
    title: 'AI coding sessions',
    status: 'Available locally',
    text: 'Create a session, send multiline instructions, read assistant messages and stop an active operation. Instructions are executed by your configured OpenCode runtime.',
    detail: 'Requires a running backend, installed OpenCode CLI and a configured provider.',
  },
  {
    title: 'Project-based development',
    status: 'Available locally',
    text: 'Create persistent managed projects with independent directories and Git repositories. Inspect real inventory and saved session history.',
    detail:
      'Create, rename, describe, archive and delete project registrations. Deletion retains source directories for safety.',
  },
  {
    title: 'Conversation and activity',
    status: 'Available locally',
    text: 'Read message history, streamed assistant text, tool events and lifecycle events. Markdown and code blocks remain readable and copyable.',
    detail:
      'Events are not a verified terminal stream. Reconnection reloads message history; activity is not replayed.',
  },
  {
    title: 'Files and code',
    status: 'Editable text',
    text: 'Edit supported UTF-8 files up to 256 KiB in CodeMirror, with tabs, syntax highlighting and conflict-checked saves.',
    detail:
      'Restricted paths and links are blocked. Review authoritative Git changes, stage/unstage selected files, or confirm a narrow unstaged revert.',
  },
  {
    title: 'Models and providers',
    status: 'Runtime discovery',
    text: 'View providers reported by the runtime and see whether runtime discovery succeeded.',
    detail:
      'Select a runtime-reported, connected tool-capable model per session. Discovery is not an authentication or generation test; credentials remain in OpenCode.',
  },
  {
    title: 'Execution and extensibility',
    status: 'Local runtime',
    text: 'An AgentRuntime abstraction keeps the browser separate from the execution engine. OpenCode runs locally behind the Atlas backend.',
    detail:
      'Session mappings and history are durable. Cloud isolation, direct MCP/CLI management and external connector management are not implemented.',
  },
]
export function FeaturesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Atlas / Capabilities"
        title="A working foundation. A clear direction."
        description="What you can do in Atlas today, and where the boundaries still are."
      />
      <Section eyebrow="Current capabilities" title="Less ambiguity. More useful context.">
        <div className="capability-list">
          {capabilityDetails.map((feature, index) => (
            <article key={feature.title}>
              <span className="card-index">0{index + 1}</span>
              <div>
                <Badge>{feature.status}</Badge>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <p className="capability-limit">{feature.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section eyebrow="The actual interface" title="Built for the project, not the performance.">
        <ProductPreview />
        <div className="section-actions">
          <Button href="/projects">Explore projects</Button>
          <Button href="/docs/workspace" secondary>
            Workspace guide
          </Button>
        </div>
      </Section>
    </>
  )
}
const comparison = [
  ['Coding sessions', 'Local OpenCode runtime'],
  ['AI usage', 'Subject to your provider’s terms and costs'],
  ['Workspace', 'One dedicated local workspace'],
  ['Session retention', 'Backend mappings reset on restart'],
  ['Accounts & teams', 'Not enabled'],
  ['Hosted execution', 'Not available'],
  ['Billing', 'Not implemented'],
]
export function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Atlas / Early access"
        title="Not a pricing promise."
        description="Atlas is a local development preview. Commercial plans, prices and quotas have not been established."
      />
      <Section eyebrow="Available today" title="Explore locally. Bring your own runtime.">
        <div className="pricing-layout">
          <article className="pricing-card">
            <Badge>Local development preview</Badge>
            <h3>Atlas, on your machine.</h3>
            <p className="pricing-value">No Atlas billing</p>
            <p>
              This is not a subscription plan or a promise of free hosted usage. Atlas does not
              process payments.
            </p>
            <ul>
              <li>Browser-based workspace interface</li>
              <li>Real OpenCode session flow</li>
              <li>Your locally configured provider</li>
              <li>Local setup and security guidance</li>
            </ul>
            <Button href="/docs/getting-started">Set up Atlas locally</Button>
            <p className="fine-print">
              AI provider usage may incur costs. Check your provider before sending instructions.
            </p>
          </article>
          <div className="comparison">
            <h3>What to expect</h3>
            <dl>
              {comparison.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>
      <Section eyebrow="Questions, answered" title="The details matter.">
        <div className="faq-list">
          {[
            [
              'Is there a paid plan?',
              'No commercial plans or prices are defined, and Atlas does not offer checkout or subscriptions.',
            ],
            [
              'Who pays for model usage?',
              'Your configured OpenCode provider determines availability, usage limits and charges. Atlas does not bundle model credits.',
            ],
            [
              'Do I need an account?',
              'No. The local preview is not authenticated. Login and signup interfaces are prepared for a future backend, but do not create accounts.',
            ],
            [
              'Is the runtime isolated?',
              'No. OpenCode executes locally. Use only trusted code and a dedicated workspace without secrets.',
            ],
            [
              'Will pricing change?',
              'Commercial terms may be defined later. Nothing on this page commits to future pricing or access.',
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  )
}
export function StatusPage({ code = '404' }: { code?: string }) {
  const descriptions: Record<string, [string, string]> = {
    '400': ['That request needs another look.', 'Check the address and try again.'],
    '401': [
      'An account boundary, not a login session.',
      'Sign in through the account page. Browser-local editing does not require an account.',
    ],
    '403': ['This resource is not available.', 'No action was completed by this page.'],
    '404': ['This page went looking for context.', 'The route does not exist, or it has moved.'],
    '408': ['The request took too long.', 'Retry once the local connection is ready.'],
    '429': ['A little too much, too quickly.', 'Wait before retrying your request.'],
    '500': ['Something needs attention.', 'Check the Atlas backend before trying again.'],
    '502': ['The runtime boundary is quiet.', 'Check the upstream runtime connection.'],
    '503': [
      'The local service is unavailable.',
      'Start the local backend and check OpenCode configuration.',
    ],
    offline: [
      'You are working without a connection.',
      'Reconnect to the Atlas backend and try again.',
    ],
  }
  const [title, description] = descriptions[code] ?? descriptions['404']
  return (
    <div className="status-page">
      <div className="status-page-inner">
        <p className="status-code">{code === 'offline' ? 'Offline' : code}</p>
        <p className="eyebrow">Atlas / System response</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="status-actions">
          <Button href="/">Return home</Button>
          <Button href="/docs/troubleshooting" secondary>
            Open troubleshooting
          </Button>
        </div>
      </div>
    </div>
  )
}
