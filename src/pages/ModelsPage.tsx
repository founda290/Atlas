import { useState } from 'react'
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
import { api } from '../services/api'
import { useResource } from '../hooks/useResource'
const load = (signal: AbortSignal) => api.providers(undefined, signal)
export function ModelsPage() {
  const resource = useResource(load),
    [search, setSearch] = useState(''),
    [showAll, setShowAll] = useState(false),
    [expanded, setExpanded] = useState('')
  const providers =
    resource.data?.providers.filter(
      (p) =>
        (showAll || p.connected) &&
        `${p.id} ${p.name} ${p.models.map((m) => m.name).join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? []
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Models"
        title="Your engine. Your model."
        description="Actual OpenCode discovery. Configure provider credentials locally; select a model when creating or opening a session."
        action={
          <Button secondary onClick={resource.reload}>
            Refresh discovery
          </Button>
        }
      />
      <div className="app-page-body">
        <SearchInput label="Search discovered providers" value={search} onChange={setSearch} />
        <label className="checkbox-field">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show unconnected providers
        </label>
        <Panel title="Credential boundary">
          <p>
            Connected means reported configured by OpenCode, not verified authentication, network
            reachability or successful generation. Atlas never returns provider keys, headers or
            configuration options. Project-local model configuration may differ; use that
            workspace’s model selector.
          </p>
        </Panel>
        {resource.loading ? (
          <Loading label="Discovering runtime models" />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : providers.length ? (
          <div className="directory-grid provider-grid">
            {providers.map((p) => (
              <article className="directory-card" key={p.id}>
                <Badge>{p.connected ? 'Runtime-connected' : 'Not connected'}</Badge>
                <h2>{p.name}</h2>
                <code>{p.id}</code>
                <p>Authentication: {p.authentication}; not independently verified.</p>
                <details
                  onToggle={(e) => {
                    if (e.currentTarget.open) setExpanded(p.id)
                  }}
                >
                  <summary>{p.models.length} reported models</summary>
                  <ul>
                    {expanded === p.id &&
                      p.models.map((m) => (
                        <li key={m.modelID}>
                          <strong>{m.name}</strong> <code>{m.modelID}</code>
                          <p>
                            {m.available
                              ? 'Selectable (not connection-tested)'
                              : 'Unavailable for coding'}{' '}
                            · {m.toolCall ? 'Tools reported' : 'No tool support'} · context{' '}
                            {m.context ?? 'not reported'} · output {m.output ?? 'not reported'}
                          </p>
                        </li>
                      ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={search ? 'No matching providers' : 'No providers reported'}>
            Configure OpenCode locally and refresh. No catalogue entries are invented.
          </EmptyState>
        )}
      </div>
    </>
  )
}
