import type { z } from 'zod'
import type { LiveMessage } from '#lib/live/messages.ts'
import type { Queryable } from '../db/connect'
import type { Dice } from '../dice'

/**
 * The shared contract every game tool follows: short snake_case names, per-Entity versions on
 * every read and write, one transaction and one Event per mutating call, and errors shaped
 * `{code, message, next}`.
 */

/** The plugin's name, which namespaces the skills a tool points to. */
export const PLUGIN_NAME = 'the-dungeon-master'

/** An MCP `tools/call` result. Errors carry `isError` and a `{code, message, next}` payload. */
export type ToolResult = {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

/** What `tools/list` shows for one tool. */
export type ToolDescriptor = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * A refusal the DM can act on: what went wrong and the call to make next. `details` adds
 * structured data to the payload (such as the matches a near-duplicate refusal found).
 */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly next: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message)
  }

  /** The handle names no Entity. */
  static unknownHandle(handle: string): ToolError {
    return new ToolError(
      'unknown_handle',
      `No Entity has the handle ${handle}`,
      'Check the handle against a recent read and call again'
    )
  }

  /** The write passed an old version: someone changed the Entity since the DM read it. */
  static staleVersion(handle: string, given: number, current: number, read: string): ToolError {
    return new ToolError(
      'stale_version',
      `${handle} is at version ${current}, not ${given}: it changed since you read it`,
      read
    )
  }

  /** The input breaks a rule the forms enforce too. */
  static invalidInput(tool: string, message: string): ToolError {
    return new ToolError('invalid_input', message, `Fix the arguments and call ${tool} again`)
  }
}

/** Refuses a write whose version is not the Entity's current one. */
export function expectVersion(
  entity: { handle: string; version: number; read: string },
  given: number
) {
  if (entity.version !== given) {
    throw ToolError.staleVersion(entity.handle, given, entity.version, entity.read)
  }
}

/** What code stamps on every Event: the open Session and the in-fiction minute. */
export type Stamp = { sessionId: string | null; minute: number }

/**
 * What a tool's `run` sees. Inside a mutating call, `db` is the call's transaction and
 * `stamp.eventId` is the id of the one Event the call will log (null for reads). `dice` is the
 * Campaign's own roller; `now` is the real time of the call.
 */
export type ToolContext = {
  db: Queryable
  stamp: Stamp & { eventId: number | null }
  folder: string
  campaignId: string
  dice: Dice
  now: number
}

/** The one Event a mutating call logs. Code stamps the Session and in-fiction time. */
export type ToolEvent = {
  kind: string
  summary: string
  data?: Record<string, unknown>
  dmOnly?: boolean
}

/** A tool's output; `skill` names a plugin skill (unprefixed) the DM must load next. */
type Output = { result: Record<string, unknown>; skill?: string }

/**
 * The Player-safe `⚙ DM …` line for one successful call (without the `⚙`), or null for none. It
 * is built from the input and result here, so it must never echo hidden handles, enemy numbers
 * or Arc events. Left out, a read shows a generic line and a write shows one unless it is DM-only.
 */
type Activity<I> = string | null | ((input: I, result: Record<string, unknown>) => string | null)

type Base<S extends z.ZodType> = {
  name: string
  description: string
  input: S
  activity?: Activity<z.infer<S>>
}

export type GameTool =
  | (Omit<Base<z.ZodType>, 'activity'> & {
      activity?: Activity<never>
      mutates: false
      run: (ctx: ToolContext, input: unknown) => Record<string, unknown>
    })
  | (Omit<Base<z.ZodType>, 'activity'> & {
      activity?: Activity<never>
      mutates: true
      run: (ctx: ToolContext, input: unknown) => Output & { event: ToolEvent }
    })
  | (Omit<Base<z.ZodType>, 'activity'> & {
      activity?: Activity<never>
      mutates: 'creation'
      run: (ctx: ToolContext, input: unknown) => CreationOutput
    })

/**
 * What a creation write returns. Creation is out of fiction, so it logs no Event and no
 * DM-activity line (map #301): `line` is the muted line the creation conversation shows for it
 * instead, and `changed` names what the browser must refetch.
 */
export type CreationOutput = {
  result: Record<string, unknown>
  line?: string
  changed: LiveMessage[]
}

/** A tool that only reads. It logs nothing. */
export function readTool<S extends z.ZodType>(
  tool: Base<S> & { run: (ctx: ToolContext, input: z.infer<S>) => Record<string, unknown> }
): GameTool {
  return {
    ...tool,
    activity: tool.activity as Activity<never>,
    mutates: false,
    run: tool.run as (ctx: ToolContext, i: unknown) => never
  }
}

/** A tool that changes state: one transaction, exactly one Event. */
export function writeTool<S extends z.ZodType>(
  tool: Base<S> & {
    run: (ctx: ToolContext, input: z.infer<S>) => Output & { event: ToolEvent }
  }
): GameTool {
  return {
    ...tool,
    activity: tool.activity as Activity<never>,
    mutates: true,
    run: tool.run as (ctx: ToolContext, i: unknown) => never
  }
}

/**
 * A tool that changes creation state (the Seed card, Character drafts, the creation conversation):
 * one transaction, and no Event, since the Event log starts with the story.
 */
export function creationTool<S extends z.ZodType>(
  tool: Omit<Base<S>, 'activity'> & {
    run: (ctx: ToolContext, input: z.infer<S>) => CreationOutput
  }
): GameTool {
  return { ...tool, mutates: 'creation', run: tool.run as (ctx: ToolContext, i: unknown) => never }
}
