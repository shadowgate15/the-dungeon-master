import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { CreateIssueResult, IssueReport, ReportContext } from './create-issue.ts'

const reportSchema = z.object({
  description: z.string().trim().min(1),
  context: z.object({
    url: z.string(),
    route: z.string().nullable(),
    params: z.record(z.string(), z.string()),
    viewport: z.object({ width: z.number(), height: z.number() }),
    userAgent: z.string()
  })
})

export type HandleReportDeps = {
  dev: boolean
  now: () => Date
  commit: () => string
  createIssue: (report: IssueReport, context: ReportContext) => Promise<CreateIssueResult>
}

/**
 * Files a dev-only issue report. The body is `reportSchema`: what the reporter wrote plus the
 * page context the browser captured; the timestamp and commit are added here. Answers
 * `{ url }` of the new issue, or `{ error }`. Outside dev it does not exist (404).
 */
export const handleReport = async (body: unknown, deps: HandleReportDeps): Promise<Response> => {
  if (!deps.dev) return json({ error: 'Not found' }, { status: 404 })

  const parsed = reportSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const { description, context } = parsed.data
  const result = await deps.createIssue(
    { description },
    { ...context, timestamp: deps.now().toISOString(), commit: deps.commit() }
  )
  if (!result.ok) return json({ error: result.error }, { status: 502 })
  return json({ url: result.url })
}
