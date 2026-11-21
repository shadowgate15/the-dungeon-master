import { describe, expect, it } from 'vitest'
import { effect, happens } from '../../../testing/exchange-scripts'
import { createScriptedPort, says } from '../../../testing/scripted-chat-port'
import { playableCampaign, sessionServiceWith } from '../fixture'
import { createSceneRunner, type ExchangeEvent } from '../scene-runner.ts'
import { MEMORY_BUDGET, NARRATOR_BUDGET, RULING_BUDGET } from './budgets.ts'
import { createWorldReader } from './sources.ts'

describe('per-Exchange context stats', () => {
  it('report each role usage against its cap, memory use, event counts and trims', async () => {
    const fixture = playableCampaign()
    const sessions = sessionServiceWith(fixture).sessions
    const sessionId = (await sessions.start(fixture.campaignId)).id
    const model = createScriptedPort([happens(), effect({ effect: 'none' }), says('Dust settles.')])
    const runner = createSceneRunner({
      sessions,
      port: model.port,
      contextSources: {
        summary: () => ({ text: null, throughSeq: 0 }),
        world: createWorldReader(fixture.db)
      }
    })
    const result = runner.begin(sessionId, 'I look around', new AbortController().signal)
    if (!result.ok) throw new Error(result.reason)
    const events: ExchangeEvent[] = []
    for await (const e of result.events) events.push(e)

    const stats = events.findLast((e) => e.type === 'stats')!.stats
    const { adjudication, effect: effectReport, narrator } = stats.context!.roles
    for (const [role, report] of [
      ['adjudication', adjudication],
      ['effect', effectReport]
    ] as const) {
      expect(report).toMatchObject({ role, cap: RULING_BUDGET, verbatim: 0 })
      expect(report!.used).toBeGreaterThan(0)
      expect(report!.used).toBeLessThanOrEqual(RULING_BUDGET)
    }
    expect(narrator).toMatchObject({
      role: 'narrator',
      cap: NARRATOR_BUDGET,
      memoryBudget: MEMORY_BUDGET,
      verbatim: 1,
      summarised: 0
    })
    expect(narrator!.memoryUsed).toBeGreaterThan(0)
    expect(stats.context!.trims).toEqual({ memory: 0, events: 0, summary: 0, uncovered: 0 })
  })
})
