// Recognizes a `claude` session that stopped on a usage limit, and when that limit resets.

/** How long to wait when `claude` reports a usage limit but no reset time the script can read. */
export const UNKNOWN_RESET_WAIT_MS = 60 * 60 * 1000

/** Output that means the session stopped because the account hit a usage limit. */
const LIMIT = /you['’]ve hit your [^\n]*limit|usage limit reached/i

/** The older `Claude AI usage limit reached|<epoch seconds>` form. */
const EPOCH_RESET = /usage limit reached\|(\d{9,})/i

/** `resets 11:20pm (America/Chicago)`, `resets 3am`, `resets Nov 25, 3pm (Europe/London)`. */
const RESET =
  /resets\s+(?:at\s+)?(?:([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*\(([^)]+)\))?/i

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** The wall-clock date and time `at` shows in `zone`. */
const wallClock = (at: number, zone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
      .formatToParts(at)
      .map((part) => [part.type, Number(part.value)])
  )
  return {
    year: parts.year,
    month: parts.month - 1,
    day: parts.day,
    utc: Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  }
}

/** The instant a wall-clock time in `zone` names (`month` 0-based; overflowing days roll over). */
const instantIn = (
  zone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) => {
  const wall = Date.UTC(year, month, day, hour, minute)
  const offset = (at: number) => wallClock(at, zone).utc - Math.floor(at / 1000) * 1000
  const guess = wall - offset(wall)
  return wall - offset(guess)
}

const validZone = (zone: string | undefined) => {
  if (zone === undefined) return localZone()
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone.trim() })
    return zone.trim()
  } catch {
    return localZone()
  }
}

/**
 * When the usage limit `output` reports resets, as epoch milliseconds: the next time after `now`
 * that matches the reset time it prints. `null` when `output` reports no usage limit. A limit with
 * no readable reset time resets `UNKNOWN_RESET_WAIT_MS` after `now`.
 */
export const usageLimitReset = (output: string, now: number): number | null => {
  if (!LIMIT.test(output)) return null

  const epoch = output.match(EPOCH_RESET)
  if (epoch) return Number(epoch[1]) * 1000

  const reset = output.match(RESET)
  if (!reset) return now + UNKNOWN_RESET_WAIT_MS
  const [, monthName, dayText, hourText, minuteText, meridiem, zoneText] = reset
  const zone = validZone(zoneText)
  const hour = (Number(hourText) % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0)
  const minute = Number(minuteText ?? 0)
  const today = wallClock(now, zone)

  if (monthName !== undefined) {
    const month = MONTHS.indexOf(monthName.toLowerCase())
    if (month === -1) return now + UNKNOWN_RESET_WAIT_MS
    const at = instantIn(zone, today.year, month, Number(dayText), hour, minute)
    return at > now ? at : instantIn(zone, today.year + 1, month, Number(dayText), hour, minute)
  }
  const at = instantIn(zone, today.year, today.month, today.day, hour, minute)
  return at > now ? at : instantIn(zone, today.year, today.month, today.day + 1, hour, minute)
}
