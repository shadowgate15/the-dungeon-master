# The Dungeon Master

An AI Dungeon Master for Dungeons & Dragons, packaged as a Claude Code plugin. Claude runs the game, so players can just play.

This document is the project's North Star. It describes where we are headed and what is in scope right now, so every feature starts from the same place.

## Vision

A complete game-running system. A Player opens a Campaign in the web UI and sees the game unfold: Narration, their Characters, the Scene and the state of the World. A Claude Code session acting as the DM runs everything behind it: it narrates, voices NPCs, adjudicates Declarations and keeps the World consistent.

## Guiding principles

- **Claude via Claude Code is required.** The DM is one Claude Code plugin agent with on-demand skills, a `builder` subagent and plugin hooks. The game doesn't run its own agent loop, and it supports no other model or provider.
- **Deterministic code owns the rules and state.** Dice, HP, initiative, spell slots, inventory and every other mechanic live in code and the database. The database is the single source of truth.
- **The DM owns narration and judgment.** It writes the story and makes the calls that have no fixed answer: NPC behavior, rulings on improvised actions, pacing. It never invents a number or a state change. It calls tools, and the tools change state.
- **Visibility is data.** The World layer is the DM-only truth. Each Holder's Beliefs record what they know, and the Player sees only what their Characters believe. Secrecy is never a prompt rule (ADR 0007).
- **Continuity lives in the server.** Session summaries, the Event log and the World and Knowledge layers carry the story across Sessions, not the Claude Code transcript. One play Session is one Claude Code session.
- **Rules content is limited to the D&D 5e SRD 5.1** (CC-BY-4.0).

## How it fits together

- **Game server**: one user-level SvelteKit server per user. It is the only process that opens SQLite and runs the rules. It serves the web UI, exposes the game as MCP tools and pushes live updates to the browser. It listens on a localhost port behind a token and runs until you stop it.
- **Bridge**: a stateless stdio MCP and channel server in the plugin's `bin/`, spawned by Claude Code. It proxies the DM's tool calls to the server and relays the Player's input from the browser to the DM through channels.
- **Launcher (`dm`)**: run in a Campaign folder. It starts the server if needed, registers the folder and starts `claude` with the plugin's `dm` agent.
- **Campaign folder**: one folder holds one Campaign, with its database in `.dm/`. A Campaign can be committed and handed to another Host through git.

The UI works against the server with or without a live session. With the DM away you can browse a Campaign, create Characters and make other edits that change nothing in the fiction.

## Install and run

Requirements: [Claude Code](https://claude.com/claude-code) and Node 26 or later.

1. Install the plugin from its marketplace (the dev-channels flag only accepts marketplace-installed plugins, not `--plugin-dir`):

   ```sh
   claude plugin marketplace add shadowgate15/the-dungeon-master
   claude plugin install the-dungeon-master@the-dungeon-master
   ```

2. Start Claude Code once in any folder. The plugin's SessionStart hook writes the `dm` command to `~/.local/bin/dm`, so make sure `~/.local/bin` is on your PATH. The shim looks up the installed plugin on every run, so it keeps working across plugin updates.
3. Create a Campaign in the web UI. This creates its folder and registers it with the server.
4. Start a Session from the Campaign folder:

   ```sh
   cd <campaign folder> && dm
   ```

   `dm` starts the game server if it isn't running (or restarts one left over from an older plugin version), registers the folder and starts `claude` with the plugin's `dm` agent. The terminal shows Claude Code's trust, MCP consent and dev-channels prompts. Play happens in the browser. Run outside a Campaign folder, `dm` starts the server and points you to the web UI.

   For a table on the same network, run `dm --lan` instead. The Host's header then shows an "Open on LAN" badge with a Join panel (URLs and QR codes) for other devices.

5. End the Session with End Session in the UI. To stop the game server, run `dm stop` or press Stop server in the UI's header.

Outside a Campaign folder, the plugin's hooks and bridge do nothing, so ordinary Claude Code sessions are unaffected.

## Campaign lifecycle

1. The Player creates a Campaign and fills its Seed (name, premise, Tone, Length and optional World details), then builds the Party. Neither step needs a session.
2. The Player presses Begin. The DM has `builder` generate the World and the first Arc from the Seed and the Party's backstories, and the Player sees a spoiler-free pitch.
3. Play is improvised from there. Each Session opens with a recap, and End Session closes it with a summary. When an Arc ends, a new one can follow.

## Current focus

- Play at one table: a Host runs the game on their machine and can play alone with Claude as the DM, or open it to others on the same network. The data model carries `player` everywhere.
- LAN multiplayer: `dm --lan` listens on every interface. The Host's header shows an "Open on LAN" badge, and a Join panel lists the join URLs with QR codes for other devices on the network. Hosting beyond the LAN is not a goal.
- A web play console: the Character sheet, a timeline of Narration and Declarations, rolls and Calls, and a right rail with the clock, the Scene, initiative and what the acting Character knows.
- D&D 5e on the SRD 5.1.

## Later (not goals right now)

- Map and richer visuals
- Voice
- Hosting and accounts
- Pre-written adventure modules
- The 2024 rules

## Stack

SvelteKit (`adapter-node`), TypeScript, Tailwind, TanStack Query, Drizzle with SQLite (better-sqlite3), the MCP SDK, Vitest, Playwright, Storybook.

## Development

```sh
pnpm install
pnpm dev          # start the dev server
pnpm check        # type-check
pnpm lint         # prettier + eslint
pnpm test         # unit + e2e tests
pnpm storybook    # component workbench
pnpm build:bridge # rebuild the committed bridge and launcher bundles in plugin/bin
pnpm build:plugin # rebuild everything the plugin ships, including the server in plugin/server
pnpm fake-dm <folder> <script> # drive a Campaign's play screen with a scripted DM, no Claude
```

`pnpm fake-dm` attaches the e2e fake DM (`src/testing/fake-dm.ts`) to the running server (`pnpm dev`, or `--home <dir>` for another state directory) as the Campaign in `<folder>`, the way a real session would. The script's default export is `async (dm) => {…}`, which gets the fake DM's `call`, `script` and `settled`, or a list of `{on, run}` steps answered in order. See `scripts/fake-dm/examples/`. Use it for UI work and PR evidence.

The plugin in `plugin/` is installed as committed: it has no `package.json`, so Claude Code runs no dependency install. `pnpm build:plugin` writes the adapter-node server build, its migrations and a vendored better-sqlite3 (with its prebuilt binaries) into `plugin/server/`. Rebuild and commit it whenever the server changes.
