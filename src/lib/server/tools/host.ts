import { asc } from 'drizzle-orm'
import { z } from 'zod'
import type { LiveMessage } from '#lib/live/messages.ts'
import type { CampaignLibrary } from '../campaign/library'
import type { Database, Queryable } from '../db/connect'
import { event } from '../db/schema'
import { campaignDice, type Dice } from '../dice'
import { addConversationLine } from '../creation/conversation'
import { currentStamp, logActivity, logEvent, nextEventId } from '../play/log'
import {
  PLUGIN_NAME,
  ToolError,
  type GameTool,
  type Stamp,
  type ToolDescriptor,
  type ToolResult
} from './contract'

export type { Stamp }

type Options = {
  library: CampaignLibrary
  tools: GameTool[]
  /** Reads the Campaign's current stamp: by default the open Session (null offline) and minute 0. */
  stamp?: (db: Queryable) => Stamp
  now?: () => number
  /** The Campaign's roller. */
  dice?: (campaignId: string) => Dice
  /** Tells every browser tab what changed; never handed a raw tool result. */
  publish?: (message: LiveMessage) => void
}

/** One logged Event, as the host reports it. */
export type LoggedEvent = {
  id: number
  session: string | null
  minute: number
  tool: string
  kind: string
  summary: string
  data: Record<string, unknown> | null
  dmOnly: boolean
}

const json = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }]
})

const failure = (e: ToolError): ToolResult => ({
  ...json({ code: e.code, message: e.message, next: e.next, ...e.details }),
  isError: true
})

/** The output of a tool that enters a situation, pointing at the skill to load. */
function withSkill(result: Record<string, unknown>, skill: string | undefined) {
  if (!skill) return result
  const name = `${PLUGIN_NAME}:${skill}`
  return { ...result, skill: name, next: `Load skill ${name} before continuing.` }
}

/** The Player-safe activity line for a successful call, or null for none. */
function activityLine(
  tool: GameTool,
  input: unknown,
  result: Record<string, unknown>,
  dmOnly: boolean
): string | null {
  const { activity } = tool
  if (activity === undefined) {
    if (tool.mutates === false) return 'DM checks their notes'
    return dmOnly ? null : 'DM updates the game'
  }
  return typeof activity === 'function' ? activity(input as never, result) : activity
}

/**
 * The game's tools, called by name against a Campaign folder. Every call follows the contract in
 * `./contract`: validated input, `{code, message, next}` refusals, and for mutating tools one
 * transaction that logs exactly one Event.
 */
export function createToolHost({
  library,
  tools,
  stamp = currentStamp,
  now = Date.now,
  dice = (id) => campaignDice.for(id),
  publish = () => {}
}: Options) {
  const byName = new Map(tools.map((t) => [t.name, t]))

  function campaignDb(folder: string): { db: Database; campaignId: string } {
    const db = library.databaseFor(folder)
    const entry = library.entryAt(folder)
    if (!db || !entry) {
      throw new ToolError(
        'not_a_campaign',
        `${folder} is not a registered Campaign folder`,
        'Ask the Player to open or create the Campaign in the web UI, then run dm in its folder'
      )
    }
    return { db, campaignId: entry.id }
  }

  /** Runs one call; returns its result and what the browser must refetch. */
  function run(
    tool: GameTool,
    folder: string,
    args: unknown
  ): { result: Record<string, unknown>; changed: LiveMessage[] } {
    const { db, campaignId } = campaignDb(folder)
    const parsed = tool.input.safeParse(args ?? {})
    if (!parsed.success) {
      throw ToolError.invalidInput(tool.name, z.prettifyError(parsed.error))
    }
    const at = now()
    const context = { folder, campaignId, dice: dice(campaignId), now: at }
    const timelineChanged: LiveMessage[] = [{ type: 'timeline', campaign: campaignId }]
    if (tool.mutates === false) {
      const result = tool.run(
        { ...context, db, stamp: { ...stamp(db), eventId: null } },
        parsed.data
      )
      const line = activityLine(tool, parsed.data, result, false)
      if (line) logActivity(db, line, { at })
      return { result, changed: line === null ? [] : timelineChanged }
    }
    if (tool.mutates === 'creation') {
      // Out of fiction: no Event and no activity line, only the muted line in the conversation.
      return db.transaction((tx) => {
        const { result, line, changed } = tool.run(
          { ...context, db: tx, stamp: { ...stamp(tx), eventId: null } },
          parsed.data
        )
        if (!line) return { result, changed }
        addConversationLine(tx, { author: 'dm_write', text: line }, at)
        return { result, changed: [...changed, { type: 'conversation', campaign: campaignId }] }
      })
    }
    return db.transaction((tx) => {
      const current = stamp(tx)
      const eventId = nextEventId(tx)
      const {
        result,
        skill,
        event: logged
      } = tool.run({ ...context, db: tx, stamp: { ...current, eventId } }, parsed.data)
      logEvent(tx, { tool: tool.name, ...logged }, { stamp: current, at, id: eventId })
      const line = activityLine(tool, parsed.data, result, logged.dmOnly ?? false)
      if (line) logActivity(tx, line, { at, afterEvent: eventId })
      // Closing a Session lapses every Character Claim.
      const changed: LiveMessage[] =
        tool.name === 'close_session'
          ? [...timelineChanged, { type: 'claims', campaign: campaignId }]
          : timelineChanged
      return { result: withSkill(result, skill), changed }
    })
  }

  return {
    /** Every tool, as `tools/list` shows it. */
    list(): ToolDescriptor[] {
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: z.toJSONSchema(t.input, { io: 'input' }) as Record<string, unknown>
      }))
    },

    /** Calls a tool for the Campaign in `folder`. Refusals come back as `isError` results. */
    call(folder: string, name: string, args: unknown): ToolResult {
      try {
        const tool = byName.get(name)
        if (!tool) {
          throw new ToolError('unknown_tool', `There is no tool named ${name}`, 'Use a listed tool')
        }
        const { result, changed } = run(tool, folder, args)
        for (const message of changed) publish(message)
        return json(result)
      } catch (e) {
        if (e instanceof ToolError) return failure(e)
        throw e
      }
    },

    /** The Campaign's Event log, oldest first. */
    events(folder: string): LoggedEvent[] {
      return campaignDb(folder)
        .db.select()
        .from(event)
        .orderBy(asc(event.id))
        .all()
        .map((e) => ({
          id: e.id,
          session: e.sessionId,
          minute: e.minute,
          tool: e.tool,
          kind: e.kind,
          summary: e.summary,
          data: e.data ?? null,
          dmOnly: e.dmOnly
        }))
    }
  }
}

export type ToolHost = ReturnType<typeof createToolHost>
