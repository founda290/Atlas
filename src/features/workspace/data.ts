import type { Message } from '../../types/api'
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
export function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}
export function parseMessages(items: unknown[]): Message[] {
  return items.flatMap((item) => {
    const message = asRecord(item)
    const info = asRecord(message.info)
    if (typeof info.id !== 'string' || (info.role !== 'user' && info.role !== 'assistant'))
      return []
    const parts = Array.isArray(message.parts) ? message.parts.map(asRecord) : []
    return [
      {
        id: info.id,
        role: info.role,
        text: parts
          .filter((part) => part.type === 'text')
          .map((part) => asString(part.text))
          .join('\n'),
        tools: parts
          .filter((part) => part.type === 'tool')
          .map((part) => `${asString(part.tool)} · ${asString(asRecord(part.state).status)}`),
      },
    ]
  })
}
export interface ObservedDiff {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
}
export function parseDiffs(value: unknown): ObservedDiff[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const diff = asRecord(item)
    return typeof diff.file === 'string' &&
      typeof diff.before === 'string' &&
      typeof diff.after === 'string' &&
      typeof diff.additions === 'number' &&
      typeof diff.deletions === 'number'
      ? [
          {
            file: diff.file,
            before: diff.before,
            after: diff.after,
            additions: diff.additions,
            deletions: diff.deletions,
          },
        ]
      : []
  })
}
export function historyDiffs(items: unknown[]) {
  return items.flatMap((item) => parseDiffs(asRecord(asRecord(asRecord(item).info).summary).diffs))
}
export interface FileNode {
  name: string
  path: string
  children: FileNode[]
  bytes?: number
  file: boolean
}
export function buildFileTree(files: { path: string; bytes?: number }[]): FileNode[] {
  const roots: FileNode[] = []
  for (const file of files) {
    let nodes = roots
    const parts = file.path.split('/').filter(Boolean)
    parts.forEach((name, index) => {
      const fullPath = parts.slice(0, index + 1).join('/')
      let node = nodes.find((item) => item.path === fullPath)
      if (!node) {
        node = {
          name,
          path: fullPath,
          file: index === parts.length - 1,
          children: [],
          bytes: index === parts.length - 1 ? file.bytes : undefined,
        }
        nodes.push(node)
      }
      nodes = node.children
    })
  }
  function sort(nodes: FileNode[]) {
    nodes.sort((a, b) => Number(a.file) - Number(b.file) || a.name.localeCompare(b.name))
    nodes.forEach((node) => sort(node.children))
  }
  sort(roots)
  return roots
}
