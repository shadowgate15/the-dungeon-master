import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { MemoryInspector, MemoryRunSummary } from '#lib/memory/inspector.ts'
import type { RulingMessage, RunStats } from './exchange-events.ts'
import EventInspector from './EventInspector.svelte'

const run = (over: Partial<MemoryRunSummary>): MemoryRunSummary => ({
  id: 'r1',
  kind: 'extraction',
  outcome: 'success',
  fromSeq: 1,
  toSeq: 6,
  accepted: 3,
  dropped: 0,
  droppedItems: [],
  durationMs: 120,
  createdAt: 0,
  ...over
})

const memory = (over: Partial<MemoryInspector> = {}): MemoryInspector => ({
  paused: false,
  extractionRunning: false,
  summaryRunning: false,
  latestSeq: 10,
  watermark: 6,
  lag: 4,
  summaryThroughSeq: 0,
  lastExtraction: run({}),
  lastSummary: null,
  recent: [run({})],
  ...over
})

describe('EventInspector memory section', () => {
  it('shows watermark lag, counts and drop reasons without item text', async () => {
    const extraction = run({
      accepted: 3,
      dropped: 1,
      droppedItems: [{ kind: 'npc', reason: 'contains digits' }]
    })
    render(EventInspector, {
      stats: null,
      memory: memory({ lastExtraction: extraction, recent: [extraction] })
    })

    const section = page.getByRole('region', { name: 'Memory' })
    await expect.element(section.getByText('Watermark lag: 4 events')).toBeVisible()
    await expect.element(section.getByText('3 accepted, 1 dropped').first()).toBeVisible()
    await expect.element(section.getByText('npc: contains digits').first()).toBeVisible()
    await expect.element(section.getByText('Extraction paused')).not.toBeInTheDocument()
  })

  it('shows the paused badge and in-flight status', async () => {
    render(EventInspector, {
      stats: null,
      memory: memory({ paused: true, summaryRunning: true })
    })

    await expect.element(page.getByText('Extraction paused')).toBeVisible()
    await expect.element(page.getByText('Summary running')).toBeVisible()
    await expect.element(page.getByText('Extraction running')).not.toBeInTheDocument()
  })

  it('shows per-role context stats from the run', async () => {
    const stats: RunStats = {
      steps: { adjudication: { requests: 1, retries: 0, defaults: 0, latencyMs: 900 } },
      context: {
        roles: {
          narrator: {
            role: 'narrator',
            used: 1500,
            cap: 2600,
            memoryUsed: 300,
            memoryBudget: 800,
            verbatim: 8,
            summarised: 12,
            trims: { memory: 1, events: 0, uncovered: 0, summary: 0 }
          }
        },
        trims: { memory: 1, events: 0, uncovered: 0, summary: 0 }
      }
    }
    render(EventInspector, { stats, memory: memory() })

    await expect.element(page.getByText('narrator: 1500 / 2600 tokens')).toBeVisible()
  })

  it('refreshes on demand', async () => {
    const onrefresh = vi.fn()
    render(EventInspector, { stats: null, memory: memory(), onrefresh })

    await page.getByRole('button', { name: 'Refresh memory' }).click()
    expect(onrefresh).toHaveBeenCalledOnce()
  })

  it('renders new load data after a refresh', async () => {
    const { rerender } = render(EventInspector, { stats: null, memory: memory() })
    await expect.element(page.getByText('Watermark lag: 4 events')).toBeVisible()

    await rerender({ stats: null, memory: memory({ watermark: 10, lag: 0 }) })
    await expect.element(page.getByText('Watermark lag: 0 events')).toBeVisible()
  })
})

describe('EventInspector Exchange section', () => {
  it('shows the requests, retries, defaults and latency of each step', async () => {
    const stats: RunStats = {
      steps: {
        adjudication: { requests: 2, retries: 1, defaults: 1, latencyMs: 2400 },
        effect: { requests: 1, retries: 0, defaults: 0, latencyMs: 800 },
        reply: { requests: 1, retries: 0, defaults: 0, latencyMs: 3100 }
      }
    }
    render(EventInspector, { stats })

    const section = page.getByRole('region', { name: 'This Exchange' })
    const step = (name: string) => section.getByRole('listitem').filter({ hasText: name })
    await expect
      .element(step('adjudication'))
      .toHaveTextContent('adjudication: 2 requests, 1 retry, default applied, 2400 ms')
    await expect.element(step('effect')).toHaveTextContent('effect: 1 request, 0 retries, 800 ms')
    await expect.element(step('reply')).toHaveTextContent('reply: 1 request, 0 retries, 3100 ms')
  })

  it('shows a step that has not run as not run', async () => {
    const stats: RunStats = {
      steps: { adjudication: { requests: 1, retries: 0, defaults: 0, latencyMs: 500 } }
    }
    render(EventInspector, { stats })

    const section = page.getByRole('region', { name: 'This Exchange' })
    await expect
      .element(section.getByRole('listitem').filter({ hasText: 'effect' }))
      .toHaveTextContent('effect: not run')
  })

  it('shows the ruling: the Adjudication and the Effect that was applied', async () => {
    const ruling: RulingMessage = {
      type: 'ruling',
      adjudication: { outcome: 'happens' },
      effect: { effect: 'move', exitId: 'front-door' }
    }
    render(EventInspector, { stats: null, ruling })

    const section = page.getByRole('region', { name: 'Ruling' })
    await expect.element(section.getByText('happens')).toBeVisible()
    await expect.element(section.getByText('move')).toBeVisible()
    await expect.element(section.getByText('exitId: front-door')).toBeVisible()
  })

  it('shows an impossible Declaration with no Effect applied', async () => {
    const ruling: RulingMessage = {
      type: 'ruling',
      adjudication: { outcome: 'impossible' },
      effect: null
    }
    render(EventInspector, { stats: null, ruling })

    const section = page.getByRole('region', { name: 'Ruling' })
    await expect.element(section.getByText('impossible')).toBeVisible()
    await expect.element(section.getByText('not applied')).toBeVisible()
  })
})
