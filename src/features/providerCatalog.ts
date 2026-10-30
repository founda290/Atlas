export interface ProviderCatalogModel {
  id: string
  name: string
  description?: string
  toolCall: true
  reasoning: boolean
  context?: number
  output?: number
  inputPrice?: number
  outputPrice?: number
  status?: 'alpha' | 'beta' | 'active'
  free: boolean
}

export interface ProviderCatalogProvider {
  id: string
  name: string
  api?: string
  docs?: string
  npm?: string
  credentialEnvNames: string[]
  catalogModelCount: number
  agentModelCount: number
  models: ProviderCatalogModel[]
}

export interface ProviderCatalog {
  schemaVersion: 1
  source: string
  sourceLicense: 'MIT'
  sourceCopyright: string
  fetchedAt: string
  providerCount: number
  agentProviderCount: number
  modelCount: number
  providers: ProviderCatalogProvider[]
}

export function isProviderCatalog(value: unknown): value is ProviderCatalog {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const catalog = value as Partial<ProviderCatalog>
  return (
    catalog.schemaVersion === 1 &&
    typeof catalog.source === 'string' &&
    typeof catalog.fetchedAt === 'string' &&
    Number.isInteger(catalog.providerCount) &&
    Array.isArray(catalog.providers) &&
    catalog.providers.every(
      (provider) =>
        !!provider &&
        typeof provider.id === 'string' &&
        typeof provider.name === 'string' &&
        Array.isArray(provider.models) &&
        provider.models.every(
          (model) =>
            !!model &&
            typeof model.id === 'string' &&
            typeof model.name === 'string' &&
            typeof model.toolCall === 'boolean' &&
            typeof model.free === 'boolean',
        ),
    )
  )
}

export async function fetchProviderCatalog(signal?: AbortSignal): Promise<ProviderCatalog> {
  const response = await fetch('/provider-catalog.json', { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error(`Provider catalog returned HTTP ${response.status}.`)
  const value: unknown = await response.json()
  if (!isProviderCatalog(value))
    throw new Error('The Atlas provider catalog has an invalid format.')
  return value
}

const OPENCODE_FREE_PROVIDER_IDS = new Set(['opencode', 'opencode-go'])

export function isOpenCodeFreeModel(
  providerID: string,
  inputPrice?: number,
  outputPrice?: number,
): boolean {
  return OPENCODE_FREE_PROVIDER_IDS.has(providerID) && inputPrice === 0 && outputPrice === 0
}
