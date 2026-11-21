import { getChatPort } from '../ai/index.ts'
import type { ChatPort } from '../ai/port.ts'
import { db } from '../db/index.ts'
import { dice } from '../dice.ts'
import { createBeatProgress } from '../arc/beat-progress.ts'
import { createMemoryExtraction } from '../memory/extraction.ts'
import { createRollingSummary } from '../memory/summary.ts'
import {
  createCharacterLineReader,
  createFixedReader,
  createWorldReader
} from './context/sources.ts'
import { createCheckModifier } from './check-modifier.ts'
import { createSessionEnd } from './end-session.ts'
import { createSceneRunner } from './scene-runner.ts'
import { createSessionService } from './service.ts'

/** The port is resolved per call, so nothing talks to the model at startup. */
const modelPort: ChatPort = (request) => getChatPort()(request)

/** Server-only singletons: the Session service and the process-wide scene runner. */
export const sessions = createSessionService(db, Date.now, modelPort)

/** World memory extraction: runs after each Exchange in the background; the Session-end hook uses it too. */
export const memoryExtraction = createMemoryExtraction(db, sessions)

/** The Rolling summary: runs in the background once uncovered events outgrow its threshold. */
export const rollingSummary = createRollingSummary(db)

/** Ends a Session: drains extraction, marks it ended, then finalizes memory in the background. */
export const sessionEnd = createSessionEnd({
  sessions,
  memory: memoryExtraction,
  summary: rollingSummary,
  port: modelPort
})

/**
 * The scene runner over the real database. It holds the one-Exchange-in-flight claim for the
 * process, so every caller must use this instance.
 */
export const sceneRunner = createSceneRunner({
  sessions,
  port: modelPort,
  beatProgress: createBeatProgress(db),
  memory: memoryExtraction,
  summary: rollingSummary,
  contextSources: {
    summary: rollingSummary.get,
    world: createWorldReader(db),
    fixed: createFixedReader(db),
    character: createCharacterLineReader(db)
  },
  dice,
  checkModifier: createCheckModifier(db)
})
