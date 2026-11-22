# Research: what a Claude Code plugin can package

Issue: shadowgate15/the-dungeon-master#290 (child of #288, the map for reimagining the DM as a Claude Code plugin).
Date: 2026-11-22. Sources: the Claude Code docs at code.claude.com (fetched today) and the `anthropics/claude-plugins-official` repository. Local Claude Code is v2.1.323. Some features below need a later version, and each one says which.

## Question

What can a Claude Code plugin ship and configure: skills, subagents, hooks, MCP servers (stdio and HTTP), output styles, slash commands, settings and tool permissions (can a plugin pre-allow its own MCP tools?), and can it start a long-running local process such as a web server? How do install and update work through a marketplace, and what limits each component?

## Answer (short)

- **What a plugin can ship:** skills, commands (the older format), subagents, hooks, MCP servers (stdio, HTTP, SSE, WS, or `.mcpb` bundles), LSP servers, output styles, themes, monitors, workflows, `bin/` executables, `userConfig` prompts, channels, and mods (JS hooks that run inside Claude Code). Everything is namespaced under the plugin name. [manifest], [components]
- **Settings and permissions: a plugin can't ship them.** The component list has no settings file and no `permissions` key, so a plugin can't add `permissions.allow` rules by declaring them. It can still avoid prompts for its own tools in three ways:
  1. A plugin `PreToolUse` hook can return `permissionDecision: "allow"` for `mcp__plugin_<plugin>_<server>__*`. Deny and ask rules still win. [hooks-pretool]
  2. A skill's `allowed-tools` grants tools, but only for the turn that invoked the skill. [skills-allowed]
  3. A mod can approve a tool call before the user is asked. [mods-overview]

  Otherwise the user or project adds `mcp__plugin_<plugin>_<server>__*` to their own `permissions.allow`. [permissions-mcp]

- **Long-running local web server: yes.** The supported pattern is a stdio MCP server that also serves HTTP or WebSocket. The official `fakechat` plugin does exactly this: its MCP server runs `Bun.serve` on `localhost:8787` and pushes browser input into the session as channel events. Claude Code starts plugin MCP servers automatically at session start and stops them when the session ends. Monitors, `async` hooks and mod `$.process.spawn` are other ways to start a process. [mcp-plugin], [fakechat]
- **Channels have a hard limit for us.** During the research preview, `--channels` only registers plugins on an Anthropic-maintained allowlist (the channel plugins in `claude-plugins-official`) or an org's `allowedChannelPlugins`. A channel from our own marketplace needs `--dangerously-load-development-channels plugin:<name>@<marketplace>` and a confirmation prompt on every launch. Channels also need claude.ai or Console auth, and they're unavailable on Bedrock, Agent Platform and Foundry. [channels], [channels-ref]
- **Install and update:** users add a marketplace (`/plugin marketplace add owner/repo`) and install `name@marketplace` at user, project or local scope. Background auto-update is off by default for third-party marketplaces. When it's on, it runs up to 10 minutes after the first message, and changes apply after `/reload-plugins` or the next launch. A pinned `version` in `plugin.json` holds users on that version until you change it. [install], [loading-updates]

## Findings by component

Default locations are relative to the plugin root. Only `.claude-plugin/plugin.json` lives in `.claude-plugin/`. [manifest-layout]

### Manifest (`.claude-plugin/plugin.json`)

- Optional. `name` (kebab-case) is the only required field. Names starting with `claude-`, `anthropic-` or `cc-plugin-` are reserved. [manifest-name]
- Unknown top-level keys are stripped with a warning. Unknown keys inside `userConfig`, `channels`, `lspServers` or `monitors` entries are errors, and the plugin doesn't load. [manifest-unknown]
- Every component path must start with `./` and resolve inside the plugin root. `..` and symlinks that lead outside are rejected. Marketplace installs copy the plugin into `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, so files above the plugin root aren't there at runtime. [manifest-paths], [loading-paths]
- Path variables: `${CLAUDE_PLUGIN_ROOT}` is the install dir and changes on every update, so don't write state there. `${CLAUDE_PLUGIN_DATA}` is `~/.claude/plugins/data/<id>/`, survives updates, and is deleted on the last uninstall unless the user passes `--keep-data`. `${CLAUDE_PROJECT_DIR}` is the project root. These variables are **not** in the Bash tool's environment. [manifest-env]
- `userConfig`: values the user is prompted for on enable. Types are `string`, `number`, `boolean`, `directory` and `file`. Values marked `sensitive` go to the OS secure store. Reference them as `${user_config.KEY}` in MCP, LSP, exec-form hook args, and skill or agent content, or as `CLAUDE_PLUGIN_OPTION_<KEY>` in hook env. Shell-form hooks and monitors can't reference them. [manifest-userconfig]
- `dependencies` on other plugins, with version ranges. `engines.claude-code` requires v2.1.323+. [manifest-fields]

### Skills (`skills/<name>/SKILL.md`)

- Claude loads a skill when its description matches. The user can run it as `/<plugin>:<name>`. The `skills` key adds to the default scan rather than replacing it. [components-skills]
- `allowed-tools` pre-approves tools only for the turn that invoked the skill. The grant clears when the user sends the next message. Plugin skills also substitute `${CLAUDE_PLUGIN_ROOT}` inside `allowed-tools`, so a skill can run a bundled script without a prompt. [skills-allowed], [skills-vars]
- A `CLAUDE.md` at the plugin root is **not** loaded. Standing instructions have to be a skill, an output style or a subagent prompt. [components-skills]

### Commands (`commands/*.md`)

- The older format, superseded by skills. They take the same frontmatter. They can also be defined inline in `plugin.json` with `source` or `content`, plus `allowedTools`, `model` and `argumentHint`. [manifest-commands], [components-commands]

### Subagents (`agents/*.md`)

- Named `<plugin>:<name>`, with subfolders adding segments. Supported frontmatter: `name`, `description`, `model`, `effort`, `maxTurns`, `autoCompactWindow`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `omitClaudeMd`, `isolation` (`worktree` only), `color`, `experimental.cacheTtl`. [components-agents]
- **Ignored in plugin agents:** `permissionMode`, `hooks`, `mcpServers`, `initialPrompt`. The docs give security as the reason. [components-agents], [subagents-plugin]
- To make the main thread _be_ the DM agent, the user needs the `agent` setting or `claude --agent <plugin>:<name>`. A plugin can't set that for them. [settings-agent]

### Hooks (`hooks/hooks.json`)

- Same shape as `hooks` in settings. Handler types are `command`, `http`, `mcp_tool`, `prompt` and `agent`. Hooks register when the plugin loads and fire on all their events, in subagents too. [components-hooks], [hooks]
- Matchers for the plugin's own MCP tools must use `mcp__plugin_<plugin>_<server>__<tool>`. A matcher on the bare server name never fires. [components-hooks]
- `PreToolUse` can allow, deny, ask, defer or rewrite input. `PermissionRequest` can return `updatedPermissions`, including `addRules`, which writes allow rules to a `destination`. A plugin hook can therefore auto-approve its own tools. Deny and ask rules still hold. [hooks-pretool], [hooks-permreq]
- Timeouts: 600 s default for command, http and mcp_tool hooks, and 30 s on `UserPromptSubmit`. `SessionEnd` hooks share a 1.5 s budget. `async`/`asyncRewake` hooks run in the background without the timeout. [hooks-fields]

### MCP servers (`.mcp.json` or the `mcpServers` key)

- Transports: stdio, HTTP, SSE (deprecated) and WebSocket. `.mcpb` and `.dxt` bundles are accepted by path or by https URL. [mcp-plugin], [manifest-mcp]
- **Lifecycle:** Claude Code starts the servers of enabled plugins at session startup. A remote server the user has used before may show `cached` and connect on first use. A stdio server that failed less than 15 minutes ago is skipped. Servers reconnect on `/reload-plugins` only if their config changed. [mcp-plugin]
- Server ID `plugin:<plugin>:<server>`. Tool names `mcp__plugin_<plugin>_<server>__<tool>`, the form used in permission rules, `allowed-tools`, agent `tools` and hook matchers. [mcp-plugin]
- Node deps: on install or update Claude Code runs the dependency install **only** with `bun.lock`, `package-lock.json` or `npm-shrinkwrap.json`. **`pnpm-lock.yaml` and `yarn.lock` are skipped.** The alternatives are shipping an npm or bun lockfile, bundling the server, or installing into `${CLAUDE_PLUGIN_DATA}` from a `SessionStart` hook. [loading-deps], [components-data]
- Project-scope plugins: MCP servers go through the same per-server approval as a project `.mcp.json`. Monitors don't load. [loading-project]

### Channels (`channels` key, bound to one of the plugin's MCP servers)

- An MCP server that declares the `experimental['claude/channel']` capability and sends `notifications/claude/channel` events. Claude sees them as `<channel source=...>` turns. Two-way channels expose a reply tool. Channels can also relay permission prompts to the remote side. [channels-ref], [fakechat]
- The user opts in each session with `claude --channels plugin:<name>@<marketplace>`. Being in `.mcp.json` isn't enough. [channels]
- **Research-preview limits:** only allowlisted channel plugins register. Our own marketplace requires `--dangerously-load-development-channels` plus a confirmation prompt. Team and Enterprise orgs must set `channelsEnabled`. Neither flag appears in `--help`. The flag syntax and protocol may change. [channels], [channels-ref]
- Permission prompts pause the session until someone answers them. The fixes are permission relay, allow rules or hooks, or `--dangerously-skip-permissions`. [channels]

### Output styles (`output-styles/*.md`)

- Replace Claude Code's software engineering instructions for the main conversation and forks, unless `keep-coding-instructions: true`. They don't affect other subagents. [output-styles]
- **`force-for-plugin: true`** (plugin-only) applies the style automatically while the plugin is enabled and overrides the user's `outputStyle`. If several plugins force a style, the first one loaded wins. Nothing enforces a style: it's an instruction Claude follows. [output-styles]

### Monitors (`monitors/monitors.json`, under `experimental`)

- A shell command started in the background at session start (or on a skill's first run with `when: "on-skill-invoke:<skill>"`). Each line it prints reaches Claude as a notification. [components-monitors], [manifest-monitors]
- Limits: not started with `-p`, can't use `${user_config.*}`, not stopped when the plugin is disabled mid-session, and need a restart (not a reload) after an update. They don't load for project-scope plugins. They run outside the sandbox with full user permissions. [components-monitors], [loading-updates], [loading-project]

### Executables (`bin/`)

- On the Bash tool's `PATH` while the plugin is enabled, after the user's own entries, so a plugin can't shadow system commands. They're tool calls, so permission rules apply. claude.ai and Cowork won't install a plugin that has a top-level `bin/`. [components-bin], [security]

### Mods (JS hooks module, listed under `modules` in `hooks/hooks.json`)

- Run inside Claude Code. They can draw panes and bands, register `/commands` and tools, approve or rewrite tool calls, call a model, run timers, and **start a turn with `$.prompt.submit`**. They also have `$.process.run/spawn`, `$.http.fetch`, `$.fs` and `$.store` (a 4 MiB store shared across sessions on the machine). [mods-overview], [mods-api], [mods-ref]
- Limits: 10 s per hook execution, `$.process.run` 30 s by default (10 min max), 4 MiB file, fetch and store sizes, and no Node APIs in the module itself. Mods run in the CLI, the Desktop Code tab and VS Code. They run but draw nothing in `-p` and the SDK. Orgs can restrict them. [mods-ref], [mods-overview]
- `$.prompt.submit` is a second way to inject web-UI input without the channel allowlist. It needs more checking (open question 2).

### LSP servers, themes, workflows

- LSP: `.lsp.json`, stdio only. The plugin doesn't install the binary. Themes: `experimental.themes`. Workflows: `.js` files that orchestrate subagents. None of these matter for the DM. [manifest-lsp], [components]

### Install, update and distribution

- **Marketplace:** `.claude-plugin/marketplace.json` in a repo. Plugin sources: relative path, `github`, `url` (git), `git-subdir`, `npm` (no install scripts), `archive` (https zip, optional sha256), and `command`. A plugin can live in the same repo as the marketplace (relative path). [marketplace-ref]
- **Install:** `/plugin marketplace add owner/repo`, then `/plugin install name@marketplace` or `claude plugin install`. Scopes: user (`~/.claude/settings.json`), project (committed `.claude/settings.json`, but each collaborator still installs), and local. The shell `claude plugin install` never prompts for `userConfig`. Users pass `--config KEY=VALUE` or run `/plugin configure`. [install], [components-userconfig]
- **Dev loop:** `claude --plugin-dir ./path` loads a plugin for one session. A marketplace added from a local path loads its plugins in place, so edits apply on `/reload-plugins` or the next start. `claude plugin validate [--strict]` checks a plugin. [loading-inplace], [manifest-validate]
- **Versioning:** the manifest `version` wins, then the entry's `version`, then the git commit SHA. Pinning `version` means users get nothing new until it's bumped. [loading-version]
- **Auto-update:** on by default for Anthropic's official marketplaces and off for others. A user turns it on in `/plugin` → Marketplaces, or an admin sets it through `extraKnownMarketplaces.autoUpdate`. It runs after a random delay of up to 10 minutes after the first message. Hooks, MCP and LSP switch to the new version on `/reload-plugins`. Monitors need a restart. `DISABLE_AUTOUPDATER` and similar variables turn it off. [loading-updates], [host-autoupdate]
- **Trust:** hooks, monitors, MCP and LSP servers and mod processes run outside the sandbox with the user's permissions. Permission rules govern only Claude's tool calls. [security]

## Implications for the DM-as-plugin map (#288)

1. **Game state MCP server:** fits well as a stdio server under `${CLAUDE_PLUGIN_ROOT}`, with SQLite in `${CLAUDE_PLUGIN_DATA}`. The lockfile rule means we need an npm or bun lockfile, or a bundled server, because pnpm won't get an automatic dependency install. Native `better-sqlite3` would also need building on the user's machine. Bun's or Node's built-in SQLite, or a bundle, may be simpler.
2. **Web UI:** the same MCP process can serve the UI on localhost, as fakechat does. It lives exactly as long as the Claude Code session.
3. **Player input → DM:** channels match the shape but are gated by the preview allowlist, so we'd launch with `--dangerously-load-development-channels`. A mod's `$.prompt.submit` is the alternative to evaluate.
4. **Tool permissions:** use a plugin `PreToolUse` hook (or a mod) to auto-allow `mcp__plugin_<plugin>_<server>__*`, or document an allow rule. Plugin agents can't set `permissionMode`.
5. **DM persona:** an output style with `force-for-plugin: true` changes the main conversation without the user selecting it. A plugin agent can only be the main thread via `--agent` or the user's `agent` setting.

## Open questions

1. Whether `--dangerously-load-development-channels` is acceptable for an end-user launch (for example a wrapper script that runs `claude --dangerously-load-development-channels plugin:dm@ours --agent dm:dm`). Does the confirmation prompt appear every launch?
2. Whether a mod's `$.prompt.submit` plus `$.http`/`$.process.spawn` can replace channels for UI input without the allowlist. Mods are new (v2.1.2xx–3xx), and orgs can restrict them.
3. Exact version floors for mods features on the user's Claude Code (local is v2.1.323, and some mod APIs need v2.1.326).

## Sources

- [manifest]: https://code.claude.com/docs/en/plugins/manifest-reference 'also cited as manifest-fields, -name, -unknown, -paths, -env, -userconfig, -commands, -mcp, -lsp, -monitors, -layout, -validate'
- [components]: https://code.claude.com/docs/en/plugins/components 'also cited as components-skills, -commands, -agents, -hooks, -monitors, -bin, -data, -userconfig'
- [loading-updates] / [loading-version] / [loading-deps] / [loading-paths] / [loading-project] / [loading-inplace]: https://code.claude.com/docs/en/plugins/loading
- [install]: https://code.claude.com/docs/en/plugins/install
- [host-autoupdate]: https://code.claude.com/docs/en/plugins/host-marketplace
- [marketplace-ref]: https://code.claude.com/docs/en/plugins/marketplace-reference
- [security]: https://code.claude.com/docs/en/plugins/security
- [mcp-plugin]: https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers
- [channels]: https://code.claude.com/docs/en/channels
- [channels-ref]: https://code.claude.com/docs/en/channels-reference
- [fakechat]: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat '`.mcp.json`, `server.ts`'
- [hooks] / [hooks-fields] / [hooks-pretool] / [hooks-permreq]: https://code.claude.com/docs/en/hooks (common fields; PreToolUse decision control; PermissionRequest / permission update entries)
- [permissions-mcp]: https://code.claude.com/docs/en/permissions
- [skills-allowed] / [skills-vars]: https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill
- [subagents-plugin]: https://code.claude.com/docs/en/sub-agents
- [settings-agent]: https://code.claude.com/docs/en/settings-reference#agent
- [output-styles]: https://code.claude.com/docs/en/output-styles
- [mods-overview]: https://code.claude.com/docs/en/plugins/mods/overview
- [mods-api]: https://code.claude.com/docs/en/plugins/mods/api
- [mods-ref]: https://code.claude.com/docs/en/plugins/mods/reference
