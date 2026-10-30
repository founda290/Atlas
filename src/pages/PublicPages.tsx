import { Link } from 'react-router-dom'
import { Button, FeatureCard, PageContainer, Section } from '../components'
import { Badge, PageHeader } from '../components/ui'

const features = [
  [
    'A chat-first workspace',
    'Sign in to a focused Chat home. Hosted AI execution is not live yet, so the composer stays disabled and no sample conversations are shown.',
  ],
  [
    'Projects are optional',
    'Create a browser-local project only when you want source editing. It stays in this browser profile and is not uploaded to your account.',
  ],
  [
    'Real source editing',
    'Browser-local projects use IndexedDB with real text files, conflict checks, import and export. They do not run an AI agent.',
  ],
  [
    'Email account flows',
    'Neon email/password signup, sign-in and reset flows are implemented. Live provider, email and browser-cookie acceptance remains pending.',
  ],
  [
    'No fabricated activity',
    'No demo projects, conversations, assistant replies or execution results are inserted into the product.',
  ],
  [
    'Hosted execution is not available',
    'A real isolated worker, resource limits, lifecycle controls and safety verification must be deployed before chat can send messages.',
  ],
] as const
export function HomePage() {
  return (
    <>
      <section className="hero">
        <PageContainer>
          <div className="hero-copy">
            <p className="eyebrow">A focused workspace for software</p>
            <h1>
              Start with a <em>conversation.</em>
            </h1>
            <p className="hero-lede">
              Atlas is organized around chat, with project creation optional. Hosted AI execution is
              not live yet, so Atlas will not pretend to answer or run code.
            </p>
            <div className="hero-actions">
              <Button href="/chat">
                Open chat <span aria-hidden="true">↗</span>
              </Button>
              <Button href="/browser-projects" secondary>
                Create a project <span aria-hidden="true">→</span>
              </Button>
            </div>
            <div className="trust">
              <p className="trust-kicker">No demo conversations. No simulated execution.</p>
              <p>Chat is not enabled until a real hosted worker is ready.</p>
              <span className="principle-note">
                Browser-local project editing is available as an optional, separate tool.
              </span>
            </div>
          </div>
        </PageContainer>
      </section>
      <Section
        eyebrow="Built around the work"
        title="What is actually available today."
        intro="Implemented surfaces are called out clearly. Features that need hosted execution remain unavailable, not simulated."
      >
        <div className="feature-grid">
          {features.map(([title, description], index) => (
            <FeatureCard key={title} index={index + 1} title={title} description={description} />
          ))}
        </div>
      </Section>
      <Section
        className="workflow"
        eyebrow="The launch boundary today"
        title="Chat-first interface. Hosted execution still to come."
      >
        <div className="workflow-grid">
          {[
            [
              '01',
              'Open Chat',
              'Sign in or enter the workspace. Chat is the main surface; projects are optional.',
            ],
            [
              '02',
              'No demo conversations',
              'Atlas shows no seeded projects, messages or pretend assistant replies.',
            ],
            [
              '03',
              'Add a project if useful',
              'The optional browser-local editor can create, edit, import and export real source files.',
            ],
            [
              '04',
              'Wait for hosted execution',
              'Sending remains disabled until an isolated worker and its safety controls are deployed.',
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
        eyebrow="A clear launch boundary"
        title="No local setup. No implied execution."
        intro="The hosted coding worker is not deployed. Atlas does not ask users to install or configure a local coding runtime as a substitute."
      >
        <div className="public-split">
          <article className="editorial-card">
            <Badge tone="success">Implemented</Badge>
            <h3>Browser-local project editor</h3>
            <p>
              Optional source editing and project import/export in the current browser. Files are
              not synced to an account and do not run an agent.
            </p>
            <Button href="/browser-projects" secondary>
              Open projects
            </Button>
          </article>
          <article className="editorial-card">
            <Badge tone="warning">Not available</Badge>
            <h3>Hosted AI execution</h3>
            <p>
              Chat messages cannot be sent until the isolated worker, resource limits, lifecycle
              controls and safety verification are ready.
            </p>
            <Link className="text-link" to="/cloud-projects">
              See the launch boundary →
            </Link>
          </article>
        </div>
      </Section>
      <Section eyebrow="Account and data" title="Know what lives where.">
        <div className="benefit-list">
          <article>
            <span>01 / Focus</span>
            <h3>Sign in to the workspace.</h3>
            <p>
              Neon email/password flows exist, but live provider, email and browser-cookie
              acceptance remains to be verified.
            </p>
          </article>
          <article>
            <span>02 / Ownership</span>
            <h3>Projects stay optional.</h3>
            <p>
              Browser-local project files stay in this browser and are not synchronized with your
              account.
            </p>
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
          <p className="eyebrow">The hosted execution boundary</p>
          <h2>Chat is ready for the next safe step.</h2>
          <p>
            Chat is the intended starting point. Hosted AI execution and billing are not available;
            browser-local project editing is optional.
          </p>
          <Button href="/chat">
            Open Chat <span aria-hidden="true">↗</span>
          </Button>
        </div>
      </Section>
    </>
  )
}
const capabilityDetails = [
  {
    title: 'Chat workspace',
    status: 'Execution unavailable',
    text: 'The Chat route is the primary workspace entry, and projects are optional.',
    detail:
      'Hosted AI execution is not deployed. Send stays disabled; no assistant replies are simulated.',
  },
  {
    title: 'Optional browser-local projects',
    status: 'Available',
    text: 'Create and edit real text files in the current browser profile, with conflict checks and file tabs.',
    detail: 'Projects are not synced to your account and do not run an AI agent.',
  },
  {
    title: 'Project portability',
    status: 'Available',
    text: 'Export an actual browser-local project or import a valid Atlas project backup.',
    detail: 'Browser storage can be removed by clearing site data or using private browsing.',
  },
  {
    title: 'Email account flows',
    status: 'Acceptance pending',
    text: 'Neon Auth signup, sign-in, email verification and password reset flows are implemented.',
    detail: 'Live provider configuration, delivery and browser-cookie behavior remain unverified.',
  },
  {
    title: 'Hosted execution and billing',
    status: 'Not built',
    text: 'No isolated cloud coding worker or production execution service is deployed.',
    detail:
      'Cloud projects and billing remain unavailable until the worker, safety controls and quotas are implemented and tested.',
  },
]
export function FeaturesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Atlas / Capabilities"
        title="What works. What does not."
        description="No mock activity: working features and unavailable hosted execution are shown separately."
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
      <Section eyebrow="Projects are optional" title="Chat remains the intended starting point.">
        <p className="section-intro">
          Browser-local projects are available for source editing and backups, but they do not
          substitute for hosted chat or execute code.
        </p>
        <div className="section-actions">
          <Button href="/browser-projects">Create a project</Button>
          <Button href="/chat" secondary>
            Open Chat
          </Button>
        </div>
      </Section>
    </>
  )
}
const comparison = [
  ['Hosted coding sessions', 'Not available; no worker is deployed'],
  ['AI usage', 'Atlas does not currently send prompts to a model'],
  ['Workspace', 'Chat-first home; optional browser-local projects'],
  ['Project retention', 'Project files stay in this browser profile and are not synced'],
  ['Accounts & teams', 'Neon email/password flows implemented; live acceptance pending'],
  ['Hosted execution', 'No isolated cloud coding worker is deployed'],
  ['Billing', 'Not implemented'],
]
export function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Atlas / Early access"
        title="Not a pricing promise."
        description="Hosted AI execution has not launched. Atlas has no paid plans, published prices or usage quotas."
      />
      <Section eyebrow="Current availability" title="No hosted usage or billing yet.">
        <div className="pricing-layout">
          <article className="pricing-card">
            <Badge>Hosted execution not available</Badge>
            <h3>Chat-first workspace.</h3>
            <p className="pricing-value">No Atlas billing</p>
            <p>
              This is not a subscription plan or a promise of free hosted usage. Atlas does not
              process payments.
            </p>
            <ul>
              <li>Chat-first workspace entry with sending disabled</li>
              <li>Optional browser-local source editing</li>
              <li>Real import and export for browser projects</li>
              <li>Neon account flows; live acceptance pending</li>
            </ul>
            <Button href="/chat">Open Chat</Button>
            <p className="fine-print">
              Atlas does not currently send prompts to an AI model or charge for model usage.
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
              'Hosted Atlas does not currently send prompts to a model, so there is no Atlas model usage or charge.',
            ],
            [
              'Do I need an account?',
              'Browser-local editing does not require an account. Neon email/password signup and sign-in flows are implemented, but the live provider, email and cookie behavior still needs acceptance.',
            ],
            [
              'Is the runtime isolated?',
              'No hosted execution worker exists yet. The Chat composer is disabled; Atlas does not execute submitted code in the hosted app.',
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
    '408': ['The request took too long.', 'Retry when Atlas services are available.'],
    '429': ['A little too much, too quickly.', 'Wait before retrying your request.'],
    '500': ['Something needs attention.', 'Retry once the hosted service is available.'],
    '502': ['The hosted runtime is unavailable.', 'Hosted coding execution is not available yet.'],
    '503': [
      'The hosted service is unavailable.',
      'Try again later. Atlas will not send work to a local runtime instead.',
    ],
    offline: [
      'You are working without a connection.',
      'Reconnect to the internet and reopen Atlas.',
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
