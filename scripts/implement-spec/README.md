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
5. Works through the ready tickets one at a time, recomputing the frontier after each merge, until nothing is ready or a merger fails.
6. Implementing a ticket: cuts its branch `implement-spec/<spec#>-<ticket#>` from the integration tip into its own worktree under `.claude/worktrees/`, records that launch commit and a fresh session ID in the state file, and runs an implementer `claude -p` session there (permission checks bypassed, default model). The session's output goes to its log, never the console.
7. Runs the done check on the implementer: it exited 0, its branch has commits beyond the launch commit, and the branch still contains the launch commit. A pass marks the ticket `implemented`; anything else marks it `failed`, keeps its worktree, and names the failed check and the log on the console. A failed ticket's dependents never launch; independent tickets carry on.
8. Merging an implemented ticket: records a fresh session ID and runs a merger `claude -p` session in the integration worktree to merge the ticket branch. It passes when it exits 0 and the integration branch contains the ticket branch's head. A pass marks the ticket `done` and removes its worktree (the branch is kept). A failure (`nonzero-exit` or `not-merged`) leaves the ticket `implemented` with its worktree, names the log, and stops the run.

The run exits non-zero when any implementer or merger failed.

`--explore` is accepted but does nothing yet.

## The run directory

`.implement-spec/<spec#>/` at the main repository root, gitignored:

| Path         | Contents                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `state.json` | The integration branch and worktree, and each ticket's status, launch commit, and implementer and merger sessions (ID and outcome). |
| `notes/`     | Shared notes for the run's sessions.                                                                                                |
| `logs/`      | One log per session: `<role>-<ticket#>.log`.                                                                                        |

## Re-running

Running the command again for the same spec reuses the integration branch, its worktree and the state file. Tickets already in the state keep their status; tickets added to the spec since the last run are added as `pending`. To start over, delete `.implement-spec/<spec#>/`, the integration worktree and the `implement-spec/<spec#>` branch.

## Code

- `main.ts`: parses arguments, builds the real ports and calls `runSpec`.
- `run-spec.ts`: `runSpec(spec, options, ports)`, the whole run behind the tracker, git and claude ports.
- `prompts.ts`: each role's prompt, pointers plus the role's instructions.
- `ports.ts`: the real ports, thin wrappers over `gh`, `git` and `claude`.
- `run-spec.spec.ts`: whole runs against fake ports and a temp repository root.
