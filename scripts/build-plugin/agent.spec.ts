import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_TOOL_PREFIX, SESSION_OPENING_SKILL } from '../../src/hooks/hooks'
import { gameTools } from '../../src/lib/server/tools'

const plugin = path.resolve(import.meta.dirname, '../../plugin')

/** A Markdown file's YAML frontmatter as flat `key: value` strings, and its body. */
function parse(file: string): { meta: Record<string, string>; body: string } {
  const text = fs.readFileSync(file, 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (!match) throw new Error(`${file} has no frontmatter`)
  const meta = Object.fromEntries(
    match[1].split('\n').map((line) => {
      const at = line.indexOf(':')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
    })
  )
  return { meta, body: match[2] }
}

describe('the dm agent', () => {
  const agent = parse(path.join(plugin, 'agents/dm.md'))

  it('is named dm, so the launcher can run the-dungeon-master:dm', () => {
    expect(agent.meta.name).toBe('dm')
    expect(agent.meta.description).not.toBe('')
  })

  it('may use exactly the game tools plus Skill and Agent (regenerate the list when tools change)', () => {
    const tools = agent.meta.tools.split(',').map((t) => t.trim())
    expect(tools.sort()).toEqual(
      [...gameTools.map((t) => `${GAME_TOOL_PREFIX}${t.name}`), 'Skill', 'Agent'].sort()
    )
  })

  it('has a prompt of six parts', () => {
    expect([...agent.body.matchAll(/^## /gm)]).toHaveLength(6)
  })
})

describe('the session-opening skill', () => {
  it('is where SessionStart points the DM', () => {
    const skill = parse(path.join(plugin, 'skills/session-opening/SKILL.md'))
    expect(`the-dungeon-master:${skill.meta.name}`).toBe(SESSION_OPENING_SKILL)
    expect(skill.meta.description).not.toBe('')
  })
})

describe('the ending-a-sitting skill', () => {
  it('is where the agent sends the DM on End Session', () => {
    const skill = parse(path.join(plugin, 'skills/ending-a-sitting/SKILL.md'))
    expect(skill.meta.name).toBe('ending-a-sitting')
    expect(skill.meta.description).not.toBe('')
    expect(parse(path.join(plugin, 'agents/dm.md')).body).toContain(
      'the-dungeon-master:ending-a-sitting'
    )
  })
})
