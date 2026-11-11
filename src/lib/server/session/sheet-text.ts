import type { SummaryModel } from '#lib/character/summary.ts'
import { ABILITY_KEYS } from '#lib/rules/registry.ts'
import type { Stat } from '#lib/rules/derive-stats.ts'
import { signed } from '#lib/signed.ts'

const ok = <T>(stat: Stat<T>): T | undefined => (stat.status === 'ok' ? stat.value : undefined)

/**
 * The derived Character sheet as plain text for the DM prompt. Every number comes from
 * `deriveStats`; a stat that is still pending is left out rather than guessed.
 */
export function sheetText(model: SummaryModel): string {
  const { data, names, stats } = model
  const lines: string[] = []
  const identity = [names.subrace ?? names.race, names.class, names.background]
    .filter(Boolean)
    .join(', ')
  lines.push(`${data.name}, level ${data.level}${identity ? ` (${identity})` : ''}`)
  if (names.alignment) lines.push(`Alignment: ${names.alignment}`)

  const scores = ABILITY_KEYS.flatMap((key) => {
    const a = ok(stats.abilities[key])
    return a ? [`${key.toUpperCase()} ${a.score} (${signed(a.modifier)})`] : []
  })
  if (scores.length) lines.push(`Abilities: ${scores.join(', ')}`)

  const hp = ok(stats.hitPoints)
  const ac = ok(stats.unarmoredAc)
  const speed = ok(stats.speed)
  const derived = [
    hp !== undefined && `HP ${hp}`,
    ac && `AC ${ac.value} (unarmored)`,
    speed !== undefined && `speed ${speed}`
  ].filter(Boolean)
  if (derived.length) lines.push(derived.join(', '))

  const skills = Object.entries(stats.skills).flatMap(([slug, stat]) => {
    const s = ok(stat)
    return s?.proficient ? [`${slug} ${signed(s.modifier)}`] : []
  })
  if (skills.length) lines.push(`Proficient skills: ${skills.join(', ')}`)

  const attacks = ok(stats.attacks)
  if (attacks?.length) {
    lines.push(`Attacks: ${attacks.map((a) => `${a.name} ${signed(a.attackBonus)}`).join(', ')}`)
  }
  if (model.equipment.length) {
    lines.push(
      `Equipment: ${model.equipment.map((e) => (e.quantity > 1 ? `${e.name} x${e.quantity}` : e.name)).join(', ')}`
    )
  }
  if (model.spells.length) lines.push(`Spells: ${model.spells.map((s) => s.name).join(', ')}`)

  const story = [
    data.personality && `Personality: ${data.personality}`,
    data.ideal && `Ideal: ${data.ideal}`,
    data.bond && `Bond: ${data.bond}`,
    data.flaw && `Flaw: ${data.flaw}`,
    data.backstory && `Backstory: ${data.backstory}`
  ].filter(Boolean)
  lines.push(...(story as string[]))
  return lines.join('\n')
}
