import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { CampaignLibrary } from '../campaign/library'
import { gameTools } from '.'
import { createToolHost, type ToolHost } from './host'

let library: CampaignLibrary
let host: ToolHost
let folder: string

beforeEach(() => {
  const tmp = tempDir('rules-tools')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  library.create({ name: 'Ember Road', folder })
  host = createToolHost({ library, tools: gameTools })
})

afterEach(() => library.close())

function call(name: string, args: unknown = {}) {
  const result = host.call(folder, name, args)
  return { isError: result.isError ?? false, payload: JSON.parse(result.content[0].text) }
}

describe('lookup', () => {
  it('reads a rules entry by its handle', () => {
    const { isError, payload } = call('lookup', { handle: 'monster:goblin' })

    expect(isError).toBe(false)
    expect(payload).toMatchObject({
      handle: 'monster:goblin',
      kind: 'monster',
      name: 'Goblin',
      entry: { hitPoints: 7, armorClass: [{ value: 15 }] }
    })
  })

  it('finds rules entries by a free-text query', () => {
    const { payload } = call('lookup', { query: 'fireball' })

    expect(payload.results[0]).toMatchObject({ handle: 'spell:fireball', name: 'Fireball' })
  })

  it('refuses a handle that names no rules entry', () => {
    const { isError, payload } = call('lookup', { handle: 'spell:wish-for-more-wishes' })

    expect(isError).toBe(true)
    expect(payload).toMatchObject({ code: 'unknown_rules_entry', next: expect.any(String) })
  })

  it('logs nothing: rules are never World content', () => {
    call('lookup', { handle: 'condition:prone' })

    expect(host.events(folder)).toEqual([])
  })
})
