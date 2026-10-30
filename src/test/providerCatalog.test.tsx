import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Activity } from '../features/workspace/Activity'
import {
  fetchProviderCatalog,
  isOpenCodeFreeModel,
  isProviderCatalog,
  type ProviderCatalog,
} from '../features/providerCatalog'
import type { RuntimeEvent } from '../types/api'

function sampleCatalog(): ProviderCatalog {
  return {
    schemaVersion: 1,
    source: 'https://models.dev/api.json',
    sourceLicense: 'MIT',
    sourceCopyright: 'Copyright (c) 2025 models.dev',
    fetchedAt: '2026-10-30T00:00:00.000Z',
    providerCount: 1,
    agentProviderCount: 1,
    modelCount: 1,
    providers: [
      {
        id: 'opencode',
        name: 'OpenCode',
        credentialEnvNames: [],
        catalogModelCount: 1,
        agentModelCount: 1,
        models: [
          {
            id: 'sample-free',
            name: 'Sample Free Model',
            toolCall: true,
            reasoning: false,
            inputPrice: 0,
            outputPrice: 0,
            free: true,
          },
        ],
      },
    ],
  }
}

describe('Atlas provider catalog', () => {
  it('bundles at least 75 unique real providers and agent models from the attributed source', () => {
    const catalog = JSON.parse(
      readFileSync('public/provider-catalog.json', 'utf8'),
    ) as ProviderCatalog
    expect(catalog.source).toBe('https://models.dev/api.json')
    expect(catalog.sourceLicense).toBe('MIT')
    expect(catalog.providerCount).toBeGreaterThanOrEqual(75)
    expect(catalog.agentProviderCount).toBeGreaterThanOrEqual(75)
    expect(catalog.modelCount).toBeGreaterThan(1000)
    expect(catalog.providers).toHaveLength(catalog.providerCount)
    expect(new Set(catalog.providers.map((provider) => provider.id)).size).toBe(
      catalog.providerCount,
    )
    for (const provider of catalog.providers) {
      for (const model of provider.models) {
        expect(model.toolCall).toBe(true)
        if (model.free) {
          expect(['opencode', 'opencode-go']).toContain(provider.id)
          expect(model.inputPrice).toBe(0)
          expect(model.outputPrice).toBe(0)
        }
      }
    }
  })

  it('only classifies OpenCode models with explicitly zero input and output cost as free', () => {
    expect(isOpenCodeFreeModel('opencode', 0, 0)).toBe(true)
    expect(isOpenCodeFreeModel('opencode-go', 0, 0)).toBe(true)
    expect(isOpenCodeFreeModel('opencode', 0, 0.01)).toBe(false)
    expect(isOpenCodeFreeModel('opencode', 0, undefined)).toBe(false)
    expect(isOpenCodeFreeModel('opencode', 0.01, 0)).toBe(false)
    expect(isOpenCodeFreeModel('opencode', undefined, 0)).toBe(false)
    expect(isOpenCodeFreeModel('openai', 0, 0)).toBe(false)
  })

  it('validates and loads the same-origin catalog without asking for credentials', async () => {
    const catalog = sampleCatalog()
    expect(isProviderCatalog(catalog)).toBe(true)
    expect(isProviderCatalog({ providers: [{ id: 'fake' }] })).toBe(false)
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(catalog), { status: 200 }))

    await expect(fetchProviderCatalog()).resolves.toMatchObject({ providerCount: 1 })
    expect(fetch).toHaveBeenCalledWith('/provider-catalog.json', {
      signal: undefined,
      cache: 'no-cache',
    })
    fetch.mockRestore()
  })
})

describe('Chat activity trace', () => {
  it('shows real tool names and lifecycle events without rendering model deltas or output', () => {
    const events: RuntimeEvent[] = [
      {
        id: 'tool-event',
        type: 'message.part.updated',
        sessionId: 'session-1',
        created: Date.now(),
        data: {
          part: {
            type: 'tool',
            tool: 'web_search',
            state: { status: 'running' },
            output: 'private tool output must not appear',
          },
        },
      },
      {
        id: 'delta-event',
        type: 'message.part.delta',
        sessionId: 'session-1',
        created: Date.now(),
        data: { delta: 'private streamed text must not appear' },
      },
      {
        id: 'done-event',
        type: 'session.completed',
        sessionId: 'session-1',
        created: Date.now(),
      },
    ]

    render(<Activity events={events} title="Agent activity" />)
    expect(screen.getByRole('heading', { name: 'Agent activity' })).toBeInTheDocument()
    expect(screen.getByText('web_search · running')).toBeInTheDocument()
    expect(screen.getByText('session.completed')).toBeInTheDocument()
    expect(screen.queryByText('message.part.delta')).not.toBeInTheDocument()
    expect(screen.queryByText(/private tool output|private streamed text/)).not.toBeInTheDocument()
  })
})
