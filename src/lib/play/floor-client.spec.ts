import { describe, expect, it } from 'vitest'
import { PlayRequestError, refusal } from './floor-client'

describe('refusal', () => {
  it("carries the server's message for the Player", async () => {
    const res = Response.json({ error: 'The DM is away' }, { status: 409 })
    const error = await refusal(res, 'The Floor could not be changed')
    expect(error).toBeInstanceOf(PlayRequestError)
    expect(error.message).toBe('The DM is away')
  })

  it('falls back to its own message when the server gave none', async () => {
    expect((await refusal(new Response('oops', { status: 500 }), 'Not loaded')).message).toBe(
      'Not loaded'
    )
    expect((await refusal(Response.json({}, { status: 400 }), 'Refused')).message).toBe('Refused')
  })
})
