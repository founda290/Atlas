// Real runtime acceptance only. No test-runtime injection or simulated successful operations.
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { createAtlasServer } from '../server/dist/app.js'
import { OpenCodeLocalRuntime, WorkspaceGuard } from '../server/dist/runtime.js'

const execute = process.argv.includes('--execute')
const timeoutIndex = process.argv.indexOf('--timeout-ms')
const timeout = timeoutIndex < 0 ? 60000 : Number(process.argv[timeoutIndex + 1])
if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000)
  throw new Error('Use a timeout between 1000 and 120000 ms')
const report = {
  cli: 'not verified',
  runtime: 'not checked',
  inventory: false,
  fileRead: false,
  sessionCreated: false,
  history: false,
  diffEndpoint: false,
  eventStream: false,
  modelExecution: execute ? 'pending' : 'not requested',
  actualFileChange: 'not checked',
  activeCancellation: 'not tested',
  runtimeEventTypes: [],
}
let app
let directory
let sourceController
let reader
let timer
let sessionId
let base
async function request(endpoint, body) {
  const response = await fetch(`${base}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    ...(body
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
    signal: AbortSignal.timeout(15000),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(`Atlas endpoint returned HTTP ${response.status}`)
  return result.data
}
try {
  const { stdout } = await promisify(execFile)('opencode', ['--version'], { timeout: 10000 })
  report.cli = stdout.trim().match(/^\d+\.\d+\.\d+/)?.[0] ?? 'version not recognized'
  directory = await mkdtemp(path.join(tmpdir(), 'atlas-runtime-check-'))
  await writeFile(
    path.join(directory, 'acceptance.ts'),
    "export const atlasAcceptance = 'before'\n",
  )
  app = createAtlasServer(new OpenCodeLocalRuntime(directory), new WorkspaceGuard(directory))
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${app.server.address().port}/api/v1`
  const health = await request('/health')
  report.runtime = health.runtime.status
  if (report.runtime !== 'ready') throw new Error('OpenCode runtime is unavailable')
  report.inventory = (await request('/workspaces/atlas-test-workspace/status')).files.some(
    (file) => file.path === 'acceptance.ts',
  )
  report.fileRead =
    (await request('/workspaces/atlas-test-workspace/file?path=acceptance.ts')).content ===
    "export const atlasAcceptance = 'before'\n"
  const session = await request('/sessions', {
    workspaceId: 'atlas-test-workspace',
    title: 'Atlas real runtime acceptance',
  })
  sessionId = session.id
  report.sessionCreated = Boolean(session.id && session.runtimeSessionId)
  const history = (await request(`/sessions/${sessionId}/messages`)).messages
  const diffs = (await request(`/sessions/${sessionId}/diff`)).diffs
  report.history = Array.isArray(history) && history.length === 0
  report.diffEndpoint = Array.isArray(diffs) && diffs.length === 0
  sourceController = new AbortController()
  timer = setTimeout(() => sourceController.abort(), 10000)
  const response = await fetch(`${base}/sessions/${sessionId}/events`, {
    signal: sourceController.signal,
  })
  reader = response.body.getReader()
  const first = new TextDecoder().decode((await reader.read()).value)
  report.eventStream = response.ok && first.includes('event: connected')
  clearTimeout(timer)
  if (
    !report.inventory ||
    !report.fileRead ||
    !report.sessionCreated ||
    !report.history ||
    !report.diffEndpoint ||
    !report.eventStream
  )
    throw new Error('A real runtime smoke assertion failed')
  if (execute) {
    const marker = randomUUID()
    const expected = `export const atlasAcceptance = '${marker}'\n`
    const prompt = `In this disposable acceptance workspace, replace only acceptance.ts with exactly this UTF-8 content (including the final newline):\n${expected}\nDo not modify any other file, install dependencies, access credentials or make network requests. This checks a real local file change.`
    let resolveTerminal
    const terminal = new Promise((resolve) => {
      resolveTerminal = resolve
    })
    const decoder = new TextDecoder()
    const consume = (async () => {
      let buffer = ''
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })
          let end
          while ((end = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const type = frame
              .split('\n')
              .find((line) => line.startsWith('event: '))
              ?.slice(7)
            if (
              [
                'message.updated',
                'message.part.updated',
                'message.part.delta',
                'session.status',
                'session.diff',
                'permission.updated',
                'session.error',
              ].includes(type) &&
              !report.runtimeEventTypes.includes(type)
            )
              report.runtimeEventTypes.push(type)
            if (['session.completed', 'session.failed', 'session.cancelled'].includes(type))
              resolveTerminal(type)
          }
          if (buffer.length > 1024 * 1024) buffer = ''
        }
      } catch {
        resolveTerminal('event-stream-disconnected')
      }
    })()
    await request(`/sessions/${sessionId}/messages`, { text: prompt })
    const outcome = await Promise.race([
      terminal,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeout)
      }),
    ])
    clearTimeout(timer)
    const disk = await readFile(path.join(directory, 'acceptance.ts'), 'utf8')
    const apiFile = await request('/workspaces/atlas-test-workspace/file?path=acceptance.ts')
    report.actualFileChange = disk === expected && apiFile.content === expected
    if (outcome !== 'session.completed') {
      if (outcome === 'timeout')
        await request(`/sessions/${sessionId}/cancel`, {}).catch(() => undefined)
      throw new Error(`Real execution did not complete: ${outcome}`)
    }
    report.modelExecution = report.actualFileChange
      ? 'verified file change'
      : 'completed without the required file change'
    sourceController.abort()
    await consume
    if (!report.actualFileChange)
      throw new Error('Agent completion did not produce the required file contents')
  }
} catch (failure) {
  report.failure =
    failure?.code === 'ENOENT'
      ? 'OpenCode executable is not on PATH'
      : failure instanceof Error
        ? failure.message
        : 'Runtime check failed'
  if (execute && report.modelExecution === 'pending') report.modelExecution = 'not verified'
  process.exitCode = 1
} finally {
  clearTimeout(timer)
  sourceController?.abort()
  await reader?.cancel().catch(() => undefined)
  await app?.close()
  if (directory) await rm(directory, { recursive: true, force: true })
  console.log(JSON.stringify(report, null, 2))
}
