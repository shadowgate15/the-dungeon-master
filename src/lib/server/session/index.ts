import { getChatPort } from '../ai/index.ts'
import type { ChatPort } from '../ai/port.ts'
import { db } from '../db/index.ts'
import { createDirectorPipeline } from './scene-director/pipeline.ts'
import { createSceneRunner } from './scene-runner.ts'
import { createSessionService } from './service.ts'

/** Server-only singletons: the Session service and the process-wide scene runner. */
export const sessions = createSessionService(db)

/**
 * The port is resolved per call so an unconfigured model reads as a failed step, not a startup
 * error.
 */
const modelPort: ChatPort = (request) => {
  const port = getChatPort()
  if (!port) throw new Error('AI is not configured')
  return port(request)
}

/**
 * The scene runner over the real database. It holds the one-run-in-flight claim for the process,
 * so every caller must use this instance.
 */
export const sceneRunner = createSceneRunner({
  sessions,
  port: modelPort,
  pipeline: createDirectorPipeline()
})
