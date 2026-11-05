---
name: pr-evidence
description: Capture screenshots or video of UI changes with Playwright and attach them to a pull request. Use when a PR changes anything visible, or when asked for before/after evidence, screenshots, or a recording of a UI change.
---

Produces the **Evidence** section of the `pr` skill's template for visual changes. Capture before and after, publish the files, link them in the PR body.

## 1. Pick the target

- **Whole app:** `pnpm build && pnpm preview` serves on `http://localhost:4173`. For anything that needs the LLM, also start the fake LM Studio so output is deterministic: `FAKE_LM_STUDIO_PORT=1235 FAKE_LM_STUDIO_MODEL=fake-model node src/lib/testing/fake-lm-studio/cli.ts`, and run preview with `LM_STUDIO_BASE_URL=http://127.0.0.1:1235/v1 LM_STUDIO_MODEL=fake-model DATABASE_URL=evidence.db`. Never point at `local.db`.
- **A single component:** `pnpm storybook` serves on `http://localhost:6006`. Use `iframe.html?id=<story-id>&viewMode=story` for a chrome-free capture.

Start servers in the background and stop them when done.

## 2. Capture

```sh
node .claude/skills/pr-evidence/capture.ts --url <url> --out <dir> --name <name> [--flow <file>] [--video] [--full-page] [--width 1280 --height 800]
```

- Without `--flow`, it loads the URL and takes one screenshot, `<dir>/<name>.png`.
- `--flow` is a module whose default export is `async (page) => { ... }`. Use it to click, type, or wait before the shot. Write it in `$CLAUDE_JOB_DIR/tmp`, not the repo.
- `--video` records the flow and saves `<dir>/<name>.webm`. Use video only when the change is motion or a multi-step interaction. A still is easier to review.
- The script runs Chromium headless and fails if the page logs a console error, so a broken page isn't mistaken for evidence.

Write output to `$CLAUDE_JOB_DIR/tmp/evidence/` (or another untracked directory), never into `src/` or `static/`.

## 3. Before and after

1. Capture **after** on the PR branch.
2. `git stash` is unsafe here (shared stack). Instead make a throwaway worktree of the base: `git worktree add $CLAUDE_JOB_DIR/tmp/base <base-branch>`, `pnpm install`, build and serve it on a different port, capture **before** with the same flow and viewport, then `git worktree remove --force` it.
3. Use identical `--name` suffixes (`<feature>-before`, `<feature>-after`), viewport and flow.

New UI with no prior state: say "n/a, new" for Before rather than faking one.

## 4. Publish

`gh` cannot upload images to a PR directly. Commit the files to an orphan branch and link them.

Pushing is outward-facing and the files persist in the repo history. **Confirm with the user before pushing**, and check the captures contain nothing sensitive (no real keys, no personal data).

```sh
git worktree add --detach $CLAUDE_JOB_DIR/tmp/evidence-wt
cd $CLAUDE_JOB_DIR/tmp/evidence-wt
git checkout --orphan pr-evidence 2>/dev/null || git checkout pr-evidence
mkdir -p pr-<number> && cp <captures> pr-<number>/
git add pr-<number> && git commit -m "evidence: PR #<number>" && git push origin pr-evidence
git rev-parse HEAD   # pin links to this SHA
```

If `pr-evidence` already exists on the remote, `git fetch origin pr-evidence` and check it out instead of creating an orphan. Add files only; never rewrite its history.

Link by commit SHA so the images never move:

```markdown
![after](https://github.com/shadowgate15/the-dungeon-master/blob/<sha>/pr-<number>/<name>.png?raw=true)
```

- Images embed for anyone who can view the repo, including private ones.
- `.webm` will not play inline from a blob link. Link it (`[recording](.../<name>.webm?raw=true)`), or if `ffmpeg` is installed convert to a GIF that embeds: `ffmpeg -i in.webm -vf "fps=10,scale=800:-1" out.gif`. Keep GIFs under about 5 MB.

## 5. Put it in the PR

Fill the `pr` skill's Evidence section with the before/after images. Edit an existing body with `gh pr edit <number> --body-file <file>`.

## Checks

- Open each image (Read tool) before linking it. Confirm it shows the change and not a blank page or error.
- Same viewport and data for before and after, so the diff shown is the change.
