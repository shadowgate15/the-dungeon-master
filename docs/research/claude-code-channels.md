# Claude Code channels: what they can do

Date: 2026-11-22. Ticket: #289 (parent map #288). Checked against Claude Code 2.1.323.

## Question

How do Claude Code channels work today? How does a channel server push events into a running session, and how does the session reply? How is the channel process launched? What is the session lifecycle? How are channels enabled, and what are the research-preview limits? What happens with permission prompts while a channel drives the session? Can a local web UI act as the player's input surface for a DM session?

## Answer

**Yes, a local web UI can be the player's input surface.** Anthropic's own `fakechat` demo channel does exactly this: it serves a chat page on `http://localhost:8787`. What the player types there arrives in the running Claude Code session, and Claude's replies come back to the page. The DM plugin would follow the same pattern:

- The plugin ships a stdio MCP server that declares the `claude/channel` capability.
- That same process serves the web UI on `127.0.0.1`.
- It pushes player input with `notifications/claude/channel`.
- It exposes a `reply` tool, and optionally edit/stream tools, that Claude calls to send narration to the page.

The main costs come from the research preview:

- A custom channel is not on the allowlist. It needs `--dangerously-load-development-channels`, which shows a confirmation dialog on every launch and works only in an interactive terminal session (not `-p` or the Agent SDK).
- The terminal session has to stay open.
- The flag syntax and protocol may change.
- Narration reaches the UI only through tool calls. Claude's transcript text never reaches the page, and nothing streams token by token.

## How events get in

- A channel is an MCP server that runs on the same machine. "Claude Code spawns it as a subprocess and communicates over stdio." ([channels reference, Overview](https://code.claude.com/docs/en/channels-reference#overview))
- The server declares `capabilities.experimental['claude/channel'] = {}`. That declaration "registers the notification listener." ([Server options](https://code.claude.com/docs/en/channels-reference#server-options))
- It pushes events with `notifications/claude/channel`:
  - `params.content` (a string) becomes the event body.
  - `params.meta` (`Record<string,string>`) becomes the tag's attributes. Keys may contain only letters, digits and underscores; other keys are silently dropped. ([Notification format](https://code.claude.com/docs/en/channels-reference#notification-format))
- Claude sees the event as `<channel source="<server>" key="value">body</channel>`. The terminal shows a one-line summary, such as `← fakechat · web: ...`. ([channels, Quickstart](https://code.claude.com/docs/en/channels#quickstart))
- The server's `instructions` string is given to Claude as context when the server connects. Use it to tell Claude what events to expect and how to reply. ([Server options](https://code.claude.com/docs/en/channels-reference#server-options))
- **Delivery is not acknowledged.** `await mcp.notification()` resolves once the message is written to the transport. If the server is not registered as a channel, or policy blocks it, the events are "dropped silently". ([Notification format](https://code.claude.com/docs/en/channels-reference#notification-format))
- **Idle vs busy:**
  - An event that arrives while the session is idle starts a turn. In the webhook walkthrough, Claude starts responding as soon as the POST lands.
  - Events that arrive while Claude is busy are queued and processed in order: "delivered together on the next turn and Claude handles them as a group."
  - To handle independent streams concurrently, run separate sessions. ([Notification format](https://code.claude.com/docs/en/channels-reference#notification-format))

## How replies get out (two-way)

- Two-way is optional. A channel that also declares `capabilities.tools = {}` and registers an ordinary MCP tool, conventionally `reply(chat_id, text)`, can carry replies. "Nothing about the tool registration is channel-specific." ([Expose a reply tool](https://code.claude.com/docs/en/channels-reference#expose-a-reply-tool))
- The reply is a tool call. The terminal shows the call and a confirmation such as "sent", not the reply text. ([channels](https://code.claude.com/docs/en/channels))
- fakechat's instructions state the key constraint: "The sender reads the fakechat UI, not this session. Anything you want them to see must go through the reply tool — your transcript output never reaches the UI." ([fakechat server.ts](https://github.com/anthropics/claude-plugins-official/blob/main/external_plugins/fakechat/server.ts))
- fakechat also exposes `edit_message(message_id, text)` and file attachments. It pushes to the browser over a WebSocket (`/ws`). Progressive narration would have to be built from repeated edit calls. Channels have no token-streaming path. (Inference from the tool-call design; no doc mentions streaming.)

## How the process runs

- The channel is a normal MCP server entry: a project `.mcp.json`, `~/.claude.json`, or a plugin's `.mcp.json` / `plugin.json` (`${CLAUDE_PLUGIN_ROOT}` is substituted). "Claude Code reads your MCP config at startup and spawns each server as a subprocess... You don't need to run the server yourself." ([webhook walkthrough](https://code.claude.com/docs/en/channels-reference#example-build-a-webhook-receiver); [MCP, plugin-provided servers](https://code.claude.com/docs/en/mcp))
- fakechat's plugin `.mcp.json` is `bun run --cwd ${CLAUDE_PLUGIN_ROOT} ... start`. One process holds both the stdio MCP connection and a `Bun.serve` HTTP/WebSocket server on `127.0.0.1:${FAKECHAT_PORT ?? 8787}`. ([fakechat source](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat))
- The runtime can be Bun, Node or Deno. The only hard dependency is `@modelcontextprotocol/sdk`. ([What you need](https://code.claude.com/docs/en/channels-reference#what-you-need))
- A plugin server registers as `plugin:<plugin>:<server>`, and its tools are named `mcp__plugin_<plugin>_<server>__<tool>`. ([MCP](https://code.claude.com/docs/en/mcp))
- Being in `.mcp.json` is not enough. The server must also be named in `--channels` (or the dev flag) to push messages. Without that, it still runs as an ordinary MCP server and its tools work. ([Security](https://code.claude.com/docs/en/channels#security); [Enterprise controls](https://code.claude.com/docs/en/channels#enable-channels-for-your-organization))
- **Protocol gotcha:** "On the v2 runtime, a channel server that negotiates MCP protocol revision 2026-07-28 can't deliver channel messages, so Claude Code doesn't register it as a channel." Stdio servers are asked for that revision by default. Fix it by using an SDK/server that does not support that revision, or by setting `MCP_PROTOCOL_NEGOTIATION=legacy`. ([MCP, Push messages with channels](https://code.claude.com/docs/en/mcp))

## Session lifecycle

- **Start:** opt in per launch with `claude --channels plugin:<name>@<marketplace>` (space-separated list), or with `--dangerously-load-development-channels plugin:...|server:...`. The startup banner confirms registration or names the problem. ([channels](https://code.claude.com/docs/en/channels); [CLI reference](https://code.claude.com/docs/en/cli-reference))
- **While open only:** "Events only arrive while the session is open, so for an always-on setup you run Claude in a background process or persistent terminal." ([channels](https://code.claude.com/docs/en/channels))
  - The channel process is a child of the session, so the web UI's server is up only while the session runs. (Inference from "spawns it as a subprocess".)
  - A web UI therefore cannot start a DM session by itself. Something has to launch `claude`.
- **Resume:** the docs say nothing specific about channels and `--resume` / `--continue`. Both `--channels` and `--resume` are launch flags, so `claude --resume <id> --dangerously-load-development-channels ...` should reattach the channel to the old conversation. This is unverified. Note that an MCP server restart loses any in-memory UI state, so game state must live in the database. ([CLI reference](https://code.claude.com/docs/en/cli-reference))
- **Non-interactive:**
  - `--channels` works with `-p`. In that mode, tools that need terminal input (AskUserQuestion, plan-mode approval) are disabled so the session never stalls. ([channels, Quickstart](https://code.claude.com/docs/en/channels#quickstart))
  - The dev flag, however, "takes effect in interactive sessions. With `-p`, Claude Code ignores the flag", and the same applies to the Agent SDK. ([Test during the research preview](https://code.claude.com/docs/en/channels-reference#test-during-the-research-preview))
  - So a custom (non-allowlisted) channel can only run in an interactive terminal session today.
- History, from the [CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md):
  - `--channels` was added in 2.1.80.
  - Permission relay was added soon after.
  - 2.1.83 disabled AskUserQuestion and plan-mode tools under `--channels`.
  - Plan-mode tools came back for interactive sessions by 2.1.126.

## Enabling and preview limits

- **Auth:** requires Anthropic authentication through claude.ai or a Console API key. Not available on Bedrock, Google Cloud Agent Platform or Microsoft Foundry. ([channels](https://code.claude.com/docs/en/channels))
- **Plans:**
  - Pro, Max and Ultra users without an organization: channels are available and opted into per session.
  - claude.ai Team/Enterprise: blocked until an Owner enables them (Organization settings > Claude Code > Channels, or the managed setting `channelsEnabled: true`).
  - Console API-key orgs: allowed by default unless they deploy managed settings. ([Enterprise controls](https://code.claude.com/docs/en/channels#enterprise-controls))
- **Allowlist:** `--channels` accepts only plugins on Anthropic's allowlist (the channel plugins in `claude-plugins-official`), or an org's `allowedChannelPlugins`. "The community marketplace is not on the channel allowlist." Our plugin would therefore need one of three routes:
  - the dev flag,
  - an official-marketplace listing coordinated with Anthropic,
  - or a Team/Enterprise admin allowlisting it. ([Research preview](https://code.claude.com/docs/en/channels#research-preview); [Package as a plugin](https://code.claude.com/docs/en/channels-reference#package-as-a-plugin))
- **Dev flag:** shows a full-screen warning ("I am using this for local development") every launch. It bypasses only the allowlist, not `channelsEnabled`. ([channels reference](https://code.claude.com/docs/en/channels-reference#test-during-the-research-preview))
- **Hidden flags:** neither flag appears in `claude --help`. "The `--channels` flag syntax and protocol contract may change based on feedback." ([Research preview](https://code.claude.com/docs/en/channels#research-preview))
- **Bun:** the pre-built plugins require Bun. A custom channel does not.

## Permission prompts while channel-driven

- When Claude calls a tool that needs approval, the local terminal dialog opens and the session waits. "If Claude hits a permission prompt while you're away from the terminal, the session pauses until you respond." ([channels, Quickstart](https://code.claude.com/docs/en/channels#quickstart))
- This includes the reply tool itself: "If Claude Code asks for permission for the first reply, approve it." Pre-allowing the plugin's tools, for example with `mcp__plugin_<plugin>_<server>__*` in permissions, avoids the prompt. (Inference from standard permission rules.)
- **Permission relay:**
  - Declare `experimental['claude/channel/permission'] = {}`.
  - Claude Code then sends `notifications/claude/channel/permission_request` with `{request_id, tool_name, description, input_preview}`.
  - The server answers with `notifications/claude/channel/permission` `{request_id, behavior: 'allow'|'deny'}`.
  - The terminal dialog stays live, and the first answer wins.
  - Relay covers tool approvals (Bash, Write, Edit, MCP tools). It does not cover project-trust or MCP-consent dialogs, which are terminal-only.
  - The ID is five letters from a–z, excluding `l`. A repeated ID is dropped.
  - From v2.1.234, relay goes only to registered channel servers, and `description`/`input_preview` are sanitized and credential-masked. ([Relay permission prompts](https://code.claude.com/docs/en/channels-reference#relay-permission-prompts))
  - The web UI could therefore render approve/deny buttons for the player.
- **Bypass:** `--dangerously-skip-permissions` (or other permission modes) avoids most prompts in trusted environments. Actions that no mode auto-approves still prompt. ([channels](https://code.claude.com/docs/en/channels); [permission modes](https://code.claude.com/docs/en/permission-modes))
- **Security:** "An ungated channel is a prompt injection vector." Gate on sender identity before emitting. For us that means binding to `127.0.0.1`, and ideally adding a per-session token so other local pages or processes cannot inject. ([Gate inbound messages](https://code.claude.com/docs/en/channels-reference#gate-inbound-messages))

## Known limits (summary)

1. Research preview: the protocol, flags and allowlist may change, and the flags are undocumented in `--help`.
2. A custom channel needs the dev flag, which means an interactive terminal, a confirmation dialog on every launch, and no `-p` or Agent SDK.
3. Events arrive only while the session is open. The channel server lives and dies with the session.
4. There is no delivery acknowledgement, and events are silently dropped if the channel is not registered.
5. Events that arrive while Claude is busy are batched into the next turn, not interleaved.
6. Output to the UI goes only through tool calls. There is no streaming, and transcript text never reaches the UI.
7. Permission prompts pause the session unless relayed, pre-allowed or bypassed. Trust and consent dialogs are terminal-only.
8. Requires claude.ai or Console auth. No Bedrock, Vertex or Foundry. Team/Enterprise needs admin opt-in.
9. Watch the MCP protocol revision 2026-07-28 / v2 runtime incompatibility.

## Related alternatives

- [Remote Control](https://code.claude.com/docs/en/remote-control) (`claude --remote-control`) drives a local session from claude.ai or the Claude app. It does not give us our own UI.
- A plain MCP server (no channel) can serve tools and a UI, but it cannot push player input into the session. ([How channels compare](https://code.claude.com/docs/en/channels#how-channels-compare))
