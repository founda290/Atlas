import { createHmac } from 'node:crypto'
import type { CloudWorker } from './projects.js'
/** Signed control-plane client, not a VM/container implementation. Disabled unless explicitly constructed. */
export class SignedCloudWorker implements CloudWorker {
  readonly available = true
  private base: string
  constructor(
    url: string,
    private secret: string,
    private transport: typeof fetch = fetch,
  ) {
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      secret.length < 32
    )
      throw new Error(
        'Use an HTTPS worker endpoint and a dedicated signing secret of at least 32 characters.',
      )
    this.base = parsed.href.replace(/\/$/, '')
  }
  private async send(
    path: string,
    input: { projectId: string; ownerId: string } & Record<string, unknown>,
  ) {
    const body = JSON.stringify(input),
      timestamp = String(Date.now()),
      signature = createHmac('sha256', this.secret)
        .update(`${timestamp}.${path}.${body}`)
        .digest('hex')
    const response = await this.transport(`${this.base}${path}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        'content-type': 'application/json',
        'x-atlas-timestamp': timestamp,
        'x-atlas-signature': signature,
      },
      body,
    })
    if (!response.ok) throw new Error('Isolated worker did not acknowledge the operation.')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Missing worker acknowledgement.')
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        bytes += part.value.byteLength
        if (bytes > 16384) {
          await reader.cancel()
          throw new Error('Invalid worker acknowledgement.')
        }
        chunks.push(part.value)
      }
    } finally {
      reader.releaseLock()
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
    const result: unknown = JSON.parse(text)
    if (!result || typeof result !== 'object') throw new Error('Invalid worker acknowledgement.')
    const data = result as Record<string, unknown>
    if (
      data.accepted !== true ||
      data.projectId !== input.projectId ||
      data.ownerId !== input.ownerId
    )
      throw new Error('Worker acknowledgement identity did not match.')
  }
  async provision(input: Parameters<CloudWorker['provision']>[0]) {
    await this.send('/v1/workspaces', input)
  }
  async stop(input: Parameters<CloudWorker['stop']>[0]) {
    await this.send(`/v1/workspaces/${encodeURIComponent(input.projectId)}/stop`, input)
  }
}
