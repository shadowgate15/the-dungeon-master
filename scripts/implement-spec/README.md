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

`--explore` is accepted but does nothing yet.

## The run directory

`.implement-spec/<spec#>/` at the main repository root, gitignored:

| Path         | Contents                                                       |
| ------------ | -------------------------------------------------------------- |
| `state.json` | The integration branch and worktree, and each ticket's status. |
| `notes/`     | Shared notes for the run's sessions.                           |
| `logs/`      | One log per session.                                           |

## Re-running

Running the command again for the same spec reuses the integration branch, its worktree and the state file. Tickets already in the state keep their status; tickets added to the spec since the last run are added as `pending`. To start over, delete `.implement-spec/<spec#>/`, the integration worktree and the `implement-spec/<spec#>` branch.

## Code

- `main.ts`: parses arguments, builds the real ports and calls `runSpec`.
- `run-spec.ts`: `runSpec(spec, options, ports)`, the whole run behind the tracker and git ports.
- `ports.ts`: the real ports, thin wrappers over `gh` and `git`.
- `run-spec.spec.ts`: whole runs against fake ports and a temp repository root.
