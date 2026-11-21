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
      steps: { adjudication: { requests: 1 } },
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
  it('shows the model requests of each step', async () => {
    const stats: RunStats = {
      steps: { adjudication: { requests: 1 }, effect: { requests: 2 }, reply: { requests: 1 } }
    }
    render(EventInspector, { stats })

    const section = page.getByRole('region', { name: 'This Exchange' })
    await expect.element(section.getByText('effect requests')).toBeVisible()
    await expect.element(section.getByText('2')).toBeVisible()
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
