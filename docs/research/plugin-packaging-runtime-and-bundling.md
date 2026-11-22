# Packaging the bridge and launcher: runtime and bundling

Research for issue #307, a child of map #288. Gathered 2026-11-22 against Claude Code 2.1.323 (the version installed locally) and the docs at code.claude.com as of that date.

**Question.** How can a Claude Code plugin ship its `bin/` launcher and its stdio bridge so they run straight after a marketplace install, with no install step? The bridge is a stateless TypeScript MCP server. It proxies tools and channel events to a user-level SvelteKit server, and that server owns SQLite through better-sqlite3.

## Answer in short

1. **No JS runtime is guaranteed.** Claude Code ships as a native binary with Bun embedded, but it does not expose that Bun to plugins. The plugin has to require a runtime the user installs, as Anthropic's own channel plugins do (they require Bun). Pick **Node**, declare a minimum version, and have the launcher check it.
2. **Bundle the bridge** with esbuild into one committed ESM file, `bin/dm-bridge.mjs` or `server/dm-bridge.mjs`, with `@modelcontextprotocol/sdk` inlined. Put no `package.json` or lockfile at the plugin root. Then no dependency install runs and no network is needed. The bridge has no native modules, so it bundles cleanly.
3. **The SvelteKit server** can ship as a committed `adapter-node` build. Only its external `dependencies` (better-sqlite3) need a `node_modules`. better-sqlite3 13.x ships prebuilt N-API binaries for 8 platforms inside its npm tarball and has no install script. So either Claude Code's automatic install (which runs `--ignore-scripts`) or a vendored copy works. The alternative is to drop the native module and use `node:sqlite`, which Drizzle supports.
4. **Paths.** Code lives under `${CLAUDE_PLUGIN_ROOT}`. That path is versioned, changes on every update, and is garbage-collected 14 days after it is orphaned. State lives under `${CLAUDE_PLUGIN_DATA}`, which survives updates but is deleted on uninstall. Another option is a user dir such as `~/.dungeon-master`, which survives both.
5. **The launcher is not on the user's terminal PATH.** `bin/` is only added to the Bash tool's PATH inside Claude sessions. A terminal command needs a shim. A SessionStart hook can write one, or the user can be given a one-line install. The shim can resolve the current install path with `claude plugin list --json`.

## 1. What runtime can `bin/` and MCP `command` assume?

### Claude Code itself guarantees no Node or Bun

- The setup docs recommend the native installer. They also list Homebrew, WinGet, apt, dnf and apk packages, none of which need Node. The npm package needs Node 22+ only to install, and "the installed `claude` binary does not itself invoke Node". The system requirements list no Node. ([setup](https://code.claude.com/docs/en/setup))
- The native binary embeds Bun, but plugins cannot use it:
  - [anthropics/claude-code#30465](https://github.com/anthropics/claude-code/issues/30465), "Expose embedded Bun runtime for skill scripts", was closed as stale and not implemented. It notes that native-install users have no `bun` or `node` on PATH.
  - [#24575](https://github.com/anthropics/claude-code/issues/24575) reports that the `BUN_BE_BUN=1` escape hatch stopped working at 2.1.35. Checked locally: `BUN_BE_BUN=1 claude --version` prints `2.1.323 (Claude Code)`, not a Bun version.
  - Windows bugs [#90315](https://github.com/anthropics/claude-code/issues/90315) and [#67801](https://github.com/anthropics/claude-code/issues/67801) show the binary launching its embedded Bun 1.4.1. That confirms Bun is in there but private.

### Commands are resolved from the user's PATH

- An MCP stdio server is launched with the `command` exactly as written. The docs set no runtime requirement, and their examples use `node`, `npx`, `bun` and `uvx`. ([mcp](https://code.claude.com/docs/en/mcp), [plugins reference](https://code.claude.com/docs/en/plugins-reference))
- The LSP docs say it outright: "Claude Code starts `command` by name from the user's PATH". The automatic dependency install likewise runs "the matched lockfile's package manager from the user's PATH". ([plugins reference](https://code.claude.com/docs/en/plugins-reference))

### Mods are not a way around this

The hooks module (mods) runs inside Claude Code with "no Node.js APIs, no timer globals" and no file or network access of its own. Its `$.process.run` and `$.process.spawn` take an argument list with no shell. A mod can start a process, but it is not a JS runtime the bridge or server could run on.

### What published plugins do ([anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official))

- **Channel plugins require Bun.** fakechat, telegram, imessage and discord all declare `"command": "bun", "args": ["run", "--cwd", "${CLAUDE_PLUGIN_ROOT}", "--shell=bun", "--silent", "start"]`. fakechat's `package.json` has `"start": "bun install --no-summary && bun server.ts"`, a `bun.lock`, and a dependency on `@modelcontextprotocol/sdk`. The channels docs state the requirement: "Each supported channel is a plugin that requires Bun", and "Bun installed. The pre-built channel plugins are Bun scripts. Check with `bun --version`." ([channels](https://code.claude.com/docs/en/channels))
- playwright and firebase use `npx`, serena uses `uvx`, and context7 and several others are remote HTTP servers.
- **Conclusion:** first-party practice is to document a runtime prerequisite, not to bundle one.

**Recommendation.** Require Node. better-sqlite3 binaries are built for Node, and `node:sqlite` is a Node API, so the server needs Node anyway. Set the floor at the Node version the server needs. The spike ran on Node 24+, where type stripping lets it run `.ts` directly. With a bundled `.mjs`, Node 22 LTS would be enough for the bridge, and better-sqlite3 13 declares `engines.node >= 22`. The launcher should check `node --version` and fail with a clear message. The bridge is spawned by Claude Code, so if `node` is missing, all the user sees is a failed MCP server in `/mcp`.

## 2. Bundling the bridge into one committed JS file

- Plugin files are copied into the cache verbatim, so a committed `bin/dm-bridge.mjs` runs as `node ${CLAUDE_PLUGIN_ROOT}/bin/dm-bridge.mjs` with nothing else on disk. ([plugin loading](https://code.claude.com/docs/en/plugins-reference))
- **Avoid triggering the automatic dependency install.** It runs only when the plugin root has a `package.json` plus a supported lockfile. Without them it never runs, so there is no network access, no 60-second timeout and no install directory. ([plugins reference, dependency install](https://code.claude.com/docs/en/plugins-reference))
- esbuild: `esbuild src/bridge.ts --bundle --platform=node --format=esm --target=node22 --outfile=plugin/bin/dm-bridge.mjs`. Add `--banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"` in case a CJS dependency calls `require` on a Node builtin.
- **Limits.**
  - Native `.node` addons cannot be inlined into a JS bundle. They have to be marked `external` and resolved from a `node_modules` at runtime.
  - Dynamic `require(variable)` and `import.meta.url`-relative file reads need care.
  - The bridge needs none of these: it is the MCP SDK plus `fetch` to the local server.
- Commit the built file, and add a CI check that rebuilds it and diffs, so it cannot drift from its source. The repo uses pnpm, and the automatic install skips pnpm lockfiles anyway (#290). That is one more reason to ship no lockfile at the plugin root.

## 3. Where the SvelteKit server's build and `node_modules` live

### What adapter-node needs at runtime

The SvelteKit docs ([adapter-node, Deploying](https://github.com/sveltejs/kit/blob/main/documentation/docs/25-build-and-deploy/40-adapter-node.md)) say: "You will need the output directory, the project's `package.json`, and the production dependencies in `node_modules`". They also say "Development dependencies will be bundled into your app ... place it in `devDependencies` or `dependencies` respectively" to bundle or externalise a package. So if everything except better-sqlite3 goes in `devDependencies`, the server's `build/` is self-contained JS plus one external native package. (The repo currently uses `adapter-auto`. It would switch to `@sveltejs/adapter-node`.)

### better-sqlite3 needs no compile step (13.x)

Checked against the npm registry and the 13.2.0 tarball:

| version         | `scripts.install`                                  | tarball contents                                                                |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| 12.4.1          | `prebuild-install \|\| node-gyp rebuild --release` | downloads its binary in an install script                                       |
| 13.0.2 / 13.2.0 | none                                               | `prebuilds/{darwin,linux,linuxmusl,win32}-{x64,arm64}.node`, about 12 MB packed |

- `lib/binding.js` loads `prebuilds/<platform>-<arch>.node` at runtime. It falls back to `build/Release` only if a copy was compiled on purpose.
- `binding.gyp` builds with `NAPI_VERSION=10`, so a single binary works across Node versions.
- The repo already depends on `better-sqlite3 ^13.0.2`.
- **Consequence.** The automatic dependency install runs with `--ignore-scripts`, and the docs warn that native modules "download but don't compile". That warning does not bite here: 13.x needs no script. Unsupported platforms (for example FreeBSD or 32-bit) would fail.

### Options, in order of preference

- **A. Vendor it.** Commit `server/build/` plus `server/node_modules/better-sqlite3/` (only `lib/`, `package.json` and the prebuilds, minus `deps/` and `src/`). No install, no network. It costs about 12 MB of binaries in the repo, or less if trimmed to the platforms you support. Updates replace it atomically with the version dir.
- **B. Use the automatic install.** Put `package.json` and `package-lock.json` at the plugin root (npm lockfileVersion 2 or 3, exact registry versions), listing only `better-sqlite3`. It runs at install, at update, and at session start when the plugin isn't cached yet. Its `node_modules` land in the version dir. ([plugins reference](https://code.claude.com/docs/en/plugins-reference))
  - Limits: registry packages only, https only, frozen resolution, no `overrides`, a 60-second timeout, and it cannot be disabled.
  - It needs npm on PATH, which comes with Node.
  - It adds a network dependency at install time, which sits badly with local-first.
- **C. Drop the native module.**
  - `node:sqlite` is built into Node. It was added in v22.5.0, has been unflagged since v22.13.0 and v23.4.0, and became a "Release candidate" (Stability 1.2) in v25.7.0. ([Node docs](https://nodejs.org/api/sqlite.html))
  - Drizzle supports it with `drizzle-orm/node-sqlite` and `DatabaseSync`. It also supports `bun:sqlite`. ([Drizzle SQLite docs](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/sqlite/get-started-sqlite.mdx))
  - With this, the whole server bundles to plain JS and needs no `node_modules` at all.
  - Cost: the Node floor rises to 22.13+, and the driver is less mature than better-sqlite3.
- **D. The data-dir pattern.** The docs' fallback: a SessionStart hook diffs `package.json` into `${CLAUDE_PLUGIN_DATA}` and runs `npm install` there, and the server runs with `NODE_PATH=${CLAUDE_PLUGIN_DATA}/node_modules`. It is meant for packages that need lifecycle scripts or pnpm/yarn. It is not needed here, and it brings the network back.

**Recommendation.** Use A now, and evaluate C as a follow-up. C makes packaging trivial: two committed bundles and zero `node_modules`.

## 4. Paths: `${CLAUDE_PLUGIN_ROOT}` and the data dirs

Source: [plugins reference, environment variables and caching](https://code.claude.com/docs/en/plugins-reference) and the [plugin CLI reference](https://code.claude.com/docs/en/plugins/cli-reference).

- **`${CLAUDE_PLUGIN_ROOT}`** is `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`.
  - It is a new directory per version, and the docs say not to write state there.
  - Old versions get an `.orphaned_at` marker and are deleted 14 days later.
  - A session that started before an update keeps the old path until `/reload-plugins`.
- **`${CLAUDE_PLUGIN_DATA}`** is `~/.claude/plugins/data/<id>/`.
  - `<id>` is `name@marketplace` with every character other than `[A-Za-z0-9_-]` replaced by `-`, so `dm@dm-local` becomes `dm-dm-local`.
  - It is created on first reference and survives updates.
  - It is deleted when the plugin is uninstalled from its last scope, unless the user runs `claude plugin uninstall --keep-data`.
- Both roots move if `CLAUDE_CODE_PLUGIN_CACHE_DIR` is set.
- Both variables are substituted in stdio MCP `command`, `args` and `env`, and exported to MCP, LSP and hook processes. They are **not** in the Bash tool's environment, and **not** exported to monitors.
- Only files inside the plugin dir are copied. `..` paths and symlinks pointing out are rejected, so the server cannot live at `../server` the way the spike had it. It must sit inside the plugin root.
- A relative-path plugin in a marketplace added from a local folder loads in place, with no copy and no dependency install. That is handy for development, but it is not what users get.

**Where things go:**

- Code (bridge bundle, server build, vendored better-sqlite3) goes in `${CLAUDE_PLUGIN_ROOT}`.
- The SQLite DB, `runtime.json` (port and token) and logs should go in a user dir such as `~/.dungeon-master/`. `${CLAUDE_PLUGIN_DATA}` would be deleted by a plain uninstall and lose a campaign. If you choose `${CLAUDE_PLUGIN_DATA}` anyway, document `--keep-data`. The launcher cannot read `${CLAUDE_PLUGIN_DATA}` from the environment (see section 5), so it would have to compute the path from the rule above.

## 5. The launcher

- "Files in `bin/` ... are on the `PATH` of the Bash tool's shell while the plugin is enabled", after the user's own PATH entries. They are **not** on the user's terminal PATH. claude.ai and Cowork refuse to install a plugin that has a top-level `bin/`. ([plugins reference, bin](https://code.claude.com/docs/en/plugins-reference))
- So "run `dungeon-master` after install" needs something extra:
  - **SessionStart hook shim.** It writes `~/.local/bin/dungeon-master`, a tiny script that `exec`s the current version's launcher. It runs on the first session after install, so it does not cover the very first run.
  - **Documented bootstrap.** For example `claude plugin install dm@... && "$(claude plugin list --json | jq -r '...installPath')/bin/dungeon-master"`, or an alias.
- `claude plugin list --json` returns one object per install, always with `id`, `version`, `scope`, `enabled` and `installPath`. The shim should resolve `installPath` on every run rather than hard-code a version dir, so it always launches the current version. ([CLI reference](https://code.claude.com/docs/en/plugins/cli-reference))
- **Detached server spawn.** Use `spawn(process.execPath, [serverEntry], { detached: true, stdio: ['ignore', log, log] }).unref()`, as in the spike. The launcher is a shell script but already needs Node, so doing this through `node -e` is fine.
- **Version skew.** After an update, a running detached server keeps executing from the orphaned version dir, and that dir is deleted 14 days later. The launcher should compare the running server's reported version (in `runtime.json` or `/health`) with its own plugin version, and restart the server on a mismatch when no session is attached. The bridge should tolerate a server one version older.
- Spike requirements from #298 still hold:
  - install from a marketplace (`--plugin-dir` is rejected for channels)
  - `--dangerously-load-development-channels plugin:<name>@<marketplace>`, because channels are allowlist-only
  - project-scope installs are per folder
  - refuse a second session
  - the bridge answers MCP protocol version 2025-06-18

## Open questions

- Should SQLite state live in `${CLAUDE_PLUGIN_DATA}` (cleaned up on uninstall) or in `~/.dungeon-master` (survives uninstall)? This is a product call. The research leans toward the user dir.
- Is `node:sqlite` with Drizzle good enough to drop better-sqlite3? That needs a spike against the existing schema and migrations.
- Not verified: whether Claude Code provides a Node runtime for `.mcpb` bundles in `mcpServers` (they extract to `~/.claude/plugins/mcpb/` from v2.1.324). Claude Desktop does provide one. If Claude Code does too, MCPB could remove the Node prerequisite for the bridge, though not for the server. MCPB is also skipped for project-scope repository plugins.
- How should the shim cover the very first run, before any SessionStart hook has fired?
