import { Ct as DUNGEON_MASTER_HOME, Tt as DUNGEON_MASTER_VERSION, _ as event, _t as asc, i as userStateDir, l as campaign, n as canonicalFolder, wt as DUNGEON_MASTER_PORT } from "./paths.js";
import { h as SESSION_LIVE_MESSAGE, i as sessions, l as NotACampaignFolderError, n as library } from "./campaign.js";
import { g as prettifyError, h as toJSONSchema, o as int, p as string, u as object } from "./schemas.js";
import { n as CampaignSeedError, o as parseCampaignSeed, r as campaignSeedCard, t as CAMPAIGN_SEED_FIELDS } from "./seed.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
// src/lib/server/runtime.ts
function runtimeFilePath(home) {
	return path.join(home, "runtime.json");
}
function writeRuntimeFile(home, runtime) {
	fs.mkdirSync(home, { recursive: true });
	const file = runtimeFilePath(home);
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(runtime) + "\n", { mode: 384 });
	fs.renameSync(tmp, file);
}
// src/lib/server/tools/contract.ts
/**
* The shared contract every game tool follows: short snake_case names, per-Entity versions on
* every read and write, one transaction and one Event per mutating call, and errors shaped
* `{code, message, next}`.
*/
/** The plugin's name, which namespaces the skills a tool points to. */
var PLUGIN_NAME = "the-dungeon-master";
/** A refusal the DM can act on: what went wrong and the call to make next. */
var ToolError = class ToolError extends Error {
	code;
	next;
	constructor(code, message, next) {
		super(message);
		this.code = code;
		this.next = next;
	}
	/** The handle names no Entity. */
	static unknownHandle(handle) {
		return new ToolError("unknown_handle", `No Entity has the handle ${handle}`, "Check the handle against a recent read and call again");
	}
	/** The write passed an old version: someone changed the Entity since the DM read it. */
	static staleVersion(handle, given, current, read) {
		return new ToolError("stale_version", `${handle} is at version ${current}, not ${given}: it changed since you read it`, read);
	}
	/** The input breaks a rule the forms enforce too. */
	static invalidInput(tool, message) {
		return new ToolError("invalid_input", message, `Fix the arguments and call ${tool} again`);
	}
};
/** Refuses a write whose version is not the Entity's current one. */
function expectVersion(entity, given) {
	if (entity.version !== given) throw ToolError.staleVersion(entity.handle, given, entity.version, entity.read);
}
/** A tool that only reads. It logs nothing. */
function readTool(tool) {
	return {
		...tool,
		mutates: false,
		run: tool.run
	};
}
/** A tool that changes state: one transaction, exactly one Event. */
function writeTool(tool) {
	return {
		...tool,
		mutates: true,
		run: tool.run
	};
}
// src/lib/server/tools/seed-tools.ts
/** The Seed is one Entity per Campaign, so its handle is fixed. */
var HANDLE = "campaign";
function current({ db }) {
	const found = db.select().from(campaign).get();
	if (!found) throw ToolError.unknownHandle(HANDLE);
	return found;
}
function view(found) {
	const seed = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, found[f]]));
	return {
		handle: HANDLE,
		version: found.version,
		...seed
	};
}
var fields = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, string().optional()]));
// src/lib/server/tools/index.ts
/** Every game tool the server exposes to the DM. */
var gameTools = [...[readTool({
	name: "seed",
	description: "Read the Campaign Seed (name, premise, tone, length and optional World details) and its version.",
	input: object({}),
	run: (ctx) => view(current(ctx))
}), writeTool({
	name: "set_seed",
	description: "Set Campaign Seed fields. Pass the version from your last `seed` read; an empty string clears an optional field.",
	input: object({
		version: int(),
		...fields
	}),
	run: (ctx, { version, ...changes }) => {
		const found = current(ctx);
		expectVersion({
			handle: HANDLE,
			version: found.version,
			read: "seed"
		}, version);
		if (found.archivedAt !== null) throw new ToolError("archived", "An archived Campaign cannot be changed", "Stop here");
		let seed;
		try {
			seed = parseCampaignSeed({
				...campaignSeedCard(found),
				...changes
			});
		} catch (e) {
			if (e instanceof CampaignSeedError) throw ToolError.invalidInput("set_seed", e.message);
			throw e;
		}
		return {
			result: view(ctx.db.update(campaign).set({
				...seed,
				version: found.version + 1,
				updatedAt: Date.now()
			}).returning().get()),
			event: {
				kind: "seed_changed",
				summary: `Seed changed: ${Object.keys(changes).join(", ")}`,
				data: changes
			}
		};
	}
})]];
// src/lib/server/tools/host.ts
var json$1 = (value) => ({ content: [{
	type: "text",
	text: JSON.stringify(value)
}] });
var failure = (e) => ({
	...json$1({
		code: e.code,
		message: e.message,
		next: e.next
	}),
	isError: true
});
/** The output of a tool that enters a situation, pointing at the skill to load. */
function withSkill(result, skill) {
	if (!skill) return result;
	const name = `${PLUGIN_NAME}:${skill}`;
	return {
		...result,
		skill: name,
		next: `Load skill ${name} before continuing.`
	};
}
/**
* The game's tools, called by name against a Campaign folder. Every call follows the contract in
* `./contract`: validated input, `{code, message, next}` refusals, and for mutating tools one
* transaction that logs exactly one Event.
*/
function createToolHost({ library, tools, stamp = () => ({
	sessionId: null,
	minute: 0
}), now = Date.now }) {
	const byName = new Map(tools.map((t) => [t.name, t]));
	function campaignDb(folder) {
		const db = library.databaseFor(folder);
		if (!db) throw new ToolError("not_a_campaign", `${folder} is not a registered Campaign folder`, "Ask the Player to open or create the Campaign in the web UI, then run dm in its folder");
		return db;
	}
	function run(tool, db, args) {
		const parsed = tool.input.safeParse(args ?? {});
		if (!parsed.success) throw ToolError.invalidInput(tool.name, prettifyError(parsed.error));
		if (!tool.mutates) return tool.run({ db }, parsed.data);
		return db.transaction((tx) => {
			const { result, skill, event: logged } = tool.run({ db: tx }, parsed.data);
			const { sessionId, minute } = stamp(tx);
			tx.insert(event).values({
				sessionId,
				minute,
				tool: tool.name,
				kind: logged.kind,
				summary: logged.summary,
				data: logged.data ?? null,
				dmOnly: logged.dmOnly ?? false,
				createdAt: now()
			}).run();
			return withSkill(result, skill);
		});
	}
	return {
		/** Every tool, as `tools/list` shows it. */
		list() {
			return tools.map((t) => ({
				name: t.name,
				description: t.description,
				inputSchema: toJSONSchema(t.input, { io: "input" })
			}));
		},
		/** Calls a tool for the Campaign in `folder`. Refusals come back as `isError` results. */
		call(folder, name, args) {
			try {
				const tool = byName.get(name);
				if (!tool) throw new ToolError("unknown_tool", `There is no tool named ${name}`, "Use a listed tool");
				return json$1(run(tool, campaignDb(folder), args));
			} catch (e) {
				if (e instanceof ToolError) return failure(e);
				throw e;
			}
		},
		/** The Campaign's Event log, oldest first. */
		events(folder) {
			return campaignDb(folder).select().from(event).orderBy(asc(event.id)).all().map((e) => ({
				id: e.id,
				session: e.sessionId,
				minute: e.minute,
				tool: e.tool,
				kind: e.kind,
				summary: e.summary,
				data: e.data ?? null,
				dmOnly: e.dmOnly
			}));
		}
	};
}
var json = (body, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers: { "content-type": "application/json" }
});
function authorized(request, token) {
	const given = Buffer.from(request.headers.get("authorization") ?? "");
	const expected = Buffer.from(`Bearer ${token}`);
	return given.length === expected.length && timingSafeEqual(given, expected);
}
var encoder = new TextEncoder();
/**
* A Campaign's channel events as Server-Sent Events, until the bridge hangs up. While the stream
* is open, the bridge's session is attached to the Campaign.
*/
function eventStream(channels, folder, detach) {
	let stop = () => {};
	const body = new ReadableStream({
		start(controller) {
			const write = (text) => controller.enqueue(encoder.encode(text));
			write(": open\n\n");
			const unlisten = channels.listen(folder, (event) => write(`event: channel\ndata: ${JSON.stringify(event)}\n\n`));
			const keepAlive = setInterval(() => write(": ka\n\n"), 15e3);
			stop = () => {
				unlisten();
				clearInterval(keepAlive);
				detach();
			};
		},
		cancel: () => stop()
	});
	return new Response(body, { headers: {
		"content-type": "text/event-stream",
		"cache-control": "no-cache"
	} });
}
/** The refusal a second session gets, as `{code, message, next}`. */
var SESSION_LIVE = {
	code: "session_live",
	message: SESSION_LIVE_MESSAGE,
	next: "Tell the Player this table already has a DM: end the other session before using this one"
};
/**
* The game server's interface for the bridge, gated by the runtime token:
* - `GET  tools`: the tool list, so tools change without republishing the plugin.
* - `POST call` with `{campaign, name, arguments}`: one tool call for the Campaign folder.
* - `GET  events?campaign=<folder>`: the Campaign's channel events as SSE; holding it open
*   attaches the bridge's session (`x-dm-session`). A second session is refused (409).
* - `POST register` with `{folder}`: registers a Campaign folder (the launcher), answering
*   `{id, name, attached}`.
*/
function createBridgeApi({ library, host, channels, sessions, token }) {
	return async function handle(request) {
		if (!authorized(request, token)) return json({ error: "bad token" }, 401);
		const url = new URL(request.url);
		const route = url.pathname.slice(12);
		if (route === "tools" && request.method === "GET") return json({ tools: host.list() });
		if (route === "call" && request.method === "POST") {
			const { campaign, name, arguments: args } = await request.json();
			if (!campaign || !name) return json({ error: "campaign and name are required" }, 400);
			const entry = library.entryAt(campaign);
			const session = request.headers.get("x-dm-session") ?? "";
			if (entry && sessions.heldByOther(entry.id, session)) return json({
				content: [{
					type: "text",
					text: JSON.stringify(SESSION_LIVE)
				}],
				isError: true
			});
			return json(host.call(campaign, name, args));
		}
		if (route === "events" && request.method === "GET") {
			const campaign = url.searchParams.get("campaign");
			if (!campaign) return json({ error: "campaign is required" }, 400);
			const entry = library.entryAt(campaign);
			if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404);
			const session = request.headers.get("x-dm-session") ?? crypto.randomUUID();
			if (!sessions.attach(entry.id, session)) return json(SESSION_LIVE, 409);
			return eventStream(channels, campaign, () => sessions.detach(entry.id, session));
		}
		if (route === "register" && request.method === "POST") {
			const { folder } = await request.json();
			if (!folder) return json({ error: "folder is required" }, 400);
			try {
				const { id, name } = library.register(folder);
				return json({
					id,
					name,
					attached: sessions.attached(id)
				});
			} catch (e) {
				if (e instanceof NotACampaignFolderError) return json({ error: e.message }, 404);
				throw e;
			}
		}
		return json({ error: "not found" }, 404);
	};
}
// src/lib/server/bridge/channels.ts
/** Channel events per Campaign folder, delivered to the bridges listening for it. */
function createChannels() {
	const listeners = /* @__PURE__ */ new Map();
	const key = canonicalFolder;
	return {
		/** Starts listening for a Campaign's events; returns the unsubscribe. */
		listen(folder, listener) {
			const set = listeners.get(key(folder)) ?? /* @__PURE__ */ new Set();
			listeners.set(key(folder), set);
			set.add(listener);
			return () => set.delete(listener);
		},
		/** Whether any bridge is listening for the Campaign. */
		listening(folder) {
			return (listeners.get(key(folder))?.size ?? 0) > 0;
		},
		send(folder, event) {
			for (const listener of listeners.get(key(folder)) ?? []) listener(event);
		}
	};
}
// src/lib/server/bridge/index.ts
/** A fresh token each server start; only processes that can read the runtime file know it. */
var token = randomBytes(24).toString("hex");
/** The game's tools, over the server's Campaign library. */
var host = createToolHost({
	library,
	tools: gameTools
});
/** Channel events for the DM, per Campaign folder. */
var channels = createChannels();
var bridgeApi = createBridgeApi({
	library,
	host,
	channels,
	sessions,
	token
});
/** The known localhost port, unless overridden for tests. */
var port = Number(DUNGEON_MASTER_PORT || 4777);
/** Writes the runtime file (port, token, pid, version) so the bridge and launcher find this server. */
function announceServer() {
	writeRuntimeFile(userStateDir({ DUNGEON_MASTER_HOME }), {
		port,
		token,
		pid: process.pid,
		version: DUNGEON_MASTER_VERSION || void 0
	});
}
export { port as a, host as i, bridgeApi as n, channels as r, announceServer as t };

//# sourceMappingURL=bridge.js.map