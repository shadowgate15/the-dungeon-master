# CI needs of each test script (research for #36, map #35)

Planning input only. No workflow files. Repo state: `main` at 88e4acb. `docs/` has no prior research-note convention, so this lives in `docs/research/`.

## Answer in brief

| Script | Browser + OS deps? | Notes |
| --- | --- | --- |
| `vitest --run`, `server` project | No | Plain Node (`environment: 'node'`). |
| `vitest --run`, `client` project | **Yes**: Chromium | `@vitest/browser-playwright`, `chromium`, `headless: true`. |
| `vitest --run`, `storybook` project | **Yes**: Chromium | Same provider. **Runs under a plain `vitest --run`**; `test:unit` has no `--project` filter. |
| `playwright test` (e2e) | **Yes**: Chromium | No `projects` in config, so Playwright's default browser (Chromium). Also needs the fake LM Studio and a `vite build`. |
| `check`, `lint`, `build` | No | |

- Run `npx playwright install --with-deps chromium` in each job that runs browser tests. Chromium alone is enough: every browser instance in `vite.config.ts` is `chromium`, and `playwright.config.ts` defines no other project.
- `better-sqlite3` needs **no native build step** on its prebuilt platforms (Linux/macOS/Windows, x64/arm64).
- Node: **pin Node 24 (LTS)**. Hard floor from dependencies is `>=22.22.1`; see below.

## Browsers

Evidence in repo:

- `vite.config.ts`: `client` project has `browser.enabled: true`, `provider: playwright()`, instance `chromium`, headless. `storybook` project has `browser.enabled: true`, `provider: playwright({})`, instance `chromium`, headless. `server` project uses `environment: 'node'`.
- `test:unit` is `vitest`, and `test` runs `npm run test:unit -- --run && npm run test:e2e`, so there is no project filter: all three projects run. This confirms the overlap the map flagged: stories are tested by `vitest --run`. A dedicated Storybook job stays out of scope.
- The `storybook` project uses `storybookTest({ configDir: '.storybook' })`. `.storybook/main.ts` picks up `src/**/*.stories.*` (3 stories under `src/stories/`). No `storybook build` is needed first; Storybook's docs only ask for a published Storybook if `storybookUrl` is set (it is not).
- `test:e2e` is `playwright install && playwright test`. A bare `playwright install` downloads Chromium, Firefox and WebKit, but nothing uses Firefox or WebKit. It also omits `--with-deps`, so a bare Linux runner may lack OS libraries. In CI, use an explicit `playwright install --with-deps chromium` step and run `playwright test` directly (not via `test:e2e`).
- e2e files: 8 `src/routes/*.e2e.ts`, `testMatch: '**/*.e2e.{ts,js}'`, `workers: 1`.

Sources:

- Playwright CI doc (https://playwright.dev/docs/ci): CI steps are `npm ci`, `npx playwright install --with-deps`, `npx playwright test`; `--with-deps` installs browsers plus OS dependencies. It says "Caching browser binaries is not recommended" (restore takes about as long as the download, and Linux OS deps cannot be cached). Upload `playwright-report/` with `if: ${{ !cancelled() }}`.
- Vitest browser mode (https://vitest.dev/guide/browser/): "to run tests in CI you need to install" Playwright or WebdriverIO. The Playwright provider page (https://vitest.dev/guide/browser/playwright) requires only the `@vitest/browser-playwright` package and gives no install command. The binaries come from the `playwright` CLI, so one install step serves both Vitest and Playwright Test (both resolve to the same `playwright` 1.64.1 in `pnpm-lock.yaml`).
- Storybook Vitest addon (https://storybook.js.org/docs/writing-tests/integrations/vitest-addon): browsers "are required for running tests in browser mode"; the `test` script runs all projects including Storybook; `--project=storybook` runs only stories. For flaky "Failed to fetch dynamically imported module" errors it suggests `isolate: false` or `vitest run --shard=1/3`.

Implications for the job layout (#38):

- Any job running `vitest --run` (client + storybook) and the e2e job each need the browser step. Do not bother caching browsers (Playwright's own advice).
- `vitest --run --project server` needs no browser, but dropping client and storybook coverage is not recommended for v1.
- e2e runs its own build through `webServer`: `rm -f e2e.db && npm run build && npm run preview` on port 4173, with no `reuseExistingServer`. Reusing a `build` job's output would require a repo change; that is a separate open question on the map.
- e2e also starts `node src/lib/testing/fake-lm-studio/cli.ts` on port 1235 and uses `DATABASE_URL=e2e.db`. No model, no services.

## better-sqlite3

- Locked at 13.0.3 (`pnpm-lock.yaml`), `engines.node >= 22`.
- Its `package.json` (https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/package.json) has `"gypfile": false`, no `install` script, and ships `prebuilds/**` in `files`. `exports` lists `linux-x64`, `linux-arm64`, `linuxmusl-x64`, `linuxmusl-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64`, `win32-arm64`. Prebuilt binaries come in the npm tarball, so there is no download and no `node-gyp` compile on those platforms.
- Compiling is only for custom SQLite amalgamations (https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/docs/compilation.md). Not our case.
- `pnpm-workspace.yaml` lists `better-sqlite3` and `esbuild` in `onlyBuiltDependencies`. Harmless for better-sqlite3 here; keep it (esbuild's postinstall). CI needs no `pnpm rebuild` and no compiler toolchain on `ubuntu-latest`.
- Not verified by running on a CI runner; I inferred it from the package manifest. The first CI run on `ubuntu-latest` (x64) will confirm.

## Node version

`pnpm-workspace.yaml` sets `engineStrict: true`, so `pnpm install` fails when Node violates any dependency's `engines`. Highest floors in `pnpm-lock.yaml`:

| Package | engines.node |
| --- | --- |
| `lint-staged@17.6.0` | `>=22.22.1` (highest) |
| `@sveltejs/kit@3.1.1` | `>=22.17` |
| 17 packages | `>=22.12.0` |
| `better-sqlite3@13.0.3` | `>=22` |
| `vite@8.3.5` | `^20.19.0 \|\| >=22.12.0` |
| `eslint@10.14.0` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| `vitest@4.1.12` | `^20 \|\| ^22 \|\| >=24` |
| `@playwright/test`, `playwright` 1.64.1 | `>=20` |

Hard floor: **Node >= 22.22.1**. eslint excludes 23.x, so use 22 or 24+.

Type stripping for `node src/lib/testing/fake-lm-studio/cli.ts` (https://nodejs.org/api/typescript.html): on by default from v23.6.0 and v22.18.0; stable from v25.2.0 / v24.12.0 (per the page's version history). Anything >= 22.22.1 satisfies it. Restrictions are erasable syntax only, `.ts` extensions in imports, and `type` keyword on type-only imports. Audited: `cli.ts` imports `./server.ts`; `server.ts` imports only `node:http` and `node:net` with `type` modifiers. Compliant.

The repo pins no Node version (no `.nvmrc`, `.node-version`, `engines`, or `packageManager` field). Recommendation: Node 24 in the workflow (`actions/setup-node` `node-version: 24`, or a new `.node-version` read via `node-version-file`). It is LTS, clears every floor, has stable type stripping, and matches `@types/node ^24`. Node 22.22.1+ would also work but sits at lint-staged's floor.

pnpm itself is also unpinned (no `packageManager` field), so #38 should decide how the workflow selects the pnpm version.

## Open items for other tickets

- Whether e2e reuses the build job's output (the `webServer` command hard-codes `npm run build`).
- Where the Node version is pinned (workflow vs `.node-version`), and how pnpm's version is chosen.
