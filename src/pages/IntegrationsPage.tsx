import { Button, Section } from '../components'
import { Badge, PageHeader } from '../components/ui'

export function IntegrationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Atlas / Connections"
        title="Browse providers. Connect when the worker is ready."
        description="Atlas now includes a real provider and model directory. This deployment still has no hosted worker or secure provider credential connection, so browsing does not imply a model is connected."
      />
      <Section eyebrow="Current status" title="Catalog available; live connections are not.">
        <div className="public-split">
          <article className="editorial-card">
            <Badge>Catalog available</Badge>
            <h3>Atlas provider directory</h3>
            <p>
              Browse 232 provider entries and their catalog-listed agent models, endpoint metadata,
              capabilities and reference prices. OpenCode free-tier models are identified
              separately; account eligibility and usage limits still apply.
            </p>
            <Button href="/models" secondary>
              Browse providers and models
            </Button>
          </article>
          <article className="editorial-card">
            <Badge tone="warning">Not connected</Badge>
            <h3>Hosted model worker</h3>
            <p>
              Real hosted messages need a private, authenticated worker with persistent execution,
              account-scoped credential storage and request limits. The deployed site does not have
              that worker. No provider keys are collected in the browser, and no fake responses are
              generated.
            </p>
            <Button href="/chat" secondary>
              Open Chat
            </Button>
          </article>
          <article className="editorial-card">
            <Badge>Planned</Badge>
            <h3>External tools and connectors</h3>
            <p>
              Managed MCP, web-search, Git and other external-service connections are not yet
              configured. The Chat activity panel will show only tool events reported by an actual
              connected runtime; it does not fabricate searches or terminal output.
            </p>
            <Button href="/docs/runtime" secondary>
              Read the current boundary
            </Button>
          </article>
        </div>
      </Section>
    </>
  )
}
