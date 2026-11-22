// The real tracker and git ports: thin, untested wrappers over the `gh` and `git` CLIs.
import { execFile } from 'node:child_process'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import type { Blocker, GitPort, Ticket, TrackerPort } from './run-spec.ts'

const execFileAsync = promisify(execFile)

const run = async (command: string, args: string[], cwd: string) =>
  (await execFileAsync(command, args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout

type Issue = { number: number; title: string; state: string }

/** `gh api --paginate --slurp` output: one array per page. */
const ghList = async (cwd: string, path: string) =>
  (JSON.parse(await run('gh', ['api', '--paginate', '--slurp', path], cwd)) as Issue[][]).flat()

export const createTracker = (cwd: string): TrackerPort => ({
  readSpec: async (spec) => {
    const subIssues = await ghList(cwd, `repos/{owner}/{repo}/issues/${spec}/sub_issues`)
    return Promise.all(
      subIssues
        .filter((issue) => issue.state === 'open')
        .map(async (issue): Promise<Ticket> => {
          const blockers = await ghList(
            cwd,
            `repos/{owner}/{repo}/issues/${issue.number}/dependencies/blocked_by`
          )
          return {
            number: issue.number,
            title: issue.title,
            open: true,
            blockedBy: blockers.map((blocker): Blocker => ({
              number: blocker.number,
              open: blocker.state === 'open'
            }))
          }
        })
    )
  }
})

export const createGit = (cwd: string): GitPort => {
  const git = (args: string[]) => run('git', args, cwd)
  return {
    repoRoot: async () =>
      dirname((await git(['rev-parse', '--path-format=absolute', '--git-common-dir'])).trim()),
    branchExists: (branch) =>
      git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).then(
        () => true,
        () => false
      ),
    worktreeFor: async (branch) => {
      const entries = (await git(['worktree', 'list', '--porcelain'])).split('\n\n')
      const entry = entries.find((lines) =>
        lines.split('\n').includes(`branch refs/heads/${branch}`)
      )
      return entry?.match(/^worktree (.+)$/m)?.[1] ?? null
    },
    addWorktree: async (path, branch, base) => {
      await git(
        base === undefined
          ? ['worktree', 'add', path, branch]
          : ['worktree', 'add', '-b', branch, path, base]
      )
    }
  }
}
