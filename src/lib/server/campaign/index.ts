import { DUNGEON_MASTER_CAMPAIGNS, DUNGEON_MASTER_HOME } from '$app/env/private'
import { createSessions } from '../bridge/sessions'
import { createLiveUpdates } from '../live'
import { createCampaignLibrary } from './library'
import { defaultCampaignRoot, userStateDir } from './paths'

const env = { DUNGEON_MASTER_HOME, DUNGEON_MASTER_CAMPAIGNS }

/** Which Campaigns have a DM at the table. */
export const sessions = createSessions()

/** The browser's live updates stream. */
export const live = createLiveUpdates({ sessions })

/** The server's Campaign library, over the registry in the user-level state directory. */
export const library = createCampaignLibrary({
  home: userStateDir(env),
  live: (id) => sessions.attached(id)
})

/** The default root the New Campaign dialog suggests folders under. */
export const campaignRoot = defaultCampaignRoot(env)
