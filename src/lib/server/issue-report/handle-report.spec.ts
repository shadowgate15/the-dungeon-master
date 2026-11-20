import { describe, expect, it } from 'vitest'
import type { CreateIssueResult, IssueReport, ReportContext } from './create-issue.ts'
import { handleReport } from './handle-report.ts'

const body = {
  description: 'Clicked it twice.',
  context: {
    url: 'http://localhost:5173/campaigns/7',
    route: '/campaigns/[id]',
    params: { id: '7' },
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Test)'
  }
}

/** Deps that record what was filed; `result` is what the fake `createIssue` answers. */
const setup = (result: CreateIssueResult = { ok: true, url: 'https://example.test/issues/1' }) => {
  const filed: { report: IssueReport; context: ReportContext }[] = []
  const deps = {
    dev: true,
    now: () => new Date('2026-11-20T10:00:00.000Z'),
    commit: () => 'abc1234',
    createIssue: async (report: IssueReport, context: ReportContext) => {
      filed.push({ report, context })
      return result
    }
  }
  return { deps, filed }
}

describe('handleReport', () => {
  it('files the report with the server-side timestamp and commit and answers with the issue URL', async () => {
    const { deps, filed } = setup()

    const response = await handleReport(body, deps)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: 'https://example.test/issues/1' })
    expect(filed).toEqual([
      {
        report: { description: 'Clicked it twice.' },
        context: { ...body.context, timestamp: '2026-11-20T10:00:00.000Z', commit: 'abc1234' }
      }
    ])
  })

  it('is not found outside dev, and files nothing', async () => {
    const { deps, filed } = setup()

    const response = await handleReport(body, { ...deps, dev: false })

    expect(response.status).toBe(404)
    expect(filed).toEqual([])
  })

  it.each([
    ['a missing body', null],
    ['a blank description', { ...body, description: '   ' }],
    ['no description', { context: body.context }],
    ['no context', { description: 'y' }]
  ])('rejects %s with 400, and files nothing', async (_name, invalid) => {
    const { deps, filed } = setup()

    const response = await handleReport(invalid, deps)

    expect(response.status).toBe(400)
    expect(filed).toEqual([])
  })

  it('ignores a title in the body, since one is generated', async () => {
    const { deps, filed } = setup()

    await handleReport({ ...body, title: 'Mine' }, deps)

    expect(filed[0].report).toEqual({ description: 'Clicked it twice.' })
  })

  it('answers 502 with the reason when the issue could not be filed', async () => {
    const { deps } = setup({ ok: false, error: '`gh` is not installed, so no issue was filed.' })

    const response = await handleReport(body, deps)

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: '`gh` is not installed, so no issue was filed.'
    })
  })
})
