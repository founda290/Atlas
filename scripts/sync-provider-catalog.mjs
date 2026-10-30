#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outputPath = path.resolve(here, '../public/provider-catalog.json')
const sourceUrl = 'https://models.dev/api.json'
const freeProviders = new Set(['opencode', 'opencode-go'])

function validUrl(value) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function safeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function transformCatalog(input, fetchedAt = new Date().toISOString()) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('Models.dev catalog must be a JSON object keyed by provider ID.')

  const providers = Object.entries(input)
    .filter(
      ([id, provider]) =>
        /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(id) && provider && typeof provider === 'object',
    )
    .map(([id, provider]) => {
      const models = Object.entries(provider.models ?? {})
        .filter(([, model]) => {
          const inputModes = model?.modalities?.input
          const outputModes = model?.modalities?.output
          return (
            model &&
            model.tool_call === true &&
            model.status !== 'deprecated' &&
            Array.isArray(inputModes) &&
            inputModes.includes('text') &&
            Array.isArray(outputModes) &&
            outputModes.includes('text')
          )
        })
        .map(([modelKey, model]) => {
          const inputPrice = Number.isFinite(model.cost?.input) ? model.cost.input : undefined
          const outputPrice = Number.isFinite(model.cost?.output) ? model.cost.output : undefined
          return {
            id: safeString(model.id) ?? modelKey,
            name: safeString(model.name) ?? safeString(model.id) ?? modelKey,
            description: safeString(model.description),
            toolCall: true,
            reasoning: model.reasoning === true,
            context: Number.isFinite(model.limit?.context) ? model.limit.context : undefined,
            output: Number.isFinite(model.limit?.output) ? model.limit.output : undefined,
            inputPrice,
            outputPrice,
            status: ['alpha', 'beta', 'active'].includes(model.status) ? model.status : undefined,
            free: freeProviders.has(id) && inputPrice === 0 && outputPrice === 0,
          }
        })
        .sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name))

      const env = Array.isArray(provider.env)
        ? provider.env.filter(
            (item) => typeof item === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(item),
          )
        : []
      return {
        id,
        name: safeString(provider.name) ?? id,
        api: validUrl(provider.api),
        docs: validUrl(provider.doc),
        npm: safeString(provider.npm),
        credentialEnvNames: env,
        catalogModelCount: Object.keys(provider.models ?? {}).length,
        agentModelCount: models.length,
        models,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  return {
    schemaVersion: 1,
    source: sourceUrl,
    sourceLicense: 'MIT',
    sourceCopyright: 'Copyright (c) 2025 models.dev',
    fetchedAt,
    providerCount: providers.length,
    agentProviderCount: providers.filter((provider) => provider.agentModelCount > 0).length,
    modelCount: providers.reduce((total, provider) => total + provider.models.length, 0),
    providers,
  }
}

async function main() {
  const inputPath = process.argv[2]
  let raw
  if (inputPath) {
    raw = JSON.parse(await readFile(path.resolve(inputPath), 'utf8'))
  } else {
    const response = await fetch(sourceUrl, {
      headers: { accept: 'application/json', 'user-agent': 'Atlas provider catalog sync' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`Catalog source returned HTTP ${response.status}.`)
    raw = await response.json()
  }
  const catalog = transformCatalog(raw)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog)}\n`, 'utf8')
  console.log(
    `Wrote ${catalog.providerCount} providers (${catalog.agentProviderCount} with agent-capable models), ${catalog.modelCount} models to ${outputPath}`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Provider catalog sync failed.')
    process.exitCode = 1
  })
}
