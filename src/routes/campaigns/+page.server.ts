import { fail } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import { createCampaignService, CampaignValidationError } from '#lib/server/campaign/service.ts'
import { createWorldService } from '#lib/server/world/service.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const worlds = createWorldService(db)

export const load: PageServerLoad = ({ url }) => {
  const view: 'active' | 'archived' =
    url.searchParams.get('view') === 'archived' ? 'archived' : 'active'
  const active = campaigns.list()
  const archived = campaigns.listArchived()
  return {
    view,
    campaigns: (view === 'archived' ? archived : active).map((c) => ({
      id: c.id,
      name: c.name,
      premise: c.premise,
      tone: c.tone,
      length: c.length,
      updatedAt: c.updatedAt,
      worlds: campaigns.get(c.id)!.worlds.map((w) => ({
        id: w.id,
        name: w.name,
        archived: w.archivedAt !== null
      }))
    })),
    activeCount: active.length,
    archivedCount: archived.length,
    // Only active Worlds may be newly linked.
    worlds: worlds.list().map((w) => ({ id: w.id, name: w.name }))
  }
}

export const actions: Actions = {
  createCampaign: async ({ request }) => {
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
      campaigns.create(
        {
          name: values.name,
          premise: values.premise,
          tone: values.tone,
          length: values.length
        } as Parameters<typeof campaigns.create>[0],
        values.worldIds
      )
    } catch (error) {
      if (error instanceof CampaignValidationError)
        return fail(400, { ...values, error: error.message })
      throw error
    }
    return { created: true }
  }
}
