import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startFakeLmStudio, type FakeLmStudio } from '#lib/testing/fake-lm-studio/server.ts'
import { createChatAdapter } from '../ai/adapter.ts'
import { createChatPort } from '../ai/port.ts'
import { generateArc, type ArcSeed } from './generate.ts'

let fake: FakeLmStudio
const port = () => createChatPort(createChatAdapter({ baseUrl: fake.baseUrl, model: 'm' }))

beforeEach(async () => {
  fake = await startFakeLmStudio({ model: 'm' })
})
afterEach(async () => {
  await fake.close()
})

const seed = (over: Partial<ArcSeed> = {}): ArcSeed => ({
  name: 'The Ember Crown',
  premise: 'A dying baron hides a relic.',
  tone: 'dark',
  length: 'short',
  worlds: [{ name: 'Eldoria', premise: 'A land of old wars.' }],
  ...over
})

const skeletonJson = (acts: number) => ({
  title: 'The Ember Crown',
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  acts: Array.from({ length: acts }, (_, a) => ({
    name: `Act name ${a + 1}`,
    purpose: `Purpose ${a + 1} things escalate.`
  })),
  resolution: 'The relic is destroyed.'
})

const actJson = (a: number, beats: number) => ({
  beats: Array.from({ length: beats }, (_, b) => ({
    title: `Beat ${a}.${b + 1}`,
    description: 'Something happens.'
  }))
})

/** Queues a skeleton and one correct Act answer per Act, using the planned Beat counts. */
const queueFull = (acts: number, beats: number[]) =>
  fake.queueAnswers(
    { content: skeletonJson(acts) },
    ...beats.map((n, i) => ({ content: actJson(i + 1, n) }))
  )

const bodies = () =>
  fake.requests
    .filter((r) => r.path === '/v1/chat/completions')
    .map((r) => r.body as { messages: { role: string; content: string }[] })
const prompt = (i: number) =>
  bodies()
    [i].messages.map((m) => m.content)
    .join('\n')

describe('generateArc', () => {
  it.each([
    ['one-shot', [3]],
    ['short', [2, 2, 2]],
    ['medium', [3, 3, 3, 3]],
    ['long', [3, 4, 4, 3, 3]]
  ] as const)('writes the planned Acts and Beats for a %s Campaign', async (length, beats) => {
    queueFull(beats.length, [...beats])

    const result = await generateArc(port(), seed({ length }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.arc.acts.map((a) => a.beats.length)).toEqual([...beats])
    expect(result.arc.acts.map((a) => a.name)).toEqual(beats.map((_, i) => `Act name ${i + 1}`))
    expect(result.arc.title).toBe('The Ember Crown')
    expect(result.arc.resolution).toBe('The relic is destroyed.')
    expect(bodies()).toHaveLength(beats.length + 1)
  })

  it('asks the skeleton for exactly N Acts, with the Seed', async () => {
    queueFull(3, [2, 2, 2])

    await generateArc(port(), seed())

    const p = prompt(0)
    expect(p).toContain('exactly 3 Acts')
    expect(p).toContain('The Ember Crown')
    expect(p).toContain('dark')
    expect(p).toContain('Eldoria')
  })

  it('shows each Act call the skeleton, its position, its Beat count and earlier Beats only', async () => {
    queueFull(3, [2, 2, 2])

    await generateArc(port(), seed())

    const second = prompt(2)
    expect(second).toContain('Act 2 of 3')
    expect(second).toContain('exactly 2 Beats')
    for (const n of [1, 2, 3]) expect(second).toContain(`Purpose ${n} things escalate.`)
    expect(second).toContain('Beat 1.1')
    expect(second).toContain('Beat 1.2')
    expect(second).not.toContain('Beat 2.1')
    expect(prompt(1)).not.toContain('Beat 1.1')
    expect(prompt(3)).toContain('Beat 2.2')
    expect(prompt(3)).toMatch(/resolution/i)
    expect(prompt(3)).toContain('The relic is destroyed.')
  })

  it('reports progress in order', async () => {
    queueFull(3, [2, 2, 2])
    const steps: unknown[] = []

    await generateArc(port(), seed(), { onProgress: (step) => steps.push(step) })

    expect(steps).toEqual([
      { kind: 'skeleton' },
      { kind: 'act', number: 1, of: 3 },
      { kind: 'act', number: 2, of: 3 },
      { kind: 'act', number: 3, of: 3 }
    ])
  })

  it('fails naming the skeleton when it has the wrong Act count, without asking for Acts', async () => {
    fake.queueAnswers({ content: skeletonJson(2) })

    const result = await generateArc(port(), seed())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    if (!result.ok) expect(result.failure.message).toMatch(/story plan.*exactly 3 Acts/s)
    expect(bodies()).toHaveLength(1)
  })

  it('fails naming the Act when its Beat count is wrong, and stops there', async () => {
    fake.queueAnswers(
      { content: skeletonJson(3) },
      { content: actJson(1, 2) },
      { content: actJson(2, 5) }
    )

    const result = await generateArc(port(), seed())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    if (!result.ok) expect(result.failure.message).toMatch(/Act 2 of 3.*exactly 2 Beats/s)
    expect(bodies()).toHaveLength(3)
  })

  it('fails on malformed output and over-long text', async () => {
    fake.queueAnswers({ content: { nonsense: true } })
    expect(await generateArc(port(), seed())).toMatchObject({
      ok: false,
      failure: { kind: 'invalid-output' }
    })

    const long = { ...skeletonJson(3), title: 'x'.repeat(500) }
    fake.queueAnswers({ content: long })
    const result = await generateArc(port(), seed())
    if (!result.ok) expect(result.failure.message).toContain('too long')
    expect(result.ok).toBe(false)
  })

  it('fails with provider-error when the model fails', async () => {
    fake.queueAnswers({ status: 503, times: 3 })

    const result = await generateArc(port(), seed())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'provider-error' } })
  })

  it('is cancelled by Stop, skipping the remaining calls', async () => {
    fake.queueAnswers({ content: skeletonJson(3) }, { content: actJson(1, 2), delayMs: 5000 })
    const controller = new AbortController()

    const pending = generateArc(port(), seed(), { signal: controller.signal })
    setTimeout(() => controller.abort(), 200)

    expect(await pending).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
    expect(bodies().length).toBeLessThanOrEqual(2)
  })

  it('times out, naming the step', async () => {
    fake.queueAnswers({ content: skeletonJson(3), delayMs: 5000 })

    const result = await generateArc(port(), seed(), { timeoutMs: 50 })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
    if (!result.ok) expect(result.failure.message).toMatch(/story plan|plan/i)
  })
})
