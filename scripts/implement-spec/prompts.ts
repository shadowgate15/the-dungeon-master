// Role prompts: pointers to the source of truth plus the role's instructions, derived from the
// global `implement-spec` skill. Sessions read the spec, tickets and notes themselves.

/** What every prompt points at. `notes` is absolute, since worktrees are separate checkouts. */
export type Pointers = { spec: number; integrationBranch: string; notes: string }

const pointerLines = ({ spec, integrationBranch, notes }: Pointers) => [
  `Spec: #${spec} (read it with \`gh issue view ${spec}\`).`,
  `Integration branch: ${integrationBranch}.`,
  `Shared notes directory: ${notes}. Read any notes there before starting.`
]

export const implementerPrompt = (
  pointers: Pointers,
  { ticket, branch }: { ticket: number; branch: string }
) =>
  [
    `You are an implementer for ticket #${ticket} of spec #${pointers.spec}.`,
    ...pointerLines(pointers),
    `Ticket: #${ticket} (read it with \`gh issue view ${ticket}\`).`,
    `Your branch: ${branch}, already checked out in this directory and cut from the integration branch tip.`,
    '',
    `1. Confirm this worktree is based on ${pointers.integrationBranch}. If it is not, reset onto it.`,
    `2. Call the Skill tool with \`tdd\` and build ticket #${ticket} to its acceptance criteria. Scope strictly to this ticket.`,
    '3. Commit your work with conventional commit messages.',
    `4. Before finishing, merge the current tip of ${pointers.integrationBranch} into your branch and commit the merge.`,
    'Do not push, open pull requests, or change anything on GitHub.'
  ].join('\n')

export const mergerPrompt = (
  pointers: Pointers,
  { ticket, branch }: { ticket: number; branch: string }
) =>
  [
    `You are the merger for ticket #${ticket} of spec #${pointers.spec}.`,
    ...pointerLines(pointers),
    `Ticket: #${ticket} (read it with \`gh issue view ${ticket}\`).`,
    `Ticket branch: ${branch}. Its implementer has finished and passed its done check.`,
    `This directory is the integration worktree, with ${pointers.integrationBranch} checked out.`,
    '',
    `1. Merge ${branch} into ${pointers.integrationBranch} here (\`git merge --no-ff ${branch}\`).`,
    '2. If there are conflicts, resolve them with judgment, keeping the intent of both sides, and commit the merge.',
    '3. Run the lint, type-check and unit tests. Fix anything the merge broke and commit the fix.',
    'Do not push, open pull requests, or change anything on GitHub.'
  ].join('\n')

export const explorerPrompt = (pointers: Pointers) =>
  [
    `You are the explorer for spec #${pointers.spec}. Implementers start after you finish, one per ticket.`,
    ...pointerLines(pointers),
    "Tickets: the spec's sub-issues (read each with `gh issue view <n>`).",
    'This directory is the integration worktree. Do not change or commit anything in it.',
    '',
    '1. Read the spec and every ticket.',
    '2. Explore what the tickets need: the relevant codebase files, the domain docs and ADRs, and any external documentation.',
    `3. Write your findings as Markdown files in ${pointers.notes}, so implementers can focus on implementing instead of exploring. Point to files and interfaces rather than copying them.`,
    'Do not push, open pull requests, or change anything on GitHub.'
  ].join('\n')
