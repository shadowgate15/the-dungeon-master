import { describe, expect, it } from 'vitest'
import { withCampaign } from './http'
import { CampaignArchivedError, CampaignMissingError, CampaignNotFoundError } from './library'

class Busy extends Error {}

const status = async (run: () => Response) => {
  const res = await withCampaign(run, [[Busy, 409]])
  return { status: res.status, body: res.status === 204 ? null : await res.json() }
}
const throwing = (e: Error) => () => {
  throw e
}

describe('withCampaign', () => {
  it('passes the response through', async () => {
    expect(await status(() => new Response(null, { status: 204 }))).toEqual({
      status: 204,
      body: null
    })
  })

  it('answers an unknown or missing Campaign with 404 and an archived one with 400', async () => {
    expect(await status(throwing(new CampaignNotFoundError('gone')))).toEqual({
      status: 404,
      body: { error: 'gone' }
    })
    expect(await status(throwing(new CampaignMissingError('moved')))).toMatchObject({
      status: 404
    })
    expect(await status(throwing(new CampaignArchivedError('read-only')))).toEqual({
      status: 400,
      body: { error: 'read-only' }
    })
  })

  it('answers the refusals a route names with their status, and rethrows anything else', async () => {
    expect(await status(throwing(new Busy('busy')))).toEqual({
      status: 409,
      body: { error: 'busy' }
    })
    await expect(status(throwing(new Error('boom')))).rejects.toThrow('boom')
  })
})
