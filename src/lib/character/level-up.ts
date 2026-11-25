import { classSpellOptions, WIZARD_SPELLBOOK_SIZE, type SpellOption } from './spells.ts'
import type { WizardRules } from './draft.ts'

/**
 * Milestone level-up (#333): what one more level asks the Player to pick. HP, slots, features and
 * Hit Dice follow from the level itself; only new spells are choices. Pure.
 */

type LevelRules = Pick<WizardRules, 'classLevels' | 'spells'>

/** What taking the next level asks for: exact counts of new cantrips and spells, with the options. */
export interface LevelUpOffer {
  /** The level the Character reaches. */
  level: number
  cantrips: { count: number; options: SpellOption[] }
  spells: { count: number; options: SpellOption[] }
}

/** The Wizard adds two spells to the spellbook each level (SRD p.114). */
const WIZARD_SPELLS_PER_LEVEL = 2

export const MAX_LEVEL = 20

function casting(rules: LevelRules, classSlug: string, level: number) {
  return rules.classLevels.find((l) => l.class === classSlug && l.level === level)?.spellcasting
}

/** The highest spell level the class has slots for at a level; 0 when none. */
export function highestSlotLevel(rules: LevelRules, classSlug: string, level: number): number {
  const slots = casting(rules, classSlug, level)?.slots ?? []
  return slots.reduce((top, n, i) => (n > 0 ? i + 1 : top), 0)
}

/**
 * The offer for reaching `level`: new cantrips by the class table's Cantrips Known, new spells by
 * its Spells Known (two for the Wizard's spellbook), from the class list up to the highest slot
 * level, leaving out the spells the Character already has. Prepared casters pick nothing.
 */
export function levelUpOffer(
  rules: LevelRules,
  classSlug: string,
  level: number,
  known: readonly string[]
): LevelUpOffer {
  const before = casting(rules, classSlug, level - 1)
  const after = casting(rules, classSlug, level)
  const cantrips = Math.max(0, (after?.cantripsKnown ?? 0) - (before?.cantripsKnown ?? 0))
  const spells =
    classSlug === 'wizard'
      ? level === 1
        ? WIZARD_SPELLBOOK_SIZE
        : WIZARD_SPELLS_PER_LEVEL
      : Math.max(0, (after?.spellsKnown ?? 0) - (before?.spellsKnown ?? 0))
  const top = highestSlotLevel(rules, classSlug, level)
  const have = new Set(known)
  const options = (levels: number[]) =>
    levels
      .flatMap((l) => classSpellOptions(rules, classSlug, l))
      .filter((o) => !have.has(o.slug))
      .sort((a, b) => a.name.localeCompare(b.name))
  return {
    level,
    cantrips: { count: cantrips, options: cantrips > 0 ? options([0]) : [] },
    spells: {
      count: spells,
      options: spells > 0 ? options(Array.from({ length: top }, (_, i) => i + 1)) : []
    }
  }
}

/** Why the picks do not fit the offer, or null when they do. */
export function levelUpIssue(
  offer: LevelUpOffer,
  picks: { cantrips?: readonly string[]; spells?: readonly string[] }
): string | null {
  for (const kind of ['cantrips', 'spells'] as const) {
    const chosen = picks[kind] ?? []
    const { count, options } = offer[kind]
    if (chosen.length !== count || new Set(chosen).size !== chosen.length) {
      return `Pick ${count} ${count === 1 ? kind.slice(0, -1) : kind}`
    }
    const wrong = chosen.find((s) => !options.some((o) => o.slug === s))
    if (wrong) return `${wrong} is not one of the ${kind} to pick from`
  }
  return null
}
