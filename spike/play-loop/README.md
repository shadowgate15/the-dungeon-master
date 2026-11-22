# PROTOTYPE: play-loop spike (throwaway, never merged)

Answers [Spike: the play loop through server, bridge and channel](https://github.com/shadowgate15/the-dungeon-master/issues/298) against the
[process topology](https://github.com/shadowgate15/the-dungeon-master/issues/294) decision. Lives on a `prototype/` branch only.

```
browser ──POST /api/input──▶ server (node:http, stand-in for SvelteKit; state in memory)
   ▲                            │ SSE /bridge/stream
   │ SSE /api/stream            ▼
   └──── narration, rolls, ◀── dm-bridge.ts (stdio, stateless; spawned by Claude Code)
         HP, permission            │ notifications/claude/channel ▲ tools/call reply|roll|apply_damage
         prompts, timings          ▼                              │
                                 claude (interactive terminal, the DM)
```

## Run it

Needs Node 24+ (runs `.ts` directly), `claude` logged in with claude.ai or Console auth.

```sh
mkdir -p ~/dm-spike-camp && cd ~/dm-spike-camp
<repo>/spike/play-loop/plugin/bin/dm-spike              # feel the real permission prompts
<repo>/spike/play-loop/plugin/bin/dm-spike --auto-allow # plugin's PreToolUse hook allows its own tools
<repo>/spike/play-loop/plugin/bin/dm-spike stop         # stop the server
```

The launcher starts the server if needed, registers the folder, installs the plugin from the spike's local
marketplace at **project scope** (writes the campaign folder's `.claude/settings.json`, nothing global), opens the UI,
then `exec`s `claude --dangerously-load-development-channels plugin:dm-spike@dm-spike-local`. Type actions in the browser.

Learned on the first run: the dev flag rejects a `--plugin-dir` plugin (`plugin:dm-spike@inline · plugin not installed`);
it needs an installed `plugin:<name>@<marketplace>`. And `--channels` is no way around it: it registers only
allowlisted plugins (Anthropic's, or an org's `allowedChannelPlugins`); anything else starts but the channel doesn't register.
Logs: `~/.dm-spike/server.log`, `~/.dm-spike/bridge.log`.

## What to notice (the question)

- **Launch:** how many dialogs before play starts (dev-channels warning, folder trust, MCP consent)? Does the banner say the channel registered?
- **First input:** does the event reach the session at all? Does Claude reply through `reply`, or chat in the terminal?
- **Permissions:** without `--auto-allow`, each new tool prompts. Do the prompts show up in the browser panel, and does approving there work?
- **Latency:** each reply logs `input → first tool call` and `input → reply`. With no streaming, does the "DM is thinking…" wait feel acceptable?
- **State:** do rolls and HP changes appear in the browser before the narration that uses them?
- **Edges:** run a second `dm-spike` in the same folder (second bridge refused?); `dm-spike stop` mid-session (clear error?), then restart it (bridge reconnects?).

Smoke test without Claude passed (fake MCP client: protocol pinned to 2025-06-18, channel event out, tool calls,
permission relay both ways, browser SSE, second bridge refused with 409).
