import { randomBytes } from 'node:crypto'
import { DUNGEON_MASTER_HOME, DUNGEON_MASTER_PORT } from '$app/env/private'
import { library, sessions } from '../campaign'
import { userStateDir } from '../campaign/paths'
import { writeRuntimeFile } from '../runtime'
import { gameTools } from '../tools'
import { createToolHost } from '../tools/host'
import { createBridgeApi } from './api'
import { createChannels } from './channels'

/** A fresh token each server start; only processes that can read the runtime file know it. */
const token = randomBytes(24).toString('hex')

/** The game's tools, over the server's Campaign library. */
export const host = createToolHost({ library, tools: gameTools })

/** Channel events for the DM, per Campaign folder. */
export const channels = createChannels()

export const bridgeApi = createBridgeApi({ library, host, channels, sessions, token })

/** The known localhost port, unless overridden for tests. */
export const port = Number(DUNGEON_MASTER_PORT || 4777)

/** Writes the runtime file (port, token, pid) so the bridge can find this server. */
export function announceServer() {
  writeRuntimeFile(userStateDir({ DUNGEON_MASTER_HOME }), { port, token, pid: process.pid })
}
