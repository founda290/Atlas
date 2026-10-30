import { randomBytes } from 'node:crypto'
export interface AtlasMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tools: string[]
  createdAt?: number
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
export function normalizeMessages(items: unknown[]): AtlasMessage[] {
  return items.flatMap((item) => {
    const raw = record(item),
      info = record(raw.info)
    if (typeof info.id !== 'string' || !['user', 'assistant'].includes(String(info.role))) return []
    const parts = Array.isArray(raw.parts) ? raw.parts.map(record) : []
    return [
      {
        id: info.id,
        role: info.role as 'user' | 'assistant',
        content: parts
          .filter((p) => p.type === 'text')
          .map((p) => (typeof p.text === 'string' ? p.text : ''))
          .join('\n'),
        tools: parts
          .filter((p) => p.type === 'tool')
          .map((p) => `${String(p.tool ?? '')} · ${String(record(p.state).status ?? '')}`),
        createdAt:
          typeof record(info.time).created === 'number'
            ? Number(record(info.time).created)
            : undefined,
      },
    ]
  })
}

let timestamp = 0,
  counter = 0
/** OpenCode 1.19.5 sorts native messages by this timestamp-prefixed identifier, not UUID order. */
export function createRuntimeMessageId() {
  const now = Math.max(Date.now(), timestamp)
  if (now !== timestamp) {
    timestamp = now
    counter = 0
  }
  if (++counter >= 4096) {
    timestamp++
    counter = 1
  }
  const prefix = ((BigInt(timestamp) * 4096n + BigInt(counter)) & 0xffffffffffffn)
    .toString(16)
    .padStart(12, '0')
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  return `msg_${prefix}${[...randomBytes(14)].map((b) => alphabet[b % 62]).join('')}`
}
