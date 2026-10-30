import path from 'node:path'
import { createEngineeringServer } from './engineering.js'
const port = Number(process.env.ATLAS_API_PORT ?? 8787)
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('ATLAS_API_PORT must be between 1 and 65535')
const host = process.env.ATLAS_API_HOST ?? '127.0.0.1'
if (!['127.0.0.1', '::1', 'localhost'].includes(host))
  throw new Error(
    'Atlas execution API must bind to loopback; public execution hosting is not supported',
  )
const app = await createEngineeringServer({
  dataDir: path.resolve(process.env.ATLAS_DATA_DIR || '.atlas'),
  workspaceRoot: process.env.ATLAS_WORKSPACE_ROOT || undefined,
  databaseUrl: process.env.DATABASE_URL,
  allowedOrigins: process.env.ATLAS_ALLOWED_ORIGINS?.split(',').filter(Boolean),
})
let closing = false
async function shutdown() {
  if (closing) return
  closing = true
  try {
    await app.close()
    process.exitCode = 0
  } catch {
    console.error('Atlas shutdown could not finish cleanly')
    process.exitCode = 1
  }
}
process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
app.server.listen(port, host, () =>
  console.log(`Atlas local API listening on port ${port}; storage ${app.store.kind}`),
)
