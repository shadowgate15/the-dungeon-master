import { describe, expect, it } from 'vitest'
import { UNKNOWN_RESET_WAIT_MS, usageLimitReset } from './usage-limit.ts'

/** 2026-11-23 20:05 in Chicago (CST, UTC-6). */
const now = Date.parse('2026-11-24T02:05:00Z')

describe('usageLimitReset', () => {
  it('is null for output that reports no usage limit', () => {
    expect(usageLimitReset('Error: something else broke', now)).toBeNull()
  })

  it('reads a reset time later today in the named time zone', () => {
    const output =
      'Plugin "svelte" is enabled but isn\'t installed\nYou\'ve hit your 5-hour limit · resets 11:20pm (America/Chicago)\n'
    expect(usageLimitReset(output, now)).toBe(Date.parse('2026-11-24T05:20:00Z'))
  })

  it('rolls a reset time already past today over to tomorrow', () => {
    const output = "You've hit your 5-hour limit · resets 7pm (America/Chicago)"
    expect(usageLimitReset(output, now)).toBe(Date.parse('2026-11-25T01:00:00Z'))
  })

  it('reads 12am and 12pm', () => {
    expect(usageLimitReset("You've hit your limit · resets 12am (UTC)", now)).toBe(
      Date.parse('2026-11-25T00:00:00Z')
    )
    expect(usageLimitReset("You've hit your limit · resets 12pm (UTC)", now)).toBe(
      Date.parse('2026-11-24T12:00:00Z')
    )
  })

  it('reads a reset date', () => {
    const output = "You've hit your weekly limit · resets Nov 27, 3pm (Europe/London)"
    expect(usageLimitReset(output, now)).toBe(Date.parse('2026-11-27T15:00:00Z'))
  })

  it('reads the epoch form', () => {
    expect(usageLimitReset('Claude AI usage limit reached|1795000000', now)).toBe(1795000000000)
  })

  it('waits a fixed time when the reset time is unreadable', () => {
    expect(usageLimitReset("You've hit your 5-hour limit", now)).toBe(now + UNKNOWN_RESET_WAIT_MS)
  })
})
