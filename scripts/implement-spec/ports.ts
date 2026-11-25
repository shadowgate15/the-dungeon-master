// The real tracker, git, claude and checks ports: thin, untested wrappers over the `gh`, `git`,
// `claude` and `pnpm` CLIs.
import { execFile, spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { usageLimitReset } from './usage-limit.ts'
import type {
  Blocker,
  ChecksPort,
  ChecksStep,
  ClaudePort,
  GitPort,
  Ticket,
  TrackerPort
} from './run-spec.ts'

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
  },
  setPrBody: async (pr, bodyFile) => {
    await run('gh', ['pr', 'edit', String(pr), '--body-file', bodyFile], cwd)
  },
  markPrReady: async (pr) => {
    await run('gh', ['pr', 'ready', String(pr)], cwd)
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
    },
    push: async (branch) => {
      await git(['push', '--set-upstream', 'origin', branch])
    },
    merge: async (worktree, branch) => {
      try {
        await run('git', ['merge', '--no-ff', '--no-edit', branch], worktree)
        return { result: 'clean' }
      } catch (error) {
        const unmerged = await run(
          'git',
          ['diff', '--name-only', '--diff-filter=U'],
          worktree
        ).then(
          (out) => out.split('\n').filter(Boolean),
          () => []
        )
        if (unmerged.length > 0) return { result: 'conflicts', paths: unmerged }
        const { stderr, stdout, message } = error as { stderr?: string; stdout?: string } & Error
        return { result: 'error', message: (stderr || stdout || message).trim() }
      }
    },
    abortMerge: async (worktree) => {
      const merging = await run(
        'git',
        ['rev-parse', '-q', '--verify', 'MERGE_HEAD'],
        worktree
      ).then(
        () => true,
        () => false
      )
      if (merging) await run('git', ['merge', '--abort'], worktree)
    }
  }
}

/** The checks after a clean git merge, in order, each a `pnpm` command. */
const CHECKS: [ChecksStep, string[]][] = [
  ['install', ['install', '--frozen-lockfile']],
  ['lint', ['lint']],
  ['check', ['check']],
  ['test', ['test:unit', '--run', '--project', 'client', '--project', 'server']]
]

/**
 * Runs each check with `pnpm` in `cwd`, stopping at the first that fails (or can't be started),
 * with every command and its output appended to the log file.
 */
export const createChecks = (): ChecksPort => ({
  run: async ({ cwd, logFile }) => {
    mkdirSync(dirname(logFile), { recursive: true })
    for (const [step, args] of CHECKS) {
      const out = openSync(logFile, 'a')
      writeSync(out, `$ pnpm ${args.join(' ')}\n`)
      const code = await new Promise<number>((resolve) => {
        const child = spawn('pnpm', args, { cwd, stdio: ['ignore', out, out] })
        child.on('error', () => resolve(127))
        child.on('close', (exit) => resolve(exit ?? 1))
      })
      closeSync(out)
      if (code !== 0) return { passed: false, step }
    }
    return { passed: true }
  }
})

/** What `claude --resume` prints when it has no saved conversation with the ID. */
const NO_CONVERSATION = /No conversation found with session ID/i

/** The text appended to `file` from byte `from` on. */
const readFrom = (file: string, from: number) => {
  const fd = openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(Math.max(0, statSync(file).size - from))
    readSync(fd, buffer, 0, buffer.length, from)
    return buffer.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

/**
 * Runs `claude -p` unattended (permission checks bypassed, on the session's model, session saved so
 * it can be resumed), with the prompt on stdin and all output appended to the session's log file.
 * Resolves to the exit code; a `claude` that can't be started resolves to 127, a resume that
 * finds no saved conversation resolves to `no-session`, and a session stopped by a usage limit
 * resolves to when that limit resets.
 */
export const createClaude = (): ClaudePort => ({
  run: ({ model, cwd, prompt, sessionId, resume, logFile }) =>
    new Promise((resolve) => {
      mkdirSync(dirname(logFile), { recursive: true })
      const start = existsSync(logFile) ? statSync(logFile).size : 0
      const out = openSync(logFile, 'a')
      const child = spawn(
        'claude',
        [
          '-p',
          resume ? '--resume' : '--session-id',
          sessionId,
          '--model',
          model,
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
        if (code === 0) return resolve(code)
        const output = readFrom(logFile, start)
        if (resume && NO_CONVERSATION.test(output)) return resolve('no-session')
        const resetsAt = usageLimitReset(output, Date.now())
        resolve(resetsAt === null ? code : { usageLimitResetsAt: resetsAt })
      }
      child.on('error', () => finish(127))
      child.on('close', (code) => finish(code ?? 1))
      child.stdin?.on('error', () => {})
      child.stdin?.end(prompt)
    })
})
