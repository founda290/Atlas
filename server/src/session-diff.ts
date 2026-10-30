import { MAX_FILE_BYTES, validateFilePath, isSupportedTextPath } from './workspace-files.js'

interface RuntimeDiff {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
}
/** Validate runtime observations at the browser boundary; never expose restricted diff content. */
export function filterRuntimeDiffs(items: unknown[]) {
  const diffs: RuntimeDiff[] = []
  let omitted = Math.max(0, items.length - 1000)
  const seen = new Set<string>()
  let bytes = 0
  for (const item of items.slice(0, 1000)) {
    if (!item || typeof item !== 'object') {
      omitted++
      continue
    }
    const diff = item as Record<string, unknown>
    try {
      if (typeof diff.file !== 'string') throw new Error()
      validateFilePath(diff.file)
      if (seen.has(diff.file)) throw new Error()
      if (
        !isSupportedTextPath(diff.file) ||
        typeof diff.before !== 'string' ||
        typeof diff.after !== 'string' ||
        typeof diff.additions !== 'number' ||
        typeof diff.deletions !== 'number' ||
        !Number.isSafeInteger(diff.additions) ||
        !Number.isSafeInteger(diff.deletions) ||
        diff.additions < 0 ||
        diff.deletions < 0
      )
        throw new Error()
      const size = Buffer.byteLength(diff.before) + Buffer.byteLength(diff.after)
      if (
        size > MAX_FILE_BYTES ||
        diff.before.includes('\0') ||
        diff.after.includes('\0') ||
        bytes + size > 1024 * 1024 ||
        diffs.length >= 100
      )
        throw new Error()
      seen.add(diff.file)
      bytes += size
      diffs.push({
        file: diff.file,
        before: diff.before,
        after: diff.after,
        additions: diff.additions,
        deletions: diff.deletions,
      })
    } catch {
      omitted++
    }
  }
  return {
    diffs,
    omitted,
    source: 'opencode-session' as const,
    authoritativeFilesystem: false as const,
    fetchedAt: Date.now(),
  }
}
