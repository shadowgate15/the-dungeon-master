# Claude Code mods: what they can do that settings hooks can't

Research for #291 (parent map #288). The question: what Claude Code mods are, how they ship, and what they can do that ordinary settings hooks can't. In particular, could a mod show live game state (character sheet, dice, combat tracker) beside the DM session, and can a mod receive data from an MCP server?

Sources, all first-party:

- [Mods overview][overview], [Mods reference][reference], [Use the mods API][api] (code.claude.com docs, read 2026-11-22)
- The `plugin-authoring` skill bundled with Claude Code v2.1.323: its `SKILL.md`, `reference.md`, and `types/claude-code.d.ts`, the build's own TypeScript declaration of the mods API. The docs call those declarations "the complete reference" and say to trust the copy Claude Code writes for your version over the GitHub copy ([reference][reference]). Cited below as **types** and **skill reference**.

## Short answer

- **What a mod is.** A plugin whose `hooks/hooks.json` names a JavaScript or TypeScript module under `modules`. That module exports `register(on, options)` and adds handlers with `on(event, matcher?, hook)`. The handlers run inside the Claude Code process ([overview][overview], [reference][reference] "Files").
- **How it ships.** As an ordinary plugin, installed from a marketplace (`/plugin install <name>@<marketplace>`). One plugin can hold a mod, skills, agents, settings hooks and an MCP server together ([overview][overview], "Compare mods..." and "Install or update a mod").
- **What settings hooks can't do.** Settings hooks run a shell command, an HTTP request or a prompt on lifecycle events. They can block or allow a tool call or prompt, rewrite a tool call's arguments or result, and add context. None of them can draw in the interface. A mod can draw panes, bands, status lines and toasts, redraw Claude Code's own rows, register slash commands that run code without a turn, register tools, call models, keep state across events, run timers, and call MCP tools ([overview][overview] comparison table).
- **Live game state beside the session: yes.** `$.ui.open({ id, title })` opens a pane docked beside the transcript, drawn by a `ui.render` hook on `{ component: 'Pane' }`. Writes to `$.state` redraw exactly the drawings that read them ([api][api], types `ui.open`, skill reference "Drawing: ui.render").
- **Data from an MCP server: yes, by pull and by observation, not by push.** A mod can call any connected MCP server's tools itself with `$.mcp.call(server, tool, args)`, with no permission prompt. A `tool.call` hook sees every MCP tool call Claude makes, and its result. The mods API exposes no MCP notifications or resource subscriptions. Live updates come from watching the DM's tool calls, from polling on `$.clock.every`, or from `$.http.fetch` to a local server (types `mcp.call`, `http.fetch`; [api][api]).
- **Surfaces.** Hooks run and draw in the CLI terminal (including the JetBrains plugin and editor terminals), the Desktop app's Code tab (not WSL or SSH sessions), and the VS Code extension's chat panel (extension v2.1.299+). Under `claude -p` and the Agent SDK, hooks run but nothing draws. With Remote Control from claude.ai or the mobile app, hooks run on your machine and draw only in the terminal there. In cloud sessions, hooks run if the plugin reaches the session, and drawing is "not in every session" ([overview][overview] "Where mods run"). The `Pane` render site is drawn in Terminal, Desktop and VS Code ([reference][reference] "Render sites").

## What a mod is

A mod is "a plugin that changes how Claude Code looks and behaves. It's made of JavaScript or TypeScript event handlers: Claude Code calls one when an event happens, such as a tool call, a submitted prompt, or a part of the interface being drawn, and the handler can watch the event, change it, or take it over" ([overview][overview]).

Three files make a minimal mod ([reference][reference] "Files"):

| File                         | Contents                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | The plugin manifest. Mods add no required fields.                                            |
| `hooks/hooks.json`           | `{ "modules": ["./register.ts"] }`, one path. It can also hold settings hooks under `hooks`. |
| `hooks/register.ts`          | Exports `register(on, options)`. An ES module (`.js`, `.ts`, `.tsx`, and similar).           |

Every hook has the shape `($, e, next)`. `$` is the engine interface (`$.ui`, `$.mcp`, `$.state`, `$.store`, `$.clock`, `$.http`, `$.fs`, `$.process`, `$.model`, `$.tool`, `$.command`, `$.session` and more). `e` is the event's input. `next(e)` runs the rest of the chain and then Claude Code's own behavior. A hook can observe (call `next(e)` unchanged), rewrite (call `next({ ...e, ... })`), or answer for itself (return without `next`). The module has no DOM and no Node: everything outside it goes through `$` (skill reference "What a plugin of function hooks is"; [overview][overview] "What a hook can do with an event").

Version floor: mods are on by default from Claude Code v2.1.287 in the terminal and v2.1.286 in the Desktop app ([overview][overview] "Turn mods on or off"). The API is early access and moves between releases (skill reference, intro).

## Mods vs settings hooks

The docs' own comparison ([overview][overview]):

|                              | Mod                                                                | Settings hook                                                                                              | MCP server                                             |
| ---------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| What it is                   | Functions in a plugin that Claude Code calls in its own process    | A shell command, HTTP request, or prompt that Claude Code runs on a lifecycle event                        | An external process or service that gives Claude tools |
| What it can change           | Tool calls, prompts, commands, turns, and what the interface draws | Whether a tool call or prompt goes ahead, a tool call's arguments and result, and context added for Claude | Which tools Claude has                                 |
| Can it draw in the interface | Yes                                                                | No                                                                                                         | No                                                     |

What a mod can do that a settings hook can't:

1. **Draw an interface.** Panes beside the transcript, a band above the prompt, with buttons, text fields, selects, tabs, `Markdown`, `Progress`, `Raster`, `Image` (terminal) and `Svg` (Desktop/VS Code/mobile) ([overview][overview]; types `Elements`).
2. **Redraw Claude Code's own UI.** Hooking `ui.render` on components like `ToolUse`, `Spinner`, `UserMessage` or `CommandOutput` restyles or replaces rows. The permission prompt is the exception: a mod can't change what it shows ([overview][overview] "What a mod can reach").
3. **Run code on a slash command with no model turn.** `$.command.register` in `session.start`, answered by a `command.run` hook. With `immediate: true` it runs even while Claude is working ([api][api] "Add a command").
4. **Register a tool for Claude.** `$.tool.register` adds `mcp__<plugin>__<name>`, served by a `tool.call` hook ([api][api] "Add a tool").
5. **Keep state between events.** Module variables, `$.state` (session-scoped, survives hot reload, subscribes drawings), and `$.store` (persists across sessions) ([api][api]; skill reference "Drawing: ui.render").
6. **Work outside events.** `$.clock.every` and `$.clock.after` run between turns without starting one. `$.prompt.submit` can start a turn when the session is idle ([api][api] "Run work in the background").
7. **Show things without a turn.** `$.ui.status` (pinned line under the prompt), `$.ui.toast`, `$.ui.log` (a transcript line Claude doesn't read), `$.ui.notify` ([api][api] "Show something without starting a turn").
8. **Call models, MCP tools, the network, files and processes** through `$.model`, `$.mcp`, `$.http`, `$.fs` and `$.process` ([api][api] "Reach files, processes, and the network").
9. **Hook settings-hook events too.** Each settings hook event is also a mod event named `classic.<Event>` (`classic.PostToolUse`, `classic.Stop`), with the same stdin JSON as `e` ([reference][reference]). So a mod covers everything a settings hook observes.

Trust cost: a mod is unsandboxed code with the user's permissions. It can see every prompt and tool call, and can approve tool calls that `deny`/`ask` rules would stop unless the built-in guard `cc-plugin-sec-default` is loaded ([overview][overview] "Decide whether to trust a mod").

## Live game state beside the session

A pane is the fit for a character sheet, dice log or combat tracker.

- **Open.** `$.ui.open({ id, title })` opens a pane. It resolves `{ isPlaced }`. A pane the user asked for (a command, prompt or button press) is placed at any width. One opened unasked is placed from 144 terminal columns, or 110 once the user has opened it before, and otherwise waits undrawn (types `ui.open`; [reference][reference] "Limits").
- **Draw.** A `ui.render` hook on `{ component: 'Pane', requestId: id }` returns a tree from `$.ui.resolve(e)`'s element table. `e.props.placement` is `dock` (beside the transcript), `inline` (above the prompt), or `widget` on Desktop (a minimized form). One hook can draw a full sheet docked and a glance as a widget (skill reference "Drawing: ui.render").
- **Update.** Values a drawing reads from `$.state` redraw only those readers when written, from a handler or another event, not from the render hook itself. `$.ui.invalidate('ui.render')` forces a redraw, throttled to 10 a second (30 for the visible terminal pane) ([reference][reference] "Limits"; skill reference).
- **Interact.** Buttons, inputs and selects raise `ui.press`, `ui.input` and `ui.select` in the mod. So a pane could have a "roll" button that calls the game MCP server directly with `$.mcp.call`.
- **Smaller surfaces.** For a one-line HP/initiative summary, use `$.ui.status`, or an `AbovePrompt` band.

Fallback: a mod can read `e.surface` and `e.viewport.isFullscreen` and fall back to a transcript line or a command's text where nothing draws ([overview][overview] "Where mods run").

## Receiving data from an MCP server

Three routes exist. None of them is a push from the server.

1. **Call the server directly.** `$.mcp.call(server, tool, args)` "calls `tool` on one of the engine's connected MCP servers with the engine's own connection and credentials ... No permission prompt: the plugin's call, seen by the hooks above it, is the grant." It returns MCP `content` blocks and `isError`. `$.mcp.connect(server)` brings in a server the plugin's own manifest lists, or one `/mcp` lists (types `mcp.call`, `mcp.connect`; [reference][reference] `$.mcp`). The game-state server can ship in the same plugin as the mod, so the mod can read it by its manifest key.
2. **Watch the DM's tool calls.** A `tool.call` hook sees every tool call, MCP tools included (`e.tool === 'mcp__<server>__<tool>'`, with the server's provenance on `e`). `await next(e)` resolves to the result. When the DM calls `apply_damage` or `roll`, the mod reads the result and writes `$.state`, and the pane redraws (types `ToolCallInput`, `McpServerProvenance`; [overview][overview] tool-call example).
3. **Poll or fetch.** `$.clock.every(ms, fn)` from `session.start` can call `$.mcp.call` or `$.http.fetch` (http/https, or a Unix socket through `socketPath`) on an interval, which catches changes made outside Claude's turns, such as by the player's web UI ([api][api]; types `http.fetch`).

Not found: an API for MCP server-to-client notifications (`notifications/resources/updated`, list-changed) or resource subscriptions. The types expose `resource` and `resource_link` only as content blocks of a tool result (types `McpContentBlock`). So a mod can't be woken by the MCP server. It can be woken by Claude's tool calls, by timers, by a slash command or button press, or by an incoming message (`session.receive`, whose origins include channels; types `UserMessage` origin `channel`).

## Fit with the Claude Code plugin plan (#288)

Two observations, not decisions:

- The plan's local web UI and a mod pane overlap. A pane shows state in the DM's own window in the terminal, Desktop or VS Code. It does not reach the player's browser. It is most useful as a DM/operator view, or for a player who plays in Claude Code directly.
- Ship the MCP server and the mod in one plugin. Then the mod reads state with `$.mcp.call` by manifest key and mirrors every DM tool call through `tool.call`, with no extra transport.

[overview]: https://code.claude.com/docs/en/plugins/mods/overview
[reference]: https://code.claude.com/docs/en/plugins/mods/reference
[api]: https://code.claude.com/docs/en/plugins/mods/api
