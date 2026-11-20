import { execFileSync } from 'node:child_process'
import { dev } from '$app/env'
import { createIssue } from '#lib/server/issue-report/create-issue.ts'
import { handleReport } from '#lib/server/issue-report/handle-report.ts'
import type { RequestHandler } from './$types'

const currentCommit = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

/** Dev-only: files a GitHub issue for a report made from the in-app "Report an issue" dialog. */
export const POST: RequestHandler = async ({ request }) =>
  handleReport(await request.json().catch(() => null), {
    dev,
    now: () => new Date(),
    commit: currentCommit,
    createIssue: (report, context) =>
      createIssue(report, context, { repo: process.env.REPORT_ISSUE_REPO })
  })
