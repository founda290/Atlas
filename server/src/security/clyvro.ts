export type ClyvroAction = 'allow' | 'challenge' | 'block'

export type GuardInput = {
  method: string
  path: string
  search?: string
  userAgent?: string
}

export type GuardResult = { status: 'disabled' } | { status: 'enabled'; action: ClyvroAction }
export type ScanResult = { id: string }

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export class ClyvroError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClyvroError'
  }
}

const ORIGIN = 'https://clyvro.vercel.app'
const MAX_METHOD = 16
const MAX_PATH = 2048
const MAX_SEARCH = 4096
const MAX_USER_AGENT = 512
const MAX_URL = 2048
const MAX_SCAN_ID = 128
const DEFAULT_TIMEOUT_MS = 5000

function boundedString(value: unknown, name: string, max: number, required = false): string | undefined {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || (required && value.length === 0) || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ClyvroError(`Invalid ${name}`)
  }
  return value
}

function validateGuard(input: GuardInput): GuardInput {
  if (!input || typeof input !== 'object') throw new ClyvroError('Invalid guard input')
  const method = boundedString(input.method, 'method', MAX_METHOD, true)!
  const path = boundedString(input.path, 'path', MAX_PATH, true)!
  const search = boundedString(input.search, 'search', MAX_SEARCH)
  const userAgent = boundedString(input.userAgent, 'user agent', MAX_USER_AGENT)
  if (!/^[A-Za-z]{1,16}$/.test(method) || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new ClyvroError('Invalid guard method or path')
  }
  return { method: method.toUpperCase(), path, ...(search === undefined ? {} : { search }), ...(userAgent === undefined ? {} : { userAgent }) }
}

function isPrivateIpv4(host: string): boolean {
  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = octets
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)) return true
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return Boolean(mapped && isPrivateIpv4(mapped[1]!))
}

function validateScanUrl(value: unknown): string {
  const raw = boundedString(value, 'scan URL', MAX_URL, true)!
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ClyvroError('Invalid scan URL')
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  const ipv4Literal = /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  const ipv6Literal = hostname.includes(':')
  if (
    url.protocol !== 'https:' || url.username || url.password || !url.hostname ||
    hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
    (ipv4Literal && isPrivateIpv4(hostname)) || (ipv6Literal && isPrivateIpv6(hostname))
  ) {
    throw new ClyvroError('Unsupported or unsafe scan URL')
  }
  return url.toString()
}

export class ClyvroClient {
  private readonly fetcher: FetchLike
  private readonly timeoutMs: number

  constructor(private readonly key: string | undefined, options: { fetch?: FetchLike; timeoutMs?: number } = {}) {
    if (key !== undefined && (typeof key !== 'string' || key.length === 0 || key.length > 4096 || /[\r\n\u0000]/.test(key))) {
      throw new ClyvroError('Invalid API key')
    }
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 60_000) {
      throw new ClyvroError('Invalid timeout')
    }
  }

  async guard(input: GuardInput): Promise<GuardResult> {
    if (!this.key) return { status: 'disabled' }
    const body = validateGuard(input)
    const result = await this.request('/api/v1/guard', body)
    if (!isRecord(result) || !['allow', 'challenge', 'block'].includes(String(result.action))) {
      throw new ClyvroError('Invalid guard response')
    }
    return { status: 'enabled', action: result.action as ClyvroAction }
  }

  async scan(url: string, consent: boolean): Promise<ScanResult> {
    if (consent !== true) throw new ClyvroError('Explicit consent is required')
    if (!this.key) throw new ClyvroError('Clyvro API key is required for scans')
    const safeUrl = validateScanUrl(url)
    const result = await this.request('/api/v1/scans', { url: safeUrl, consent: true })
    if (!isRecord(result) || typeof result.id !== 'string' || result.id.length === 0 || result.id.length > MAX_SCAN_ID || !/^[A-Za-z0-9_-]+$/.test(result.id)) {
      throw new ClyvroError('Invalid scan response')
    }
    return { id: result.id }
  }

  private async request(path: string, body: object): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(`${ORIGIN}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'error',
      })
      if (response.status !== 200 && response.status !== 202) throw new ClyvroError('Clyvro request failed')
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new ClyvroError('Invalid Clyvro response')
      }
      return payload
    } catch (error) {
      if (error instanceof ClyvroError) throw error
      throw new ClyvroError(controller.signal.aborted ? 'Clyvro request timed out' : 'Clyvro request failed')
    } finally {
      clearTimeout(timer)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
