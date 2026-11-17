import type { MenuContext, MenuEntry, MenuOption } from './types.ts'

/** Builds the Director's menu from scene state: every registered option's entries, in order. */
export function buildMenu(options: MenuOption[], menu: MenuContext): MenuEntry[] {
  return options.flatMap((option) => option.offer(menu))
}

/**
 * Reads the Director's answer as one menu id: an exact match first, else the earliest id named in
 * the answer (the longest wins a tie). `undefined` when the answer names none.
 */
export function parsePick(answer: string, menu: MenuEntry[]): string | undefined {
  const text = answer.trim().toLowerCase()
  const exact = menu.find((m) => m.id.toLowerCase() === text)
  if (exact) return exact.id
  let best: { id: string; at: number } | undefined
  for (const { id } of menu) {
    const at = text.indexOf(id.toLowerCase())
    if (at < 0) continue
    if (!best || at < best.at || (at === best.at && id.length > best.id.length)) best = { id, at }
  }
  return best?.id
}

/** The option that owns a menu id. */
export function optionFor(options: MenuOption[], id: string): MenuOption | undefined {
  const verb = id.split(':', 1)[0]
  return options.find((o) => o.verb === verb)
}
