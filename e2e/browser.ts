import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { brotliDecompressSync } from 'node:zlib'
import chromium from '@sparticuz/chromium'
export async function browserOptions() {
  if (process.env.ATLAS_BUNDLED_CHROMIUM !== '1') return {}
  const require = createRequire(import.meta.url)
  const packageRoot = path.resolve(path.dirname(require.resolve('@sparticuz/chromium')), '..', '..')
  const root = path.join(tmpdir(), 'atlas-browser-libs')
  mkdirSync(root, { recursive: true })
  const archive = path.join(root, 'libs.tar')
  writeFileSync(
    archive,
    brotliDecompressSync(readFileSync(path.join(packageRoot, 'bin/al2023.tar.br'))),
  )
  execFileSync('tar', ['xf', archive, '-C', root])
  return {
    executablePath: await chromium.executablePath(),
    args: chromium.args.filter((arg) => arg !== '--single-process'),
    env: { ...process.env, LD_LIBRARY_PATH: `${root}/lib:${process.env.LD_LIBRARY_PATH ?? ''}` },
  }
}
