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

const arcJson = (acts: number, beats: number) => ({
  title: 'The Ember Crown',
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  acts: Array.from({ length: acts }, (_, a) => ({
    name: `Act ${a}`,
    purpose: 'Things escalate.',
    beats: Array.from({ length: beats }, (_, b) => ({
      title: `Beat ${a}.${b}`,
      description: 'Something happens.'
    }))
  })),
  resolution: 'The relic is destroyed.'
})

const bodies = () =>
  fake.requests
    .filter((r) => r.path === '/v1/chat/completions')
    .map((r) => r.body as { messages: { role: string; content: string }[] })
const prompt = (i: number) =>
  bodies()
    [i].messages.map((m) => m.content)
    .join('\n')

describe('generateArc', () => {
  it('returns a validated draft sized by Length, and tells the model the Seed and size', async () => {
    fake.queueAnswers({ content: arcJson(3, 2) })

    const result = await generateArc(port(), seed())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.arc.acts).toHaveLength(3)
    const p = prompt(0)
    expect(p).toContain('The Ember Crown')
    expect(p).toContain('dark')
    expect(p).toContain('Eldoria')
    expect(p).toContain('3 Acts and 5 to 8 Beats')
  })

  it('retries once, naming the problem, and accepts a valid second answer', async () => {
    fake.queueAnswers({ content: arcJson(2, 2) }, { content: arcJson(3, 2) })

    const result = await generateArc(port(), seed())

    expect(result.ok).toBe(true)
    expect(bodies()).toHaveLength(2)
    expect(prompt(1)).toMatch(/rejected.*Acts/s)
  })

  it('fails with invalid-output after two invalid answers', async () => {
    fake.queueAnswers({ content: arcJson(2, 2) }, { content: arcJson(5, 5) })

    const result = await generateArc(port(), seed())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(bodies()).toHaveLength(2)
  })

  it('fails with provider-error when the model fails', async () => {
    fake.queueAnswers({ status: 503, times: 3 })

    const result = await generateArc(port(), seed())

    expect(result).toMatchObject({ ok: false, failure: { kind: 'provider-error' } })
  })

  it('is cancelled by Stop', async () => {
    fake.queueAnswers({ content: arcJson(3, 2), delayMs: 5000 })
    const controller = new AbortController()

    const pending = generateArc(port(), seed(), { signal: controller.signal })
    setTimeout(() => controller.abort(), 50)

    expect(await pending).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
  })

  it('times out', async () => {
    fake.queueAnswers({ content: arcJson(3, 2), delayMs: 5000 })

    const result = await generateArc(port(), seed(), { timeoutMs: 50 })

    expect(result).toMatchObject({ ok: false, failure: { kind: 'timeout' } })
  })
})
