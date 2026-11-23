import os from 'node:os'
import path from 'node:path'

type Env = { DUNGEON_MASTER_HOME?: string; DUNGEON_MASTER_CAMPAIGNS?: string }

/** The user-level state directory (registry, server runtime file). */
export function userStateDir(env: Env = process.env): string {
  return env.DUNGEON_MASTER_HOME || path.join(os.homedir(), '.dungeon-master')
}

/** Where the New Campaign dialog suggests creating Campaign folders. */
export function defaultCampaignRoot(env: Env = process.env): string {
  return env.DUNGEON_MASTER_CAMPAIGNS || path.join(os.homedir(), 'dm-campaigns')
}

/** A Campaign folder's database, inside its `.dm/` directory. */
export function campaignDatabasePath(folder: string): string {
  return path.join(folder, '.dm', 'campaign.db')
}
