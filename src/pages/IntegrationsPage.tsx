import { Button, Section } from '../components'
import { Badge, PageHeader } from '../components/ui'

export function IntegrationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Atlas / Connections"
        title="Connections are not available yet."
        description="The hosted coding worker has not been deployed, and Atlas does not currently connect to external tools or model providers."
      />
      <Section eyebrow="Current status" title="No connected services are implied.">
        <div className="public-split">
          <article className="editorial-card">
            <Badge tone="warning">Not available</Badge>
            <h3>Hosted AI execution</h3>
            <p>
              Atlas cannot send prompts to a model or run code in the hosted app. Chat sending stays
              disabled until a real isolated worker and its safety controls are ready.
            </p>
            <Button href="/chat" secondary>
              Open Chat
            </Button>
          </article>
          <article className="editorial-card">
            <Badge>Not built</Badge>
            <h3>External tools and providers</h3>
            <p>
              Managed MCP, Git, CLI and third-party service connections are not available. Atlas
              does not ask users to install a local coding runtime as a substitute.
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
