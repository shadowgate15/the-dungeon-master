import { fail, redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import { CampaignSeedError } from '#lib/campaign/seed.ts'
import type { ActionNotice } from '#lib/campaign/ActionToast.svelte'
import type { CampaignListItem } from '#lib/campaign/CampaignTable.svelte'
import { campaignRoot, library } from '#lib/server/campaign/index.ts'
import {
  CampaignExistsError,
  CampaignMissingError,
  CampaignNotFoundError,
  NotACampaignFolderError,
  type LibraryEntry
} from '#lib/server/campaign/library.ts'
import type { Actions, PageServerLoad } from './$types'

const item = (e: LibraryEntry): CampaignListItem => ({
  id: e.id,
  name: e.name,
  path: e.path,
  status: e.status,
  premise: e.campaign?.premise ?? null,
  tone: e.campaign?.tone ?? null,
  length: e.campaign?.length ?? null,
  updatedAt: e.campaign?.updatedAt ?? null
})

export const load: PageServerLoad = ({ url }) => {
  const view: 'active' | 'archived' =
    url.searchParams.get('view') === 'archived' ? 'archived' : 'active'
  const entries = library.list()
  // A Missing Campaign shows in the Active view, so the Player sees it and can re-add it.
  const active = entries.filter((e) => e.status !== 'archived')
  // Most recently changed first; Missing ones (no date) last.
  const byUpdated = (a: LibraryEntry, b: LibraryEntry) =>
    (b.campaign?.updatedAt ?? -1) - (a.campaign?.updatedAt ?? -1)
  const archived = entries.filter((e) => e.status === 'archived')
  return {
    view,
    campaigns: (view === 'archived' ? archived : active).sort(byUpdated).map(item),
    activeCount: active.length,
    archivedCount: archived.length,
    campaignRoot
  }
}

const notFound = (e: unknown) => {
  if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError)
    return fail(404, { notice: { message: e.message } satisfies ActionNotice })
  throw e
}

/** Archives or restores the Campaigns named by the form's `id`s, and offers the reverse. */
function setArchived(action: 'archive' | 'restore') {
  const past = action === 'archive' ? 'Archived' : 'Restored'
  const reverse = action === 'archive' ? 'restore' : 'archive'
  return async ({ request }: { request: Request }) => {
    const ids = (await request.formData()).getAll('id').map(String)
    const done: { id: string; name: string }[] = []
    let failure: unknown
    for (const id of ids) {
      try {
        done.push({ id, name: library[action](id).name })
      } catch (e) {
        failure = e
      }
    }
    if (done.length === 0) return notFound(failure)
    const notice: ActionNotice = {
      message: done.length === 1 ? `${past} ${done[0].name}` : `${past} ${done.length} Campaigns`,
      undo: { action: reverse, ids: done.map((d) => d.id) }
    }
    return { notice }
  }
}

const formId = async (request: Request) => String((await request.formData()).get('id') ?? '')

export const actions: Actions = {
  archive: setArchived('archive'),

  restore: setArchived('restore'),

  delete: async ({ request }) => {
    try {
      const { name } = library.delete(await formId(request))
      return { notice: { message: `Deleted ${name}` } satisfies ActionNotice }
    } catch (e) {
      return notFound(e)
    }
  },

  unregister: async ({ request }) => {
    const id = await formId(request)
    const name = library.get(id)?.name ?? 'Campaign'
    try {
      library.unregister(id)
    } catch (e) {
      return notFound(e)
    }
    return { notice: { message: `Removed ${name} from the library` } satisfies ActionNotice }
  },

  /** Adds an existing Campaign folder, which also brings back a Missing Campaign that moved. */
  register: async ({ request }) => {
    const folder = String((await request.formData()).get('folder') ?? '').trim()
    try {
      const { name } = library.register(folder)
      return { notice: { message: `Added ${name}` } satisfies ActionNotice }
    } catch (e) {
      if (e instanceof NotACampaignFolderError)
        return fail(400, { notice: { message: e.message } satisfies ActionNotice })
      throw e
    }
  },

  createCampaign: async ({ request }) => {
    const data = await request.formData()
    const name = String(data.get('name') ?? '')
    const folder = String(data.get('folder') ?? '').trim()
    let id: string
    try {
      if (!folder) throw new CampaignSeedError('Folder is required')
      id = library.create({ name, folder }).id
    } catch (error) {
      if (error instanceof CampaignSeedError || error instanceof CampaignExistsError)
        return fail(400, { name, folder, error: error.message })
      throw error
    }
    redirect(303, resolve('/campaigns/[id]', { id }))
  }
}
