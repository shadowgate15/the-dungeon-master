import type { z } from 'zod'
import type { Queryable } from '../db/connect'

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

/** A refusal the DM can act on: what went wrong and the call to make next. */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly next: string
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

/** What a tool's `run` sees. Inside a mutating call, `db` is the call's transaction. */
export type ToolContext = { db: Queryable }

/** The one Event a mutating call logs. Code stamps the Session and in-fiction time. */
export type ToolEvent = {
  kind: string
  summary: string
  data?: Record<string, unknown>
  dmOnly?: boolean
}

/** A tool's output; `skill` names a plugin skill (unprefixed) the DM must load next. */
type Output = { result: Record<string, unknown>; skill?: string }

type Base<S extends z.ZodType> = { name: string; description: string; input: S }

export type GameTool =
  | (Base<z.ZodType> & {
      mutates: false
      run: (ctx: ToolContext, input: unknown) => Record<string, unknown>
    })
  | (Base<z.ZodType> & {
      mutates: true
      run: (ctx: ToolContext, input: unknown) => Output & { event: ToolEvent }
    })

/** A tool that only reads. It logs nothing. */
export function readTool<S extends z.ZodType>(
  tool: Base<S> & { run: (ctx: ToolContext, input: z.infer<S>) => Record<string, unknown> }
): GameTool {
  return { ...tool, mutates: false, run: tool.run as (ctx: ToolContext, i: unknown) => never }
}

/** A tool that changes state: one transaction, exactly one Event. */
export function writeTool<S extends z.ZodType>(
  tool: Base<S> & {
    run: (ctx: ToolContext, input: z.infer<S>) => Output & { event: ToolEvent }
  }
): GameTool {
  return { ...tool, mutates: true, run: tool.run as (ctx: ToolContext, i: unknown) => never }
}
