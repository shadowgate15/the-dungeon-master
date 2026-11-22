// The real tracker, git and claude ports: thin, untested wrappers over the `gh`, `git` and `claude` CLIs.
import { execFile, spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import type { Blocker, ClaudePort, GitPort, Ticket, TrackerPort } from './run-spec.ts'

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
  },
  openDraftPr: async ({ head, base, title, body }) => {
    const url = await run(
      'gh',
      ['pr', 'create', '--draft', '--head', head, '--base', base, '--title', title, '--body', body],
      cwd
    )
    const number = Number(url.trim().match(/\/pull\/(\d+)/)?.[1])
    if (!Number.isInteger(number)) throw new Error(`gh pr create printed no PR URL: ${url}`)
    return number
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
    },
    head: async (branch) => (await git(['rev-parse', '--verify', `${branch}^{commit}`])).trim(),
    hasCommitsBeyond: async (branch, base) =>
      Number((await git(['rev-list', '--count', `${base}..${branch}`])).trim()) > 0,
    contains: (branch, commit) =>
      git(['merge-base', '--is-ancestor', commit, branch]).then(
        () => true,
        () => false
      ),
    removeWorktree: async (path) => {
      await git(['worktree', 'remove', path])
    }
  }
}

/**
 * Runs `claude -p` unattended (permission checks bypassed, default model, session saved so it can
 * be resumed), with the prompt on stdin and all output appended to the session's log file.
 * Resolves to the exit code; a `claude` that can't be started resolves to 127.
 */
export const createClaude = (): ClaudePort => ({
  run: ({ cwd, prompt, sessionId, resume, logFile }) =>
    new Promise((resolve) => {
      mkdirSync(dirname(logFile), { recursive: true })
      const out = openSync(logFile, 'a')
      const child = spawn(
        'claude',
        [
          '-p',
          resume ? '--resume' : '--session-id',
          sessionId,
          '--dangerously-skip-permissions',
          '--output-format',
          'text'
        ],
        { cwd, stdio: ['pipe', out, out] }
      )
      let finished = false
      const finish = (code: number) => {
        if (finished) return
        finished = true
        closeSync(out)
        resolve(code)
      }
      child.on('error', () => finish(127))
      child.on('close', (code) => finish(code ?? 1))
      child.stdin?.on('error', () => {})
      child.stdin?.end(prompt)
    })
})
