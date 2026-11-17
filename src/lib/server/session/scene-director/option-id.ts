/**
 * Menu option ids: a verb, optionally followed by `:argument` (`move:front-door`). The argument is
 * everything after the first colon, so it may itself contain colons.
 */
export function makeOptionId(verb: string, arg?: string): string {
  return arg === undefined ? verb : `${verb}:${arg}`
}

/** Splits an option id into its verb and argument (`''` when it has none). */
export function parseOptionId(id: string): { verb: string; arg: string } {
  const colon = id.indexOf(':')
  return colon < 0 ? { verb: id, arg: '' } : { verb: id.slice(0, colon), arg: id.slice(colon + 1) }
}
