/** Names: handle slugs and the near-duplicate test `establish` and link near-matches use. */

const plain = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** The slug part of a handle: `Mira Voss` → `mira-voss`. */
export function slug(name: string): string {
  return (
    plain(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unnamed'
  )
}

/** A name reduced for comparison: lower case, letters and digits only, no leading "the". */
export function normalizeName(name: string): string {
  return plain(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    row = next
  }
  return row[b.length]
}

/**
 * Whether two names are close enough to be the same thing: equal once normalized, a typo apart,
 * or one's words all in the other ("Mira" and "Mira Voss").
 */
export function isNearName(a: string, b: string): boolean {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return false
  if (x === y) return true
  if (distance(x, y) <= Math.max(1, Math.floor(Math.max(x.length, y.length) / 6))) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  const words = new Set(long.split(' '))
  return short.split(' ').every((w) => words.has(w))
}
