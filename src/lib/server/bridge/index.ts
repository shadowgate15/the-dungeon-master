import { randomBytes } from 'node:crypto'
import {
  DUNGEON_MASTER_HOME,
  DUNGEON_MASTER_LAN,
  DUNGEON_MASTER_PORT,
  DUNGEON_MASTER_VERSION
} from '$app/env/private'
import { library, live, sessions } from '../campaign'
import { userStateDir } from '../campaign/paths'
import { joinUrls } from '../lan'
import { lanAccess } from '../lan-access'
import { stopServer, writeRuntimeFile } from '../runtime'
import { gameTools } from '../tools'
import { createToolHost } from '../tools/host'
import { createDmChannels } from '../play/notices'
import { createPlay, openSessionsOnAttach } from '../play/play'
import { createBridgeApi } from './api'
import { createPermissions } from './permissions'

/** A fresh token each server start; only processes that can read the runtime file know it. */
const token = randomBytes(24).toString('hex')

/** The game's tools, over the server's Campaign library. */
export const host = createToolHost({ library, tools: gameTools, publish: live.publish })

/** Channel events for the DM, per Campaign folder. */
export const channels = createDmChannels(library)

/** The play turn: Done wakes the DM, and a DM attaching opens a Session. */
export const play = createPlay({ library, channels, publish: live.publish })
openSessionsOnAttach(sessions, play)

/** The permission prompts the DM's sessions are waiting on, relayed to the Player. */
export const permissions = createPermissions({ channels, sessions, publish: live.publish })

export const bridgeApi = createBridgeApi({
  library,
  host,
  channels,
  sessions,
  permissions,
  play,
  token
})

/** The known localhost port, unless overridden for tests. */
export const port = Number(DUNGEON_MASTER_PORT || 4777)

/** Whether `dm --lan` started this server on every interface. */
export const lan = Boolean(DUNGEON_MASTER_LAN)
lanAccess.set({ lan })

/** Writes the runtime file (port, token, pid, version, mode, join URLs) so the bridge and launcher find this server. */
export function announceServer() {
  writeRuntimeFile(userStateDir({ DUNGEON_MASTER_HOME }), {
    port,
    token,
    pid: process.pid,
    version: DUNGEON_MASTER_VERSION || undefined,
    mode: lan ? 'lan' : 'local',
    joinUrls: lan ? joinUrls({ port }) : []
  })
}

/**
 * The UI's stop control: like `dm stop`, it ends this server. The process exits just after the
 * response goes out, through the same SIGTERM `dm stop` sends.
 */
export function stop() {
  stopServer({
    home: userStateDir({ DUNGEON_MASTER_HOME }),
    pid: process.pid,
    exit: () => setTimeout(() => process.kill(process.pid, 'SIGTERM'), 100)
  })
}
