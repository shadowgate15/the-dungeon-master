import { describe, expect, it } from 'vitest'
import { createIssue, type GhRunner, type ReportContext } from './create-issue.ts'

const context: ReportContext = {
  url: 'http://localhost:5173/campaigns/7/sessions/12?tab=log',
  route: '/campaigns/[id]/sessions/[sessionId]',
  params: { id: '7', sessionId: '12' },
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Test)',
  timestamp: '2026-11-20T10:00:00.000Z',
  commit: 'abc1234'
}

/** A fake `gh` that records its arguments and answers with the new issue's URL. */
const recordingGh = () => {
  const calls: string[][] = []
  const gh: GhRunner = async (args) => {
    calls.push(args)
    return 'https://github.com/shadowgate15/the-dungeon-master/issues/301\n'
  }
  return { gh, calls }
}

const flag = (args: string[], name: string) => args[args.indexOf(name) + 1]

describe('createIssue', () => {
  it('files a needs-triage issue titled "Fix: …" and returns its URL', async () => {
    const { gh, calls } = recordingGh()

    const result = await createIssue(
      { title: 'Roll button does nothing', description: 'Clicked it twice.' },
      context,
      { gh }
    )

    expect(result).toEqual({
      ok: true,
      url: 'https://github.com/shadowgate15/the-dungeon-master/issues/301'
    })
    expect(calls).toHaveLength(1)
    const [args] = calls
    expect(args.slice(0, 2)).toEqual(['issue', 'create'])
    expect(flag(args, '--title')).toBe('Fix: Roll button does nothing')
    expect(flag(args, '--label')).toBe('needs-triage')
    expect(flag(args, '--repo')).toBe('shadowgate15/the-dungeon-master')
  })

  it('puts the description and the captured context in the body', async () => {
    const { gh, calls } = recordingGh()

    await createIssue({ title: 'x', description: 'Clicked it twice.' }, context, { gh })

    const body = flag(calls[0], '--body')
    expect(body).toContain('Clicked it twice.')
    expect(body).toContain('http://localhost:5173/campaigns/7/sessions/12?tab=log')
    expect(body).toContain('/campaigns/[id]/sessions/[sessionId]')
    expect(body).toContain('sessionId: 12')
    expect(body).toContain('1280×720')
    expect(body).toContain('Mozilla/5.0 (Test)')
    expect(body).toContain('2026-11-20T10:00:00.000Z')
    expect(body).toContain('abc1234')
  })

  it('files into the repo it is given', async () => {
    const { gh, calls } = recordingGh()

    await createIssue({ title: 'x', description: '' }, context, { gh, repo: 'someone/else' })

    expect(flag(calls[0], '--repo')).toBe('someone/else')
  })

  it('says so when gh is not installed', async () => {
    const gh: GhRunner = async () => {
      throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' })
    }

    const result = await createIssue({ title: 'x', description: '' }, context, { gh })

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('`gh` is not installed')
    })
  })

  it('tells the reporter to run `gh auth login` when gh rejects its credentials', async () => {
    const gh: GhRunner = async () => {
      throw Object.assign(new Error('Command failed'), {
        stderr: 'HTTP 401: Bad credentials (https://api.github.com/graphql)'
      })
    }

    const result = await createIssue({ title: 'x', description: '' }, context, { gh })

    expect(result).toEqual({ ok: false, error: expect.stringContaining('gh auth login') })
  })

  it('does not echo the command or report body when gh fails silently', async () => {
    const gh: GhRunner = async () => {
      throw new Error('Command failed: gh issue create --body Clicked it twice.')
    }

    const result = await createIssue({ title: 'x', description: 'Clicked it twice.' }, context, {
      gh
    })

    expect(result).toEqual({ ok: false, error: expect.not.stringContaining('Clicked it twice.') })
  })

  it("passes on gh's own message when it fails, e.g. not logged in", async () => {
    const gh: GhRunner = async () => {
      throw Object.assign(new Error('Command failed'), {
        stderr: 'To get started with GitHub CLI, please run: gh auth login'
      })
    }

    const result = await createIssue({ title: 'x', description: '' }, context, { gh })

    expect(result).toEqual({ ok: false, error: expect.stringContaining('gh auth login') })
  })
})
