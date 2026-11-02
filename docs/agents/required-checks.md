# Required checks for `main`

`main` is protected by a repository ruleset that gates merges on CI. The agent does not change repository settings: the maintainer configures the ruleset by hand in the GitHub UI (Settings → Rules → Rulesets).

## Settings

- Target: the default branch (`main`), enforcement active.
- Require a pull request before merging. No direct pushes.
- Required approvals: 0.
- Require branches to be up to date before merging: off (no strict policy).
- Bypass: repository admins, always.

## Required status checks

| Check        | Source workflow                    |
| ------------ | ---------------------------------- |
| `check`      | `.github/workflows/ci.yml`         |
| `lint`       | `.github/workflows/ci.yml`         |
| `unit`       | `.github/workflows/ci.yml`         |
| `build`      | `.github/workflows/ci.yml`         |
| `e2e`        | `.github/workflows/ci.yml`         |
| `commitlint` | `.github/workflows/commitlint.yml` |

These names are contractual. Renaming a job is a breaking change and needs a matching ruleset update.

## Re-applying the ruleset

`required-checks-ruleset.json` in this directory holds the ruleset. To create it on a fresh repo:

```sh
gh api --method POST repos/shadowgate15/the-dungeon-master/rulesets --input docs/agents/required-checks-ruleset.json
```

To update an existing ruleset, look up its id with `gh api repos/shadowgate15/the-dungeon-master/rulesets` and use `--method PUT repos/shadowgate15/the-dungeon-master/rulesets/<id>`.

The committed JSON is hand-authored to GitHub's export schema. After configuring the ruleset in the UI, export it (the ruleset's **Export ruleset** action) and replace the JSON with the real export.
