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
5. Launches every ready ticket at once, with no concurrency cap. Implementers that pass the done check join a FIFO merge queue, and only one merger runs at a time. After each merge the frontier is recomputed and newly ready tickets launch straight away. The run ends when nothing is running, queued or ready.
6. Implementing a ticket: cuts its branch `implement-spec/<spec#>-<ticket#>` from the integration tip into its own worktree under `.claude/worktrees/`, records that launch commit and a fresh session ID in the state file, and runs an implementer `claude -p` session there (permission checks bypassed, default model). The session's output goes to its log, never the console.
7. Runs the done check on the implementer: it exited 0, its branch has commits beyond the launch commit, and the branch still contains the launch commit. A pass marks the ticket `implemented`; anything else marks it `failed`, keeps its worktree, and names the failed check and the log on the console. A failed ticket's dependents never launch; independent tickets carry on.
8. Merging an implemented ticket: records a fresh session ID and runs a merger `claude -p` session in the integration worktree to merge the ticket branch. It passes when it exits 0 and the integration branch contains the ticket branch's head. A pass marks the ticket `done` and removes its worktree (the branch is kept). The first pass also opens a draft PR from the integration branch into `main`, with the body `Closes #<spec#>` followed by one `Closes #<ticket#>` line per ticket, and records its number in the state file; a re-run reuses that PR. The script never closes issues itself: merging the PR does. A failure (`nonzero-exit` or `not-merged`) leaves the ticket `implemented` with its worktree, names the log, and stops new launches and merges; sessions already running finish.

9. Finishing the run, only once every ticket is `done`: a reviewer session runs `/code-review` on `main...implement-spec/<spec#>` and writes its findings to `notes/review.md`; a fixer session fixes all of them with `tdd`; a PR-writer session writes the PR description with the `pr` skill to `pr-body.md` in the run directory. All three run in the integration worktree. The script then appends any `Closes #<spec#>` or `Closes #<ticket#>` line missing from that file, replaces the PR body from it, marks the PR ready and removes the integration worktree (the branch is kept). Each finished step (`review`, `fix`, `pr-description`, `ready`) is recorded under `steps` in the state file and skipped on a re-run. A session that exits non-zero (or a PR writer that leaves no `pr-body.md`: `no-pr-body`) fails its step, names its log and ends the run with the PR still a draft.

The run exits non-zero when any implementer, merger or end-of-run step failed. A run with a failed ticket skips the end-of-run steps, so the PR stays a draft with its minimal body and nothing else is written to GitHub. It ends by printing `failed tickets:` followed by one line per failed ticket, with the session that failed, its check and its log. Nothing is retried within a run.

With `--explore`, one explorer `claude -p` session runs in the integration worktree before any implementer and writes Markdown notes to the run's `notes/` directory, which every later prompt points at. Its session and status are recorded under `steps.explore` in the state file; once it is `done`, re-runs skip it. A failed explorer (non-zero exit) ends the run before any implementer launches. Without the flag no explorer runs.

## The run directory

`.implement-spec/<spec#>/` at the main repository root, gitignored:

| Path         | Contents                                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state.json` | The integration branch and worktree, each ticket's status, launch commit, and implementer and merger sessions (ID and outcome), each step not tied to a ticket (`steps.explore`, `review`, `fix`, `pr-description`, `ready`), and the PR number (`pr`). |
| `notes/`     | Shared notes for the run's sessions, including the explorer's.                                                                                                                                                                                          |
| `pr-body.md` | The PR description the PR writer wrote, with any missing `Closes` lines appended.                                                                                                                                                                       |
| `logs/`      | One log per session: `<role>-<ticket#>.log`, or `<role>.log` for a role not tied to a ticket (`explorer.log`, `reviewer.log`, `fixer.log`, `pr-writer.log`).                                                                                            |

## Re-running

Running the command again for the same spec reuses the integration branch, its worktree, the state file and the PR. Tickets already in the state keep their status; tickets added to the spec since the last run are added as `pending`.

Every `claude` session starts with a fresh script-generated `--session-id`, written to the state file before it launches, and never with `--no-session-persistence`. A re-run resumes every session that didn't complete, instead of starting it fresh: one left running when the previous run stopped, or one that ended failed. It runs `claude -p --resume <id>` in the session's original directory (the ticket worktree for an implementer, the integration worktree for the explorer, mergers and end-of-run roles) and logs to the same file, with a short continue prompt: the previous session didn't complete, the reason the script recorded (interrupted, the exit code, or the failed done check), then the original prompt with its pointers. When it exits, the same done check runs again. Each resume prints `resumed …` in place of `launched …`.

In order, a re-run:

1. Resumes the explorer, with `--explore`, if it didn't complete.
2. Resumes each merger that didn't complete, one at a time, before anything else launches. If one fails again, the run stops there.
3. Queues tickets left `implemented` with no merger for merging.
4. Resumes implementers that didn't complete, their tickets going back to `running`, alongside launching the ready frontier. A resumed ticket's dependents launch once it merges.
5. Resumes the first end-of-run step that didn't complete; finished steps are skipped.

A re-run after the PR was marked ready (`steps.ready` is `done`) does nothing: it prints that the spec is finished and exits 0, without reading GitHub or recreating the integration worktree.

To start over, delete `.implement-spec/<spec#>/`, the integration worktree and the `implement-spec/<spec#>` branch.

## Code

- `main.ts`: parses arguments, builds the real ports and calls `runSpec`.
- `run-spec.ts`: `runSpec(spec, options, ports)`, the whole run behind the tracker, git and claude ports.
- `prompts.ts`: each role's prompt, pointers plus the role's instructions.
- `ports.ts`: the real ports, thin wrappers over `gh`, `git` and `claude`.
- `run-spec.spec.ts`: whole runs against fake ports and a temp repository root.
