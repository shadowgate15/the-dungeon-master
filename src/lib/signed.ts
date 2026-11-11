/** A number with its sign always shown: "+4", "-2", "+0". `spaced` gives "+ 4" for sums like "15 + 4". */
export function signed(n: number, spaced = false): string {
  const sign = n < 0 ? '-' : '+'
  return `${sign}${spaced ? ' ' : ''}${Math.abs(n)}`
}
