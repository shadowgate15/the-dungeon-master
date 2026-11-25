import { canAct } from '#lib/character/acting.ts'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import type { PlaySheet } from '#lib/play/sheet.ts'
import { ABILITY_KEYS } from '#lib/rules/derive-stats.ts'
import type { Party } from '../character/party'
import type { CharacterDetail } from '../character/service'
import { loadWizardRules } from '../character/wizard-rules'

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

function toPlaySheet(c: CharacterDetail): PlaySheet {
  const rules = loadWizardRules()
  // The summary's equipment is the starting kit; the sheet shows what the Character carries now.
  const { stats, names, resolved } = buildSummary(rules, {
    ...detailToSummaryData(c),
    equipment: c.inventory
  })
  const itemName = new Map(rules.equipment.map((e) => [e.slug, e.name]))
  const ok = <T>(s: { status: 'ok'; value: T } | { status: 'pending' }) =>
    s.status === 'ok' ? s.value : null
  const slots = ok(stats.spellSlots) ?? []
  return {
    id: c.id,
    name: c.name,
    headline: `${[names.subrace ?? names.race, names.class].filter(Boolean).join(' ')} ${c.level}`,
    canAct: canAct(c),
    whereabouts: c.whereabouts,
    hp: { current: c.currentHp, max: ok(stats.hitPoints), temp: c.tempHp },
    ac:
      stats.unarmoredAc.status === 'ok'
        ? { value: stats.unarmoredAc.value.value, note: 'unarmored' }
        : null,
    conditions: c.conditions,
    concentration: c.concentration,
    deathSaves:
      c.status === 'alive' && c.currentHp === 0
        ? {
            successes: c.deathSaves.successes,
            failures: c.deathSaves.failures,
            stable: c.deathSaves.stable ?? false
          }
        : null,
    abilities: ABILITY_KEYS.flatMap((key) => {
      const a = ok(stats.abilities[key])
      return a ? [{ key, score: a.score, modifier: a.modifier }] : []
    }),
    attacks: (ok(stats.attacks) ?? []).map((a) => ({
      name: a.name,
      attackBonus: a.attackBonus,
      damage:
        a.damage &&
        `${a.damage.dice}${a.damage.modifier ? signed(a.damage.modifier) : ''} ${a.damage.type}`
    })),
    spellSlots: slots.flatMap((max, i) =>
      max > 0 ? [{ level: i + 1, max, spent: c.spentSlots[i] ?? 0 }] : []
    ),
    features: resolved.features.map((f) => ({
      slug: f.slug,
      name: f.name,
      spent: c.featureUses[f.slug] ?? 0
    })),
    inventory: c.inventory.map((i) => ({
      name: itemName.get(i.item) ?? i.item,
      quantity: i.quantity
    }))
  }
}

/** The play sheet of every saved Character in the Party, oldest first. */
export function playSheets(party: Party): PlaySheet[] {
  return party
    .list()
    .flatMap((m) => (m.kind === 'character' ? [toPlaySheet(party.character(m.id).character)] : []))
}
