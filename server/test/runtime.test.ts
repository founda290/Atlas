// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpencode, type OpencodeClient } from '@opencode-ai/sdk'
import { OpenCodeEngine, OpenCodeLocalRuntime } from '../src/runtime'
import { normalizeRuntimeEvent } from '../src/events'
import { createRuntimeMessageId, normalizeMessages } from '../src/messages'
vi.mock('@opencode-ai/sdk', () => ({ createOpencode: vi.fn() }))
const metadata = {
  all: [
    {
      id: 'test',
      name: 'Provider',
      key: 'not-returned-secret',
      options: { apiKey: 'not-returned-secret' },
      models: {
        modern: {
          id: 'modern',
          name: 'Modern',
          capabilities: { toolcall: true, reasoning: true },
          limit: { context: 4096, output: 1000 },
          headers: { Authorization: 'not-returned-secret' },
        },
        legacy: {
          id: 'legacy',
          name: 'Legacy',
          tool_call: true,
          reasoning: false,
          limit: { context: 1024, output: 200 },
        },
      },
    },
  ],
  connected: ['test'],
  default: {},
}
function mockClient() {
  return {
    provider: { list: vi.fn().mockResolvedValue({ data: metadata }) },
    config: { get: vi.fn().mockResolvedValue({ data: {} }) },
    session: {
      create: vi.fn().mockResolvedValue({ data: { id: 'runtime-session', time: { created: 1 } } }),
      prompt: vi.fn().mockResolvedValue({ data: { info: { id: 'message' } } }),
      abort: vi.fn().mockResolvedValue({ data: true }),
      get: vi.fn().mockResolvedValue({ data: { id: 'runtime-session' } }),
      status: vi.fn().mockResolvedValue({ data: {} }),
    },
  }
}
const instances: OpenCodeLocalRuntime[] = []
function fixture(timeout = 1000) {
  const engine = new OpenCodeEngine(),
    client = mockClient(),
    close = vi.fn()
  vi.mocked(createOpencode).mockResolvedValue({
    client: client as unknown as OpencodeClient,
    server: { url: 'http://127.0.0.1:1', close },
  })
  const runtime = new OpenCodeLocalRuntime(process.cwd(), engine, timeout)
  instances.push(runtime)
  return { engine, client, close, runtime }
}
afterEach(async () => {
  for (const runtime of instances.splice(0)) await runtime.close()
  vi.restoreAllMocks()
  vi.mocked(createOpencode).mockReset()
})
describe('OpenCode adapter reliability and wire boundary', () => {
  it('shares one startup across adapters and closes the process only after its last owner', async () => {
    const { runtime, engine, close } = fixture()
    const second = new OpenCodeLocalRuntime(process.cwd(), engine)
    instances.push(second)
    await Promise.all([runtime.status(), second.status()])
    expect(createOpencode).toHaveBeenCalledTimes(1)
    expect(engine.state).toBe('available')
    await runtime.close()
    expect(close).not.toHaveBeenCalled()
    await second.close()
    expect(close).toHaveBeenCalledOnce()
    expect(engine.state).toBe('stopped')
  })
  it('normalizes both observed live capabilities and legacy SDK fields without exposing credential objects', async () => {
    const { runtime } = fixture()
    const providers = await runtime.catalogue()
    expect(providers[0].models.map((m) => m.available)).toEqual([true, true])
    expect(JSON.stringify(providers)).not.toContain('not-returned-secret')
    await expect(
      runtime.validateModel({ providerID: 'test', modelID: 'missing' }),
    ).rejects.toMatchObject({ code: 'model_unavailable' })
  })
  it('requires an explicit/default configured model and passes the actual selected model to the SDK', async () => {
    const { runtime, client } = fixture()
    await expect(runtime.prompt('runtime-session', 'instruction')).rejects.toMatchObject({
      code: 'model_required',
    })
    await runtime.prompt(
      'runtime-session',
      'instruction',
      { providerID: 'test', modelID: 'modern' },
      'msg_stable',
    )
    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          model: { providerID: 'test', modelID: 'modern' },
          messageID: 'msg_stable',
          parts: [{ type: 'text', text: 'instruction' }],
        },
      }),
    )
  })
  it('does not turn HTTP-200 assistant errors into a completed operation', async () => {
    const { runtime, client, engine } = fixture()
    client.session.prompt.mockResolvedValue({
      data: {
        info: {
          id: 'error',
          error: { name: 'APIError', data: { statusCode: 401, message: 'not-returned-secret' } },
        },
      },
    } as never)
    await expect(
      runtime.prompt('runtime-session', 'instruction', { providerID: 'test', modelID: 'modern' }),
    ).rejects.toMatchObject({ code: 'provider_authentication' })
    expect(engine.state).toBe('degraded')
  })
  it('enforces a real bounded request signal and requests cancellation on timeout', async () => {
    const { runtime, client } = fixture(30)
    client.session.prompt.mockImplementation(
      (options: unknown) =>
        new Promise((_resolve, reject) => {
          const signal = (options as { signal: AbortSignal }).signal
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    )
    await expect(
      runtime.prompt('runtime-session', 'instruction', { providerID: 'test', modelID: 'modern' }),
    ).rejects.toMatchObject({ code: 'model_timeout' })
    expect(client.session.abort).toHaveBeenCalledOnce()
  })
  it('redacts startup failure and detects a lost engine before starting a replacement', async () => {
    const { runtime, engine, close } = fixture()
    await runtime.status()
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('not-returned-secret'))
    await runtime.status()
    expect(close).toHaveBeenCalledOnce()
    expect(createOpencode).toHaveBeenCalledTimes(2)
    expect(engine.state).toBe('available')
    await runtime.close()
    const another = fixture()
    vi.mocked(createOpencode).mockRejectedValue(new Error('not-returned-secret'))
    expect(JSON.stringify(await another.runtime.status())).not.toContain('not-returned-secret')
    expect(another.engine.state).toBe('unavailable')
  })
  it('marks missing/busy sessions non-resumable and maps SDK messages/events to Atlas-owned fields', async () => {
    const { runtime, client } = fixture()
    expect(await runtime.reconcile('runtime-session')).toBe(true)
    client.session.get.mockRejectedValue(new Error('missing'))
    expect(await runtime.reconcile('runtime-session')).toBe(false)
    expect(
      normalizeMessages([
        {
          info: { id: 'one', role: 'assistant', privateHeader: 'not-returned-secret' },
          parts: [
            { type: 'text', text: 'hello' },
            {
              type: 'tool',
              tool: 'read',
              state: { status: 'completed', output: 'not-returned-secret' },
            },
          ],
        },
      ]),
    ).toEqual([
      {
        id: 'one',
        role: 'assistant',
        content: 'hello',
        tools: ['read · completed'],
        createdAt: undefined,
      },
    ])
    const event = normalizeRuntimeEvent({
      payload: {
        type: 'message.updated',
        properties: {
          info: {
            id: 'one',
            sessionID: 'session',
            role: 'assistant',
            apiKey: 'not-returned-secret',
          },
        },
      },
    })
    expect(event.sessionId).toBe('session')
    expect(JSON.stringify(event)).not.toContain('not-returned-secret')
  })
  it('prevents a cancelled preflight from starting a late native prompt', async () => {
    const { runtime, client } = fixture()
    let proceed!: () => void
    client.provider.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          proceed = () => resolve({ data: metadata })
        }),
    )
    const controller = new AbortController()
    const pending = runtime.prompt(
      'runtime-session',
      'instruction',
      { providerID: 'test', modelID: 'modern' },
      undefined,
      controller.signal,
    )
    await vi.waitFor(() => expect(proceed).toBeTypeOf('function'))
    controller.abort()
    proceed()
    await expect(pending).rejects.toMatchObject({ code: 'operation_cancelled' })
    expect(client.session.prompt).not.toHaveBeenCalled()
  })
  it('never claims confirmed cancellation after a timed-out request when native abort returns false', async () => {
    const { runtime, client } = fixture(25)
    client.session.abort.mockResolvedValue({ data: false })
    client.session.prompt.mockImplementation(
      (options: unknown) =>
        new Promise((_resolve, reject) => {
          const signal = (options as { signal: AbortSignal }).signal
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    )
    await expect(
      runtime.prompt('runtime-session', 'instruction', { providerID: 'test', modelID: 'modern' }),
    ).rejects.toMatchObject({ code: 'cancellation_unconfirmed' })
  })
  it('uses native-compatible stable timestamped outgoing IDs rather than unordered UUIDs', () => {
    const first = createRuntimeMessageId(),
      second = createRuntimeMessageId()
    expect(first).toMatch(/^msg_[0-9a-f]{12}[A-Za-z0-9]{14}$/)
    expect(first < second).toBe(true)
    expect(
      Math.abs(Number(BigInt('0x' + first.slice(4, 16)) / 4096n) - (Date.now() % 2 ** 36)),
    ).toBeLessThan(100)
  })

  it('requires native idle as well as an abort acknowledgement before confirming cancellation', async () => {
    const { runtime, client } = fixture()
    client.session.status.mockResolvedValue({
      data: { 'runtime-session': { type: 'busy' } },
    } as never)
    expect(await runtime.abort('runtime-session')).toBe(false)
  })
  it('aborts pending startup and returns to stopped without registering a late host', async () => {
    const { runtime, engine, close } = fixture()
    vi.mocked(createOpencode).mockImplementation(
      (options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          }),
        ),
    )
    const checking = runtime.status()
    await vi.waitFor(() => expect(engine.state).toBe('starting'))
    await runtime.close()
    await checking
    expect(engine.state).toBe('stopped')
    expect(close).not.toHaveBeenCalled()
  })
})
