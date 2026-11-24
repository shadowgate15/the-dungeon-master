import { randomBytes } from 'node:crypto'
import { DUNGEON_MASTER_HOME, DUNGEON_MASTER_PORT, DUNGEON_MASTER_VERSION } from '$app/env/private'
import { library, live, sessions } from '../campaign'
import { userStateDir } from '../campaign/paths'
import { writeRuntimeFile } from '../runtime'
import { gameTools } from '../tools'
import { createToolHost } from '../tools/host'
import { createPlay, openSessionsOnAttach } from '../play/play'
import { createBridgeApi } from './api'
import { createChannels } from './channels'
import { createPermissions } from './permissions'

/** A fresh token each server start; only processes that can read the runtime file know it. */
const token = randomBytes(24).toString('hex')

/** The game's tools, over the server's Campaign library. */
export const host = createToolHost({ library, tools: gameTools, publish: live.publish })

/** Channel events for the DM, per Campaign folder. */
export const channels = createChannels()

/** The play turn: Done wakes the DM, and a DM attaching opens a Session. */
export const play = createPlay({ library, channels, publish: live.publish })
openSessionsOnAttach(sessions, play)

/** The permission prompts the DM's sessions are waiting on, relayed to the Player. */
export const permissions = createPermissions({ channels, sessions, publish: live.publish })

export const bridgeApi = createBridgeApi({ library, host, channels, sessions, permissions, token })

/** The known localhost port, unless overridden for tests. */
export const port = Number(DUNGEON_MASTER_PORT || 4777)

/** Writes the runtime file (port, token, pid, version) so the bridge and launcher find this server. */
export function announceServer() {
  writeRuntimeFile(userStateDir({ DUNGEON_MASTER_HOME }), {
    port,
    token,
    pid: process.pid,
    version: DUNGEON_MASTER_VERSION || undefined
  })
}
