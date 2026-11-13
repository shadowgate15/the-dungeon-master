import { describe, expect, it } from 'vitest'
import { ARC_SIZES, arcProblems, type ArcDraft } from './arc.ts'

const beat = (n: number) => ({ title: `Beat ${n}`, description: `Something happens ${n}.` })
const arc = (acts: number, beatsPerAct: number): ArcDraft => ({
  title: 'The Ember Crown',
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  acts: Array.from({ length: acts }, (_, a) => ({
    name: `Act ${a}`,
    purpose: 'Things escalate.',
    beats: Array.from({ length: beatsPerAct }, (_, b) => beat(a * 10 + b))
  })),
  resolution: 'The relic is destroyed.'
})

describe('Arc size ranges by Length', () => {
  it('names the ranges from the spec', () => {
    expect(ARC_SIZES).toEqual({
      'one-shot': { acts: [1, 1], beats: [3, 4] },
      short: { acts: [3, 3], beats: [5, 8] },
      medium: { acts: [3, 4], beats: [9, 14] },
      long: { acts: [4, 5], beats: [14, 20] }
    })
  })

  it('accepts an Arc inside its Length ranges', () => {
    expect(arcProblems(arc(1, 3), 'one-shot')).toEqual([])
    expect(arcProblems(arc(3, 2), 'short')).toEqual([])
    expect(arcProblems(arc(4, 3), 'medium')).toEqual([])
    expect(arcProblems(arc(5, 3), 'long')).toEqual([])
  })

  it('rejects too many or too few Acts', () => {
    expect(arcProblems(arc(2, 3), 'short').join()).toMatch(/Acts/)
    expect(arcProblems(arc(2, 3), 'one-shot').join()).toMatch(/Acts/)
  })

  it('rejects a total Beat count outside the range', () => {
    expect(arcProblems(arc(1, 5), 'one-shot').join()).toMatch(/Beats/)
    expect(arcProblems(arc(3, 1), 'short').join()).toMatch(/Beats/)
  })

  it('requires at least one Beat in every Act, and non-blank text', () => {
    const a = arc(3, 2)
    a.acts[1].beats = []
    expect(arcProblems(a, 'short').join()).toMatch(/at least one Beat/)
    const b = arc(3, 2)
    b.title = '  '
    expect(arcProblems(b, 'short').join()).toMatch(/title/i)
  })

  it('rejects over-long text', () => {
    const a = arc(3, 2)
    a.acts[0].beats[0].description = 'x'.repeat(2000)
    expect(arcProblems(a, 'short').join()).toMatch(/too long/)
  })

  it('in generated mode, wants 2 to 4 Beats per Act', () => {
    expect(arcProblems(arc(3, 1), 'short', { generated: true }).join()).toMatch(/2 to 4/)
    expect(arcProblems(arc(3, 2), 'short', { generated: true })).toEqual([])
  })
})
