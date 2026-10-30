// Genuine disposable engineering acceptance. No injected runtime or simulated provider output.
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { createEngineeringServer } from '../server/dist/engineering.js'
import { OpenCodeLocalRuntime } from '../server/dist/runtime.js'
import { Store } from '../server/dist/database/store.js'
const run = promisify(execFile),
  execute = process.argv.includes('--execute')
const option = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? fallback : process.argv[index + 1]
}
const timeout = Number(option('--timeout-ms', '15000')),
  requested = option('--model', '')
class AcceptanceError extends Error {}
if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000)
  throw new AcceptanceError('Use a timeout between 1000 and 120000 ms')
const report = {
  cli: 'not verified',
  sdk: '1.19.5',
  runtime: 'not checked',
  model: 'not selected',
  projectCreated: false,
  inventory: false,
  fileRead: false,
  sessionCreated: false,
  eventStream: false,
  modelExecution: execute ? 'pending' : 'not requested',
  actualFileChange: false,
  sourcePreserved: false,
  examplePreserved: false,
  functionVerified: false,
  testVerified: false,
  history: false,
  historyDurable: false,
  gitDiff: false,
  activeCancellation: 'not tested',
  runtimeEventTypes: [],
  tools: [],
}
let app, directory, base, sessionId, projectId
const streams = []
async function request(endpoint, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  const result = (await response.json()).data
  if (!response.ok)
    throw new AcceptanceError(
      `Atlas request failed (HTTP ${response.status}, ${String(result?.error?.code ?? 'request_failed')})`,
    )
  return result
}
const delay = (ms, value) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(value), ms)
    timer.unref()
  })
async function subscribe(id) {
  const controller = new AbortController()
  let resolveTerminal, resolveTool, resolveConnected
  const connected = new Promise((resolve) => {
    resolveConnected = resolve
  })
  const terminal = new Promise((resolve) => {
      resolveTerminal = resolve
    }),
    activeTool = new Promise((resolve) => {
      resolveTool = resolve
    })
  const response = await fetch(`${base}/sessions/${id}/events?projectId=${projectId}`, {
    signal: controller.signal,
  })
  if (!response.ok) throw new AcceptanceError('Session event subscription failed')
  const reader = response.body.getReader(),
    decoder = new TextDecoder()
  const stream = { controller, reader, terminal, activeTool, consume: undefined }
  streams.push(stream)
  stream.consume = (async () => {
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
          const line = frame.split('\n').find((line) => line.startsWith('data: '))
          const event = line ? JSON.parse(line.slice(6)) : {}
          if (type === 'connected') {
            report.eventStream = true
            resolveConnected(true)
          }
          if (type && !report.runtimeEventTypes.includes(type)) report.runtimeEventTypes.push(type)
          const part = event.data?.part
          if (part?.type === 'tool' && typeof part.tool === 'string') {
            if (!report.tools.includes(part.tool)) report.tools.push(part.tool)
            if (part.state?.status === 'running' && /bash|shell|terminal/i.test(part.tool))
              resolveTool(true)
          }
          if (
            ['session.completed', 'session.failed', 'session.cancelled', 'session.error'].includes(
              type,
            )
          ) {
            if (event.error) {
              report.executionDiagnostic = event.error
              report.executionCode = event.errorCode ?? 'not_reported'
            }
            resolveTerminal(type)
          }
        }
        if (buffer.length > 1024 * 1024) throw new AcceptanceError('Event buffer exceeded limit')
      }
    } catch {
      resolveTerminal('stream_disconnected')
    }
  })()
  if (!(await Promise.race([connected, delay(5000, false)])))
    throw new AcceptanceError('Event stream did not confirm connection')
  return stream
}
try {
  let version
  try {
    version = await run('opencode', ['--version'], { timeout: 10000, maxBuffer: 10000 })
  } catch {
    throw new AcceptanceError('OpenCode executable could not be verified on backend PATH')
  }
  report.cli = version.stdout.trim().match(/^\d+\.\d+\.\d+/)?.[0] ?? 'version not recognized'
  directory = await mkdtemp(path.join(tmpdir(), 'atlas-engineering-acceptance-'))
  app = await createEngineeringServer({
    dataDir: directory,
    runtimeFactory: (root) => new OpenCodeLocalRuntime(root, undefined, timeout),
  })
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${app.server.address().port}/api/v1`
  report.runtime = (await request('/health')).runtime.status
  if (report.runtime !== 'ready') throw new AcceptanceError('OpenCode engine is not available')
  const project = await request('/projects', {
    name: 'Disposable engineering acceptance',
    description: 'Real runtime check; removed afterwards',
    location: 'managed',
  })
  projectId = project.id
  report.projectCreated = Boolean(projectId)
  const prefix = `/projects/${projectId}`,
    root = (await app.projects.get(projectId)).rootPath
  const initial = 'export const originalMarker = 42\n',
    example =
      "import { celsiusToFahrenheit } from './sample.ts'\nconsole.log(celsiusToFahrenheit(0))\n",
    test =
      "import assert from 'node:assert/strict'\nimport { originalMarker } from './sample.ts'\nassert.equal(originalMarker, 42)\n"
  for (const [file, content] of [
    ['sample.ts', initial],
    ['example.ts', example],
    ['sample.test.ts', test],
  ])
    await request(`${prefix}/files`, { path: file, kind: 'file', content })
  report.inventory = (await request(`${prefix}/files`)).files.length === 3
  report.fileRead = (await request(`${prefix}/files/content?path=sample.ts`)).content === initial
  await run(
    'git',
    [
      '-C',
      root,
      '-c',
      'core.hooksPath=/dev/null',
      'add',
      '--',
      'sample.ts',
      'example.ts',
      'sample.test.ts',
    ],
    { timeout: 10000 },
  )
  await run(
    'git',
    [
      '-C',
      root,
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'user.name=Atlas Acceptance',
      '-c',
      'user.email=acceptance@example.invalid',
      'commit',
      '-m',
      'Disposable acceptance baseline',
    ],
    { timeout: 10000 },
  )
  const catalogue = await request(`/providers?projectId=${projectId}`)
  let model
  if (execute) {
    const slash = requested.indexOf('/')
    if (slash < 1)
      throw new AcceptanceError(
        'Execution requires --model provider/model from real runtime discovery',
      )
    const providerID = requested.slice(0, slash),
      modelID = requested.slice(slash + 1)
    model = catalogue.providers
      .find((p) => p.id === providerID)
      ?.models.find((m) => m.modelID === modelID && m.available)
    if (!model)
      throw new AcceptanceError('Requested model is not reported as connected and tool-capable')
    model = { providerID: model.providerID, modelID: model.modelID }
    report.model = `${model.providerID}/${model.modelID}`
  }
  const session = await request(`${prefix}/sessions`, {
    workspaceId: projectId,
    title: 'Genuine Celsius coding acceptance',
    ...(model ? { model } : {}),
  })
  sessionId = session.id
  report.sessionCreated = Boolean(sessionId && session.runtimeSessionId)
  const stream = await subscribe(sessionId)
  if (execute) {
    await request(`/sessions/${sessionId}/messages?projectId=${projectId}`, {
      text: 'Inspect the files in this disposable project with tools. Add and export celsiusToFahrenheit(celsius: number): number in sample.ts. Preserve the existing originalMarker export and value. Extend sample.test.ts with assertions for 0 => 32, 100 => 212 and -40 => -40 while preserving its originalMarker assertion. Preserve example.ts unchanged. Read and modify the actual files using tools and run the tests locally. Do not install dependencies, access credentials, modify any other directory or make network requests. Do not merely describe the changes.',
    })
    const outcome = await Promise.race([
      stream.terminal,
      delay(timeout + 17000, 'acceptance_deadline'),
    ])
    if (outcome === 'acceptance_deadline')
      await request(`/sessions/${sessionId}/cancel?projectId=${projectId}`, {}).catch(
        () => undefined,
      )
    const disk = await readFile(path.join(root, 'sample.ts'), 'utf8'),
      testDisk = await readFile(path.join(root, 'sample.test.ts'), 'utf8')
    report.actualFileChange = disk !== initial
    report.sourcePreserved = disk.includes('originalMarker') && disk.includes('42')
    report.examplePreserved = (await readFile(path.join(root, 'example.ts'), 'utf8')) === example
    report.gitDiff = (await request(`${prefix}/diff?comparison=working`)).diffs.some(
      (d) => d.path === 'sample.ts' && d.before === initial && d.after === disk,
    )
    if (report.actualFileChange && report.tools.length) {
      const check = `import assert from 'node:assert/strict';import {originalMarker,celsiusToFahrenheit} from ${JSON.stringify(pathToFileURL(path.join(root, 'sample.ts')).href)};assert.equal(originalMarker,42);assert.equal(celsiusToFahrenheit(0),32);assert.equal(celsiusToFahrenheit(100),212);assert.equal(celsiusToFahrenheit(-40),-40)`
      const env = { PATH: process.env.PATH, HOME: directory, ATLAS_ACCEPTANCE: '1' }
      report.functionVerified = await run(
        process.execPath,
        ['--experimental-strip-types', '--input-type=module', '-e', check],
        { timeout: 10000, maxBuffer: 10000, env },
      ).then(
        () => true,
        () => false,
      )
      report.testVerified =
        testDisk !== test &&
        testDisk.includes('celsiusToFahrenheit') &&
        (await run(process.execPath, ['--experimental-strip-types', 'sample.test.ts'], {
          cwd: root,
          timeout: 10000,
          maxBuffer: 10000,
          env,
        }).then(
          () => true,
          () => false,
        ))
    }
    const history = await request(`/sessions/${sessionId}/messages?projectId=${projectId}`)
    report.history = history.messages.some((m) => m.role === 'user' || m.info?.role === 'user')
    report.modelExecution = outcome
    if (
      outcome !== 'session.completed' ||
      !report.actualFileChange ||
      !report.functionVerified ||
      !report.testVerified ||
      !report.sourcePreserved ||
      !report.examplePreserved ||
      !report.gitDiff ||
      !report.tools.length
    )
      throw new AcceptanceError(
        'Real coding acceptance incomplete; inspect exact observed fields, not assistant claims',
      )
    const second = await request(`${prefix}/sessions`, {
      workspaceId: projectId,
      title: 'Genuine active cancellation check',
      model,
    })
    const cancellationStream = await subscribe(second.id)
    await request(`/sessions/${second.id}/messages?projectId=${projectId}`, {
      text: 'In this disposable project, run a terminal command node -e "setTimeout(()=>{},30000)". Do not modify files, read credentials, install dependencies or make network requests. Wait for the command; this tests active cancellation.',
    })
    const active = await Promise.race([cancellationStream.activeTool, delay(timeout, false)])
    const cancellation = await request(`/sessions/${second.id}/cancel?projectId=${projectId}`, {})
    report.activeCancellation =
      active && cancellation.cancelled && (await appRuntimeIdle(second.runtimeSessionId, root))
        ? 'verified running shell tool, native cancel acknowledgement and idle state'
        : 'not verified; no running shell tool or native idle confirmation'
    if (report.activeCancellation.startsWith('not verified'))
      throw new AcceptanceError(
        'Real file execution passed but active cancellation is not verified',
      )
  }
  if (!report.projectCreated || !report.inventory || !report.fileRead || !report.sessionCreated)
    throw new AcceptanceError('Real engine smoke assertions failed')
} catch (failure) {
  report.failure =
    failure instanceof AcceptanceError
      ? failure.message
      : 'Runtime check failed; inspect local CLI, persistence and network configuration'
  if (execute && report.modelExecution === 'pending') report.modelExecution = 'not verified'
  process.exitCode = 1
} finally {
  for (const stream of streams) {
    stream.controller.abort()
    await stream.reader.cancel().catch(() => undefined)
    await stream.consume
  }
  await app?.close()
  if (directory && sessionId) {
    const store = await Store.open(directory)
    try {
      report.historyDurable = (await store.messages(sessionId)).length > 0
      report.persistedStatus = (await store.session(sessionId))?.status ?? 'unknown'
    } finally {
      await store.close()
    }
  }
  if (directory) await rm(directory, { recursive: true, force: true })
  console.log(JSON.stringify(report, null, 2))
}
async function appRuntimeIdle(runtimeSessionId, root) {
  const runtime = new OpenCodeLocalRuntime(root)
  try {
    return await runtime.reconcile(runtimeSessionId)
  } finally {
    await runtime.close()
  }
}
