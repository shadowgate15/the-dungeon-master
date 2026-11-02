# Research: CI caching for pnpm, Playwright browsers and the build

Issue: shadowgate15/the-dungeon-master#37 (child of #35, "Map: Add a CI workflow").
Date: 2026-11-02. Inputs: the repo's `package.json`, `pnpm-workspace.yaml`, `playwright.config.ts`, `vite.config.ts`; action READMEs and docs from their owning repos; Playwright and GitHub docs.

## Question

What caching is worth having for the pnpm store, Playwright browser downloads and build output, and what are the version/pinning conventions for the actions?

## Recommendation (short)

1. **Cache the pnpm store: yes.** Use `pnpm/action-setup` then `actions/setup-node` with `cache: pnpm`. One line, lockfile-keyed, no custom `actions/cache` step.
2. **Cache Playwright browsers: no for v1.** Playwright's own CI docs advise against it. Install with `playwright install --with-deps` per job that needs a browser.
3. **Cache build output: no.** Nothing in the repo benefits. Reuse the `build` job's output through an artifact only if the map decides e2e should skip its own build (a separate decision, not a cache).
4. **Pinning:** keep it simple for v1 with major-version tags for first-party `actions/*` and `pnpm/action-setup`; revisit SHA pinning when/if Dependabot or Renovate is added (currently out of scope on #35).

## Repo facts that shape the answer

- pnpm 10 is used locally (lockfile `lockfileVersion: '9.0'`). `package.json` has **no `packageManager` field**, so `pnpm/action-setup` needs an explicit `version` (or the design ticket adds the field). `pnpm-workspace.yaml` sets `engineStrict: true` and `onlyBuiltDependencies` (`better-sqlite3`, `esbuild`), so install scripts for native `better-sqlite3` run and need a build toolchain/prebuilt binary on the runner.
- `prepare` runs `husky && svelte-kit sync || echo ''`, so `pnpm install` triggers it. The `|| echo ''` makes failures soft; the workflow design may still want `HUSKY=0` (not verified in CI).
- No `.nvmrc`, `.node-version` or `engines.node` exists. Local Node is 26.x; `@types/node` is `^24`. Per the Node release schedule, v24 is in maintenance (since 2026-10-20) and v26 became LTS on 2026-10-28. The e2e fake LM Studio is launched as `node src/lib/testing/fake-lm-studio/cli.ts` (running TypeScript directly), so the Node pin must support type stripping. This is for the pinning design ticket, noted here because `setup-node` can read the version from `node-version-file`.
- `vite.config.ts` defines three vitest projects: `client` (browser, Chromium via Playwright), `server` (node) and `storybook` (browser, Chromium via Playwright). So **`vitest --run` runs Storybook tests too** and needs Playwright's Chromium, not just the e2e job. This confirms the overlap the map flagged. Consequence: the unit-test job also needs `playwright install --with-deps chromium`.
- `test:e2e` is `playwright install && playwright test` (no `--with-deps`, all browsers). CI should call `playwright test` directly after its own targeted install rather than `pnpm test:e2e`.
- `playwright.config.ts` `webServer` runs `rm -f e2e.db && npm run build && npm run preview` (port 4173) plus the fake LM Studio (port 1235), `workers: 1`, no `retries`, no `reporter` set, no `reuseExistingServer`. It calls `npm run build`, so npm must exist on the runner (it does with Node).
- Resolved Playwright version in the lockfile: 1.64.1 (`^1.60.0` in `package.json`).

## Findings

### pnpm store

- `actions/setup-node` caches the package manager's **global store**, not `node_modules`, and keys it on the lockfile. Supported `cache` values are `npm`, `yarn`, `pnpm` (pnpm >= 6.10). Only npm is auto-enabled (from the `packageManager`/`devEngines.packageManager` field); pnpm needs `cache: pnpm` set explicitly. (https://github.com/actions/setup-node/blob/main/README.md, https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md)
- Ordering: the documented example puts `pnpm/action-setup` **before** `setup-node`, because `setup-node` shells out to `pnpm store path`, which needs pnpm on `PATH`. (The docs show the order; the reason is my inference from how the cache step must locate the store.)
- `pnpm install` adds `--frozen-lockfile` automatically when it detects CI. (setup-node advanced-usage)
- `pnpm/action-setup` also has its own `cache: true` input (default false, keyed on `pnpm-lock.yaml`). Using both would double-cache; pick `setup-node`'s, which is the pattern in `setup-node`'s own docs. (https://github.com/pnpm/action-setup/blob/master/README.md)
- `pnpm/action-setup` `version` accepts an exact version, a range or `latest`, and is optional only when `package.json` has `packageManager`/`devEngines.packageManager`. (same README)
- Worth it: yes. Install is the largest repeated cost (Storybook, Vite, Vitest, Playwright, Tailwind trees) and the cost is one input.

### Playwright browsers

- Playwright's CI docs: "Caching browser binaries is not recommended", because restoring the cache costs about as much as downloading, and Linux OS dependencies cannot be cached anyway. If you do cache, key on the Playwright version. (https://playwright.dev/docs/ci)
- CI install step documented as `npx playwright install --with-deps` (browsers plus system packages). Limiting to `chromium` is allowed by the CLI and fits here: the vitest browser projects configure only `chromium`, and the e2e config declares no `projects`, so it uses Playwright's default (Chromium) browser. (https://playwright.dev/docs/browsers; config facts from repo)
- Default Linux location is `~/.cache/ms-playwright`; `PLAYWRIGHT_BROWSERS_PATH` overrides it. (https://playwright.dev/docs/browsers) Only relevant if caching is ever added later.
- Decision: no cache for v1. If install time later proves painful, add `actions/cache` on `~/.cache/ms-playwright` keyed on `runner.os` + the resolved Playwright version, with `playwright install-deps` always run.

### Build output

- Vite/SvelteKit has no persistent incremental build cache worth restoring across runs; `.svelte-kit/` and `build/` are regenerated by `vite build` in seconds for a repo this size. (Judgement; no primary source claims otherwise. I did not benchmark the build.)
- The real question is **reuse, not caching**: e2e's `webServer` runs its own `npm run build`. If the design wants e2e to reuse the `build` job's output, that is `actions/upload-artifact` / `actions/download-artifact` plus a Playwright config change (command `npm run preview` only), not `actions/cache`. Given e2e also needs `better-sqlite3` and `node_modules`, the saving is small; it is simplest to let e2e rebuild.

### Reports on failure (adjacent, for the e2e-ergonomics item)

- Playwright's CI example uploads `playwright-report/` with `actions/upload-artifact`, guarded by `if: ${{ !cancelled() }}`, 30-day retention, and recommends `workers: 1` on CI (already set in this repo). It does not cover retries. (https://playwright.dev/docs/ci)

### Action versions and pinning

Latest releases at time of writing (GitHub releases API):

| Action | Latest | Notes |
|---|---|---|
| `actions/checkout` | v7.0.1 | first-party |
| `actions/setup-node` | v7.1.0 | runs on Node 24; needs runner >= 2.327.1; recommends `contents: read` |
| `pnpm/action-setup` | v6.1.0 | README examples use `@v6`; supports pnpm up to 12 |
| `actions/cache` | v6.1.0 | not needed if using `setup-node` cache |
| `actions/upload-artifact` | v7.0.2 | Playwright docs example shows `@v5` (docs lag) |

- GitHub's hardening guide ranks: (1) a workflow lockfile if you can adopt one, (2) a full-length commit SHA, (3) tags only if you trust the creator. It frames this around third-party actions and gives no separate guidance for first-party ones. It also notes Dependabot does not alert on SHA-pinned actions, so you need Dependabot version updates to keep SHAs fresh. (https://docs.github.com/en/actions/reference/security/secure-use)
- Implication: SHA pinning is only maintainable with automated updates, which #35 puts out of scope. For v1, major-tag pins (`@v7`, `@v6`) are the pragmatic choice, with `pnpm/action-setup` (third-party) the one candidate for a SHA pin plus a `# v6.1.0` comment if the owner wants stricter handling.
- Set `permissions: contents: read` at workflow level (`setup-node` recommends it).

## Open points for the design ticket (#38)

- Add `packageManager` to `package.json` (single source for pnpm version) or pass `version: 10` to `pnpm/action-setup`.
- Pick the Node pin (v24 vs v26 LTS) and where it lives (`.nvmrc` / `engines`); must support running `.ts` files with `node`.
- Run Playwright Chromium install in both the unit-test and e2e jobs (vitest `client` and `storybook` projects need it).
- Whether e2e reuses `build` output (recommendation: no).
- CI-specific `retries` and `reporter` in `playwright.config.ts` if trace/report artifacts are wanted.
