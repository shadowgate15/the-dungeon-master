import { fail } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import {
  createCampaignService,
  CampaignNotFoundError,
  CampaignValidationError
} from '#lib/server/campaign/service.ts'
import { worldWithSeed } from '#lib/server/campaign/world-seed.ts'
import { createWorldService } from '#lib/server/world/service.ts'
import type { ActionNotice } from '#lib/world/ActionToast.svelte'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const worlds = createWorldService(db)

export const load: PageServerLoad = ({ url }) => {
  const view: 'active' | 'archived' =
    url.searchParams.get('view') === 'archived' ? 'archived' : 'active'
  // An unknown World id (a stale link) is ignored rather than emptying the list.
  const filterWorld = worlds.get(url.searchParams.get('world') ?? '')
  const worldFilter = filterWorld && { id: filterWorld.id, name: filterWorld.name }
  const active = campaigns.list({ worldId: worldFilter?.id })
  const withWorlds = (list: ReturnType<typeof campaigns.list>) =>
    list.map((c) => ({ ...c, worlds: campaigns.get(c.id)?.worlds ?? [] }))
  const archived = withWorlds(campaigns.listArchived()).filter(
    (c) => !worldFilter || c.worlds.some((w) => w.id === worldFilter.id)
  )
  return {
    view,
    worldFilter,
    campaigns: (view === 'archived' ? archived : withWorlds(active)).map((c) => ({
      id: c.id,
      name: c.name,
      premise: c.premise,
      tone: c.tone,
      length: c.length,
      updatedAt: c.updatedAt,
      worlds: c.worlds.map((w) => ({
        id: w.id,
        name: w.name,
        archived: w.archivedAt !== null
      }))
    })),
    activeCount: active.length,
    archivedCount: archived.length,
    // Only active Worlds may be newly linked.
    worlds: worlds.list().map(worldWithSeed)
  }
}

/** Archives or restores the Campaign named by the form's `id`, and offers the reverse. */
function setArchived(action: 'archive' | 'restore') {
  const past = action === 'archive' ? 'Archived' : 'Restored'
  const reverse = action === 'archive' ? 'restore' : 'archive'
  return async ({ request }: { request: Request }) => {
    const ids = (await request.formData()).getAll('id').map(String)
    const done: { id: string; name: string }[] = []
    for (const id of ids) {
      try {
        done.push({ id, name: campaigns[action](id).name })
      } catch (e) {
        if (!(e instanceof CampaignNotFoundError)) throw e
      }
    }
    if (done.length === 0)
      return fail(404, { notice: { message: 'Campaign not found' } satisfies ActionNotice })
    const notice: ActionNotice = {
      message: done.length === 1 ? `${past} ${done[0].name}` : `${past} ${done.length} Campaigns`,
      undo: { action: reverse, ids: done.map((d) => d.id) }
    }
    return { notice }
  }
}

export const actions: Actions = {
  archive: setArchived('archive'),

  restore: setArchived('restore'),

  delete: async ({ request }) => {
    const id = String((await request.formData()).get('id') ?? '')
    const name = campaigns.get(id)?.name ?? 'Campaign'
    try {
      campaigns.delete(id)
    } catch (e) {
      if (e instanceof CampaignNotFoundError)
        return fail(404, { notice: { message: e.message } satisfies ActionNotice })
      throw e
    }
    const notice: ActionNotice = { message: `Deleted ${name}` }
    return { notice }
  },

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
