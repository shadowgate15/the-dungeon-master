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

  it('names only skills the plugin ships, rests and levels among them', () => {
    const skills = [...agent.body.matchAll(/the-dungeon-master:([a-z-]+)/g)].map((m) => m[1])
    expect(skills).toEqual(expect.arrayContaining(['rests-and-downtime', 'level-up']))
    for (const name of skills) {
      expect(parse(path.join(plugin, `skills/${name}/SKILL.md`)).meta.name).toBe(name)
    }
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

describe('the builder subagent', () => {
  const builder = parse(path.join(plugin, 'agents/builder.md'))
  const tools = builder.meta.tools.split(',').map((t) => t.trim())
  const game = (name: string) => `${GAME_TOOL_PREFIX}${name}`

  it('is named builder, so the dm agent can hand it Begin', () => {
    expect(builder.meta.name).toBe('builder')
    expect(builder.meta.description).not.toBe('')
  })

  it('writes the World, the pitch and the Arc through game tools only', () => {
    const names = new Set(gameTools.map((t) => game(t.name)))
    expect(tools.filter((t) => t !== 'Skill').every((t) => names.has(t))).toBe(true)
    for (const name of ['seed', 'party', 'establish', 'reveal', 'create_arc']) {
      expect(tools).toContain(game(name))
    }
  })

  it('can move the Party to the opening Place it sets as the Scene', () => {
    expect(tools).toContain(game('move'))
    expect(builder.body).toMatch(/`move`[^\n]*`set_scene`/)
  })

  it('never talks to the Player or edits creation', () => {
    for (const name of ['narrate', 'reply', 'set_seed', 'set_draft_fields']) {
      expect(tools).not.toContain(game(name))
    }
  })

  it('loads creation procedure skills the plugin ships', () => {
    const skills = [...builder.body.matchAll(/the-dungeon-master:([a-z-]+)/g)].map((m) => m[1])
    expect(skills.length).toBeGreaterThan(0)
    for (const name of skills) {
      const skill = parse(path.join(plugin, `skills/${name}/SKILL.md`))
      expect(skill.meta.name).toBe(name)
      expect(skill.meta.description).not.toBe('')
    }
  })
})

describe('the dm agent at Begin', () => {
  it('hands a begin event to builder', () => {
    const agent = parse(path.join(plugin, 'agents/dm.md'))
    expect(agent.body).toMatch(/`begin` event[^\n]*`builder`/)
  })
})

describe('the ending-a-session skill', () => {
  it('is where the agent sends the DM on End Session', () => {
    const skill = parse(path.join(plugin, 'skills/ending-a-session/SKILL.md'))
    expect(skill.meta.name).toBe('ending-a-session')
    expect(skill.meta.description).not.toBe('')
    expect(parse(path.join(plugin, 'agents/dm.md')).body).toContain(
      'the-dungeon-master:ending-a-session'
    )
  })

  it('closes the Session last, after the Arc review, lint and goodbye', () => {
    const body = parse(path.join(plugin, 'skills/ending-a-session/SKILL.md')).body
    const close = body.lastIndexOf('`close_session')
    for (const step of ['arc-review', '`lint`', 'goodbye']) {
      expect(body.indexOf(step)).toBeGreaterThan(-1)
      expect(body.indexOf(step)).toBeLessThan(close)
    }
  })
})

describe('the arc-review skill', () => {
  it('ships, and the dm prompt and ending a Session point to it', () => {
    const skill = parse(path.join(plugin, 'skills/arc-review/SKILL.md'))
    expect(skill.meta.name).toBe('arc-review')
    expect(skill.meta.description).not.toBe('')
    for (const file of ['agents/dm.md', 'skills/ending-a-session/SKILL.md']) {
      expect(parse(path.join(plugin, file)).body).toContain('the-dungeon-master:arc-review')
    }
  })
})
