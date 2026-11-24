import type { Equipment } from './schema.ts'

/**
 * A Character's AC from what it wears (SRD "Armor and Shields"): equipped body armor's base plus
 * the Dexterity modifier (all of it for light armor, at most 2 for medium, none for heavy), or the
 * unarmored AC without armor; +2 with an equipped shield; +1 from the Defense fighting style while
 * armored. Pure.
 */
export function armorClass(
  equipment: readonly Pick<
    Equipment,
    | 'slug'
    | 'name'
    | 'armorCategory'
    | 'armorClassBase'
    | 'armorClassDexBonus'
    | 'armorClassMaxBonus'
  >[],
  input: {
    /** Slugs of the items the Character has equipped. */
    equipped: readonly string[]
    dexModifier: number
    /** The best unarmored AC (10 + Dex, or a class's Unarmored Defense). */
    unarmored: number
    /** Whether the Character took the Defense fighting style. */
    defense: boolean
  }
): { value: number; note: string } {
  const worn = input.equipped.flatMap((slug) => equipment.find((e) => e.slug === slug) ?? [])
  const armor = worn.find(
    (e) => e.armorCategory && e.armorCategory !== 'Shield' && e.armorClassBase !== null
  )
  const shield = worn.find((e) => e.armorCategory === 'Shield')
  let value = input.unarmored
  if (armor) {
    const dex = !armor.armorClassDexBonus
      ? 0
      : armor.armorClassMaxBonus === null
        ? input.dexModifier
        : Math.min(input.dexModifier, armor.armorClassMaxBonus)
    value = armor.armorClassBase! + dex + (input.defense ? 1 : 0)
  }
  if (shield) value += shield.armorClassBase ?? 2
  const note = [armor ? armor.name : 'unarmored', ...(shield ? [shield.name] : [])].join(', ')
  return { value, note }
}

/** Whether an item can be equipped: armor, a shield or a weapon. */
export const equippable = (item: Pick<Equipment, 'armorCategory' | 'weaponCategory'>) =>
  item.armorCategory !== null || item.weaponCategory !== null

/** Whether an item is body armor (one suit at a time), as opposed to a shield or a weapon. */
export const isBodyArmor = (item: Pick<Equipment, 'armorCategory'>) =>
  item.armorCategory !== null && item.armorCategory !== 'Shield'
