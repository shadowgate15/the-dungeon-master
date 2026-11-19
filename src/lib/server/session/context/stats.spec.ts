import { describe, expect, it } from 'vitest'
import { createScriptedPort, says } from '../../../testing/scripted-chat-port'
import { playableCampaign, sessionServiceWith } from '../fixture'
import { createDirectorPipeline } from '../scene-director/pipeline.ts'
import { createSceneRunner, type PipelineEvent } from '../scene-runner.ts'
import { DIRECTOR_BUDGET, MEMORY_BUDGET, NARRATOR_BUDGET } from './budgets.ts'
import { createWorldReader } from './sources.ts'

describe('per-run context stats', () => {
  it('report each role usage against its cap, memory use, event counts and trims', async () => {
    const fixture = playableCampaign()
    const sessions = sessionServiceWith(fixture).sessions
    const sessionId = (await sessions.start(fixture.campaignId)).id
    const model = createScriptedPort([says('narrate'), says('Dust settles.'), says('yield')])
    const runner = createSceneRunner({
      sessions,
      port: model.port,
      pipeline: createDirectorPipeline(),
      contextSources: {
        summary: () => ({ text: null, throughSeq: 0 }),
        world: createWorldReader(fixture.db)
      }
    })
    const result = runner.begin(sessionId, 'I look around', new AbortController().signal)
    if (!result.ok) throw new Error(result.reason)
    const events: PipelineEvent[] = []
    for await (const e of result.events) events.push(e)

    const stats = events.findLast((e) => e.type === 'stats')!.stats
    const { director, narrator } = stats.context!.roles
    expect(director).toMatchObject({ role: 'director', cap: DIRECTOR_BUDGET, verbatim: 2 })
    expect(director!.used).toBeGreaterThan(0)
    expect(director!.used).toBeLessThanOrEqual(DIRECTOR_BUDGET)
    expect(narrator).toMatchObject({
      role: 'narrator',
      cap: NARRATOR_BUDGET,
      memoryBudget: MEMORY_BUDGET,
      verbatim: 1,
      summarised: 0
    })
    expect(narrator!.memoryUsed).toBeGreaterThan(0)
    expect(stats.context!.trims).toEqual({ memory: 0, events: 0, summary: 0, uncovered: 0 })

    const step = events.find((e) => e.type === 'step')!
    expect(step.context).toMatchObject({ role: 'director', cap: DIRECTOR_BUDGET })
  })
})
