import { useState } from 'react'
import { integrations } from '../features/integrations'
import { api } from '../services/api'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  SearchInput,
} from '../components/ui'
import { Section } from '../components'
const loadHealth = (signal: AbortSignal) => api.health(signal)
function Directory({ managed = false }: { managed?: boolean }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const categories = [...new Set(integrations.map((item) => item.category))]
  const filtered = integrations.filter(
    (item) =>
      `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === 'All categories' || item.category === category),
  )
  return (
    <>
      <div className="list-toolbar">
        <SearchInput label="Search integrations" value={search} onChange={setSearch} />
        <label className="select-label">
          <span className="sr-only">Integration category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="result-count" role="status">
        {filtered.length} integration entries · availability is not connection status
      </p>
      <div className="directory-grid">
        {filtered.map((item) => (
          <article className="directory-card" key={item.id}>
            <div className="directory-card-top">
              <span className="panel-eyebrow">{item.category}</span>
              <Badge tone={item.status === 'Available' ? 'success' : 'neutral'}>
                {item.status}
              </Badge>
            </div>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <Button secondary href={item.guide}>
              {item.status === 'Planned'
                ? 'Read the limitations'
                : managed
                  ? 'Configuration guide'
                  : 'Read setup guide'}
            </Button>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState title="No matching integrations">
          Try a different name or category. Only implemented and explicitly planned entries are
          listed.
        </EmptyState>
      )}
    </>
  )
}
export function IntegrationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Atlas / Connections"
        title="Tools with a clear place."
        description="An honest directory of the implemented runtime, local configuration and planned connections. Available never means connected."
      />
      <Section eyebrow="Integration directory">
        <Directory />
      </Section>
    </>
  )
}
export function ManagedIntegrationsPage() {
  const health = useResource(loadHealth)
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Integrations"
        title="Your connections."
        description="Runtime discovery is live. Atlas does not currently manage external credentials or connector configuration."
      />
      <div className="app-page-body">
        <Panel
          title="Runtime connection"
          eyebrow="Live status"
          action={
            <Button secondary onClick={health.reload}>
              Refresh status
            </Button>
          }
        >
          {health.loading ? (
            <Loading />
          ) : health.error ? (
            <ErrorState message={health.error} retry={health.reload} />
          ) : (
            <>
              <div className="status-line">
                <strong>OpenCode local runtime</strong>
                <Badge tone={health.data?.runtime.status === 'ready' ? 'success' : 'warning'}>
                  {health.data?.runtime.status === 'ready'
                    ? 'Connected to runtime'
                    : 'Runtime unavailable'}
                </Badge>
              </div>
              <p>
                Runtime provider discovery: {health.data?.runtime.providers.length ?? 0} provider
                entries reported. A provider entry is not verification of its credentials.
              </p>
              <Button secondary href="/models">
                Inspect discovered providers
              </Button>
            </>
          )}
        </Panel>
        <div className="section-heading">
          <h2>Integration directory</h2>
          <p>
            Direct connect and disconnect operations are not implemented. Configure OpenCode locally
            using the linked guides.
          </p>
        </div>
        <Directory managed />
        <Panel title="External connections" eyebrow="Not implemented">
          <EmptyState title="No managed external connections">
            Atlas has no external connector store. MCP, CLI and Git service connections cannot be
            connected or disconnected here yet.
          </EmptyState>
        </Panel>
      </div>
    </>
  )
}
