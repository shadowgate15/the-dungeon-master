import { defineEnvVars } from '@sveltejs/kit/env'

/** An optional variable: unset reads as undefined, and the code picks the default. */
const optional = (value: string | undefined) => value

export const variables = defineEnvVars({
  DATABASE_URL: {
    description:
      'The rules database for the credits page. Default rules.db in the user-level state directory.',
    schema: optional
  },
  DUNGEON_MASTER_HOME: {
    description:
      'The user-level state directory (the Campaign registry). Default ~/.dungeon-master.',
    schema: optional
  },
  DUNGEON_MASTER_PORT: {
    description:
      'The localhost port the game server listens on, written to its runtime file for the bridge. Default 4777.',
    schema: optional
  },
  DUNGEON_MASTER_VERSION: {
    description:
      'The plugin version the launcher started this server from, written to its runtime file so a stale server is restarted.',
    schema: optional
  },
  DUNGEON_MASTER_CAMPAIGNS: {
    description: 'Where new Campaign folders are suggested. Default ~/dm-campaigns.',
    schema: optional
  }
})
