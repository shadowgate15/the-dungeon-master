/**
 * The Campaign clock counts in-fiction minutes from the Campaign's start, which is day 1 at 08:00.
 * Shown as "day 3, 14:20". Named calendars wait until the World needs them.
 */

const DAY = 24 * 60
/** The time of day the Campaign starts, in minutes after midnight. */
const START = 8 * 60

const pad = (n: number) => String(n).padStart(2, '0')

/** The clock as day and time of day, e.g. `{ day: 3, time: '14:20' }`. */
export function clockParts(minute: number): { day: number; time: string } {
  const since = START + minute
  const ofDay = since % DAY
  return {
    day: Math.floor(since / DAY) + 1,
    time: `${pad(Math.floor(ofDay / 60))}:${pad(ofDay % 60)}`
  }
}

/** The clock as the Players read it: "day 3, 14:20". */
export function formatClock(minute: number): string {
  const { day, time } = clockParts(minute)
  return `day ${day}, ${time}`
}

/** The minute a "day 3, 14:20" reading names, or null when it isn't one (or is before the start). */
export function parseClock(text: string): number | null {
  const match = /^\s*day\s+(\d+),?\s+(\d{1,2}):(\d{2})\s*$/i.exec(text)
  if (!match) return null
  const [day, hours, minutes] = match.slice(1).map(Number)
  if (day < 1 || hours > 23 || minutes > 59) return null
  const minute = (day - 1) * DAY + hours * 60 + minutes - START
  return minute < 0 ? null : minute
}
