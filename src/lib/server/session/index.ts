import { NO_MODEL_MESSAGE } from '#lib/ai/status.ts'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import type { AbilityKey } from '#lib/rules/registry.ts'
import { getChatPort } from '../ai/index.ts'
import type { ChatPort } from '../ai/port.ts'
import { createCharacterService } from '../character/service.ts'
import { loadWizardRules } from '../character/wizard-rules.ts'
import { db } from '../db/index.ts'
import { createBeatProgress } from '../arc/beat-progress.ts'
import { createMemoryExtraction } from '../memory/extraction.ts'
import { createRollingSummary } from '../memory/summary.ts'
import { createFixedReader, createWorldReader } from './context/sources.ts'
import { createSessionEnd } from './end-session.ts'
import { createDirectorPipeline } from './scene-director/pipeline.ts'
import { createSceneRunner } from './scene-runner.ts'
import { createSessionService } from './service.ts'

/**
 * The port is resolved per call so an unconfigured model reads as a failed step, not a startup
 * error.
 */
const modelPort: ChatPort = (request) => {
  const port = getChatPort()
  if (!port) throw new Error(NO_MODEL_MESSAGE)
  return port(request)
}

/** Server-only singletons: the Session service and the process-wide scene runner. */
export const sessions = createSessionService(db, Date.now, modelPort)
const characters = createCharacterService(db)

/** World memory extraction: runs after each run in the background; the Session-end hook uses it too. */
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

/** The Session's Character's modifier for a check (a skill slug, or an ability key); 0 if unknown. */
function rollModifier(sessionId: string, check: string): number {
  const session = sessions.get(sessionId)
  const hero = session && characters.get(session.characterId)
  if (!hero) return 0
  const { stats } = buildSummary(loadWizardRules(), detailToSummaryData(hero))
  const stat = stats.skills[check] ?? stats.abilities[check as AbilityKey]
  return stat?.status === 'ok' ? stat.value.modifier : 0
}

/**
 * The scene runner over the real database. It holds the one-run-in-flight claim for the process,
 * so every caller must use this instance.
 */
export const sceneRunner = createSceneRunner({
  sessions,
  port: modelPort,
  pipeline: createDirectorPipeline(),
  beatProgress: createBeatProgress(db),
  memory: memoryExtraction,
  summary: rollingSummary,
  contextSources: {
    summary: rollingSummary.get,
    world: createWorldReader(db),
    fixed: createFixedReader(db)
  },
  rollModifier
})
