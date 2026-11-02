import { error, fail, redirect } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import {
  createWorldService,
  WorldInUseError,
  WorldNotFoundError,
  WorldValidationError
} from '#lib/server/world/service.ts'
import type { Actions, PageServerLoad } from './$types'

const worlds = createWorldService(db)

export const load: PageServerLoad = ({ params }) => {
  const world = worlds.get(params.id)
  if (!world) error(404, 'World not found')
  return { world, affectedCampaigns: worlds.affectedCampaignCount(world.id) }
}

export const actions: Actions = {
  save: async ({ request, params }) => {
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
      worlds.update(params.id, values as Parameters<typeof worlds.update>[1])
    } catch (e) {
      if (e instanceof WorldNotFoundError) error(404, 'World not found')
      if (e instanceof WorldValidationError) return fail(400, { ...values, error: e.message })
      throw e
    }
    return { saved: true }
  },

  archive: ({ params }) => {
    try {
      worlds.archive(params.id)
    } catch (e) {
      if (e instanceof WorldNotFoundError) error(404, 'World not found')
      throw e
    }
    redirect(303, '/')
  },

  restore: ({ params }) => {
    try {
      worlds.restore(params.id)
    } catch (e) {
      if (e instanceof WorldNotFoundError) error(404, 'World not found')
      throw e
    }
    return { restored: true }
  },

  delete: ({ params }) => {
    try {
      worlds.delete(params.id)
    } catch (e) {
      if (e instanceof WorldNotFoundError) error(404, 'World not found')
      if (e instanceof WorldInUseError) return fail(409, { inUse: true, error: e.message })
      throw e
    }
    redirect(303, '/')
  }
}
