import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import { getChatPort } from '../ai/index.ts'
import { DEFAULT_CONTEXT_LIMIT } from '../ai/config.ts'
import type { ChatPort } from '../ai/port.ts'
import { createCampaignService } from '../campaign/service.ts'
import { createCharacterService } from '../character/service.ts'
import { loadWizardRules } from '../character/wizard-rules.ts'
import { db } from '../db/index.ts'
import { sheetText } from './sheet-text.ts'
import { createSessionService } from './service.ts'
import { createTurnRunner } from './turn-runner.ts'

/** The DM's reply cap in tokens, also the room kept free for it in the prompt. */
export const DM_REPLY_TOKENS = 1024

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)

/** Server-only singletons: the Session service and the process-wide turn-runner. */
export const sessions = createSessionService(db)

/**
 * The turn-runner over the real database. It holds the one-call-in-flight lock for the process,
 * so every caller (the turn route, ending a Session) must use this instance. The port is
 * resolved per call so an unconfigured model reads as a failure, not a startup error.
 */
export const turnRunner = createTurnRunner({
  sessions,
  port: ((request) => {
    const port = getChatPort()
    if (!port) throw new Error('AI is not configured')
    return port(request)
  }) satisfies ChatPort,
  contextLimit: DEFAULT_CONTEXT_LIMIT,
  replyReserve: DM_REPLY_TOKENS,
  loadContext: ({ campaignId, characterId }) => {
    const campaign = campaigns.get(campaignId)
    const hero = characters.get(characterId)
    if (!campaign || !hero) throw new Error('The Session lost its Campaign or Character')
    return {
      campaign,
      worlds: campaign.worlds,
      sheet: sheetText(buildSummary(loadWizardRules(), detailToSummaryData(hero)))
    }
  }
})
