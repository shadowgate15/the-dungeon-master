import { error, fail } from '@sveltejs/kit'
import { worldWithSeed } from '#lib/server/campaign/world-seed.ts'
import { db } from '#lib/server/db/index.ts'
import {
  createCampaignService,
  CampaignNotFoundError,
  CampaignValidationError
} from '#lib/server/campaign/service.ts'
import { createWorldService } from '#lib/server/world/service.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const worlds = createWorldService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = campaigns.get(params.id)
  if (!found) error(404, 'Campaign not found')
  return {
    campaign: {
      id: found.id,
      name: found.name,
      premise: found.premise,
      tone: found.tone,
      length: found.length,
      archived: found.archivedAt !== null,
      worldIds: found.worlds.map((w) => w.id)
    },
    // Archived Worlds that make the Campaign read-only; the page shows these instead of a form.
    blockingWorlds: campaigns.blockingWorlds(found.id).map((w) => ({ id: w.id, name: w.name })),
    // Only active Worlds may be newly linked.
    worlds: worlds.list().map(worldWithSeed)
  }
}

export const actions: Actions = {
  save: async ({ request, params }) => {
    const data = await request.formData()
    const text = (key: string) => String(data.get(key) ?? '')
    const values = {
      name: text('name'),
      premise: text('premise'),
      tone: text('tone'),
      length: text('length'),
      worldIds: data.getAll('worldId').map(String)
    }
    try {
      // The service validates enum membership; the cast only bridges raw form strings.
      campaigns.update(
        params.id,
        {
          name: values.name,
          premise: values.premise,
          tone: values.tone,
          length: values.length
        } as Parameters<typeof campaigns.update>[1],
        values.worldIds
      )
    } catch (e) {
      if (e instanceof CampaignNotFoundError) error(404, 'Campaign not found')
      if (e instanceof CampaignValidationError) return fail(400, { ...values, error: e.message })
      throw e
    }
    return { saved: true }
  }
}
