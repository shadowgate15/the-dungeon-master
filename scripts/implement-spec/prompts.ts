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

/** Where the reviewer writes its findings, inside the notes directory, for the fixer to read. */
export const reviewFindings = (pointers: Pointers) => `${pointers.notes}/review.md`

export const reviewerPrompt = (pointers: Pointers) =>
  [
    `You are the reviewer for spec #${pointers.spec}. Every ticket has been merged into the integration branch.`,
    ...pointerLines(pointers),
    `This directory is the integration worktree, with ${pointers.integrationBranch} checked out.`,
    '',
    `1. Call the Skill tool with \`code-review\` on \`main...${pointers.integrationBranch}\`, against the spec and its tickets.`,
    `2. Write every finding to ${reviewFindings(pointers)}, each with the file, the problem and the fix it needs, so a fixer can act on them without re-reviewing.`,
    'Do not change any code, push, open pull requests, or change anything on GitHub.'
  ].join('\n')

export const fixerPrompt = (pointers: Pointers) =>
  [
    `You are the fixer for spec #${pointers.spec}.`,
    ...pointerLines(pointers),
    `This directory is the integration worktree, with ${pointers.integrationBranch} checked out.`,
    `Review findings: ${reviewFindings(pointers)}.`,
    '',
    '1. Read the review findings.',
    '2. Call the Skill tool with `tdd` and fix every finding in one coherent pass.',
    '3. Commit your work with conventional commit messages.',
    '4. Run the lint, type-check and unit tests, and fix anything that fails.',
    'Do not push, open pull requests, or change anything on GitHub.'
  ].join('\n')

export const prWriterPrompt = (pointers: Pointers, { bodyFile }: { bodyFile: string }) =>
  [
    `You are the PR writer for spec #${pointers.spec}.`,
    ...pointerLines(pointers),
    `This directory is the integration worktree, with ${pointers.integrationBranch} checked out.`,
    '',
    `1. Call the Skill tool with \`pr\` and write the pull request description for \`main...${pointers.integrationBranch}\`.`,
    `2. Write the description, and only the description, to ${bodyFile}. End it with \`Closes #${pointers.spec}\` and one \`Closes #<ticket>\` line per ticket.`,
    'Do not push, open or edit pull requests, or change anything on GitHub.'
  ].join('\n')
