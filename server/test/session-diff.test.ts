// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { filterRuntimeDiffs } from '../src/session-diff'
import { MAX_FILE_BYTES } from '../src/workspace-files'
const entry = (file: string) => ({ file, before: '', after: 'new\n', additions: 1, deletions: 0 })

describe('runtime diff response budgets', () => {
  it('bounds scanned and returned entries and accounts for all omitted data', () => {
    const result = filterRuntimeDiffs(Array.from({ length: 1001 }, (_, i) => entry(`file-${i}.ts`)))
    expect(result.diffs).toHaveLength(100)
    expect(result.omitted).toBe(901)
  })
  it('bounds combined text to 1 MiB while permitting pairs at the per-file limit', () => {
    const source = 'x'.repeat(MAX_FILE_BYTES / 2)
    const result = filterRuntimeDiffs(
      Array.from({ length: 5 }, (_, i) => ({
        ...entry(`file-${i}.ts`),
        before: source,
        after: source,
      })),
    )
    expect(result.diffs).toHaveLength(4)
    expect(result.omitted).toBe(1)
  })
  it('omits malformed, absolute, sensitive, unsupported, binary and duplicate entries', () => {
    const good = entry('source.ts')
    const result = filterRuntimeDiffs([
      good,
      good,
      null,
      {},
      entry('/tmp/source.ts'),
      entry('.env'),
      entry('data.zip'),
      { ...entry('binary.ts'), after: '\0' },
      { ...entry('count.ts'), additions: -1 },
      { ...entry('fraction.ts'), deletions: 1.5 },
    ])
    expect(result.diffs).toEqual([good])
    expect(result.omitted).toBe(9)
  })
})
