/**
 * The Narrator's never-trimmed text: the Campaign Seed and the playing Character's sheet, each
 * rendered compactly.
 */
import type { SummaryModel } from '#lib/character/summary.ts'
import type { AbilityKey } from '#lib/rules/registry.ts'

const ABILITIES: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export function renderSeed(seed: {
  name: string
  premise: string
  tone: string
  length: string
}): string {
  return `Campaign: ${seed.name}. Premise: ${seed.premise} Tone: ${seed.tone}. Length: ${seed.length}.`
}

export function renderCharacter(summary: SummaryModel): string {
  const { data, names, stats } = summary
  const identity = [names.race, names.subrace, names.class, names.subclass].filter(Boolean)
  const extras = [names.background && `background ${names.background}`, names.alignment].filter(
    Boolean
  )
  const head = `Player character: ${data.name}, level ${data.level} ${identity.join(' ')}${
    extras.length ? ` (${extras.join(', ')})` : ''
  }.`
  const scores = ABILITIES.flatMap((k) => {
    const a = stats.abilities[k]
    if (a.status !== 'ok') return []
    const sign = a.value.modifier >= 0 ? '+' : ''
    return [`${k.toUpperCase()} ${a.value.score} (${sign}${a.value.modifier})`]
  })
  const traits = (
    [
      ['Appearance', data.appearance],
      ['Personality', data.personality],
      ['Ideal', data.ideal],
      ['Bond', data.bond],
      ['Flaw', data.flaw]
    ] as const
  )
    .filter(([, text]) => text.trim())
    .map(([label, text]) => `${label}: ${text.trim()}.`)
  return [head, ...(scores.length ? [`Abilities: ${scores.join(', ')}.`] : []), ...traits].join(' ')
}

/** The Character as one line for the ruling steps: name, and level, race and class. */
export function characterLine(summary: SummaryModel): { name: string; summary: string } {
  const { data, names } = summary
  const identity = [names.subrace ?? names.race, names.class].filter(Boolean).join(' ')
  return {
    name: data.name,
    summary: `a level ${data.level} ${identity.toLowerCase() || 'adventurer'}`
  }
}
