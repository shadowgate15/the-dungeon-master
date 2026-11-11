import { fail } from '@sveltejs/kit'
import { db } from '#lib/server/db/index.ts'
import {
  createCharacterService,
  CharacterNotFoundError,
  CharacterValidationError
} from '#lib/server/character/service.ts'
import type { ActionNotice } from '#lib/world/ActionToast.svelte'
import type { Actions, PageServerLoad } from './$types'

const characters = createCharacterService(db)

export const load: PageServerLoad = ({ url }) => {
  const view: 'active' | 'archived' =
    url.searchParams.get('view') === 'archived' ? 'archived' : 'active'
  const active = characters.list()
  const archived = characters.listArchived()
  return {
    view,
    characters: (view === 'archived' ? archived : active).map((c) => ({
      id: c.id,
      name: c.name,
      raceName: c.raceName,
      subraceName: c.subraceName,
      className: c.className,
      backgroundName: c.backgroundName,
      level: c.level,
      updatedAt: c.updatedAt
    })),
    activeCount: active.length,
    archivedCount: archived.length
  }
}

/** Archives or restores the Character named by the form's `id`, and offers the reverse. */
function setArchived(action: 'archive' | 'restore') {
  const past = action === 'archive' ? 'Archived' : 'Restored'
  const reverse = action === 'archive' ? 'restore' : 'archive'
  return async ({ request }: { request: Request }) => {
    const ids = (await request.formData()).getAll('id').map(String)
    const done: { id: string; name: string }[] = []
    for (const id of ids) {
      try {
        done.push({ id, name: characters[action](id).name })
      } catch (e) {
        if (!(e instanceof CharacterNotFoundError)) throw e
      }
    }
    if (done.length === 0)
      return fail(404, { notice: { message: 'Character not found' } satisfies ActionNotice })
    const notice: ActionNotice = {
      message: done.length === 1 ? `${past} ${done[0].name}` : `${past} ${done.length} Characters`,
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
    const name = characters.get(id)?.name ?? 'Character'
    try {
      characters.delete(id)
    } catch (e) {
      if (e instanceof CharacterNotFoundError)
        return fail(404, { notice: { message: e.message } satisfies ActionNotice })
      if (e instanceof CharacterValidationError)
        return fail(409, { notice: { message: e.message } satisfies ActionNotice })
      throw e
    }
    const notice: ActionNotice = { message: `Deleted ${name}` }
    return { notice }
  }
}
