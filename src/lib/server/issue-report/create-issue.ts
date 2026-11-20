import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const DEFAULT_REPO = 'shadowgate15/the-dungeon-master'

export type IssueReport = {
  title: string
  description: string
}

/** What the browser captures about the page the report was filed from. Identifiers only, never game content. */
export type ReportContext = {
  url: string
  /** The route pattern, e.g. `/campaigns/[id]`; null when no route matched. */
  route: string | null
  params: Record<string, string>
  viewport: { width: number; height: number }
  userAgent: string
  timestamp: string
  commit: string
}

/** Runs `gh` with the given arguments and resolves to its stdout; rejects when `gh` fails. */
export type GhRunner = (args: string[]) => Promise<string>

export type CreateIssueResult = { ok: true; url: string } | { ok: false; error: string }

export const runGh: GhRunner = async (args) => (await execFileAsync('gh', args)).stdout

const buildBody = (report: IssueReport, context: ReportContext) => {
  const params = Object.entries(context.params)
  return [
    report.description,
    '## Context',
    `- URL: ${context.url}`,
    `- Route: ${context.route ?? 'none'}`,
    ...params.map(([name, value]) => `- ${name}: ${value}`),
    `- Viewport: ${context.viewport.width}×${context.viewport.height}`,
    `- User agent: ${context.userAgent}`,
    `- Reported at: ${context.timestamp}`,
    `- Commit: ${context.commit}`
  ].join('\n\n')
}

const AUTH_FAILURE = /credentials|unauthori[sz]ed|authenticat|not logged in|\b401\b/i

const describeFailure = (cause: unknown) => {
  const { code, stderr } = cause as { code?: string; stderr?: string }
  if (code === 'ENOENT') return '`gh` is not installed, so no issue was filed.'
  const reason = stderr?.trim()
  // An exec error's own message repeats the whole command, report body included.
  if (!reason) return '`gh` failed without saying why, so no issue was filed.'
  if (AUTH_FAILURE.test(reason) && !reason.includes('gh auth login')) {
    return `${reason}\nRun \`gh auth login\` and try again.`
  }
  return reason
}

/** Files the report as a GitHub issue through the `gh` CLI, which brings its own authentication. */
export const createIssue = async (
  report: IssueReport,
  context: ReportContext,
  { gh = runGh, repo = DEFAULT_REPO }: { gh?: GhRunner; repo?: string } = {}
): Promise<CreateIssueResult> => {
  try {
    const stdout = await gh([
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      `Fix: ${report.title}`,
      '--label',
      'needs-triage',
      '--body',
      buildBody(report, context)
    ])
    return { ok: true, url: stdout.trim() }
  } catch (cause) {
    return { ok: false, error: describeFailure(cause) }
  }
}
