import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startFakeLmStudio, type FakeLmStudio } from '#lib/testing/fake-lm-studio/server.ts'
import { createChatAdapter } from './adapter.ts'
import { runField, type FieldRequest } from './field-generation.ts'
import { createChatPort } from './port.ts'

const EMPTY = { name: '', premise: '', genreFlavor: '', scale: '', magicLevel: '', techLevel: '' }

function worldRequest(over: Record<string, unknown> = {}): FieldRequest {
  return { flow: 'world', field: 'scale', mode: 'generate', values: EMPTY, ...over } as FieldRequest
}

let fake: FakeLmStudio
const port = () => createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }))

beforeEach(async () => {
  fake = await startFakeLmStudio({ model: 'm' })
})
afterEach(async () => {
  await fake.close()
})

describe('runField through the real adapter and the fake LM Studio', () => {
  it('returns the first legal slug for an enum field by default', async () => {
    const result = await runField(port(), worldRequest({ field: 'scale' }))

    expect(result).toEqual({ ok: true, value: 'single region' })
  })

  it('returns a text value for a free-text field by default', async () => {
    const result = await runField(port(), worldRequest({ field: 'name' }))

    expect(result).toEqual({ ok: true, value: 'A fake value.' })
  })
})

const chatBodies = () =>
  fake.requests
    .filter((r) => r.path === '/v1/chat/completions')
    .map(
      (r) =>
        r.body as {
          messages: { role: string; content: string }[]
          response_format: unknown
        }
    )
const system = (i = 0) =>
  chatBodies()
    [i].messages.filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n')
const answer = (value: unknown, delayMs?: number) => ({ content: { value }, delayMs })

describe('output schema', () => {
  it('is one key, constrained to the legal slugs for an enum field', async () => {
    await runField(port(), worldRequest({ field: 'magicLevel' }))

    const schema = JSON.stringify(chatBodies()[0].response_format)
    expect(schema).toContain('"value"')
    for (const slug of ['none', 'low', 'moderate', 'high', 'ubiquitous']) {
      expect(schema).toContain(`"${slug}"`)
    }
  })

  it('is one key with no maxLength for a text field', async () => {
    await runField(port(), worldRequest({ field: 'premise' }))

    const schema = JSON.stringify(chatBodies()[0].response_format)
    expect(schema).toContain('"value"')
    expect(schema).not.toContain('maxLength')
  })
})

describe('prompt context', () => {
  const values = { ...EMPTY, name: 'Eldoria', scale: 'continent', genreFlavor: 'not-a-genre' }

  it('lists the other fields as labelled lines, unset ones and invalid slugs as (unset)', async () => {
    await runField(port(), worldRequest({ field: 'premise', values }))

    const prompt = system()
    expect(prompt).toContain('- Name: Eldoria')
    expect(prompt).toContain('- Scale: continent')
    expect(prompt).toContain('- Genre flavor: (unset)')
    expect(prompt).toContain('- Magic level: (unset)')
  })

  it('leaves the target field out of the other-fields block', async () => {
    await runField(port(), worldRequest({ field: 'name', values: { ...values, name: 'Secret' } }))

    expect(system()).not.toContain('Secret')
    expect(system()).not.toMatch(/- Name:/)
  })

  it('names the legal options of an enum field and uses structural length wording for text', async () => {
    await runField(port(), worldRequest({ field: 'scale' }))
    await runField(port(), worldRequest({ field: 'premise' }))

    expect(system(0)).toContain('single region, continent, multiple continents, planar')
    expect(system(1)).toMatch(/exactly 3 sentences/)
    expect(system(1)).not.toMatch(/300 to 400/)
  })

  it('works when every other field is unset', async () => {
    const result = await runField(port(), worldRequest({ field: 'name' }))

    expect(result.ok).toBe(true)
  })

  it('sends the current value and the note for feedback, and neither for generate', async () => {
    fake.queueAnswers(answer('Brighter Eldoria'))
    await runField(
      port(),
      worldRequest({
        field: 'name',
        mode: 'feedback',
        values: { ...EMPTY, name: 'Eldoria' },
        current: 'Eldoria',
        note: 'make it sound hopeful'
      })
    )
    fake.queueAnswers(answer('Another Name'))
    await runField(port(), worldRequest({ field: 'name', values: { ...EMPTY, name: 'Eldoria' } }))

    expect(system(0)).toContain('Current value of Name: Eldoria')
    expect(system(0)).toContain("The player's note: make it sound hopeful")
    expect(system(0)).toContain('do not return the same text')
    expect(system(1)).not.toContain('note')
    expect(system(1)).not.toContain('Eldoria')
  })
})

describe('validation', () => {
  it('strips wrapper quotes, markdown and fences', async () => {
    fake.queueAnswers(answer('"**The Shattered Reach**"'))
    expect(await runField(port(), worldRequest({ field: 'name' }))).toEqual({
      ok: true,
      value: 'The Shattered Reach'
    })

    fake.queueAnswers(answer('```\nSalt Coast\n```'))
    expect(await runField(port(), worldRequest({ field: 'name' }))).toEqual({
      ok: true,
      value: 'Salt Coast'
    })
  })

  it('trims over-long text to the last sentence boundary within the ceiling', async () => {
    const first = 'A world of drifting isles.'
    const long = `${first} ${'Storms rule the sky and the sea alike. '.repeat(20)}And then`
    fake.queueAnswers(answer(long))

    const result = await runField(port(), worldRequest({ field: 'premise' }))

    expect(result.ok).toBe(true)
    const value = (result as { value: string }).value
    expect(value.length).toBeLessThanOrEqual(500)
    expect(value.endsWith('.')).toBe(true)
    expect(value.startsWith(first)).toBe(true)
  })

  it('retries once, naming the problem, when the value is empty, then succeeds', async () => {
    fake.queueAnswers(answer('  '), answer('Eldoria'))

    const result = await runField(port(), worldRequest({ field: 'name' }))

    expect(result).toEqual({ ok: true, value: 'Eldoria' })
    expect(chatBodies()).toHaveLength(2)
    const retry = chatBodies()[1].messages.filter((m) => m.role === 'user')[0].content
    expect(retry).toContain('empty')
  })

  it('retries once when the result is identical to the current value (feedback)', async () => {
    fake.queueAnswers(answer('Eldoria'), answer('Eldoria Reborn'))

    const result = await runField(
      port(),
      worldRequest({
        field: 'name',
        mode: 'feedback',
        values: { ...EMPTY, name: 'Eldoria' },
        current: 'Eldoria',
        note: 'change it'
      })
    )

    expect(result).toEqual({ ok: true, value: 'Eldoria Reborn' })
    expect(chatBodies()).toHaveLength(2)
  })

  it('fails with invalid-output when the retry is unchanged too', async () => {
    fake.queueAnswers(answer('Eldoria'), answer('Eldoria'))

    const result = await runField(
      port(),
      worldRequest({ field: 'name', values: { ...EMPTY, name: 'Eldoria' } })
    )

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(chatBodies()).toHaveLength(2)
  })

  it('retries once on a slug outside the legal options, then fails invalid-output', async () => {
    fake.queueAnswers(answer('galaxy'), answer('galaxy'))

    const result = await runField(port(), worldRequest({ field: 'scale' }))

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(chatBodies()).toHaveLength(2)
  })

  it('retries once on a wrong-shape answer', async () => {
    fake.queueAnswers({ content: { unexpected: true } }, answer('planar'))

    expect(await runField(port(), worldRequest({ field: 'scale' }))).toEqual({
      ok: true,
      value: 'planar'
    })
  })
})

describe('typed failures', () => {
  it('times out on the injected deadline', async () => {
    fake.setScenario('hang')

    const result = await runField(port(), worldRequest(), { timeoutMs: 200 })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
  })

  it('shares one deadline across the retry', async () => {
    fake.queueAnswers(answer('  ', 150), answer('Eldoria', 150))

    const result = await runField(port(), worldRequest({ field: 'name' }), { timeoutMs: 200 })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
  })

  it('is cancelled by the abort signal', async () => {
    fake.setScenario('hang')
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 50)

    const result = await runField(port(), worldRequest(), { signal: controller.signal })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
  })

  it('reports no-options without calling the model when an enum has no legal options', async () => {
    const registry = {
      world: {
        scale: { kind: 'enum' as const, label: 'Scale', instruction: 'x', options: () => [] }
      }
    }

    const result = await runField(port(), worldRequest(), { registry })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'no-options' } })
    expect(chatBodies()).toHaveLength(0)
  })

  it('reports context-invalid for unusable feedback and unknown fields, without a model call', async () => {
    const feedback = { mode: 'feedback', field: 'name', note: 'x' }
    expect(await runField(port(), worldRequest({ ...feedback, current: ' ' }))).toMatchObject({
      ok: false,
      failure: { kind: 'context-invalid' }
    })
    expect(
      await runField(port(), worldRequest({ ...feedback, current: 'Eldoria', note: ' ' }))
    ).toMatchObject({ ok: false, failure: { kind: 'context-invalid' } })
    expect(await runField(port(), worldRequest(), { registry: { world: {} } })).toMatchObject({
      ok: false,
      failure: { kind: 'context-invalid' }
    })
    expect(chatBodies()).toHaveLength(0)
  })

  it('reports a reasoning model', async () => {
    fake.setScenario('reasoning-model')

    expect(await runField(port(), worldRequest())).toMatchObject({
      ok: false,
      failure: { kind: 'reasoning-model' }
    })
  })

  it('reports an unreachable provider as provider-error', async () => {
    fake.setScenario('unreachable')

    expect(await runField(port(), worldRequest(), { timeoutMs: 5000 })).toMatchObject({
      ok: false,
      failure: { kind: 'provider-error' }
    })
  })
})
