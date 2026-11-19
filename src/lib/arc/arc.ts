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

/** An Arc as the Campaign page receives it: text, structure, status and ids. */
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

/** What code decides before any model call: Acts in the Arc and the exact Beats in each. */
export interface ArcPlan {
  acts: number
  beats: number[]
}

/** Total Beats planned per Length: the midpoint of the Beat range, rounded to suit the Act count. */
const PLANNED_BEATS: Record<Length, number> = { 'one-shot': 3, short: 6, medium: 12, long: 17 }

/**
 * Plans the Arc's size: the top of the Act range, and the planned total Beats spread evenly with
 * the remainder going to the middle Acts (centre outwards, the earlier Act first on a tie).
 */
export function planArc(length: Length): ArcPlan {
  const acts = ARC_SIZES[length].acts[1]
  const total = PLANNED_BEATS[length]
  const base = Math.floor(total / acts)
  const beats = Array.from({ length: acts }, () => base)
  const centre = (acts - 1) / 2
  const order = beats
    .map((_, i) => i)
    .sort((x, y) => Math.abs(x - centre) - Math.abs(y - centre) || x - y)
  for (let k = 0; k < total - base * acts; k++) beats[order[k]]++
  return { acts, beats }
}

/** The shared text rule: required (after trimming) and within the cap. */
const textProblem = (problems: string[], label: string, value: unknown, max: number) => {
  if (typeof value !== 'string' || !value.trim()) problems.push(`${label} is required`)
  else if (value.trim().length > max) problems.push(`${label} is too long (max ${max})`)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Skeleton call check: shape, required and capped text, and exactly `actCount` Acts. */
export function skeletonProblems(skeleton: unknown, actCount: number): string[] {
  if (!isRecord(skeleton)) return ['The skeleton must be an object']
  const problems: string[] = []
  textProblem(problems, 'The title', skeleton.title, ARC_MAX.title)
  textProblem(problems, 'The premise', skeleton.premise, ARC_MAX.premise)
  textProblem(problems, 'The stakes', skeleton.stakes, ARC_MAX.stakes)
  textProblem(problems, 'The resolution', skeleton.resolution, ARC_MAX.resolution)
  if (!Array.isArray(skeleton.acts)) return [...problems, 'The acts must be a list']
  if (skeleton.acts.length !== actCount) {
    problems.push(`The Arc needs exactly ${plural(actCount, 'Act')}, not ${skeleton.acts.length}`)
  }
  skeleton.acts.forEach((act: unknown, i: number) => {
    if (!isRecord(act)) problems.push(`Act ${i + 1} must be an object with a name and purpose`)
    else {
      textProblem(problems, `Act ${i + 1}'s name`, act.name, ARC_MAX.actName)
      textProblem(problems, `Act ${i + 1}'s purpose`, act.purpose, ARC_MAX.purpose)
    }
  })
  return problems
}

/** Act call check: shape, exactly `beatCount` Beats, and capped non-empty Beat text. */
export function actProblems(act: unknown, beatCount: number, actNumber: number): string[] {
  if (!isRecord(act) || !Array.isArray(act.beats)) return [`Act ${actNumber} needs a list of Beats`]
  const problems: string[] = []
  if (act.beats.length !== beatCount) {
    problems.push(
      `Act ${actNumber} needs exactly ${plural(beatCount, 'Beat')}, not ${act.beats.length}`
    )
  }
  act.beats.forEach((beat: unknown, j: number) => {
    const at = `Act ${actNumber} Beat ${j + 1}`
    if (!isRecord(beat)) problems.push(`${at} must be an object with a title and description`)
    else {
      textProblem(problems, `${at}'s title`, beat.title, ARC_MAX.beatTitle)
      textProblem(problems, `${at}'s description`, beat.description, ARC_MAX.beatDescription)
    }
  })
  return problems
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
  const text = (label: string, value: unknown, max: number) =>
    textProblem(problems, label, value, max)
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
