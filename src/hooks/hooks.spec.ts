import { execFile } from 'node:child_process'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tempDir } from '../testing/temp-dir'
import { addCharacter, fighterDraft } from '../lib/server/character/test-characters'
import { startTestGameServer, type TestGameServer } from '../testing/game-server'

vi.setConfig({ testTimeout: 20_000 })

/** The committed hooks bundle, run with plain Node like Claude Code does. */
const HOOKS_BUNDLE = path.resolve(import.meta.dirname, '../../plugin/hooks/dm-hooks.mjs')

const GAME_TOOL = 'mcp__plugin_the-dungeon-master_dm__narrate'

let tmp: string
let home: string
let server: TestGameServer
let folder: string
let campaignId: string

beforeEach(async () => {
  tmp = tempDir('hooks')
  home = path.join(tmp, 'home')
  server = await startTestGameServer({ home })
  folder = path.join(tmp, 'ember-road')
  campaignId = server.library.create({ name: 'Ember Road', folder }).id
})

afterEach(() => server.stop())

/** Runs one hook as Claude Code does: its input JSON on stdin; resolves to its parsed stdout. */
function hook(event: string, input: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [HOOKS_BUNDLE, event],
      { env: { PATH: process.env.PATH, DUNGEON_MASTER_HOME: home } },
      (error, stdout) => {
        if (error) return reject(error)
        resolve(stdout.trim() ? JSON.parse(stdout) : null)
      }
    )
    child.stdin!.end(JSON.stringify({ cwd: folder, ...input }))
  })
}

/** Leaves a closed Floor awaiting Narration, with a DM at the table to hear it. */
function closeFloor() {
  server.channels.listen(folder, () => {})
  const wren = addCharacter(server.library, campaignId, fighterDraft('Wren'))
  server.library.floor(campaignId).send({ character: wren, text: 'I pick the lock.' })
  server.play.done(campaignId)
}

describe('PreToolUse', () => {
  it('allows a game tool', async () => {
    const out = await hook('pre-tool-use', {
      hook_event_name: 'PreToolUse',
      tool_name: GAME_TOOL,
      tool_input: { text: 'Dust.' }
    })

    expect(out).toMatchObject({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' }
    })
  })

  it('leaves every other tool to Claude Code', async () => {
    for (const tool_name of ['Bash', 'mcp__plugin_other_dm__narrate', 'mcp__dm__narrate']) {
      expect(await hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name })).toBeNull()
    }
  })
})

describe('Stop', () => {
  it('lets the turn end when nothing awaits Narration', async () => {
    expect(await hook('stop', { hook_event_name: 'Stop', stop_hook_active: false })).toBeNull()
  })

  it('refuses to end the turn while a closed Floor awaits Narration', async () => {
    closeFloor()

    const out = await hook('stop', { hook_event_name: 'Stop', stop_hook_active: false })

    expect(out).toMatchObject({ decision: 'block', reason: expect.stringContaining('narrate') })
  })

  it('lets the turn end on the second attempt, and the Player sees an error', async () => {
    closeFloor()

    const out = await hook('stop', { hook_event_name: 'Stop', stop_hook_active: true })

    expect(out).toBeNull()
    expect(server.play.timeline(campaignId).entries.at(-1)).toMatchObject({
      type: 'error',
      text: expect.stringContaining('without a Narration')
    })
  })
})

describe('SessionStart', () => {
  it('injects the core block and starts session opening', async () => {
    addCharacter(server.library, campaignId, fighterDraft('Wren'))

    const out = (await hook('session-start', {
      hook_event_name: 'SessionStart',
      source: 'startup'
    })) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } }

    expect(out.hookSpecificOutput.hookEventName).toBe('SessionStart')
    const context = out.hookSpecificOutput.additionalContext
    expect(context).toContain('# Core block')
    expect(context).toContain('- Wren (char:wren): HP 12/12')
    expect(context).toContain('the-dungeon-master:session-opening')
  })

  it('tells the DM what changed since the last Session, once', async () => {
    const wren = addCharacter(server.library, campaignId, fighterDraft('Wren'))
    server.library.party(campaignId).updateDetails(wren, { appearance: 'A scar across one brow.' })
    const start = async () =>
      (
        (await hook('session-start', { hook_event_name: 'SessionStart', source: 'startup' })) as {
          hookSpecificOutput: { additionalContext: string }
        }
      ).hookSpecificOutput.additionalContext

    const context = await start()
    expect(context).toContain('# Core block')
    expect(context).toMatch(/^- char:wren v2: the Player edited Wren’s appearance$/m)
    expect(await start()).not.toContain('Changed since last Session')
  })

  it('re-injects the core block after compaction, without reopening the session', async () => {
    const out = (await hook('session-start', {
      hook_event_name: 'SessionStart',
      source: 'compact'
    })) as { hookSpecificOutput: { additionalContext: string } }

    expect(out.hookSpecificOutput.additionalContext).toContain('# Core block')
    expect(out.hookSpecificOutput.additionalContext).not.toContain('session-opening')
  })
})

describe('outside a Campaign folder', () => {
  it('every hook is inert', async () => {
    closeFloor()
    const elsewhere = tempDir('code')
    const inputs = {
      'pre-tool-use': { hook_event_name: 'PreToolUse', tool_name: GAME_TOOL },
      stop: { hook_event_name: 'Stop', stop_hook_active: false },
      'session-start': { hook_event_name: 'SessionStart', source: 'startup' }
    }

    for (const [event, input] of Object.entries(inputs)) {
      expect(await hook(event, { ...input, cwd: elsewhere })).toBeNull()
    }
  })
})
