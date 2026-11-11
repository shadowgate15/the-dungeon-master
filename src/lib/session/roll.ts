import type { RollRequest, RollResult } from './enums.ts'

const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
}

/** "Strength check", "Sleight of Hand check": what the player is being asked to roll. */
export function checkLabel(request: Pick<RollRequest, 'check' | 'key'>): string {
  const name =
    request.check === 'ability'
      ? (ABILITY_NAMES[request.key] ?? request.key)
      : request.key
          .split('-')
          .map((w) => (w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
          .join(' ')
  return `${name} check`
}

/** "15 + 4 = 19", with the modifier's sign shown. */
export function resultLabel(result: RollResult): string {
  const sign = result.modifier < 0 ? '-' : '+'
  return `${result.d20} ${sign} ${Math.abs(result.modifier)} = ${result.total}`
}
