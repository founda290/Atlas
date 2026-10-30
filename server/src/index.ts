import path from 'node:path'
import { createAtlasServer } from './app.js'
import { OpenCodeLocalRuntime, WorkspaceGuard } from './runtime.js'
const port = Number(process.env.ATLAS_API_PORT ?? 8787)
const host = process.env.ATLAS_API_HOST ?? '127.0.0.1'
const workspacePath = path.resolve(
  process.env.ATLAS_TEST_WORKSPACE ?? path.join(process.cwd(), 'test-workspace'),
)
const app = createAtlasServer(
  new OpenCodeLocalRuntime(workspacePath),
  new WorkspaceGuard(workspacePath),
)
let closing = false
async function shutdown() {
  if (closing) return
  closing = true
  await app.close()
  process.exit(0)
}
process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
app.server.listen(port, host, () => console.log(`Atlas API listening on http://${host}:${port}`))
