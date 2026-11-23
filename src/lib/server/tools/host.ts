import { asc } from 'drizzle-orm'
import { z } from 'zod'
import type { CampaignLibrary } from '../campaign/library'
import type { Database } from '../db/connect'
import { event } from '../db/schema'
import {
  PLUGIN_NAME,
  ToolError,
  type GameTool,
  type ToolDescriptor,
  type ToolResult
} from './contract'

/** What code stamps on every Event: the open Session and the in-fiction minute. */
export type Stamp = { sessionId: string | null; minute: number }

type Options = {
  library: CampaignLibrary
  tools: GameTool[]
  /** Reads the Campaign's current stamp. No Sessions or clock yet: offline, minute 0. */
  stamp?: (db: Database) => Stamp
  now?: () => number
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
  ...json({ code: e.code, message: e.message, next: e.next }),
  isError: true
})

/** The output of a tool that enters a situation, pointing at the skill to load. */
function withSkill(result: Record<string, unknown>, skill: string | undefined) {
  if (!skill) return result
  const name = `${PLUGIN_NAME}:${skill}`
  return { ...result, skill: name, next: `Load skill ${name} before continuing.` }
}

/**
 * The game's tools, called by name against a Campaign folder. Every call follows the contract in
 * `./contract`: validated input, `{code, message, next}` refusals, and for mutating tools one
 * transaction that logs exactly one Event.
 */
export function createToolHost({
  library,
  tools,
  stamp = () => ({ sessionId: null, minute: 0 }),
  now = Date.now
}: Options) {
  const byName = new Map(tools.map((t) => [t.name, t]))

  function campaignDb(folder: string): Database {
    const db = library.databaseFor(folder)
    if (!db) {
      throw new ToolError(
        'not_a_campaign',
        `${folder} is not a registered Campaign folder`,
        'Ask the Player to open or create the Campaign in the web UI, then run dm in its folder'
      )
    }
    return db
  }

  function run(tool: GameTool, db: Database, args: unknown): Record<string, unknown> {
    const parsed = tool.input.safeParse(args ?? {})
    if (!parsed.success) {
      throw ToolError.invalidInput(tool.name, z.prettifyError(parsed.error))
    }
    if (!tool.mutates) return tool.run({ db }, parsed.data)
    return db.transaction((tx) => {
      const { result, skill, event: logged } = tool.run({ db: tx as Database }, parsed.data)
      const { sessionId, minute } = stamp(tx as Database)
      tx.insert(event)
        .values({
          sessionId,
          minute,
          tool: tool.name,
          kind: logged.kind,
          summary: logged.summary,
          data: logged.data ?? null,
          dmOnly: logged.dmOnly ?? false,
          createdAt: now()
        })
        .run()
      return withSkill(result, skill)
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
        return json(run(tool, campaignDb(folder), args))
      } catch (e) {
        if (e instanceof ToolError) return failure(e)
        throw e
      }
    },

    /** The Campaign's Event log, oldest first. */
    events(folder: string): LoggedEvent[] {
      return campaignDb(folder)
        .select()
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
