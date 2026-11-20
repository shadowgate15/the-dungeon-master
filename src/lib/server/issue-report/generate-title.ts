import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

/** Runs `claude` with the given prompt and resolves to its stdout; rejects when `claude` fails. */
export type ClaudeRunner = (prompt: string) => Promise<string>

const MAX_TITLE_LENGTH = 72
const TIMEOUT_MS = 30_000

/**
 * Asks the `claude` CLI, which brings its own authentication, with no tools and no saved session.
 * It runs from a temp directory so it does not load this project's CLAUDE.md, hooks or MCP servers.
 */
export const runClaude: ClaudeRunner = (prompt) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      [
        '-p',
        '--model',
        'haiku',
        '--tools',
        '',
        '--no-session-persistence',
        '--disable-slash-commands',
        '--output-format',
        'text'
      ],
      { cwd: tmpdir(), timeout: TIMEOUT_MS, stdio: ['pipe', 'pipe', 'ignore'] }
    )
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`claude exited with ${code}`))
    )
    child.stdin.on('error', () => {})
    child.stdin.end(prompt)
  })

const prompt = (description: string) =>
  [
    'Write a GitHub issue title for the bug report or request below.',
    `Answer with the title only: one line, imperative, ${MAX_TITLE_LENGTH} characters or fewer, no quotes, no prefix.`,
    '',
    description
  ].join('\n')

const tidy = (text: string) =>
  (text.trim().split('\n')[0] ?? '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()
    .slice(0, MAX_TITLE_LENGTH)

/**
 * A title for the report, written by `claude` from the description alone. When `claude` is
 * missing, fails, or says nothing, the description's first line stands in, so filing never waits on it.
 */
export const generateTitle = async (
  description: string,
  { claude = runClaude }: { claude?: ClaudeRunner } = {}
): Promise<string> => {
  const generated = await claude(prompt(description)).then(tidy, () => '')
  return generated || (description.trim().split('\n')[0] ?? '').trim().slice(0, MAX_TITLE_LENGTH)
}
