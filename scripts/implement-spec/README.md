# implement-spec

A dev-only command that runs a spec's tickets as a deterministic loop, instead of a long-lived agent orchestrating them (ADR 0004: dev tooling may call the `claude` CLI directly).

```sh
pnpm implement-spec <spec#> [--explore]
```

Run it from any checkout or worktree of this repository. It resolves the main repository root from git's common directory, so the run directory and worktrees always land in the same place.

## What it does

1. Reads the spec's open sub-issues and their native GitHub `blocked_by` relationships through `gh`, once per invocation.
2. Creates the integration branch `implement-spec/<spec#>` from `main`, in its own worktree under `.claude/worktrees/`.
3. Creates the run directory and a state file listing every ticket as `pending`.
4. Prints the ready frontier: every open ticket whose blockers are all closed on GitHub or `done` in the state file.
5. Implements the first ready ticket: cuts its branch `implement-spec/<spec#>-<ticket#>` from the integration tip into its own worktree under `.claude/worktrees/`, records that launch commit and a fresh session ID in the state file, and runs an implementer `claude -p` session there (permission checks bypassed, default model). The session's output goes to its log, never the console.
6. Runs the done check on the session: it exited 0, its branch has commits beyond the launch commit, and the branch still contains the launch commit. A pass marks the ticket `implemented`; anything else marks it `failed`, keeps its worktree, and names the failed check and the log on the console.

With `--explore`, one explorer `claude -p` session runs in the integration worktree before any implementer and writes Markdown notes to the run's `notes/` directory, which every later prompt points at. Its session and status are recorded under `steps.explore` in the state file; once it is `done`, re-runs skip it. A failed explorer (non-zero exit) ends the run before any implementer launches. Without the flag no explorer runs.

## The run directory

`.implement-spec/<spec#>/` at the main repository root, gitignored:

| Path         | Contents                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state.json` | The integration branch and worktree, each ticket's status, launch commit and session (ID and outcome), and each step not tied to a ticket (`steps.explore`). |
| `notes/`     | Shared notes for the run's sessions, including the explorer's.                                                                                               |
| `logs/`      | One log per session: `<role>-<ticket#>.log`, or `<role>.log` for a role not tied to a ticket (`explorer.log`).                                               |

## Re-running

Running the command again for the same spec reuses the integration branch, its worktree and the state file. Tickets already in the state keep their status; tickets added to the spec since the last run are added as `pending`. To start over, delete `.implement-spec/<spec#>/`, the integration worktree and the `implement-spec/<spec#>` branch.

## Code

- `main.ts`: parses arguments, builds the real ports and calls `runSpec`.
- `run-spec.ts`: `runSpec(spec, options, ports)`, the whole run behind the tracker, git and claude ports.
- `prompts.ts`: each role's prompt, pointers plus the role's instructions.
- `ports.ts`: the real ports, thin wrappers over `gh`, `git` and `claude`.
- `run-spec.spec.ts`: whole runs against fake ports and a temp repository root.
