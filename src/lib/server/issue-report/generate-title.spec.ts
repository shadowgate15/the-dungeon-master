import { describe, expect, it } from 'vitest'
import { generateTitle } from './generate-title.ts'

describe('generateTitle', () => {
  it('titles the report with what claude answers for the description', async () => {
    const prompts: string[] = []
    const claude = async (prompt: string) => {
      prompts.push(prompt)
      return 'Roll button does nothing\n'
    }

    const title = await generateTitle('Clicked the roll button twice and nothing happened.', {
      claude
    })

    expect(title).toBe('Roll button does nothing')
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('Clicked the roll button twice and nothing happened.')
  })

  it('falls back to the first line of the description when claude fails', async () => {
    const claude = async () => {
      throw new Error('spawn claude ENOENT')
    }

    const title = await generateTitle('Roll button does nothing\nClicked it twice.', { claude })

    expect(title).toBe('Roll button does nothing')
  })

  it('falls back to the description when claude answers with nothing', async () => {
    const claude = async () => '  \n'

    const title = await generateTitle('Roll button does nothing', { claude })

    expect(title).toBe('Roll button does nothing')
  })

  it('cuts a fallback title to 72 characters', async () => {
    const claude = async () => ''

    const title = await generateTitle('a'.repeat(100), { claude })

    expect(title).toBe('a'.repeat(72))
  })

  it('keeps the description as written when it is the fallback', async () => {
    const claude = async () => ''

    expect(await generateTitle('"Roll" button does nothing', { claude })).toBe(
      '"Roll" button does nothing'
    )
  })

  it('strips quotes claude wraps around the title', async () => {
    const claude = async () => '"Roll button does nothing"'

    expect(await generateTitle('x', { claude })).toBe('Roll button does nothing')
  })

  it('cuts a title longer than 72 characters', async () => {
    const claude = async () => 'b'.repeat(100)

    expect(await generateTitle('x', { claude })).toBe('b'.repeat(72))
  })
})
