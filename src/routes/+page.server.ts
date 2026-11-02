import { fail } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import {
  createWorldService,
  WorldInUseError,
  WorldNotFoundError,
  WorldValidationError
} from '#lib/server/world/service.ts'
import type { ActionNotice } from '#lib/world/ActionToast.svelte'
import type { Actions, PageServerLoad } from './$types'

const worlds = createWorldService(db)

export const load: PageServerLoad = ({ url }) => {
  const view: 'active' | 'archived' =
    url.searchParams.get('view') === 'archived' ? 'archived' : 'active'
  const active = worlds.list()
  const archived = worlds.listArchived()
  const counts = worlds.campaignCounts()
  return {
    view,
    worlds: (view === 'archived' ? archived : active).map((w) => ({
      id: w.id,
      name: w.name,
      premise: w.premise,
      genreFlavor: w.genreFlavor,
      scale: w.scale,
      magicLevel: w.magicLevel,
      techLevel: w.techLevel,
      updatedAt: w.updatedAt,
      campaigns: counts[w.id] ?? 0
    })),
    activeCount: active.length,
    archivedCount: archived.length
  }
}

/** Archives or restores every World named by the form's `id` fields, and offers the reverse. */
function setArchived(action: 'archive' | 'restore') {
  const past = action === 'archive' ? 'Archived' : 'Restored'
  const reverse = action === 'archive' ? 'restore' : 'archive'
  return async ({ request }: { request: Request }) => {
    const ids = (await request.formData()).getAll('id').map(String)
    const done: { id: string; name: string }[] = []
    for (const id of ids) {
      try {
        const { name } = worlds[action](id)
        done.push({ id, name })
      } catch (e) {
        if (!(e instanceof WorldNotFoundError)) throw e
      }
    }
    if (done.length === 0)
      return fail(404, { notice: { message: 'World not found' } satisfies ActionNotice })
    const notice: ActionNotice = {
      message: done.length === 1 ? `${past} ${done[0].name}` : `${past} ${done.length} Worlds`,
      undo: { action: reverse, ids: done.map((d) => d.id) }
    }
    return { notice }
  }
}

export const actions: Actions = {
  createWorld: async ({ request }) => {
    const data = await request.formData()
    const text = (key: string) => String(data.get(key) ?? '')
    // An unset picker submits '', which means unspecified (NULL).
    const optional = (key: string) => text(key) || null
    const values = {
      name: text('name'),
      premise: text('premise'),
      genreFlavor: optional('genreFlavor'),
      scale: optional('scale'),
      magicLevel: optional('magicLevel'),
      techLevel: optional('techLevel')
    }
    try {
      // The service validates enum membership; the cast only bridges raw form strings.
      worlds.create(values as Parameters<typeof worlds.create>[0])
    } catch (error) {
      if (error instanceof WorldValidationError)
        return fail(400, { ...values, error: error.message })
      throw error
    }
    return { created: true }
  },

  archive: setArchived('archive'),

  restore: setArchived('restore'),

  delete: async ({ request }) => {
    const id = String((await request.formData()).get('id') ?? '')
    const name = worlds.get(id)?.name ?? 'World'
    try {
      worlds.delete(id)
    } catch (e) {
      if (e instanceof WorldNotFoundError)
        return fail(404, { notice: { message: e.message } satisfies ActionNotice })
      if (e instanceof WorldInUseError)
        return fail(409, { notice: { message: e.message } satisfies ActionNotice })
      throw e
    }
    const notice: ActionNotice = { message: `Deleted ${name}` }
    return { notice }
  }
}
