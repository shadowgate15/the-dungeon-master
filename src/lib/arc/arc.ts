import type { Length } from '../campaign/enums.ts'

/** The text of an Arc as the player edits it and the model generates it. */
export interface ArcBeatText {
  title: string
  description: string
}
export interface ArcActText {
  name: string
  purpose: string
  beats: ArcBeatText[]
}
export interface ArcDraft {
  title: string
  premise: string
  stakes: string
  acts: ArcActText[]
  resolution: string
}

export type BeatState = 'pending' | 'reached' | 'abandoned'

/** An Arc as the Campaign page receives it: text, structure, status and Beat state, with ids. */
export interface ArcViewData extends Omit<ArcDraft, 'acts'> {
  id: string
  status: 'draft' | 'accepted'
  acts: {
    id: string
    name: string
    purpose: string
    beats: {
      id: string
      title: string
      description: string
      state: BeatState
      /** The Session (by number) that moved the Beat off pending; null while pending. */
      sessionNumber?: number | null
    }[]
  }[]
}

export type Range = readonly [min: number, max: number]

/** Acts and total Beats an Arc holds, by Campaign Length. Tunable; also given to the prompt. */
export const ARC_SIZES: Record<Length, { acts: Range; beats: Range }> = {
  'one-shot': { acts: [1, 1], beats: [3, 4] },
  short: { acts: [3, 3], beats: [5, 8] },
  medium: { acts: [3, 4], beats: [9, 14] },
  long: { acts: [4, 5], beats: [14, 20] }
}

/** Generated Acts hold this many Beats each (editing only needs at least one). */
export const GENERATED_BEATS_PER_ACT: Range = [2, 4]

/** Text length caps, in characters. */
export const ARC_MAX = {
  title: 120,
  premise: 600,
  stakes: 600,
  actName: 80,
  purpose: 200,
  beatTitle: 120,
  beatDescription: 400,
  resolution: 600
} as const

const describe = ([min, max]: Range) => (min === max ? `${min}` : `${min} to ${max}`)

/** The size rule as a sentence, for the prompt and the UI. */
export function sizeText(length: Length): string {
  const { acts, beats } = ARC_SIZES[length]
  return `${describe(acts)} Act${acts[1] === 1 ? '' : 's'} and ${describe(beats)} Beats in total`
}

/**
 * Every rule an Arc must satisfy, as readable problems (empty when valid). Shared by the server
 * (generation and saving) and the editor. `generated` adds the per-Act Beat count.
 */
export function arcProblems(
  arc: ArcDraft,
  length: Length,
  options: { generated?: boolean } = {}
): string[] {
  const problems: string[] = []
  const text = (label: string, value: unknown, max: number) => {
    if (typeof value !== 'string' || !value.trim()) problems.push(`${label} is required`)
    else if (value.trim().length > max) problems.push(`${label} is too long (max ${max})`)
  }
  text('The title', arc.title, ARC_MAX.title)
  text('The premise', arc.premise, ARC_MAX.premise)
  text('The stakes', arc.stakes, ARC_MAX.stakes)
  text('The resolution', arc.resolution, ARC_MAX.resolution)

  const size = ARC_SIZES[length]
  if (arc.acts.length < size.acts[0] || arc.acts.length > size.acts[1]) {
    problems.push(`A ${length} Arc needs ${describe(size.acts)} Acts, not ${arc.acts.length}`)
  }
  let beats = 0
  arc.acts.forEach((act, i) => {
    text(`Act ${i + 1}'s name`, act.name, ARC_MAX.actName)
    text(`Act ${i + 1}'s purpose`, act.purpose, ARC_MAX.purpose)
    if (act.beats.length < 1) problems.push(`Act ${i + 1} needs at least one Beat`)
    if (options.generated && act.beats.length > 0) {
      const [lo, hi] = GENERATED_BEATS_PER_ACT
      if (act.beats.length < lo || act.beats.length > hi) {
        problems.push(`Act ${i + 1} needs ${describe(GENERATED_BEATS_PER_ACT)} Beats`)
      }
    }
    act.beats.forEach((beat, j) => {
      text(`Act ${i + 1} Beat ${j + 1}'s title`, beat.title, ARC_MAX.beatTitle)
      text(`Act ${i + 1} Beat ${j + 1}'s description`, beat.description, ARC_MAX.beatDescription)
    })
    beats += act.beats.length
  })
  if (beats < size.beats[0] || beats > size.beats[1]) {
    problems.push(`A ${length} Arc needs ${describe(size.beats)} Beats in total, not ${beats}`)
  }
  return problems
}
