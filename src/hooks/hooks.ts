import fs from 'node:fs'
import path from 'node:path'
import { campaignDatabasePath, userStateDir } from '../lib/server/campaign/paths'
import { readRuntimeFile } from '../lib/server/runtime'

/** The prefix every game tool has in Claude Code: plugin `the-dungeon-master`, MCP server `dm`. */
export const GAME_TOOL_PREFIX = 'mcp__plugin_the-dungeon-master_dm__'

/** The skill that opens a sitting. */
export const SESSION_OPENING_SKILL = 'the-dungeon-master:session-opening'

type Env = Record<string, string | undefined>

/** The hook input fields these hooks read; Claude Code sends more. */
export type HookInput = {
  cwd?: string
  tool_name?: string
  stop_hook_active?: boolean
  source?: 'startup' | 'resume' | 'clear' | 'compact'
}

export type HookName = 'pre-tool-use' | 'stop' | 'session-start'

/** The Campaign folder the session runs in, or undefined outside one. */
function campaignFolder(input: HookInput, env: Env): string | undefined {
  const folder = path.resolve(env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd())
  return fs.existsSync(campaignDatabasePath(folder)) ? folder : undefined
}

/** Calls the game server's bridge API; undefined when the server is down. */
async function api(env: Env, route: string, init?: RequestInit): Promise<unknown> {
  const runtime = readRuntimeFile(userStateDir(env))
  if (!runtime) return undefined
  try {
    const res = await fetch(`http://localhost:${runtime.port}/api/bridge/${route}`, {
      ...init,
      headers: { authorization: `Bearer ${runtime.token}`, 'content-type': 'application/json' }
    })
    return res.ok ? await res.json() : undefined
  } catch {
    return undefined
  }
}

/**
 * The plugin's hooks, inert outside a Campaign folder. Returns the hook's stdout JSON, or undefined
 * for no output (Claude Code carries on as it would without the hook).
 */
export async function runHook(
  name: HookName,
  input: HookInput,
  env: Env = process.env
): Promise<object | undefined> {
  const folder = campaignFolder(input, env)
  if (!folder) return undefined

  if (name === 'pre-tool-use') {
    if (!input.tool_name?.startsWith(GAME_TOOL_PREFIX)) return undefined
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: 'A game tool of The Dungeon Master'
      }
    }
  }

  if (name === 'stop') {
    const check = (await api(env, 'stop-check', {
      method: 'POST',
      body: JSON.stringify({ campaign: folder, again: input.stop_hook_active === true })
    })) as { block: boolean; reason?: string } | undefined
    if (!check?.block) return undefined
    return { decision: 'block', reason: check.reason }
  }

  // A new sitting (or a cleared or resumed one) hears what changed since the last; compaction
  // only needs the core block back.
  const block = (
    input.source === 'compact'
      ? await api(env, `core-block?campaign=${encodeURIComponent(folder)}`)
      : await api(env, 'session-start', {
          method: 'POST',
          body: JSON.stringify({ campaign: folder })
        })
  ) as { text: string } | undefined
  const core = block?.text ?? 'The game server is not running: the core block is unavailable.'
  const additionalContext =
    input.source === 'compact'
      ? core
      : `${core}\n\nThis sitting has just started. Load skill ${SESSION_OPENING_SKILL} now and follow it.`
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }
}
