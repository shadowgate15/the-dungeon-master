import { $ as subclass, A as npcCombat, B as pageRevision, C as characterSpell, D as declaration, E as conversationMessage, F as beat, G as abilityScoreMethod, H as ENTITY_TYPES, I as belief, J as classTable, K as alignment, L as entity, M as session, N as act, O as event, P as arc, Q as spell, R as entityAlias, S as characterSkill, T as combatant$1, U as NPC_STATUSES, V as worldLink, W as handleKind, X as race, Y as equipment, Z as skill, _ as character, a as createRulesRepository, at as gt, b as characterEquipment, c as abilities_default, ct as isNotNull, d as defaultCampaignRoot, dt as lt, et as subrace, f as userStateDir, ft as ne, g as campaign, gt as is, h as callPart, ht as Column, it as eq, j as returnedDraft, k as floor, l as campaignDatabasePath, lt as isNull, m as call, mt as sql, nt as desc, o as loadRulesDataset, ot as gte, p as activityLine, pt as or, q as background, rt as and, s as skills_default, st as inArray, t as openSeededDatabase, tt as asc, u as canonicalFolder, ut as like, v as characterChoice, vt as DUNGEON_MASTER_CAMPAIGNS, w as combat, x as characterItem, y as characterDraft, yt as DUNGEON_MASTER_HOME, z as fact } from "./seed.js";
import { a as CUSTOM_BACKGROUND_FEATURE_MAX, c as SOLO_PLAYER, r as BACKSTORY_MAX, t as ABILITY_METHODS } from "./enums2.js";
import { F as equipmentGroups, P as equipmentGroupKeys, R as resolveFeatures, c as WIZARD_RULES_KEYS, f as resolverDraft, g as STEPS, i as tryDraftToCharacterInput, l as changedDraftFields, n as detailToSummaryData, o as deriveStats, p as classSpellOptions, t as buildSummary, u as emptyDraft } from "./summary.js";
import { _ as prettifyError, c as literal, f as strictObject, m as union, p as string, r as array, t as _enum, u as object } from "./schemas.js";
import { s as ABILITY_KEYS } from "./schema.js";
import { a as missingSeedFields, o as parseCampaignSeed, r as campaignSeedCard, t as CAMPAIGN_SEED_FIELDS } from "./seed2.js";
import fs from "node:fs";
import path from "node:path";
// src/lib/server/bridge/sessions.ts
/** Why a second bridge for a Campaign is refused. */
var SESSION_LIVE_MESSAGE = "This Campaign already has a live session: another Claude Code session is the DM at this table";
/**
* Which Campaigns have a DM at the table: one live session per Campaign, held by the bridge whose
* channel stream is connected. A bridge may hold several streams at once (a reconnect racing the
* old one); the session detaches when its last stream goes.
*/
function createSessions() {
	const live = /* @__PURE__ */ new Map();
	const listeners = /* @__PURE__ */ new Set();
	const emit = (change) => {
		for (const listener of listeners) listener(change);
	};
	return {
		/** Attaches the session to the Campaign; false when another session already holds it. */
		attach(campaign, session) {
			const held = live.get(campaign);
			if (held && held.session !== session) return false;
			if (held) held.streams++;
			else {
				live.set(campaign, {
					session,
					streams: 1
				});
				emit({
					campaign,
					attached: true,
					session
				});
			}
			return true;
		},
		/** Ends one of the session's streams; the Campaign is free once its last one ends. */
		detach(campaign, session) {
			const held = live.get(campaign);
			if (!held || held.session !== session) return;
			if (--held.streams > 0) return;
			live.delete(campaign);
			emit({
				campaign,
				attached: false,
				session
			});
		},
		/** Whether a session is attached to the Campaign. */
		attached(campaign) {
			return live.has(campaign);
		},
		/** Whether the Campaign is held by a session other than this one. */
		heldByOther(campaign, session) {
			const held = live.get(campaign);
			return held !== void 0 && held.session !== session;
		},
		/** The ids of every Campaign with a session attached. */
		list() {
			return [...live.keys()];
		},
		/** Calls `listener` on every attach and detach; returns the unsubscribe. */
		onChange(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
}
// src/lib/server/live.ts
var encoder = new TextEncoder();
/**
* The one SSE stream that keeps every browser tab current: each message names a state change the
* browser answers by invalidating its TanStack Query caches. Session attach and detach are pushed
* as they happen; later state changes are pushed with `publish`.
*/
function createLiveUpdates({ sessions }) {
	const listeners = /* @__PURE__ */ new Set();
	function publish(message) {
		for (const listener of listeners) listener(message);
	}
	sessions.onChange(({ campaign, attached }) => publish({
		type: "session",
		campaign,
		attached
	}));
	return {
		publish,
		/** A browser's stream, until it hangs up. */
		stream() {
			let stop = () => {};
			const body = new ReadableStream({
				start(controller) {
					const write = (text) => controller.enqueue(encoder.encode(text));
					write(": open\n\n");
					const listener = (message) => write(`data: ${JSON.stringify(message)}\n\n`);
					listeners.add(listener);
					const keepAlive = setInterval(() => write(": ka\n\n"), 15e3);
					stop = () => {
						listeners.delete(listener);
						clearInterval(keepAlive);
					};
				},
				cancel: () => stop()
			});
			return new Response(body, { headers: {
				"content-type": "text/event-stream",
				"cache-control": "no-cache"
			} });
		}
	};
}
// ../implement-spec-383/node_modules/.pnpm/drizzle-orm@0.45.4_@types+better-sqlite3@9.6.0_better-sqlite3@13.0.3/node_modules/drizzle-orm/sql/functions/aggregate.js
function count(expression) {
	return sql`count(${expression || sql.raw("*")})`.mapWith(Number);
}
function max(expression) {
	return sql`max(${expression})`.mapWith(is(expression, Column) ? expression : String);
}
/** What the DM hears for the localhost browser. */
var HOST = "Host";
/**
* Names each Player by the Characters their browser Claims right now (`Player of Wren & Ash`),
* marking the Host's localhost browser (`Host · Player of Wren`, or just `Host` with no Claims).
* A browser with no Claims that isn't the Host is `a Player`. Read when the event is sent.
*/
function playerLabels(db) {
	const held = db.select({
		name: character.name,
		browser: character.controllingPlayer
	}).from(character).where(and(isNotNull(character.controllingPlayer), ne(character.status, "departed"))).orderBy(asc(character.createdAt), asc(character.name)).all();
	return (browser) => {
		const names = held.filter((c) => c.browser === browser).map((c) => c.name);
		const named = names.length ? `Player of ${names.join(" & ")}` : null;
		if (browser === "player") return named ? `${HOST} · ${named}` : HOST;
		return named ?? "a Player";
	};
}
/**
* The table as the DM reads it: each Player by label (the Host first, then the rest in Party order),
* then the Characters nobody has Claimed. With no Claims it says so.
*/
function whoIsAtTheTable(db) {
	const rows = db.select({
		name: character.name,
		browser: character.controllingPlayer
	}).from(character).where(ne(character.status, "departed")).orderBy(asc(character.createdAt), asc(character.name)).all();
	const label = playerLabels(db);
	const browsers = [...new Set(rows.flatMap((r) => r.browser ? [r.browser] : []))].sort((a, b) => Number(b === SOLO_PLAYER) - Number(a === SOLO_PLAYER));
	const free = rows.filter((r) => !r.browser).map((r) => r.name);
	return `Who's at the table: ${[browsers.length ? browsers.map(label).join("; ") : "no one has Claimed yet", ...free.length ? [`unclaimed: ${free.join(", ")}`] : []].join("; ")}.`;
}
// src/lib/character/edit.ts
/**
* Turns the stored rows of one choice group back into the player's pick: the first option whose
* fixed items are all present and whose leftover items exactly fill its wildcard slots. Null when
* no option fits (Rules Data drift); the Equipment step then flags the group as unanswered.
*/
function pickFromRows(group, rows) {
	for (const option of group.options) {
		const left = /* @__PURE__ */ new Map();
		for (const r of rows) left.set(r.item, (left.get(r.item) ?? 0) + r.quantity);
		let fits = true;
		for (const line of option.lines) {
			if (line.kind !== "item") continue;
			const have = left.get(line.item) ?? 0;
			if (have < line.count) fits = false;
			left.set(line.item, have - line.count);
		}
		if (!fits) continue;
		const wild = [...left].flatMap(([item, n]) => Array(Math.max(n, 0)).fill(item));
		if (wild.length === option.slots.length) return {
			option: option.index,
			wild
		};
	}
	return null;
}
/**
* The wizard draft for a saved Character (#115), so the edit page reopens it prefilled. Pure
* inverse of `draftToCharacterInput`: service vocabulary back to draft vocabulary (`roll` is
* `rolling`, scores are `baseScores`), and stored equipment rows back to option picks.
*/
function detailToDraft(rules, c) {
	const draft = {
		...emptyDraft(),
		name: c.name,
		race: c.raceSlug,
		subrace: c.subraceSlug,
		class: c.classSlug,
		subclass: c.subclassSlug,
		background: c.backgroundSlug,
		alignment: c.alignment,
		appearance: c.appearance ?? "",
		personality: c.personality ?? "",
		ideal: c.ideal ?? "",
		bond: c.bond ?? "",
		flaw: c.flaw ?? "",
		backstory: c.backstory ?? "",
		level: c.level,
		abilityMethod: c.abilityMethod === "roll" ? "rolling" : c.abilityMethod,
		baseScores: {
			str: c.str,
			dex: c.dex,
			con: c.con,
			int: c.int,
			wis: c.wis,
			cha: c.cha
		},
		abilityRolls: c.abilityRolls ?? null,
		picks: structuredClone(c.picks),
		classSpells: [...c.classSpells],
		customBackgroundName: c.customBackgroundName ?? "",
		customBackgroundFeature: c.customBackgroundFeature ?? ""
	};
	const resolved = resolveFeatures(rules, resolverDraft(draft));
	for (const group of equipmentGroups(rules, draft, resolved)) {
		const pick = pickFromRows(group, c.equipment.filter((e) => e.choiceKey === group.key).map((e) => ({
			item: e.item,
			quantity: e.quantity
		})));
		if (pick) draft.equipment[group.key] = pick;
	}
	return draft;
}
// src/lib/character/level-up.ts
/** The Wizard adds two spells to the spellbook each level (SRD p.114). */
var WIZARD_SPELLS_PER_LEVEL = 2;
function casting(rules, classSlug, level) {
	return rules.classLevels.find((l) => l.class === classSlug && l.level === level)?.spellcasting;
}
/** The highest spell level the class has slots for at a level; 0 when none. */
function highestSlotLevel(rules, classSlug, level) {
	return (casting(rules, classSlug, level)?.slots ?? []).reduce((top, n, i) => n > 0 ? i + 1 : top, 0);
}
/**
* The offer for reaching `level`: new cantrips by the class table's Cantrips Known, new spells by
* its Spells Known (two for the Wizard's spellbook), from the class list up to the highest slot
* level, leaving out the spells the Character already has. Prepared casters pick nothing.
*/
function levelUpOffer(rules, classSlug, level, known) {
	const before = casting(rules, classSlug, level - 1);
	const after = casting(rules, classSlug, level);
	const cantrips = Math.max(0, (after?.cantripsKnown ?? 0) - (before?.cantripsKnown ?? 0));
	const spells = classSlug === "wizard" ? level === 1 ? 6 : WIZARD_SPELLS_PER_LEVEL : Math.max(0, (after?.spellsKnown ?? 0) - (before?.spellsKnown ?? 0));
	const top = highestSlotLevel(rules, classSlug, level);
	const have = new Set(known);
	const options = (levels) => levels.flatMap((l) => classSpellOptions(rules, classSlug, l)).filter((o) => !have.has(o.slug)).sort((a, b) => a.name.localeCompare(b.name));
	return {
		level,
		cantrips: {
			count: cantrips,
			options: cantrips > 0 ? options([0]) : []
		},
		spells: {
			count: spells,
			options: spells > 0 ? options(Array.from({ length: top }, (_, i) => i + 1)) : []
		}
	};
}
/** Why the picks do not fit the offer, or null when they do. */
function levelUpIssue(offer, picks) {
	for (const kind of ["cantrips", "spells"]) {
		const chosen = picks[kind] ?? [];
		const { count, options } = offer[kind];
		if (chosen.length !== count || new Set(chosen).size !== chosen.length) return `Pick ${count} ${count === 1 ? kind.slice(0, -1) : kind}`;
		const wrong = chosen.find((s) => !options.some((o) => o.slug === s));
		if (wrong) return `${wrong} is not one of the ${kind} to pick from`;
	}
	return null;
}
// src/lib/server/world/names.ts
/** Names: handle slugs and the near-duplicate test `establish` and link near-matches use. */
var plain = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** The slug part of a handle: `Mira Voss` → `mira-voss`. */
function slug$1(name) {
	return plain(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unnamed";
}
/** A name reduced for comparison: lower case, letters and digits only, no leading "the". */
function normalizeName(name) {
	return plain(name).replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");
}
function distance(a, b) {
	let row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const next = [i];
		for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		row = next;
	}
	return row[b.length];
}
/**
* Whether two names are close enough to be the same thing: equal once normalized, a typo apart,
* or one's words all in the other ("Mira" and "Mira Voss").
*/
function isNearName(a, b) {
	const x = normalizeName(a);
	const y = normalizeName(b);
	if (!x || !y) return false;
	if (x === y) return true;
	if (distance(x, y) <= Math.max(1, Math.floor(Math.max(x.length, y.length) / 6))) return true;
	const [short, long] = x.length <= y.length ? [x, y] : [y, x];
	const words = new Set(long.split(" "));
	return short.split(" ").every((w) => words.has(w));
}
// src/lib/server/knowledge/holders.ts
/**
* Every Character with its handle, in the order they joined the Party: the one place handles are
* worked out. A handle is `char:` and the name's slug, numbered (`char:wren-2`) when two
* Characters share a name. Characters are not Entities, but Facts, Beliefs and tools link to them
* by handle.
*/
function characterRefs(db) {
	const rows = db.select().from(character).orderBy(sql`rowid`).all();
	const taken = /* @__PURE__ */ new Set();
	return rows.map((row) => {
		const base = `char:${slug$1(row.name) || "character"}`;
		let handle = base;
		for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`;
		taken.add(handle);
		return {
			handle,
			row
		};
	});
}
/** A Character's handle by its id. */
function characterHandleOf(db, id) {
	return characterRefs(db).find((c) => c.row.id === id)?.handle;
}
/** A Character reference as a Holder. */
var asHolder = ({ handle, row }) => ({
	id: row.id,
	handle,
	name: row.name,
	player: row.controllingPlayer
});
/** Every Character in the Campaign as a Holder. */
function characterHolders(db) {
	return characterRefs(db).map(asHolder);
}
// src/lib/server/bridge/channels.ts
/** Channel events per Campaign folder, delivered to the bridges listening for it. */
function createChannels({ annotate } = {}) {
	const listeners = /* @__PURE__ */ new Map();
	const verdictListeners = /* @__PURE__ */ new Map();
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
			const set = listeners.get(key(folder));
			if (!set?.size) return;
			const delivered = annotate ? annotate(folder, event) : event;
			for (const listener of set) listener(delivered);
		},
		/** Starts listening for the verdicts the Player gives the Campaign's session; returns the unsubscribe. */
		listenVerdicts(folder, listener) {
			const set = verdictListeners.get(key(folder)) ?? /* @__PURE__ */ new Set();
			verdictListeners.set(key(folder), set);
			set.add(listener);
			return () => set.delete(listener);
		},
		/** Relays a permission verdict to the Campaign's session. */
		sendVerdict(folder, verdict) {
			for (const listener of verdictListeners.get(key(folder)) ?? []) listener(verdict);
		}
	};
}
// src/lib/play/clock.ts
/**
* The Campaign clock counts in-fiction minutes from the Campaign's start, which is day 1 at 08:00.
* Shown as "day 3, 14:20". Named calendars wait until the World needs them.
*/
var DAY = 1440;
/** The time of day the Campaign starts, in minutes after midnight. */
var START = 480;
var pad = (n) => String(n).padStart(2, "0");
/** The clock as day and time of day, e.g. `{ day: 3, time: '14:20' }`. */
function clockParts(minute) {
	const since = START + minute;
	const ofDay = since % DAY;
	return {
		day: Math.floor(since / DAY) + 1,
		time: `${pad(Math.floor(ofDay / 60))}:${pad(ofDay % 60)}`
	};
}
/** The clock as the Players read it: "day 3, 14:20". */
function formatClock(minute) {
	const { day, time } = clockParts(minute);
	return `day ${day}, ${time}`;
}
/** The minute a "day 3, 14:20" reading names, or null when it isn't one (or is before the start). */
function parseClock(text) {
	const match = /^\s*day\s+(\d+),?\s+(\d{1,2}):(\d{2})\s*$/i.exec(text);
	if (!match) return null;
	const [day, hours, minutes] = match.slice(1).map(Number);
	if (day < 1 || hours > 23 || minutes > 59) return null;
	const minute = (day - 1) * DAY + hours * 60 + minutes - START;
	return minute < 0 ? null : minute;
}
// src/lib/server/tools/contract.ts
/**
* The shared contract every game tool follows: short snake_case names, per-Entity versions on
* every read and write, one transaction and one Event per mutating call, and errors shaped
* `{code, message, next}`.
*/
/** The plugin's name, which namespaces the skills a tool points to. */
var PLUGIN_NAME = "the-dungeon-master";
/**
* A refusal the DM can act on: what went wrong and the call to make next. `details` adds
* structured data to the payload (such as the matches a near-duplicate refusal found).
*/
var ToolError = class ToolError extends Error {
	code;
	next;
	details;
	constructor(code, message, next, details) {
		super(message);
		this.code = code;
		this.next = next;
		this.details = details;
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
		activity: tool.activity,
		mutates: false,
		run: tool.run
	};
}
/** A tool that changes state: one transaction, exactly one Event. */
function writeTool(tool) {
	return {
		...tool,
		activity: tool.activity,
		mutates: true,
		run: tool.run
	};
}
/**
* A tool that changes creation state (the Seed card, Character drafts, the creation conversation):
* one transaction, and no Event, since the Event log starts with the story.
*/
function creationTool(tool) {
	return {
		...tool,
		mutates: "creation",
		run: tool.run
	};
}
// src/lib/server/story/arc.ts
/** There is already a current Arc; a Campaign has at most one. */
var CurrentArcError = class extends Error {};
/** The current Arc in full, as the DM reads it, or null in a gap between Arcs. */
function currentArc(db) {
	const found = currentRow(db);
	return found ? arcView(db, found) : null;
}
/** The Arcs that have left current (concluded or retired), oldest first. */
function pastArcs(db) {
	return db.select().from(arc).where(ne(arc.state, "current")).orderBy(asc(arc.createdAt)).all().map((found) => arcView(db, found));
}
var currentRow = (db) => db.select().from(arc).where(eq(arc.state, "current")).get();
function arcView(db, found) {
	const acts = db.select().from(act).where(eq(act.arcId, found.id)).orderBy(asc(act.position)).all();
	const beats = acts.length ? db.select().from(beat).where(inArray(beat.actId, acts.map((a) => a.id))).orderBy(asc(beat.position)).all() : [];
	return {
		title: found.title,
		premise: found.premise,
		stakes: found.stakes,
		resolution: found.resolution,
		state: found.state,
		version: found.version,
		...found.state === "current" ? {} : { endReason: found.endReason },
		acts: acts.map((a, i) => ({
			number: i + 1,
			name: a.name,
			purpose: a.purpose,
			beats: beats.filter((b) => b.actId === a.id).map((b) => ({
				handle: b.handle,
				title: b.title,
				description: b.description,
				state: b.state,
				reason: b.reason,
				...b.state === "pending" ? {} : {
					event: b.resolvedEvent,
					minute: b.resolvedMinute
				}
			}))
		}))
	};
}
/** A Beat handle from its title, unique across every Arc the Campaign has had. */
function beatHandle(db, title, taken) {
	const base = `beat:${slug$1(title)}`;
	for (let n = 1;; n++) {
		const handle = n === 1 ? base : `${base}-${n}`;
		if (taken.has(handle)) continue;
		if (db.select({ handle: beat.handle }).from(beat).where(eq(beat.handle, handle)).get()) continue;
		taken.add(handle);
		return handle;
	}
}
/** Creates the current Arc; refused (`CurrentArcError`) while one exists. */
function createArc(db, input, at) {
	if (db.select({ id: arc.id }).from(arc).where(eq(arc.state, "current")).get()) throw new CurrentArcError("A current Arc already exists");
	const created = db.insert(arc).values({
		title: input.title,
		premise: input.premise,
		stakes: input.stakes,
		resolution: input.resolution,
		createdAt: at
	}).returning().get();
	const taken = /* @__PURE__ */ new Set();
	input.acts.forEach((a, position) => {
		const { id } = db.insert(act).values({
			arcId: created.id,
			position,
			name: a.name,
			purpose: a.purpose
		}).returning({ id: act.id }).get();
		a.beats.forEach((b, i) => {
			db.insert(beat).values({
				handle: beatHandle(db, b.title, taken),
				actId: id,
				position: i,
				title: b.title,
				description: b.description
			}).run();
		});
	});
	return arcView(db, created);
}
/** Discards every Arc (Start over, before the story has a Narration). */
function discardArcs(db) {
	db.delete(arc).run();
}
/** The Event kinds that change the Arc; the drift count restarts at the latest of them. */
var ARC_CHANGES = [
	"arc_created",
	"beat_resolved",
	"arc_revised",
	"arc_retired"
];
/**
* The drift count: Player Declarations since the last Arc change (`create_arc`, `resolve_beat`,
* `revise_arc`, or the Arc ending), or since the log began.
*/
function driftCount(db) {
	const last = db.select({ id: event.id }).from(event).where(inArray(event.kind, ARC_CHANGES)).orderBy(desc(event.id)).limit(1).get();
	const where = [eq(event.kind, "declaration")];
	if (last) where.push(gt(event.id, last.id));
	return db.select({ n: count() }).from(event).where(and(...where)).get()?.n ?? 0;
}
var READ_ARC = "Read arc() for the current version and call again";
/** The current Arc at `version`, or a refusal the DM can act on. */
function writableArc(db, version) {
	const found = currentRow(db);
	if (!found) throw new ToolError("no_current_arc", "There is no current Arc", "Read arc(); in a gap, have builder draft the next Arc with create_arc");
	expectVersion({
		handle: "The Arc",
		version: found.version,
		read: READ_ARC
	}, version);
	return found;
}
/** A Beat of the current Arc by handle, with the position of its Act. */
function beatOf(db, arcId, handle) {
	const found = db.select({
		beat,
		actPosition: act.position
	}).from(beat).innerJoin(act, eq(beat.actId, act.id)).where(and(eq(beat.handle, handle), eq(act.arcId, arcId))).get();
	if (!found) throw new ToolError("unknown_beat", `The current Arc has no Beat ${handle}`, "Check the handle against arc() and call again");
	return found;
}
/** Refuses a change to a Beat that has left pending. */
function expectPending(b) {
	if (b.state !== "pending") throw new ToolError("beat_not_pending", `${b.handle} is ${b.state}; a Beat leaves pending once and stays as history`, "Add a new Beat with revise_arc instead");
}
var beatSummary = (b) => ({
	handle: b.handle,
	title: b.title,
	state: b.state
});
/** Abandons Beats with a reason and stamp; returns them. */
function abandon(ctx, beats, reason) {
	return beats.map((b) => stampBeat(ctx, b, "abandoned", reason));
}
function stampBeat({ db, stamp, now }, b, state, reason) {
	return db.update(beat).set({
		state,
		reason,
		resolvedAt: now,
		resolvedEvent: stamp.eventId,
		resolvedSession: stamp.sessionId,
		resolvedMinute: stamp.minute
	}).where(eq(beat.handle, b.handle)).returning().get();
}
/** The pending Beats of an Arc, Act by Act. */
function pendingBeats(db, arcId) {
	return db.select({ beat }).from(beat).innerJoin(act, eq(beat.actId, act.id)).where(and(eq(act.arcId, arcId), eq(beat.state, "pending"))).orderBy(asc(act.position), asc(beat.position)).all().map((r) => r.beat);
}
/** Ends the current Arc (concluded or retired) and bumps its version. */
function endArc(db, found, state, reason, at) {
	return db.update(arc).set({
		state,
		endedAt: at,
		endReason: reason,
		version: found.version + 1
	}).where(eq(arc.id, found.id)).returning().get();
}
var bump = (db, found) => db.update(arc).set({ version: found.version + 1 }).where(eq(arc.id, found.id)).returning().get();
/**
* Settles a pending Beat. Reaching a Beat in a later Act abandons every pending Beat of the earlier
* Acts (the cascade); when no Beat is left pending, the Arc concludes.
*/
function resolveBeat(ctx, input) {
	const { db } = ctx;
	const found = writableArc(db, input.version);
	const target = beatOf(db, found.id, input.beat);
	expectPending(target.beat);
	const resolved = stampBeat(ctx, target.beat, input.to, input.reason);
	const cascaded = abandon(ctx, input.to === "reached" ? db.select({ beat }).from(beat).innerJoin(act, eq(beat.actId, act.id)).where(and(eq(act.arcId, found.id), eq(beat.state, "pending"), lt(act.position, target.actPosition))).all().map((r) => r.beat) : [], `Play moved past its Act when ${resolved.handle} was reached`);
	const after = pendingBeats(db, found.id).length === 0 ? endArc(db, found, "concluded", input.reason, ctx.now) : bump(db, found);
	return {
		resolved: beatSummary(resolved),
		abandoned: cascaded.map(beatSummary),
		arc: {
			state: after.state,
			version: after.version
		}
	};
}
/** Retires the current Arc: every pending Beat is abandoned with the reason. */
function retireArc(ctx, input) {
	const found = writableArc(ctx.db, input.version);
	const abandoned = abandon(ctx, pendingBeats(ctx.db, found.id), input.reason);
	const after = endArc(ctx.db, found, "retired", input.reason, ctx.now);
	return {
		title: after.title,
		abandoned: abandoned.map(beatSummary),
		arc: {
			state: after.state,
			version: after.version
		}
	};
}
/**
* Applies every op in order, or none (the caller's transaction rolls back on a refusal). Only
* pending Beats change, nothing is deleted, and nothing is added after the final Act.
*/
function reviseArc(ctx, input) {
	const { db } = ctx;
	const found = writableArc(db, input.version);
	const acts = () => db.select().from(act).where(eq(act.arcId, found.id)).orderBy(asc(act.position)).all();
	const actAt = (n) => {
		const all = acts();
		if (n > all.length) throw new ToolError("after_final_act", `The Arc has ${all.length} Acts; nothing can be added after the final Act`, "Revise the final Act, or have builder draft the next Arc once this one ends");
		return all[n - 1];
	};
	/** Puts a Beat at a 1-based position of an Act (the end by default), renumbering the Act. */
	const place = (handle, actId, position) => {
		const others = db.select({ handle: beat.handle }).from(beat).where(and(eq(beat.actId, actId), ne(beat.handle, handle))).orderBy(asc(beat.position)).all().map((b) => b.handle);
		const at = Math.min(Math.max((position ?? others.length + 1) - 1, 0), others.length);
		others.splice(at, 0, handle);
		others.forEach((h, i) => db.update(beat).set({
			actId,
			position: i
		}).where(eq(beat.handle, h)).run());
	};
	const pendingBeat = (handle) => {
		const target = beatOf(db, found.id, handle).beat;
		expectPending(target);
		return target;
	};
	/** The fields an edit op sets, so an edit that names none changes nothing. */
	const fieldsOf = (op, ...keys) => Object.fromEntries(Object.entries(op).filter(([k, v]) => keys.includes(k) && v !== void 0));
	const edit = (table, where, fields) => {
		if (Object.keys(fields).length) db.update(table).set(fields).where(where).run();
	};
	const added = [];
	for (const op of input.ops) switch (op.op) {
		case "edit_arc":
			edit(arc, eq(arc.id, found.id), fieldsOf(op, "title", "premise", "stakes", "resolution"));
			break;
		case "edit_act":
			edit(act, eq(act.id, actAt(op.act).id), fieldsOf(op, "name", "purpose"));
			break;
		case "add_act": {
			const all = acts();
			if (op.before > all.length) actAt(op.before);
			const at = Math.max(op.before, 1) - 1;
			all.slice(at).forEach((a) => {
				db.update(act).set({ position: a.position + 1 }).where(eq(act.id, a.id)).run();
			});
			db.insert(act).values({
				arcId: found.id,
				position: all[at].position,
				name: op.name,
				purpose: op.purpose
			}).run();
			break;
		}
		case "edit_beat":
			pendingBeat(op.beat);
			edit(beat, eq(beat.handle, op.beat), fieldsOf(op, "title", "description"));
			break;
		case "add_beat": {
			const target = actAt(op.act);
			const handle = beatHandle(db, op.title, /* @__PURE__ */ new Set());
			db.insert(beat).values({
				handle,
				actId: target.id,
				position: Number.MAX_SAFE_INTEGER,
				title: op.title,
				description: op.description
			}).run();
			place(handle, target.id, op.position);
			added.push(handle);
			break;
		}
		case "move_beat":
			pendingBeat(op.beat);
			place(op.beat, actAt(op.act).id, op.position);
	}
	bump(db, found);
	return {
		...arcView(db, currentRow(db)),
		added
	};
}
// src/lib/server/world/links.ts
/** `[[Name]]`, `[[alias]]` or `[[npc:handle]]`; text after a `|` is a label and ignored. */
var LINK = /\[\[([^[\]]+?)\]\]/g;
/** An Entity handle, such as `npc:mira-voss`. */
var HANDLE = new RegExp(`^(${ENTITY_TYPES.join("|")}):[a-z0-9-]+$`);
var target = (inner) => inner.split("|")[0].trim();
/** The Entity a merged handle now lives in. */
function follow(handle, known) {
	let found = known.get(handle);
	for (let hops = 0; found?.mergedInto && hops < 10; hops++) found = known.get(found.mergedInto);
	return found;
}
function byName(name, known) {
	const wanted = normalizeName(name);
	return known.filter((k) => !k.retired && [k.name, ...k.aliases].some((n) => normalizeName(n) === wanted));
}
/**
* Rewrites `[[Name]]` links to `[[handle]]` so renames never break them. A link that names no
* Entity, or several, stays as written and is reported with near-matches. Nothing is stubbed.
*/
function resolveLinks(text, all) {
	const known = new Map(all.map((k) => [k.handle, k]));
	const links = /* @__PURE__ */ new Set();
	const unresolved = [];
	return {
		text: text.replace(LINK, (whole, inner) => {
			const name = target(inner);
			if (HANDLE.test(name) && known.has(name)) {
				links.add(follow(name, known)?.handle ?? name);
				return `[[${name}]]`;
			}
			const found = byName(name, all);
			if (found.length === 1) {
				links.add(found[0].handle);
				return `[[${found[0].handle}]]`;
			}
			const near = found.length ? found : all.filter((k) => !k.retired && [k.name, ...k.aliases].some((n) => isNearName(n, name)));
			if (!unresolved.some((u) => u.link === name)) unresolved.push({
				link: name,
				near: near.map((k) => ({
					handle: k.handle,
					name: k.name
				}))
			});
			return whole;
		}),
		links: [...links],
		unresolved
	};
}
/** Every `[[link]]` target in a text, as written (a handle once stored, or an unresolved name). */
function linkTargets(text) {
	return [...text.matchAll(LINK)].map((m) => target(m[1]));
}
/**
* Shows stored `[[handle]]` links by the Entity's current name (following merges), or by handle
* when that name would not lead back to it.
*/
function renderLinks(text, all) {
	const known = new Map(all.map((k) => [k.handle, k]));
	return text.replace(LINK, (whole, inner) => {
		const handle = target(inner);
		if (!HANDLE.test(handle)) return whole;
		const found = follow(handle, known);
		if (!found) return whole;
		const named = byName(found.name, all);
		return named.length === 1 && named[0].handle === found.handle ? `[[${found.name}]]` : `[[${found.handle}]]`;
	});
}
// src/lib/server/world/fields.ts
/** A Place's handle, as a field value that must name an existing Place. */
var placeHandle = string().regex(/^place:[a-z0-9-]+$/, "Expected a place handle (place:…)");
var prose = string().trim();
/**
* Each Entity type's typed fields. `name` is common to every type and kept outside `fields`. A
* row field is the single owner of its value: Facts and Pages should not restate it.
*/
var FIELD_SCHEMAS = {
	npc: strictObject({
		description: prose.optional(),
		role: prose.optional(),
		status: _enum(NPC_STATUSES).default("alive"),
		whereabouts: placeHandle.optional(),
		stat_block: string().regex(/^monster:[a-z0-9-]+$/, "Expected a monster handle (monster:…)").optional()
	}),
	place: strictObject({
		description: prose.optional(),
		exits: array(strictObject({
			name: prose.min(1),
			to: placeHandle.optional()
		})).default([])
	}),
	faction: strictObject({ description: prose.optional() }),
	topic: strictObject({})
};
/** The handles a type's fields point at, which must name existing Places. */
function placeRefs(fields) {
	const refs = [];
	if (typeof fields.whereabouts === "string") refs.push(fields.whereabouts);
	if (Array.isArray(fields.exits)) {
		for (const exit of fields.exits) if (exit.to) refs.push(exit.to);
	}
	return refs;
}
/** Parses a type's fields, or returns the problem in words. */
function parseFields(type, fields) {
	const parsed = FIELD_SCHEMAS[type].safeParse(fields ?? {});
	if (parsed.success) return {
		ok: true,
		fields: parsed.data
	};
	return {
		ok: false,
		message: prettifyError(parsed.error)
	};
}
/** The field names a type has, besides `name`. */
function fieldNames(type) {
	return Object.keys(FIELD_SCHEMAS[type].shape);
}
// src/lib/server/world/world.ts
/**
* Whether a Fact's claim restates a field's value: it mentions the value's words, or links to the
* Entity a handle value names.
*/
function restates(rendered, stored, value, all) {
	const mentions = (v) => {
		if (typeof v === "string") {
			const linked = all.find((k) => k.handle === v);
			if (linked && stored.includes(`[[${v}]]`)) return true;
			const word = (linked?.name ?? v).trim().toLowerCase();
			return word !== "" && rendered.toLowerCase().includes(word);
		}
		if (Array.isArray(v)) return v.some(mentions);
		if (v && typeof v === "object") return Object.values(v).some(mentions);
		return false;
	};
	return mentions(value);
}
/** The World layer over one Campaign database: the DM-only truth (ADR 0007). */
function createWorld({ db, stamp }) {
	const read = (handle) => `open ${handle}`;
	function find(handle) {
		const found = db.select().from(entity).where(eq(entity.handle, handle)).get();
		if (!found) throw ToolError.unknownHandle(handle);
		return found;
	}
	/** An Entity a write may change: it exists, isn't retired, and the DM saw its version. */
	function writable(handle, version) {
		const found = find(handle);
		expectVersion({
			handle,
			version: found.version,
			read: read(handle)
		}, version);
		if (found.retiredAt !== null) {
			const where = found.mergedInto ? `; it was merged into ${found.mergedInto}` : "";
			throw new ToolError("retired", `${handle} is retired (${found.retiredReason})${where}`, found.mergedInto ? `Use ${found.mergedInto} instead` : `Leave ${handle} as it is`);
		}
		return found;
	}
	function bump(handle) {
		const { version } = db.update(entity).set({ version: sql`${entity.version} + 1` }).where(eq(entity.handle, handle)).returning({ version: entity.version }).get();
		return version;
	}
	function known() {
		const aliases = db.select().from(entityAlias).all();
		return db.select().from(entity).all().map((e) => ({
			handle: e.handle,
			name: e.name,
			aliases: aliases.filter((a) => a.handle === e.handle).map((a) => a.alias),
			retired: e.retiredAt !== null,
			mergedInto: e.mergedInto
		}));
	}
	const aliasesOf = (handle) => db.select().from(entityAlias).where(eq(entityAlias.handle, handle)).all().map((a) => a.alias);
	function checkFields(tool, type, fields) {
		const parsed = parseFields(type, fields);
		if (!parsed.ok) throw ToolError.invalidInput(tool, parsed.message);
		for (const ref of placeRefs(parsed.fields)) {
			const place = db.select().from(entity).where(eq(entity.handle, ref)).get();
			if (!place || place.retiredAt !== null) throw ToolError.invalidInput(tool, `${ref} is not an established Place`);
		}
		return parsed.fields;
	}
	function freeHandle(type, name) {
		const base = `${type}:${slug$1(name)}`;
		const taken = new Set(db.select({ handle: entity.handle }).from(entity).where(or(eq(entity.handle, base), like(entity.handle, `${base}-%`))).all().map((e) => e.handle));
		let handle = base;
		for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`;
		return handle;
	}
	function page(handle) {
		return db.select({ text: pageRevision.text }).from(pageRevision).where(eq(pageRevision.handle, handle)).orderBy(desc(pageRevision.id)).get()?.text ?? "";
	}
	/** Stores a new Page revision with its links resolved, and re-indexes the Page's links. */
	function writePage(handle, text) {
		const resolved = resolveLinks(text, known());
		db.insert(pageRevision).values({
			handle,
			text: resolved.text,
			sessionId: stamp.sessionId,
			eventId: stamp.eventId,
			createdAt: Date.now()
		}).run();
		db.delete(worldLink).where(and(eq(worldLink.fromHandle, handle), isNull(worldLink.factId))).run();
		for (const to of resolved.links) db.insert(worldLink).values({
			fromHandle: handle,
			factId: null,
			toHandle: to
		}).run();
		return resolved.unresolved;
	}
	const isCurrent = (f) => f.supersededBy === null && f.retiredAt === null;
	function insertFact(subject, input) {
		const resolved = resolveLinks(input.claim, known());
		const validFrom = input.valid_from === void 0 ? stamp.minute : input.valid_from;
		const row = db.insert(fact).values({
			subject,
			claim: resolved.text,
			validFrom,
			sessionId: stamp.sessionId,
			eventId: stamp.eventId,
			recordedMinute: stamp.minute
		}).returning().get();
		for (const to of resolved.links) db.insert(worldLink).values({
			fromHandle: subject,
			factId: row.id,
			toHandle: to
		}).run();
		return {
			row,
			unresolved: resolved.unresolved
		};
	}
	function factView(f, all) {
		return {
			id: f.id,
			claim: renderLinks(f.claim, all),
			valid_from: f.validFrom,
			valid_to: f.supersededBy === null ? null : f.validTo,
			state: f.retiredAt !== null ? "retired" : f.supersededBy !== null ? "superseded" : "current",
			...f.supersededBy !== null && { superseded_by: f.supersededBy },
			...f.retiredAt !== null && { retired_reason: f.retiredReason }
		};
	}
	function findFact(id) {
		const found = db.select().from(fact).where(eq(fact.id, id)).get();
		if (!found) throw new ToolError("unknown_fact", `No Fact has the id ${id}`, "Check the id against a recent open");
		return found;
	}
	/** A Fact that a supersession or retirement may still change. */
	function currentFact(id) {
		const found = findFact(id);
		if (!isCurrent(found)) throw new ToolError("not_current", `Fact ${id} is already ${found.retiredAt !== null ? "retired" : `superseded by Fact ${found.supersededBy}`}`, `Open ${found.subject} with history to see its Facts`);
		return found;
	}
	/**
	* Closes `old` at the start of `by`. A Fact never begins before the one it supersedes; one that
	* held since before the Campaign may only be superseded by another such Fact or a later one.
	*/
	function close(tool, old, by) {
		if (old.id === by.id) throw ToolError.invalidInput(tool, "A Fact cannot supersede itself");
		if (old.validFrom !== null && (by.validFrom === null || by.validFrom < old.validFrom)) throw ToolError.invalidInput(tool, `Fact ${old.id} holds from minute ${old.validFrom}; what supersedes it cannot begin earlier`);
		db.update(fact).set({
			supersededBy: by.id,
			validTo: by.validFrom
		}).where(eq(fact.id, old.id)).run();
	}
	/** Retires current Facts with one reason, returning them as the DM saw them. */
	function retireFacts(facts, reason) {
		const all = known();
		for (const f of facts) db.update(fact).set({
			retiredAt: stamp.minute,
			retiredReason: reason
		}).where(eq(fact.id, f.id)).run();
		return facts.map((f) => ({
			id: f.id,
			claim: renderLinks(f.claim, all)
		}));
	}
	/** Entities whose Page or current Facts link to `handle`. */
	function linkersOf(handle) {
		const rows = db.select().from(worldLink).where(eq(worldLink.toHandle, handle)).all();
		return [...new Set(rows.map((l) => l.fromHandle))].filter((h) => h !== handle);
	}
	/** Rebuilds an Entity's full-text rows: name and aliases, Page, current Facts. */
	function reindex(handle) {
		db.run(sql`DELETE FROM world_search WHERE handle = ${handle}`);
		const found = find(handle);
		if (found.retiredAt !== null) return;
		const all = known();
		const rows = [
			["name", [found.name, ...aliasesOf(handle)].join(" · ")],
			["page", renderLinks(page(handle), all)],
			...db.select().from(fact).where(eq(fact.subject, handle)).all().filter(isCurrent).map((f) => [`fact:${f.id}`, renderLinks(f.claim, all)])
		];
		for (const [source, text] of rows) if (text.trim()) db.run(sql`INSERT INTO world_search (handle, source, text) VALUES (${handle}, ${source}, ${text})`);
	}
	return {
		/** Every Entity as link resolution sees it, retired and merged ones included. */
		known,
		/** Entities whose name or aliases are close to any of `names`, retired ones aside. */
		nearMatches(names) {
			return known().filter((k) => !k.retired).filter((k) => [k.name, ...k.aliases].some((n) => names.some((m) => isNearName(n, m)))).map((k) => ({
				handle: k.handle,
				name: k.name
			}));
		},
		establish(input) {
			for (const handle of input.distinct_from) find(handle);
			const matches = this.nearMatches([input.name, ...input.aliases]).filter((m) => !input.distinct_from.includes(m.handle));
			if (matches.length) throw new ToolError("near_duplicate", `"${input.name}" is close to ${matches.map((m) => `${m.handle} (${m.name})`).join(", ")}`, `Open the match if it is the same Entity; if not, call establish again with distinct_from: ${JSON.stringify(matches.map((m) => m.handle))}`, { matches });
			const fields = checkFields("establish", input.type, input.fields);
			const handle = freeHandle(input.type, input.name);
			db.insert(entity).values({
				handle,
				type: input.type,
				name: input.name,
				fields,
				createdAt: Date.now()
			}).run();
			for (const alias of new Set(input.aliases)) db.insert(entityAlias).values({
				handle,
				alias
			}).run();
			const unresolved = input.page ? writePage(handle, input.page) : [];
			const facts = input.facts.map((f) => {
				const made = insertFact(handle, f);
				unresolved.push(...made.unresolved);
				return made.row.id;
			});
			reindex(handle);
			return {
				handle,
				version: 1,
				facts,
				unresolved
			};
		},
		open(handle, history) {
			const found = find(handle);
			const all = known();
			const facts = db.select().from(fact).where(eq(fact.subject, handle)).orderBy(asc(fact.id)).all().filter((f) => history || isCurrent(f));
			const currentFactIds = new Set(db.select().from(fact).all().filter(isCurrent).map((f) => f.id));
			const live = (l) => l.factId === null || currentFactIds.has(l.factId);
			const via = (l) => l.factId === null ? "page" : l.factId;
			const nameOf = (h) => all.find((k) => k.handle === h)?.name ?? h;
			const links = db.select().from(worldLink).where(eq(worldLink.fromHandle, handle)).all().filter(live).map((l) => ({
				handle: l.toHandle,
				name: nameOf(l.toHandle),
				via: via(l)
			}));
			const backlinks = db.select().from(worldLink).where(eq(worldLink.toHandle, handle)).all().filter((l) => live(l) && l.fromHandle !== handle).map((l) => ({
				handle: l.fromHandle,
				name: nameOf(l.fromHandle),
				via: via(l)
			}));
			const revisions = history ? db.select().from(pageRevision).where(eq(pageRevision.handle, handle)).orderBy(asc(pageRevision.id)).all().map((r) => ({
				revision: r.id,
				text: renderLinks(r.text, all),
				session: r.sessionId,
				event: r.eventId
			})) : void 0;
			return {
				handle,
				type: found.type,
				name: found.name,
				aliases: aliasesOf(handle),
				version: found.version,
				retired: found.retiredAt === null ? null : {
					reason: found.retiredReason,
					merged_into: found.mergedInto
				},
				fields: found.fields,
				page: renderLinks(page(handle), all),
				facts: facts.map((f) => factView(f, all)),
				links,
				backlinks,
				...revisions && { revisions }
			};
		},
		editPage(handle, version, change) {
			writable(handle, version);
			const all = known();
			const current = renderLinks(page(handle), all);
			let text;
			if ("text" in change) {
				if (current.trim()) throw new ToolError("page_not_empty", `${handle} already has a Page; full text only goes into an empty one`, `Call edit_page with patches of old/new text from open ${handle}`);
				text = change.text;
			} else text = change.patches.reduce((t, p) => {
				const count = t.split(p.old).length - 1;
				if (count !== 1) throw new ToolError("patch_mismatch", `"${p.old}" appears ${count} times in the Page of ${handle}; it must appear exactly once`, `Open ${handle} and quote a longer, unique stretch of its Page`);
				return t.replace(p.old, () => p.new);
			}, current);
			const unresolved = writePage(handle, text);
			const next = bump(handle);
			reindex(handle);
			return {
				handle,
				version: next,
				unresolved
			};
		},
		setField(handle, version, field, value) {
			const found = writable(handle, version);
			let old;
			if (field === "name") {
				const parsed = string().trim().min(1).safeParse(value);
				if (!parsed.success) throw ToolError.invalidInput("set_field", "A name must be text");
				old = found.name;
				db.update(entity).set({ name: parsed.data }).where(eq(entity.handle, handle)).run();
				value = parsed.data;
			} else {
				if (!fieldNames(found.type).includes(field)) throw ToolError.invalidInput("set_field", `A ${found.type} has no field ${field}; its fields are name, ${fieldNames(found.type).join(", ")}`);
				old = found.fields[field] ?? null;
				const next = { ...found.fields };
				if (value === null) delete next[field];
				else next[field] = value;
				const fields = checkFields("set_field", found.type, next);
				value = fields[field] ?? null;
				db.update(entity).set({ fields }).where(eq(entity.handle, handle)).run();
			}
			const next = bump(handle);
			reindex(handle);
			if (field === "name") for (const from of linkersOf(handle)) reindex(from);
			const all = known();
			const warnings = db.select().from(fact).where(eq(fact.subject, handle)).all().filter(isCurrent).filter((f) => restates(renderLinks(f.claim, all), f.claim, value, all)).map((f) => `Fact ${f.id} ("${renderLinks(f.claim, all)}") restates ${field}; the field owns it now, so supersede or retire the Fact`);
			return {
				handle,
				field,
				old,
				new: value,
				version: next,
				warnings
			};
		},
		addFact(input) {
			writable(input.subject, input.version);
			const olds = [...new Set(input.supersedes)].map(currentFact);
			const made = insertFact(input.subject, input);
			for (const old of olds) close("add_fact", old, made.row);
			const version = bump(input.subject);
			const others = [...new Set(olds.map((o) => o.subject))].filter((h) => h !== input.subject);
			for (const other of others) bump(other);
			for (const h of [input.subject, ...others]) reindex(h);
			return {
				fact: made.row.id,
				subject: input.subject,
				version,
				valid_from: made.row.validFrom,
				superseded: olds.map((o) => o.id),
				unresolved: made.unresolved
			};
		},
		supersede(oldId, byId) {
			const old = currentFact(oldId);
			const by = currentFact(byId);
			close("supersede", old, by);
			const version = bump(old.subject);
			reindex(old.subject);
			return {
				old: old.id,
				by: by.id,
				valid_to: by.validFrom,
				subject: old.subject,
				version
			};
		},
		retireFact(id, version, reason) {
			const found = currentFact(id);
			writable(found.subject, version);
			const facts = retireFacts([found], reason);
			const next = bump(found.subject);
			reindex(found.subject);
			return {
				handle: found.subject,
				version: next,
				retired_facts: facts
			};
		},
		retireEntity(handle, version, reason) {
			writable(handle, version);
			const facts = retireFacts(db.select().from(fact).where(eq(fact.subject, handle)).all().filter(isCurrent), reason);
			db.update(entity).set({
				retiredAt: stamp.minute,
				retiredReason: reason
			}).where(eq(entity.handle, handle)).run();
			const next = bump(handle);
			reindex(handle);
			return {
				handle,
				version: next,
				retired_facts: facts
			};
		},
		merge(from, into, versions) {
			if (from === into) throw ToolError.invalidInput("merge", "An Entity cannot merge into itself");
			writable(from, versions.from);
			const survivor = writable(into, versions.into);
			const before = known();
			const fromPage = renderLinks(page(from), before);
			const intoPage = renderLinks(page(into), before);
			const facts = db.update(fact).set({ subject: into }).where(eq(fact.subject, from)).returning({ id: fact.id }).all();
			db.update(worldLink).set({ fromHandle: into }).where(and(eq(worldLink.fromHandle, from), isNotNull(worldLink.factId))).run();
			const links = db.update(worldLink).set({ toHandle: into }).where(eq(worldLink.toHandle, from)).returning({ id: worldLink.id }).all();
			const taken = new Set([survivor.name, ...aliasesOf(into)].map(normalizeName));
			const aliases = [db.select().from(entity).where(eq(entity.handle, from)).get().name].concat(aliasesOf(from)).filter((a) => !taken.has(normalizeName(a)) && taken.add(normalizeName(a)));
			db.delete(entityAlias).where(eq(entityAlias.handle, from)).run();
			for (const alias of aliases) db.insert(entityAlias).values({
				handle: into,
				alias
			}).run();
			db.update(entity).set({
				retiredAt: stamp.minute,
				retiredReason: `Merged into ${into}`,
				mergedInto: into
			}).where(eq(entity.handle, from)).run();
			const unresolved = fromPage.trim() ? writePage(into, intoPage.trim() ? `${intoPage}\n\n${fromPage}` : fromPage) : [];
			db.delete(worldLink).where(and(eq(worldLink.fromHandle, from), isNull(worldLink.factId))).run();
			bump(from);
			const version = bump(into);
			for (const h of /* @__PURE__ */ new Set([
				from,
				into,
				...linkersOf(into)
			])) reindex(h);
			return {
				from,
				into,
				version,
				moved: {
					facts: facts.map((f) => f.id),
					aliases,
					links: links.length
				},
				unresolved
			};
		},
		search(query, type) {
			const words = query.match(/[\p{L}\p{N}]+/gu) ?? [];
			if (!words.length) return [];
			const match = words.map((w) => `"${w}"*`).join(" OR ");
			const rows = db.all(sql`
        SELECT world_search.handle AS handle,
          snippet(world_search, 2, '«', '»', '…', 12) AS snippet
        FROM world_search JOIN ${entity} ON ${entity.handle} = world_search.handle
        WHERE world_search MATCH ${match} AND ${entity.retiredAt} IS NULL
          ${type ? sql`AND ${entity.type} = ${type}` : sql``}
        ORDER BY bm25(world_search)
        LIMIT 100`);
			const seen = /* @__PURE__ */ new Map();
			const all = db.select().from(entity).all();
			for (const r of rows) {
				if (seen.has(r.handle) || seen.size >= 10) continue;
				const e = all.find((x) => x.handle === r.handle);
				seen.set(r.handle, {
					handle: r.handle,
					type: e.type,
					name: e.name,
					snippet: r.snippet
				});
			}
			return [...seen.values()];
		}
	};
}
// src/lib/server/world/lint.ts
var pairKey = (a, b) => [a, b].sort().join(" ");
/** Every pair of handles the DM declared distinct with establish's distinct_from. */
function distinctPairs(ctx) {
	const pairs = /* @__PURE__ */ new Set();
	const rows = ctx.db.select().from(event).where(eq(event.kind, "entity_established")).all();
	for (const row of rows) {
		const from = row.data?.handle;
		const others = row.data?.distinct_from;
		if (typeof from !== "string" || !Array.isArray(others)) continue;
		for (const other of others) pairs.add(pairKey(from, String(other)));
	}
	return pairs;
}
/**
* Checks the World for what code can detect (ADR 0007): near-duplicate names, broken links, Facts
* restating a field, Beliefs on retired Facts and Pages linking to retired Entities. Reads only.
*/
function lintWorld(ctx) {
	const world = createWorld(ctx);
	const live = world.known().filter((k) => !k.retired).sort((a, b) => a.handle.localeCompare(b.handle));
	const findings = [];
	const distinct = distinctPairs(ctx);
	for (const [i, a] of live.entries()) for (const b of live.slice(i + 1)) {
		if (distinct.has(pairKey(a.handle, b.handle))) continue;
		if ([a.name, ...a.aliases].some((x) => [b.name, ...b.aliases].some((y) => isNearName(x, y)))) findings.push({
			kind: "near_duplicate",
			entities: [a, b].map((e) => ({
				handle: e.handle,
				name: e.name
			}))
		});
	}
	const known = new Map(world.known().map((k) => [k.handle, k]));
	const reasons = new Map(ctx.db.select({
		handle: entity.handle,
		reason: entity.retiredReason
	}).from(entity).all().map((e) => [e.handle, e.reason]));
	const all = [...known.values()];
	const fields = new Map(ctx.db.select({
		handle: entity.handle,
		fields: entity.fields
	}).from(entity).all().map((e) => [e.handle, e.fields]));
	for (const t of texts(ctx, live)) {
		if (t.in === "page") continue;
		const rendered = renderLinks(t.text, all);
		for (const [field, value] of Object.entries(fields.get(t.handle) ?? {})) if (restates(rendered, t.text, value, all)) findings.push({
			kind: "restated_field",
			handle: t.handle,
			fact: t.in,
			claim: rendered,
			field
		});
	}
	for (const t of texts(ctx, live)) {
		const retired = /* @__PURE__ */ new Set();
		for (const link of linkTargets(t.text)) {
			let found = known.get(link);
			if (!found) {
				findings.push({
					kind: "broken_link",
					handle: t.handle,
					in: t.in,
					link
				});
				continue;
			}
			for (let hops = 0; found.mergedInto && hops < 10; hops++) found = known.get(found.mergedInto) ?? found;
			if (t.in === "page" && found.retired && !retired.has(found.handle)) {
				retired.add(found.handle);
				findings.push({
					kind: "retired_link",
					handle: t.handle,
					retired: {
						handle: found.handle,
						name: found.name,
						reason: reasons.get(found.handle) ?? null
					}
				});
			}
		}
	}
	findings.push(...retiredFactBeliefs(ctx), ...revealsOutsideAudience(ctx));
	return {
		findings,
		pages: changedPages(ctx, live, all)
	};
}
/** The Event keys that name the Entities a World write touched. */
var TOUCHED = [
	"handle",
	"subject",
	"from",
	"into"
];
/** The last `lint_ran` Event, or undefined if lint never ran. */
function lastLint(db) {
	return db.select().from(event).where(eq(event.kind, "lint_ran")).orderBy(desc(event.id)).get();
}
/**
* The Pages of live Entities changed since the last lint (every Page before the first), beside
* their fields, so the DM can judge where a Page contradicts a field.
*/
function changedPages(ctx, live, all) {
	const { db } = ctx;
	const since = lastLint(db)?.id ?? 0;
	const touched = new Set(db.select({ data: event.data }).from(event).where(gt(event.id, since)).all().flatMap((e) => TOUCHED.map((k) => e.data?.[k])).filter((h) => typeof h === "string"));
	return live.filter((e) => touched.has(e.handle)).flatMap((e) => {
		const row = db.select().from(entity).where(eq(entity.handle, e.handle)).get();
		const page = pageText(ctx, e.handle);
		if (!page?.trim()) return [];
		return [{
			handle: row.handle,
			type: row.type,
			name: row.name,
			version: row.version,
			fields: row.fields,
			page: renderLinks(page, all)
		}];
	});
}
function pageText({ db }, handle) {
	return db.select({ text: pageRevision.text }).from(pageRevision).where(eq(pageRevision.handle, handle)).orderBy(desc(pageRevision.id)).get()?.text;
}
/**
* Reveals since the last lint whose new Beliefs belong to a Character the latest Narration
* before the Reveal did not reach. Reveals keep their default Holders (ADR 0007); this only reads.
*/
function revealsOutsideAudience({ db }) {
	const since = lastLint(db)?.id ?? 0;
	const characters = new Map(characterHolders(db).map((c) => [c.id, c.handle]));
	const reveals = db.select().from(event).where(and(eq(event.kind, "beliefs_revealed"), gt(event.id, since))).orderBy(asc(event.id)).all();
	const findings = [];
	for (const reveal of reveals) {
		const narration = db.select({ audience: event.audience }).from(event).where(and(eq(event.kind, "narration"), lt(event.id, reveal.id), sql`coalesce(json_extract(${event.data}, '$.recap'), 0) = 0`)).orderBy(desc(event.id)).get();
		if (!narration) continue;
		const ids = Array.isArray(reveal.data?.beliefs) ? reveal.data.beliefs : [];
		if (!ids.length) continue;
		const rows = db.select({
			id: belief.id,
			holder: belief.holderCharacter
		}).from(belief).where(inArray(belief.id, ids)).orderBy(asc(belief.id)).all();
		for (const row of rows) {
			if (row.holder === null || narration.audience.includes(row.holder)) continue;
			findings.push({
				kind: "reveal_outside_audience",
				holder: characters.get(row.holder) ?? "?",
				belief: row.id
			});
		}
	}
	return findings;
}
function retiredFactBeliefs({ db }) {
	const characters = new Map(characterHolders(db).map((c) => [c.id, c.handle]));
	return db.select({
		belief,
		fact
	}).from(belief).innerJoin(fact, eq(fact.id, belief.factId)).where(and(eq(belief.kind, "fact"), isNull(belief.replacedBy), isNull(belief.retiredAt))).orderBy(asc(belief.id)).all().filter((r) => r.fact.retiredAt !== null).map((r) => ({
		kind: "retired_fact_belief",
		belief: r.belief.id,
		holder: r.belief.holderNpc ?? characters.get(r.belief.holderCharacter) ?? "?",
		fact: r.fact.id,
		reason: r.fact.retiredReason
	}));
}
/** The current Page and current Facts of each live Entity, as stored. */
function texts({ db }, live) {
	return live.flatMap((e) => {
		const page = pageText({ db }, e.handle);
		const facts = db.select().from(fact).where(eq(fact.subject, e.handle)).orderBy(asc(fact.id)).all().filter((f) => f.supersededBy === null && f.retiredAt === null);
		return [...page ? [{
			handle: e.handle,
			in: "page",
			text: page
		}] : [], ...facts.map((f) => ({
			handle: e.handle,
			in: f.id,
			text: f.claim
		}))];
	});
}
// src/lib/play/hp-state.ts
function hpState(hp, max) {
	if (hp <= 0) return "down";
	if (hp * 4 <= max) return "near death";
	if (hp * 2 <= max) return "bloodied";
	return "unhurt";
}
// src/lib/character/acting.ts
/**
* Whether a Character can act: put a Declaration on the Floor or be picked as the acting
* Character. Dead, departed and Unconscious Characters can't; an Unconscious one only answers
* their own Death save Call. The one rule the sheet tabs, the composer and the server all use.
*/
function canAct(character) {
	return character.status === "alive" && !character.conditions?.includes("unconscious");
}
// src/lib/server/character/service.ts
/** The input breaks a Character rule (required or conditional field, bad score, unknown key or slug). */
var CharacterValidationError = class extends Error {};
/** The Character does not exist. */
var CharacterNotFoundError = class extends Error {};
var fail = (message) => {
	throw new CharacterValidationError(message);
};
function text(label, value, max) {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	if (trimmed.length > max) fail(`${label} must be at most ${max} characters`);
	return trimmed;
}
var isInt = (n) => typeof n === "number" && Number.isInteger(n);
var sortedNumbers = (values) => [...values].sort((a, b) => a - b);
/** Checks the six assigned scores (and rolls) against the method's rules. */
function checkScores(input, config) {
	const scores = ABILITY_KEYS.map((a) => {
		const v = input.scores?.[a];
		if (!isInt(v)) return fail(`Score ${a} must be a whole number`);
		return v;
	});
	const rolls = input.abilityRolls ?? null;
	if (config.type !== "roll") {
		if (rolls !== null) fail("Ability rolls are only allowed with the roll method");
	}
	switch (config.type) {
		case "standardArray":
			if (sortedNumbers(scores).join() !== sortedNumbers(config.values).join()) fail(`Standard array scores must be exactly ${config.values.join(", ")}, one per ability`);
			return null;
		case "pointBuy": {
			let spent = 0;
			for (const [i, v] of scores.entries()) {
				const cost = config.costs[String(v)];
				if (v < config.min || v > config.max || cost === void 0) fail(`Score ${ABILITY_KEYS[i]} must be between ${config.min} and ${config.max}`);
				spent += cost;
			}
			if (spent > config.budget) fail(`Point buy spends ${spent} of ${config.budget} points`);
			return null;
		}
		case "roll":
			if (!rolls) return fail("Ability rolls are required for the roll method");
			if (rolls.length !== config.count) fail(`Exactly ${config.count} ability rolls are required`);
			if (sortedNumbers(rolls.map((dice) => {
				if (!Array.isArray(dice) || dice.length !== config.dice || dice.some((d) => !isInt(d) || d < 1 || d > config.sides)) fail(`Each ability roll must be ${config.dice} dice of 1 to ${config.sides}`);
				return sortedNumbers(dice).slice(config.dropLowest).reduce((a, b) => a + b, 0);
			})).join() !== sortedNumbers(scores).join()) fail("Ability scores must equal the rolled totals");
			return rolls.map((dice) => [...dice]);
	}
}
/**
* The Characters of the Campaign whose database this is. Every Character belongs to that one
* Campaign and has a Controlling Player and a status.
*/
function createCharacterService(db, now = Date.now, rules = loadRulesDataset()) {
	const bySlug = (list) => new Map(list.map((r) => [r.slug, r]));
	const classRules = bySlug(rules.classes);
	const backgroundRules = bySlug(rules.backgrounds);
	const spellRules = bySlug(rules.spells);
	const proficiencyRules = bySlug(rules.proficiencies);
	const idsOf = (table, slugs) => new Map(slugs.length === 0 ? [] : db.select({
		slug: table.slug,
		id: table.id
	}).from(table).where(inArray(table.slug, slugs)).all().map((r) => [r.slug, r.id]));
	function lookup(label, table, slug) {
		return idsOf(table, [slug]).get(slug) ?? fail(`Unknown ${label}: ${slug}`);
	}
	function optionalLookup(label, table, slug) {
		return slug ? lookup(label, table, slug) : null;
	}
	/** Validates the whole input against the rules and Rules Data, and returns rows ready to write. */
	function prepare(input) {
		const name = text("Name", input.name, 80) ?? fail("Name is required");
		const alignment$1 = input.alignment ?? null;
		if (alignment$1 !== null) {
			if (!db.select({ slug: alignment.slug }).from(alignment).where(eq(alignment.slug, alignment$1)).get()) fail(`Invalid alignment: ${String(alignment$1)}`);
		}
		const narrative = {
			appearance: text("Appearance", input.appearance, 500),
			personality: text("Personality", input.personality, 500),
			ideal: text("Ideal", input.ideal, 500),
			bond: text("Bond", input.bond, 500),
			flaw: text("Flaw", input.flaw, 500),
			backstory: text("Backstory", input.backstory, BACKSTORY_MAX)
		};
		const raceId = lookup("race", race, input.race);
		const classId = lookup("class", classTable, input.class);
		const backgroundId = lookup("background", background, input.background);
		const subraceId = optionalLookup("subrace", subrace, input.subrace);
		const subclassId = optionalLookup("subclass", subclass, input.subclass);
		if (!ABILITY_METHODS.includes(input.abilityMethod)) fail(`Invalid ability method: ${String(input.abilityMethod)}`);
		const method = db.select().from(abilityScoreMethod).where(eq(abilityScoreMethod.slug, input.abilityMethod)).get();
		if (!method) fail(`Unknown ability method: ${input.abilityMethod}`);
		const abilityRolls = checkScores(input, method.config);
		const customName = text("Custom background name", input.customBackgroundName, 80);
		const customFeature = text("Custom background feature", input.customBackgroundFeature, CUSTOM_BACKGROUND_FEATURE_MAX);
		if (input.background === "custom") {
			if (!customName) fail("Custom background name is required");
			if (!customFeature) fail("Custom background feature is required");
		} else if (customName || customFeature) fail("Custom background fields are only allowed with the custom background");
		const picks = input.picks ?? {};
		const resolved = resolveFeatures(rules, {
			race: input.race,
			subrace: input.subrace ?? null,
			class: input.class,
			subclass: input.subclass ?? null,
			background: input.background,
			picks
		});
		const structure = resolved.structure[0];
		if (structure) fail(`Invalid ${structure.field}: ${structure.type}`);
		const orphan = resolved.orphanPicks[0];
		if (orphan) fail(`Unknown choice ${orphan.key}`);
		for (const g of resolved.groups) {
			if (g.kind === "subclass") continue;
			if (g.status === "incomplete") fail(`Choice ${g.key} needs ${g.choose} pick(s)`);
			if (g.status !== "valid") fail(`Choice ${g.key} has an invalid pick: ${g.issues.map((i) => i.type).join(", ")}`);
		}
		const skillSlugs = new Map(db.select({
			slug: skill.slug,
			id: skill.id
		}).from(skill).all().map((r) => [r.slug, r.id]));
		const skills = /* @__PURE__ */ new Map();
		const choiceRows = [];
		const racialSpells = [];
		for (const g of resolved.groups) {
			if (g.kind === "subclass") continue;
			for (const pick of g.picks) if (g.kind === "skill") {
				const slug = proficiencyRules.get(pick)?.reference?.slug ?? pick.replace(/^skill-/, "");
				const id = skillSlugs.get(slug) ?? fail(`Unknown skill: ${pick}`);
				skills.set(id, g.source);
			} else if (g.kind === "spell") racialSpells.push({
				slug: pick,
				source: g.source
			});
			else choiceRows.push({
				choiceKey: g.key,
				optionSlug: pick
			});
		}
		const classSpells = [...new Set(input.classSpells ?? [])];
		for (const slug of classSpells) {
			const s = spellRules.get(slug) ?? fail(`Unknown spell: ${slug}`);
			if (s.level > 1) fail(`Spell ${slug} is above level 1`);
			if (!s.classes.includes(input.class)) fail(`Spell ${slug} is not on the ${input.class} list`);
		}
		const spellSources = /* @__PURE__ */ new Map();
		for (const s of racialSpells) spellSources.set(s.slug, s.source);
		for (const slug of classSpells) {
			if (spellSources.has(slug)) fail(`Spell ${slug} is picked twice`);
			spellSources.set(slug, "class");
		}
		const spellIds = new Map(spellSources.size === 0 ? [] : db.select({
			slug: spell.slug,
			id: spell.id
		}).from(spell).where(inArray(spell.slug, [...spellSources.keys()])).all().map((r) => [r.slug, r.id]));
		const spells = [...spellSources].map(([slug, source]) => ({
			spellId: spellIds.get(slug) ?? fail(`Unknown spell: ${slug}`),
			source
		}));
		const requiredKeys = [...equipmentGroupKeys("class", input.class, classRules.get(input.class)?.choiceGroups), ...equipmentGroupKeys("background", input.background, backgroundRules.get(input.background)?.choiceGroups)];
		const legalKeys = new Set(requiredKeys);
		const gear = input.equipment ?? [];
		const seen = /* @__PURE__ */ new Set();
		for (const row of gear) {
			if (!legalKeys.has(row.choiceKey)) fail(`Unknown equipment choice: ${row.choiceKey}`);
			const quantity = row.quantity ?? 1;
			if (!isInt(quantity) || quantity < 1) fail("Equipment quantity must be a positive whole number");
			const dupe = `${row.choiceKey}\u0000${row.item}`;
			if (seen.has(dupe)) fail(`Equipment ${row.item} is listed twice for ${row.choiceKey}`);
			seen.add(dupe);
		}
		for (const key of requiredKeys) if (!gear.some((r) => r.choiceKey === key)) fail(`Equipment choice ${key} needs a pick`);
		const itemSlugs = [...new Set(gear.map((r) => r.item))];
		const itemIds = new Map(itemSlugs.length === 0 ? [] : db.select({
			slug: equipment.slug,
			id: equipment.id
		}).from(equipment).where(inArray(equipment.slug, itemSlugs)).all().map((r) => [r.slug, r.id]));
		const equipmentRows = gear.map((r) => ({
			choiceKey: r.choiceKey,
			itemId: itemIds.get(r.item) ?? fail(`Unknown item: ${r.item}`),
			quantity: r.quantity ?? 1
		}));
		const hitPoints = deriveStats(rules, resolved, {
			class: input.class,
			level: 1,
			baseScores: input.scores,
			equipment: []
		}).hitPoints;
		if (hitPoints.status !== "ok") fail(`Hit points need ${hitPoints.missing.join(", ")}`);
		const carried = /* @__PURE__ */ new Map();
		const carry = (item, quantity) => carried.set(item, (carried.get(item) ?? 0) + quantity);
		const backgroundRule = backgroundRules.get(input.background);
		for (const e of classRules.get(input.class)?.startingEquipment ?? []) carry(e.item, e.quantity);
		for (const e of backgroundRule?.startingEquipment ?? []) carry(e.item, e.quantity);
		for (const r of gear) carry(r.item, r.quantity ?? 1);
		const carriedIds = new Map(db.select({
			slug: equipment.slug,
			id: equipment.id
		}).from(equipment).where(inArray(equipment.slug, [...carried.keys()])).all().map((r) => [r.slug, r.id]));
		const inventory = [...carried].map(([item, quantity]) => ({
			itemId: carriedIds.get(item) ?? fail(`Unknown item: ${item}`),
			quantity
		}));
		const coin = {
			cp: 0,
			sp: 0,
			ep: 0,
			gp: 0,
			pp: 0
		};
		const unit = backgroundRule?.startingGoldUnit;
		if (unit && unit in coin) coin[unit] = backgroundRule?.startingGoldQuantity ?? 0;
		const playState = {
			currentHp: hitPoints.status === "ok" ? hitPoints.value : 0,
			tempHp: 0,
			spentSlots: [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			],
			hitDiceSpent: 0,
			featureUses: {},
			conditions: [],
			coin,
			concentration: null,
			deathSaves: {
				successes: 0,
				failures: 0
			},
			whereabouts: null
		};
		return {
			row: {
				name,
				alignment: alignment$1,
				...narrative,
				raceId,
				subraceId,
				classId,
				subclassId,
				backgroundId,
				customBackgroundName: customName,
				customBackgroundFeature: customFeature,
				abilityMethod: input.abilityMethod,
				str: input.scores.str,
				dex: input.scores.dex,
				con: input.scores.con,
				int: input.scores.int,
				wis: input.scores.wis,
				cha: input.scores.cha,
				abilityRolls
			},
			playState,
			skills: [...skills].map(([skillId, source]) => ({
				skillId,
				source
			})),
			spells,
			equipment: equipmentRows,
			inventory,
			choices: choiceRows
		};
	}
	function writeChildren(tx, characterId, p) {
		if (p.skills.length) tx.insert(characterSkill).values(p.skills.map((s) => ({
			...s,
			characterId
		}))).run();
		if (p.spells.length) tx.insert(characterSpell).values(p.spells.map((s) => ({
			...s,
			characterId
		}))).run();
		if (p.equipment.length) tx.insert(characterEquipment).values(p.equipment.map((e) => ({
			...e,
			characterId
		}))).run();
		if (p.choices.length) tx.insert(characterChoice).values(p.choices.map((c) => ({
			...c,
			characterId
		}))).run();
		if (p.inventory.length) tx.insert(characterItem).values(p.inventory.map((i) => ({
			...i,
			characterId
		}))).run();
	}
	function summaries(order) {
		return db.select({
			character,
			raceSlug: race.slug,
			raceName: race.name,
			subraceName: subrace.name,
			className: classTable.name,
			backgroundName: background.name
		}).from(character).innerJoin(race, eq(race.id, character.raceId)).leftJoin(subrace, eq(subrace.id, character.subraceId)).innerJoin(classTable, eq(classTable.id, character.classId)).innerJoin(background, eq(background.id, character.backgroundId)).orderBy(...order).all().map(({ character: c, ...names }) => ({
			...c,
			...names
		}));
	}
	return {
		/**
		* Validates, then inserts the Character and all its child rows atomically: level 1, alive,
		* controlled by `player` (the solo Player by default), with play state at its defaults.
		*/
		create(input, { player = SOLO_PLAYER } = {}) {
			const p = prepare(input);
			const owner = db.select({ id: campaign.id }).from(campaign).get();
			if (!owner) throw new Error("This database holds no Campaign");
			return db.transaction((tx) => {
				const at = now();
				const created = tx.insert(character).values({
					...p.row,
					...p.playState,
					campaignId: owner.id,
					controllingPlayer: player,
					level: 1,
					createdAt: at,
					updatedAt: at
				}).returning().get();
				writeChildren(tx, created.id, p);
				return created;
			});
		},
		/**
		* Replaces the choices and every child row in one transaction; updated_at always moves. Level,
		* status, Controlling Player and created_at are kept. Wizard edits happen before play, so play
		* state starts over from the new choices.
		*/
		update(id, input) {
			const p = prepare(input);
			return db.transaction((tx) => {
				if (!tx.select().from(character).where(eq(character.id, id)).get()) throw new CharacterNotFoundError("Character not found");
				const updated = tx.update(character).set({
					...p.row,
					...p.playState,
					updatedAt: now()
				}).where(eq(character.id, id)).returning().get();
				tx.delete(characterSkill).where(eq(characterSkill.characterId, id)).run();
				tx.delete(characterSpell).where(eq(characterSpell.characterId, id)).run();
				tx.delete(characterEquipment).where(eq(characterEquipment.characterId, id)).run();
				tx.delete(characterChoice).where(eq(characterChoice.characterId, id)).run();
				tx.delete(characterItem).where(eq(characterItem.characterId, id)).run();
				writeChildren(tx, id, p);
				return updated;
			});
		},
		/** Hard delete; child rows cascade. */
		delete(id) {
			if (!db.delete(character).where(eq(character.id, id)).returning().get()) throw new CharacterNotFoundError("Character not found");
		},
		/** One Character with its children, or undefined. */
		get(id) {
			const found = db.select().from(character).where(eq(character.id, id)).get();
			if (!found) return void 0;
			const slugOf = (table, rowId) => rowId === null ? null : db.select({ slug: table.slug }).from(table).where(eq(table.id, rowId)).get()?.slug ?? null;
			const skills = db.select({
				skill: skill.slug,
				source: characterSkill.source
			}).from(characterSkill).innerJoin(skill, eq(skill.id, characterSkill.skillId)).where(eq(characterSkill.characterId, id)).orderBy(asc(skill.slug)).all();
			const spells = db.select({
				spell: spell.slug,
				level: spell.level,
				source: characterSpell.source
			}).from(characterSpell).innerJoin(spell, eq(spell.id, characterSpell.spellId)).where(eq(characterSpell.characterId, id)).orderBy(asc(spell.level), asc(spell.slug)).all();
			const gear = db.select({
				choiceKey: characterEquipment.choiceKey,
				item: equipment.slug,
				quantity: characterEquipment.quantity
			}).from(characterEquipment).innerJoin(equipment, eq(equipment.id, characterEquipment.itemId)).where(eq(characterEquipment.characterId, id)).orderBy(asc(characterEquipment.choiceKey), asc(equipment.slug)).all();
			const inventory = db.select({
				item: equipment.slug,
				quantity: characterItem.quantity,
				equipped: characterItem.equipped
			}).from(characterItem).innerJoin(equipment, eq(equipment.id, characterItem.itemId)).where(eq(characterItem.characterId, id)).orderBy(asc(equipment.slug)).all();
			const choices = db.select({
				choiceKey: characterChoice.choiceKey,
				optionSlug: characterChoice.optionSlug
			}).from(characterChoice).where(eq(characterChoice.characterId, id)).orderBy(asc(characterChoice.choiceKey), asc(characterChoice.optionSlug)).all();
			const detail = {
				raceSlug: slugOf(race, found.raceId),
				subraceSlug: slugOf(subrace, found.subraceId),
				classSlug: slugOf(classTable, found.classId),
				subclassSlug: slugOf(subclass, found.subclassId),
				backgroundSlug: slugOf(background, found.backgroundId)
			};
			const picks = {};
			for (const c of choices) (picks[c.choiceKey] ??= []).push(c.optionSlug);
			const groups = resolveFeatures(rules, {
				race: detail.raceSlug,
				subrace: detail.subraceSlug,
				class: detail.classSlug,
				subclass: detail.subclassSlug,
				background: detail.backgroundSlug,
				picks
			}).groups;
			const fill = (kind, items) => {
				for (const g of groups.filter((x) => x.kind === kind)) {
					const mine = items.filter((i) => i.source === g.source).splice(0, g.choose);
					if (mine.length === 0) continue;
					picks[g.key] = mine.map((i) => i.slug);
					for (const i of mine) items.splice(items.indexOf(i), 1);
				}
			};
			fill("skill", skills.map((s) => ({
				slug: `skill-${s.skill}`,
				source: s.source
			})));
			fill("spell", spells.filter((s) => s.source !== "class").map((s) => ({
				slug: s.spell,
				source: s.source
			})));
			return {
				...found,
				...detail,
				skills,
				spells,
				equipment: gear,
				inventory,
				choices,
				picks,
				classSpells: spells.filter((s) => s.source === "class").map((s) => s.spell)
			};
		},
		/** Every Character of the Campaign, whatever their status, oldest first. */
		list() {
			return summaries([asc(character.createdAt), asc(sql`${character}.rowid`)]);
		}
	};
}
// src/lib/server/character/wizard-rules.ts
var cached;
/**
* The Rules Data collections the resolver and `deriveStats` read, in the plain dataset shape (the
* committed JSON the database is seeded from). Loaded once per process.
*/
function loadWizardRules() {
	if (!cached) {
		const dataset = loadRulesDataset();
		cached = Object.fromEntries(WIZARD_RULES_KEYS.map((k) => [k, dataset[k]]));
	}
	return cached;
}
/**
* The name the Characters know an Entity by: the name on the latest current Belief a Character
* holds about it, or null when none of them knows it. Every name the Player sees for an NPC or a
* Place comes from here, never from the World layer (ADR 0007).
*/
function believedName(db, handle) {
	return db.select({ name: belief.aboutName }).from(belief).where(and(eq(belief.about, handle), isNotNull(belief.holderCharacter), isNotNull(belief.aboutName), isNull(belief.replacedBy), isNull(belief.retiredAt))).orderBy(desc(belief.id)).get()?.name ?? null;
}
// src/lib/server/play/scene.ts
/** A move of the clock that would take it backwards. */
var ClockBackwardsError = class extends Error {};
/** The Campaign clock: in-fiction minutes since the Campaign started. */
function currentMinute(db) {
	return db.select({ minute: campaign.clockMinute }).from(campaign).get()?.minute ?? 0;
}
/**
* Moves the Campaign clock to `to`, inside the caller's transaction. The one way the clock moves:
* `advance_time`, rests and the end of a Combat all go through here. Refuses to go backwards.
*/
function advanceClock(db, to) {
	const from = currentMinute(db);
	if (!Number.isInteger(to) || to < from) throw new ClockBackwardsError(`The clock is at ${formatClock(from)}; it cannot go back to ${formatClock(Math.max(0, Math.floor(to)))}`);
	db.update(campaign).set({ clockMinute: to }).run();
	return {
		from,
		to
	};
}
/** The Place the spotlight is on, or null before the DM first sets the Scene. */
function scenePlace(db) {
	const handle = db.select({ scene: campaign.scene }).from(campaign).get()?.scene ?? null;
	if (handle === null) return null;
	return db.select().from(entity).where(eq(entity.handle, handle)).get() ?? null;
}
/** Whether a Character is in the Scene. Before the Scene is first set, the whole Party is. */
function inScene(place, row) {
	return place === null || row.whereabouts === place.handle;
}
/** Live NPCs whose whereabouts is `place`. */
function npcsAt(db, place) {
	return db.select().from(entity).where(and(eq(entity.type, "npc"), isNull(entity.retiredAt))).orderBy(entity.name).all().filter((e) => e.fields.whereabouts === place && e.fields.status !== "dead");
}
/**
* Who is in the Scene, worked out from whereabouts (never stored): the Characters there who are
* still in play and the live NPCs at the Place. The rest of the Party is elsewhere.
*/
function present(db) {
	const place = scenePlace(db);
	const party = characterRefs(db).filter((c) => c.row.status === "alive");
	return {
		place,
		characters: party.filter((c) => inScene(place, c.row)),
		elsewhere: party.filter((c) => !inScene(place, c.row)),
		npcs: place ? npcsAt(db, place.handle) : []
	};
}
/** A spotlight request the server won't send: unknown Character, or one already in the Scene. */
var SpotlightRefusedError = class extends Error {};
/** The Scene as the Player's rail shows it, built from Player-safe fields only. */
function playerScene(db) {
	const { place, characters, elsewhere } = present(db);
	const minute = currentMinute(db);
	const placeName = (handle) => handle === null ? null : believedName(db, handle) ?? "an unfamiliar place";
	return {
		clock: {
			minute,
			...clockParts(minute)
		},
		place: place && { name: placeName(place.handle) },
		present: characters.map((c) => ({
			id: c.row.id,
			name: c.row.name
		})),
		elsewhere: elsewhere.map((c) => ({
			id: c.row.id,
			name: c.row.name,
			whereabouts: placeName(c.row.whereabouts)
		})),
		combat: playerCombat(db, new Map(characterRefs(db).map((c) => [c.handle, c.row.id])), (handle) => {
			const npc = db.select().from(npcCombat).where(eq(npcCombat.handle, handle)).get();
			return npc ? hpState(npc.hp, npc.maxHp) : "unhurt";
		})
	};
}
/**
* A Player's "Cut to <Name>" for a Character elsewhere, as the DM hears it: one `spotlight`
* channel event carrying the Character and the Player. It doesn't await Narration; the DM cuts
* with `set_scene` at a natural break.
*/
function spotlightRequest(db, characterId, player) {
	const { elsewhere, characters } = present(db);
	const target = elsewhere.find((c) => c.row.id === characterId);
	if (!target) {
		const here = characters.find((c) => c.row.id === characterId);
		throw new SpotlightRefusedError(here ? `${here.row.name} is already in the Scene` : "Character not found");
	}
	return {
		content: `Cut to ${target.row.name} (${target.handle}), at ${target.row.whereabouts ?? "no known Place"}`,
		meta: {
			kind: "spotlight",
			character: target.handle,
			player
		}
	};
}
// src/lib/server/play/death.ts
var FRESH$1 = {
	successes: 0,
	failures: 0
};
/** Successes or failures that end the Death saves. */
var THREE = 3;
/** The roll a Death save needs to succeed (SRD: 10 or higher). */
var DEATH_SAVE_DC = 10;
var without = (list, item) => list.filter((c) => c !== item);
var withCondition = (list, item) => list.includes(item) ? list : [...list, item];
function write(db, id, set) {
	db.update(character).set(set).where(eq(character.id, id)).run();
}
/** The Character dies: no Death saves, no concentration. */
function die(db, row) {
	write(db, row.id, {
		status: "dead",
		deathSaves: FRESH$1,
		concentration: null
	});
}
/**
* What damage that got past temporary HP does to a Character's life: falling Unconscious at 0,
* Death save failures at 0, or death. `before` is the HP before the damage, `taken` what got
* through. Returns the DM's notes; the HP itself is already written.
*/
function damagedCharacter(db, row, { before, taken, maxHp, crit = false }) {
	if (row.status !== "alive" || taken <= 0) return [];
	if (before > 0) {
		if (taken < before) return [];
		if (taken - before >= maxHp) {
			die(db, row);
			return [`${row.name} dies outright (instant death)`];
		}
		write(db, row.id, {
			conditions: withCondition(row.conditions, "unconscious"),
			deathSaves: FRESH$1,
			concentration: null
		});
		return [`${row.name} drops to 0 HP and falls unconscious${row.concentration ? `; concentration on ${row.concentration} ends` : ""}`];
	}
	if (taken >= maxHp) {
		die(db, row);
		return [`${row.name} dies outright (instant death)`];
	}
	const failures = row.deathSaves.failures + (crit ? 2 : 1);
	if (failures >= THREE) {
		die(db, row);
		return [`${row.name} takes damage at 0 HP: a third Death save failure, and dies`];
	}
	write(db, row.id, { deathSaves: {
		successes: row.deathSaves.successes,
		failures
	} });
	return [`${row.name} takes damage at 0 HP: ${crit ? "two Death save failures" : "a Death save failure"} (${failures} of ${THREE})`];
}
/** Healing at 0 HP wakes a Character and clears the tallies. */
function healedCharacter(db, row, hp) {
	if (row.currentHp > 0 || hp === 0) return;
	write(db, row.id, {
		conditions: without(row.conditions, "unconscious"),
		deathSaves: FRESH$1
	});
}
/** Whether a Character at 0 HP still rolls Death saves: alive, not stable. */
var rollsDeathSaves = (row) => row.status === "alive" && row.currentHp === 0 && !row.deathSaves.stable;
var tally = (s) => `${s.successes} success${s.successes === 1 ? "" : "es"}, ${s.failures} failure${s.failures === 1 ? "" : "s"}`;
/**
* Applies one Death save roll (the kept d20, no modifier). A natural 20 regains 1 HP; a natural 1
* is two failures; 10 or higher succeeds. Three successes stabilize, three failures kill.
*/
function applyDeathSave(db, row, d20) {
	if (d20 === 20) {
		write(db, row.id, {
			currentHp: 1,
			conditions: without(row.conditions, "unconscious"),
			deathSaves: FRESH$1
		});
		return {
			success: true,
			outcome: "regains 1 HP",
			text: "natural 20: regains 1 HP and wakes"
		};
	}
	const success = d20 >= DEATH_SAVE_DC;
	const next = {
		successes: row.deathSaves.successes + (success ? 1 : 0),
		failures: row.deathSaves.failures + (success ? 0 : d20 === 1 ? 2 : 1)
	};
	if (next.failures >= THREE) {
		die(db, row);
		return {
			success,
			outcome: "dead",
			text: `failure: a third failure, ${row.name} dies`
		};
	}
	if (next.successes >= THREE) {
		write(db, row.id, { deathSaves: {
			...FRESH$1,
			stable: true
		} });
		return {
			success,
			outcome: "stable",
			text: `success: a third success, ${row.name} is stable`
		};
	}
	write(db, row.id, { deathSaves: next });
	return {
		success,
		outcome: success ? "success" : "failure",
		text: `${success ? "success" : d20 === 1 ? "natural 1: two failures" : "failure"} (${tally(next)})`
	};
}
/**
* On a Combat turn, a Character at 0 HP who still rolls Death saves gets a pending Death save
* Call. Returns its id, or null for anyone else.
*/
function deathSaveCall(db, handle, at) {
	const ref = characterRefs(db).find((c) => c.handle === handle);
	if (!ref || !rollsDeathSaves(ref.row)) return null;
	return createPendingCall(db, [{
		characterId: ref.row.id,
		player: ref.row.controllingPlayer ?? "player",
		sequence: null
	}], at, "death_save");
}
// src/lib/rules/armor-class.ts
/**
* A Character's AC from what it wears (SRD "Armor and Shields"): equipped body armor's base plus
* the Dexterity modifier (all of it for light armor, at most 2 for medium, none for heavy), or the
* unarmored AC without armor; +2 with an equipped shield; +1 from the Defense fighting style while
* armored. Pure.
*/
function armorClass(equipment, input) {
	const worn = input.equipped.flatMap((slug) => equipment.find((e) => e.slug === slug) ?? []);
	const armor = worn.find((e) => e.armorCategory && e.armorCategory !== "Shield" && e.armorClassBase !== null);
	const shield = worn.find((e) => e.armorCategory === "Shield");
	let value = input.unarmored;
	if (armor) {
		const dex = !armor.armorClassDexBonus ? 0 : armor.armorClassMaxBonus === null ? input.dexModifier : Math.min(input.dexModifier, armor.armorClassMaxBonus);
		value = armor.armorClassBase + dex + (input.defense ? 1 : 0);
	}
	if (shield) value += shield.armorClassBase ?? 2;
	const note = [armor ? armor.name : "unarmored", ...shield ? [shield.name] : []].join(", ");
	return {
		value,
		note
	};
}
/** Whether an item can be equipped: armor, a shield or a weapon. */
var equippable = (item) => item.armorCategory !== null || item.weaponCategory !== null;
/** Whether an item is body armor (one suit at a time), as opposed to a shield or a weapon. */
var isBodyArmor = (item) => item.armorCategory !== null && item.armorCategory !== "Shield";
// src/lib/server/character/armor.ts
/**
* A Character's AC from its equipped armor and shield (see `armorClass`), or null while its
* unarmored AC can't be derived yet.
*/
function characterAc(rules, detail, stats) {
	if (stats.unarmoredAc.status !== "ok") return null;
	const dex = stats.abilities.dex;
	return armorClass(rules.equipment, {
		equipped: detail.inventory.filter((i) => i.equipped).map((i) => i.item),
		dexModifier: dex.status === "ok" ? dex.value.modifier : 0,
		unarmored: stats.unarmoredAc.value.value,
		defense: detail.choices.some((c) => c.optionSlug.endsWith("fighting-style-defense"))
	});
}
// src/lib/server/play/concentration.ts
/** The lowest DC a concentration save has. */
var MIN_DC = 10;
/** The DC to keep concentration after taking this much damage. */
var concentrationDc = (damage) => Math.max(MIN_DC, Math.floor(damage / 2));
/** Writes the caster's concentration link: a spell slug, or null to end it. */
function setConcentration(db, who, spell) {
	if (who.kind === "character") db.update(character).set({ concentration: spell }).where(eq(character.id, who.id)).run();
	else if (who.kind === "npc") db.update(npcCombat).set({ concentration: spell }).where(eq(npcCombat.handle, who.handle)).run();
	else {
		const live = liveCombat(db);
		if (!live) return;
		db.update(combatant$1).set({ concentration: spell }).where(and(eq(combatant$1.combatId, live.id), eq(combatant$1.handle, who.handle))).run();
	}
}
/** Starts concentrating on a spell; returns the spell it ended, if any. */
function concentrate(db, who, spell) {
	setConcentration(db, who, spell);
	return who.concentration && who.concentration !== spell ? who.concentration : null;
}
/**
* Damage to a concentrating caster: a Character gets a pending Constitution save Call; an NPC or
* Creature rolls it now (`bonus` is its Con save) and loses the spell on a failure.
*/
function concentrationCheck(db, who, damage, { dice, at, bonus }) {
	const spell = who.concentration;
	if (!spell || damage <= 0) return {
		notes: [],
		calls: []
	};
	const dc = concentrationDc(damage);
	if (who.kind === "character") {
		const id = createPendingCall(db, [{
			characterId: who.id,
			player: who.player,
			sequence: null,
			save: "con",
			dc,
			reason: `To keep concentration on ${spell}`
		}], at, "concentration");
		return {
			notes: [`${who.name} must make a Constitution save (DC ${dc}) to keep concentration on ${spell}: attach pending Call ${id} with narrate`],
			calls: [id]
		};
	}
	const d20 = dice.rollD20();
	const total = d20.kept + bonus;
	const kept = total >= dc;
	if (!kept) setConcentration(db, who, null);
	const sign = bonus >= 0 ? `+ ${bonus}` : `- ${-bonus}`;
	return {
		notes: [`${who.name} Constitution save to keep concentration: d20 ${d20.kept} ${sign} = ${total} vs DC ${dc} → ${kept ? "success" : `failure; concentration on ${spell} ends`}`],
		calls: []
	};
}
// src/lib/server/play/combatants.ts
/**
* The SRD stat block a ref names, with or without its `monster:` prefix. The one lookup NPCs,
* Creatures and start_combat share, refused alike when the SRD has no such stat block.
*/
function statBlockFor(db, block) {
	const ref = block.startsWith("monster:") ? block : `monster:${block}`;
	const found = createRulesRepository(db).entry(ref);
	if (!found || found.kind !== "monster") throw new ToolError("unknown_stat_block", `No SRD stat block is ${ref}`, "Find the monster: slug with lookup and call again");
	return found.entry;
}
var ok = (s) => s.status === "ok" ? s.value : null;
/** A Character's derived stats, from its stored choices and what it carries now. */
function characterStats(db, id) {
	const detail = createCharacterService(db).get(id);
	const rules = loadWizardRules();
	const { stats, resolved } = buildSummary(rules, {
		...detailToSummaryData(detail),
		equipment: detail.inventory
	});
	return {
		detail,
		stats,
		features: resolved.features.map((f) => ({
			slug: f.slug,
			name: f.name
		})),
		ac: characterAc(rules, detail, stats)?.value ?? 10
	};
}
function characterCombatant(db, ref) {
	const key = ref.trim().toLowerCase();
	const holder = characterHolders(db).find((c) => c.handle === key || c.id === ref || c.name.toLowerCase() === key);
	if (!holder) return null;
	const { detail, stats, features, ac } = characterStats(db, holder.id);
	return {
		kind: "character",
		handle: holder.handle,
		name: holder.name,
		id: holder.id,
		player: holder.player ?? "player",
		detail,
		stats,
		features,
		ac,
		hp: detail.currentHp,
		maxHp: ok(stats.hitPoints) ?? detail.currentHp,
		conditions: detail.conditions,
		concentration: detail.concentration
	};
}
/** The stat block's AC: its first listed armor class. */
var statBlockAc = (m) => m.armorClass[0]?.value ?? 10;
/**
* An NPC's HP and conditions, kept apart from its World page. The first time an NPC is drawn into
* the rules it starts at its stat block's full HP.
*/
function npcCombatState(db, handle, block) {
	return db.select().from(npcCombat).where(eq(npcCombat.handle, handle)).get() ?? db.insert(npcCombat).values({
		handle,
		hp: block.hitPoints,
		maxHp: block.hitPoints,
		conditions: []
	}).returning().get();
}
function npcCombatant(db, handle) {
	const npc = db.select().from(entity).where(eq(entity.handle, handle)).get();
	if (!npc || npc.type !== "npc" || npc.retiredAt !== null) return null;
	const ref = npc.fields.stat_block;
	if (typeof ref !== "string") throw new ToolError("no_stat_block", `${npc.name} (${handle}) has no stat block`, `Give it one with set_field(${handle}, stat_block, monster:<slug>) — find the slug with lookup — and call again`);
	const statBlock = statBlockFor(db, ref);
	const state = npcCombatState(db, handle, statBlock);
	return {
		kind: "npc",
		handle,
		name: npc.name,
		statBlock,
		ac: statBlockAc(statBlock),
		hp: state.hp,
		maxHp: state.maxHp,
		conditions: state.conditions,
		concentration: state.concentration
	};
}
/** A Creature in the live Combat; gone once the Combat ends. */
function creatureCombatant(db, handle) {
	const row = liveCreature(db, handle);
	if (!row) return null;
	const statBlock = statBlockFor(db, row.statBlock);
	return {
		kind: "creature",
		handle,
		name: row.name,
		statBlock,
		ac: statBlockAc(statBlock),
		hp: row.hp,
		maxHp: row.maxHp,
		conditions: row.conditions,
		concentration: row.concentration
	};
}
var deadRefusal = (who, status, code) => new ToolError(code, `${who.name} is ${status}; healing can't bring them back`, "Only magic that restores life can; narrate it and leave the HP alone");
var CHARACTER = {
	find: (db, ref) => characterCombatant(db, ref),
	saveBonus: (who, ability) => ok(who.stats.savingThrows[ability])?.modifier ?? 0,
	canAct: (who) => canAct(who.detail),
	damageFactor: () => 1,
	takeDamage(db, who, dealt, { crit }) {
		const absorbed = Math.min(who.detail.tempHp, dealt);
		const taken = dealt - absorbed;
		const hp = Math.max(0, who.hp - taken);
		db.update(character).set({
			currentHp: hp,
			tempHp: who.detail.tempHp - absorbed
		}).where(eq(character.id, who.id)).run();
		return {
			hp,
			notes: damagedCharacter(db, who.detail, {
				before: who.hp,
				taken,
				maxHp: who.maxHp,
				crit
			})
		};
	},
	assertHealable(_db, who) {
		if (who.detail.status !== "alive") throw deadRefusal(who, who.detail.status, "character_dead");
	},
	restore(db, who, hp) {
		db.update(character).set({ currentHp: hp }).where(eq(character.id, who.id)).run();
		healedCharacter(db, who.detail, hp);
	},
	isOut: (_db, who) => who.detail.status !== "alive",
	write(db, who, { hp, conditions, concentration }) {
		db.update(character).set({
			...hp !== void 0 ? { currentHp: hp } : {},
			...conditions !== void 0 ? { conditions } : {},
			...concentration !== void 0 ? { concentration } : {}
		}).where(eq(character.id, who.id)).run();
	}
};
/** The rules NPCs and Creatures share: a stat block, and their own HP and conditions. */
function foeRules(find, write, { dead, die }) {
	const rules = {
		find,
		write,
		saveBonus(who, ability) {
			const proficient = who.statBlock.proficiencies.find((p) => p.proficiency === `saving-throw-${ability}`);
			if (proficient) return proficient.value;
			const score = who.statBlock.abilityScores[ability] ?? 10;
			return Math.floor((score - 10) / 2);
		},
		canAct: () => true,
		damageFactor(who, damageType) {
			if (!damageType) return 1;
			const has = (list) => list.some((entry) => entry.toLowerCase().split(/[,;]\s*|\s+and\s+/).includes(damageType));
			if (has(who.statBlock.damageImmunities)) return 0;
			if (has(who.statBlock.damageResistances)) return .5;
			if (has(who.statBlock.damageVulnerabilities)) return 2;
			return 1;
		},
		takeDamage(db, who, dealt, { knockOut }) {
			const hp = Math.max(0, who.hp - dealt);
			write(db, who, { hp });
			return {
				hp,
				notes: who.hp > 0 && hp === 0 ? down(db, who, knockOut) : []
			};
		},
		assertHealable(db, who) {
			if (rules.isOut(db, who)) throw deadRefusal(who, "dead", "npc_dead");
		},
		restore(db, who, hp) {
			write(db, who, {
				hp,
				conditions: hp > 0 ? who.conditions.filter((c) => c !== "unconscious") : who.conditions
			});
		},
		isOut: (db, who) => dead(db, who) || who.hp === 0 && !who.conditions.includes("unconscious")
	};
	/** At 0 HP: knocked out (Unconscious) when the DM rules it, else dead. */
	function down(db, who, knockOut) {
		const ended = who.concentration ? [`concentration on ${who.concentration} ends`] : [];
		if (who.concentration) write(db, who, { concentration: null });
		if (knockOut) {
			if (!who.conditions.includes("unconscious")) write(db, who, { conditions: [...who.conditions, "unconscious"] });
			return [[`${who.name} is knocked out`, ...ended].join("; ")];
		}
		die(db, who);
		return [[`${who.name} dies`, ...ended].join("; ")];
	}
	return rules;
}
var KINDS = {
	character: CHARACTER,
	npc: foeRules((db, ref) => npcCombatant(db, ref), (db, who, set) => {
		db.update(npcCombat).set(set).where(eq(npcCombat.handle, who.handle)).run();
	}, {
		dead: (db, who) => db.select().from(entity).where(eq(entity.handle, who.handle)).get()?.fields.status === "dead",
		die(db, who) {
			const npc = db.select().from(entity).where(eq(entity.handle, who.handle)).get();
			db.update(entity).set({
				fields: {
					...npc.fields,
					status: "dead"
				},
				version: npc.version + 1
			}).where(eq(entity.handle, who.handle)).run();
		}
	}),
	creature: foeRules((db, ref) => creatureCombatant(db, ref), (db, who, set) => {
		const row = liveCreature(db, who.handle);
		db.update(combatant$1).set(set).where(eq(combatant$1.id, row.id)).run();
	}, {
		dead: () => false,
		die: () => {}
	})
};
/** The rules for a combatant's kind. */
var rulesOf = (who) => KINDS[who.kind];
/**
* The combatant a tool names: a Character by handle (`char:wren`) or name, an NPC by handle, or a
* Creature in the live Combat (`creature:goblin-2`). The one lookup every action tool and primitive
* goes through.
*/
function combatant(db, ref) {
	const kind = handleKind(ref);
	const found = (kind === "npc" || kind === "creature" ? KINDS[kind] : CHARACTER).find(db, ref);
	if (!found) throw ToolError.unknownHandle(ref);
	return found;
}
/** A combatant's saving throw bonus: a Character's derived save, a stat block's proficiency or ability. */
var saveBonus = (who, ability) => rulesOf(who).saveBonus(who, ability);
/** A Character who acts must be able to. */
function mustAct(who) {
	if (!rulesOf(who).canAct(who)) throw new ToolError("character_cannot_act", `${who.name} can't act`, "Choose a Character who can act");
}
/**
* The one way HP goes down. Temporary HP absorbs damage first; HP never drops below 0. Stat block
* resistances apply. A Character at 0 HP falls Unconscious (or dies outright) and takes Death save
* failures from more damage; an NPC or Creature dies at 0 HP unless knocked out. A concentrating
* target still standing saves to keep its spell.
*/
function applyDamage(db, who, amount, damageType, { crit = false, knockOut = false, dice, at = Date.now() } = {}) {
	const rules = rulesOf(who);
	const dealt = Math.floor(amount * rules.damageFactor(who, damageType));
	const { hp, notes } = rules.takeDamage(db, who, dealt, {
		crit,
		knockOut
	});
	const save = dice && hp > 0 ? concentrationCheck(db, who, dealt, {
		dice,
		at,
		bonus: rules.saveBonus(who, "con")
	}) : {
		notes: [],
		calls: []
	};
	return {
		dealt,
		hp,
		max: who.maxHp,
		notes: [...notes, ...save.notes],
		calls: save.calls
	};
}
/** Restores HP, never above the maximum. A Character at 0 HP wakes; the dead stay dead. */
function applyHealing(db, who, amount) {
	const rules = rulesOf(who);
	rules.assertHealable(db, who);
	const hp = Math.min(who.maxHp, who.hp + amount);
	rules.restore(db, who, hp);
	return {
		dealt: hp - who.hp,
		hp,
		max: who.maxHp,
		notes: [],
		calls: []
	};
}
/**
* Whether a combatant is out of the Combat for good: a dead Character, or an NPC or Creature that
* is dead or at 0 HP without being knocked out. A Character at 0 HP still rolls Death saves.
*/
var isOut = (db, who) => rulesOf(who).isOut(db, who);
/** Replaces a combatant's conditions. */
function setConditions(db, who, conditions) {
	rulesOf(who).write(db, who, { conditions });
}
/** Conditions that leave a creature incapacitated, which ends its concentration (SRD). */
var INCAPACITATING = /* @__PURE__ */ new Set([
	"incapacitated",
	"paralyzed",
	"petrified",
	"stunned",
	"unconscious"
]);
/** Whether a condition leaves its bearer incapacitated. */
var incapacitates = (condition) => INCAPACITATING.has(condition);
// src/lib/server/play/combat.ts
/** Seconds in a Combat round (SRD). */
var ROUND_SECONDS = 6;
var FRESH = {
	action: false,
	bonusAction: false,
	reaction: false
};
var abilityMod = (score) => Math.floor((score - 10) / 2);
/** The live Combat, or null. */
function liveCombat(db) {
	return db.select().from(combat).where(isNull(combat.endedAt)).get() ?? null;
}
/** The live Combat, or `no_combat`. */
function requireCombat(db) {
	const live = liveCombat(db);
	if (!live) throw new ToolError("no_combat", "No Combat is live", "Start one with start_combat");
	return live;
}
/** Refuses while a Combat is live. */
function refuseDuringCombat(db, what) {
	if (liveCombat(db)) throw new ToolError("combat_live", `A Combat is live: ${what} waits until it ends`, "Finish the fight and call end_combat first");
}
/** Every combatant of a Combat, in the order they joined. */
function combatantsOf(db, combatId) {
	return db.select().from(combatant$1).where(eq(combatant$1.combatId, combatId)).orderBy(asc(combatant$1.joined)).all();
}
/**
* The initiative order: everyone with initiative, highest first; ties go to the higher Dexterity,
* then to whoever joined first. A Character still to roll isn't in it yet.
*/
function initiativeOrder(db, combatId) {
	return combatantsOf(db, combatId).filter((c) => c.initiative !== null).sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || a.joined - b.joined);
}
/** The combatants still to roll initiative (Characters whose Call isn't rolled yet). */
function waitingOnInitiative(db, combatId) {
	return combatantsOf(db, combatId).filter((c) => c.initiative === null);
}
/** A Creature in the live Combat by handle, or null. */
function liveCreature(db, handle) {
	const live = liveCombat(db);
	if (!live) return null;
	return db.select().from(combatant$1).where(and(eq(combatant$1.combatId, live.id), eq(combatant$1.handle, handle), eq(combatant$1.kind, "creature"))).get() ?? null;
}
var statBlockDex = (m) => m.abilityScores.dex ?? 10;
function joining(db, combatId, entries) {
	const existing = combatantsOf(db, combatId);
	const taken = new Set(existing.map((c) => c.handle));
	const out = [];
	for (const entry of entries) {
		const spec = typeof entry === "string" && entry.startsWith("monster:") ? { monster: entry } : entry;
		if (typeof spec !== "string") {
			const statBlock = statBlockFor(db, spec.monster);
			for (let i = 0; i < (spec.count ?? 1); i++) {
				let n = 1;
				while (taken.has(`creature:${statBlock.slug}-${n}`)) n++;
				const handle = `creature:${statBlock.slug}-${n}`;
				taken.add(handle);
				out.push({ row: {
					kind: "creature",
					handle,
					name: `${statBlock.name} ${n}`,
					dex: statBlockDex(statBlock),
					statBlock: `monster:${statBlock.slug}`,
					hp: statBlock.hitPoints,
					maxHp: statBlock.hitPoints
				} });
			}
			continue;
		}
		const who = combatant(db, spec);
		if (taken.has(who.handle)) throw ToolError.invalidInput("start_combat", `${who.name} (${who.handle}) is already fighting`);
		taken.add(who.handle);
		const dex = who.kind === "character" ? who.stats.abilities.dex.status === "ok" ? who.stats.abilities.dex.value.score : 10 : statBlockDex(who.statBlock);
		out.push({
			row: {
				kind: who.kind,
				handle: who.handle,
				name: who.name,
				dex
			},
			who
		});
	}
	return out;
}
/**
* Adds combatants to a Combat. NPCs and Creatures roll initiative now, in code; Characters get
* one pending initiative Call between them, for the closing narrate to attach.
*/
function join(db, dice, combatId, entries, { surprised = [], at }) {
	const adding = joining(db, combatId, entries);
	const unknown = surprised.filter((h) => !adding.some((a) => a.row.handle === h));
	if (unknown.length) throw ToolError.invalidInput("start_combat", `Surprised must name combatants in this fight: ${unknown.join(", ")}`);
	let joined = combatantsOf(db, combatId).length;
	const rolls = [];
	const rolled = [];
	const parts = [];
	for (const { row, who } of adding) {
		let initiative = null;
		const unclaimed = who?.kind === "character" && characterHolders(db).find((h) => h.id === who.id)?.player === null;
		if (row.kind === "character" && who?.kind === "character" && !unclaimed) parts.push({
			characterId: who.id,
			player: who.player,
			sequence: null,
			reason: null
		});
		else {
			const modifier = who?.kind === "character" && who.stats.initiative.status === "ok" ? who.stats.initiative.value : abilityMod(row.dex);
			const d20 = dice.rollD20();
			initiative = d20.kept + modifier;
			const sign = modifier >= 0 ? `+ ${modifier}` : `- ${-modifier}`;
			rolled.push(`${row.name} initiative: d20 ${d20.kept} ${sign} = ${initiative}`);
			rolls.push({
				characterName: row.name,
				characterHandle: row.handle,
				what: "Initiative",
				dice: d20.dice,
				modifier,
				total: initiative,
				outcome: null,
				mode: "normal",
				reason: null,
				target: null
			});
		}
		db.insert(combatant$1).values({
			...row,
			combatId,
			joined: ++joined,
			initiative,
			surprised: surprised.includes(row.handle)
		}).run();
	}
	const pendingCall = parts.length ? createPendingCall(db, parts, at, "initiative") : null;
	rolled.push(...beginIfReady(db, combatId, dice));
	return {
		creatures: adding.filter((a) => a.row.kind === "creature").map((a) => a.row.handle),
		rolls,
		rolled,
		pendingCall
	};
}
/** Starts a Combat. Refused while one is live. */
function startCombat(db, dice, entries, { surprised, at }) {
	if (liveCombat(db)) throw new ToolError("combat_live", "A Combat is already live", "Add late arrivals with add_combatant, or end it with end_combat first");
	const { id } = db.insert(combat).values({ startedAt: currentMinute(db) }).returning({ id: combat.id }).get();
	return join(db, dice, id, entries, {
		surprised,
		at
	});
}
/** Adds a late arrival to the live Combat. */
function addCombatants(db, dice, entries, at) {
	return join(db, dice, requireCombat(db).id, entries, { at });
}
/**
* Whether a combatant acts this round: a surprised one loses its first turn, and the dead (or a
* foe at 0 HP that wasn't knocked out) lose every turn.
*/
function acts(db, c, round) {
	if (round === 1 && c.surprised) return false;
	return !isOut(db, combatant(db, c.handle));
}
/**
* Moves the turn pointer to the next combatant who acts, wrapping into the next round, and resets
* their per-turn resources. From no current turn, starts from the top of round `round`.
*/
function step(db, live) {
	const order = initiativeOrder(db, live.id);
	let round = live.round;
	let index = live.current === null ? -1 : order.findIndex((c) => c.id === live.current);
	let next = null;
	for (let n = 0; n < order.length * 2 + 1 && order.length; n++) {
		index++;
		if (index >= order.length) {
			index = 0;
			round++;
		}
		if (acts(db, order[index], round)) {
			next = order[index];
			break;
		}
	}
	db.update(combat).set({
		round,
		current: next?.id ?? null
	}).where(eq(combat.id, live.id)).run();
	if (next) db.update(combatant$1).set({ used: FRESH }).where(eq(combatant$1.id, next.id)).run();
	return {
		round,
		current: next
	};
}
/** Whether a combatant is a Character nobody Claims right now. */
var isUnclaimed = (db, c) => c.kind === "character" && characterHolders(db).find((h) => h.handle === c.handle)?.player === null;
/**
* Moves to the next turn. An unclaimed Character's turn passes with a note and code makes its rolls
* (a Death save at 0 HP); a Character Claimed by the time its turn comes plays it. After one full
* lap of unclaimed Characters the turn stays on the last one.
*/
function advance(db, live, dice) {
	const notes = [];
	let state = step(db, live);
	const lap = combatantsOf(db, live.id).length;
	for (let n = 0; n < lap && state.current && isUnclaimed(db, state.current); n++) {
		const who = state.current;
		notes.push(`${who.name} is unclaimed: no action`);
		const row = characterRefs(db).find((c) => c.handle === who.handle)?.row;
		if (row && rollsDeathSaves(row)) {
			const d20 = dice.rollD20().kept;
			notes.push(`${who.name} Death save: d20 ${d20} → ${applyDeathSave(db, row, d20).text}`);
		}
		state = step(db, {
			...live,
			round: state.round,
			current: who.id
		});
	}
	return {
		...state,
		notes
	};
}
/** Once every combatant has initiative, round 1 begins with the first who acts. */
function beginIfReady(db, combatId, dice = null) {
	const live = db.select().from(combat).where(eq(combat.id, combatId)).get();
	if (live.round !== 0 || live.endedAt !== null) return [];
	if (combatantsOf(db, combatId).some((c) => c.initiative === null)) return [];
	const start = {
		...live,
		round: 1,
		current: null
	};
	return dice ? advance(db, start, dice).notes : (step(db, start), []);
}
/**
* Records a Character's initiative roll from the Party's Call. Late arrivals slot into the order;
* the last roll at the start of a Combat begins round 1.
*/
function recordInitiative(db, characterHandle, total, dice = null) {
	const live = liveCombat(db);
	if (!live) return [];
	db.update(combatant$1).set({ initiative: total }).where(and(eq(combatant$1.combatId, live.id), eq(combatant$1.handle, characterHandle))).run();
	return beginIfReady(db, live.id, dice);
}
/** Advances to the next turn. Refused until every combatant has initiative. */
function nextTurn(db, dice) {
	const live = requireCombat(db);
	if (live.round === 0) throw new ToolError("initiative_pending", "The order is not known yet: some Characters have not rolled initiative", "Attach the initiative Call with narrate and wait for its call_result");
	return advance(db, live, dice);
}
var RESOURCE_NAMES = {
	action: "an action",
	bonusAction: "a bonus action",
	reaction: "a reaction"
};
/**
* Marks a per-turn resource spent by a combatant in the live Combat. Returns a reminder when it was
* already spent this turn, never a refusal; null outside a Combat or the first time.
*/
function spendTurnResource(db, handle, name, resource) {
	const live = liveCombat(db);
	if (!live) return null;
	const row = db.select().from(combatant$1).where(and(eq(combatant$1.combatId, live.id), eq(combatant$1.handle, handle))).get();
	if (!row) return null;
	if (row.used[resource]) return `${name} has already used ${RESOURCE_NAMES[resource]} this turn (a reminder: go on if the fiction allows it)`;
	db.update(combatant$1).set({ used: {
		...row.used,
		[resource]: true
	} }).where(eq(combatant$1.id, row.id)).run();
	return null;
}
/** The DM's one-line order: `Order: Wren 20, Goblin 2 17. Round 1: Wren (char:wren) acts.` */
function orderText(db) {
	const live = liveCombat(db);
	if (!live) return "No Combat is live.";
	const order = initiativeOrder(db, live.id);
	const waiting = waitingOnInitiative(db, live.id);
	const current = order.find((c) => c.id === live.current);
	return [
		`Order: ${order.map((c) => `${c.name} ${c.initiative}`).join(", ") || "none yet"}.`,
		waiting.length ? `Waiting on initiative: ${waiting.map((c) => c.name).join(", ")}.` : null,
		current ? `Round ${live.round}: ${current.name} (${current.handle}) acts.` : null
	].filter(Boolean).join(" ");
}
/** The live Combat as the DM reads it: round, current turn and the order with Creatures' state. */
function combatState(db) {
	const live = requireCombat(db);
	const current = initiativeOrder(db, live.id).find((c) => c.id === live.current) ?? null;
	return {
		round: live.round,
		turn: current && {
			handle: current.handle,
			name: current.name,
			used: current.used
		},
		order: orderText(db)
	};
}
/**
* Ends the live Combat: its rounds go onto the clock, rounded up to a whole minute, Creatures
* vanish, and any initiative Call still pending is cancelled.
*/
function endCombat(db, at) {
	const live = requireCombat(db);
	const rounds = live.round;
	const minutes = Math.ceil(rounds * ROUND_SECONDS / 60);
	const clock = advanceClock(db, currentMinute(db) + minutes);
	const creatures = combatantsOf(db, live.id).filter((c) => c.kind === "creature");
	db.update(call).set({
		state: "cancelled",
		closedAt: at
	}).where(and(eq(call.kind, "initiative"), inArray(call.state, ["pending", "open"]))).run();
	db.delete(combatant$1).where(eq(combatant$1.combatId, live.id)).run();
	db.update(combat).set({
		endedAt: at,
		current: null
	}).where(eq(combat.id, live.id)).run();
	return {
		rounds,
		minutes,
		clock,
		gone: creatures.map((c) => ({
			handle: c.handle,
			statBlock: c.statBlock,
			hp: c.hp,
			maxHp: c.maxHp
		}))
	};
}
/** A Creature's HP as the Player reads it. */
var stateOf = (c) => c.kind === "creature" ? hpState(c.hp, c.maxHp) : null;
/**
* The live Combat as the Player's rail shows it: the order with the current turn marked; enemy HP
* only as a state, never a number, and no handles. Null when no Combat is live.
*/
function playerCombat(db, characterIds, npcState) {
	const live = liveCombat(db);
	if (!live) return null;
	const order = initiativeOrder(db, live.id);
	const waiting = waitingOnInitiative(db, live.id);
	const shown = (c) => c.kind === "npc" ? believedName(db, c.handle) ?? "a stranger" : c.name;
	return {
		round: live.round,
		order: order.map((c, i) => ({
			key: `${i}`,
			name: shown(c),
			kind: c.kind,
			characterId: characterIds.get(c.handle) ?? null,
			initiative: c.initiative,
			current: c.id === live.current,
			state: c.kind === "npc" ? npcState(c.handle) : stateOf(c)
		})),
		waiting: waiting.map(shown)
	};
}
/** The Character whose turn it is in the live Combat, by handle; null outside a Character's turn. */
function currentTurn(db) {
	const live = liveCombat(db);
	if (!live?.current) return null;
	return db.select().from(combatant$1).where(eq(combatant$1.id, live.current)).get() ?? null;
}
// src/lib/server/play/log.ts
/** The default Audience: every Party Character now, in the order they joined (ADR 0008). */
function partyAudience(db) {
	return db.select({ id: character.id }).from(character).orderBy(sql`rowid`).all().map((c) => c.id);
}
/** The ids of the Characters `viewer`'s browser holds a Claim on: what it may see (ADR 0008). */
function claimedBy(db, viewer) {
	return db.select({ id: character.id }).from(character).where(eq(character.controllingPlayer, viewer)).all().map((c) => c.id);
}
/**
* Whether an Audience reaches at least one of the viewer's Claimed Characters. An empty Audience
* was written before the Party had any Character, so it is everyone's.
*/
var reaches = (audience, claimed) => audience.length === 0 || audience.some((id) => claimed.has(id));
/**
* The Campaign's current stamp: the open Session (null offline) and the Campaign clock's minute.
*/
function currentStamp(db) {
	return {
		sessionId: currentSession(db)?.id ?? null,
		minute: currentMinute(db)
	};
}
/**
* The current Session: the newest one still open, or undefined offline. An older open one is a
* Session that stopped without End Session, waiting for its catch-up close.
*/
function currentSession(db) {
	return db.select().from(session).where(isNull(session.closedAt)).orderBy(desc(session.number)).get();
}
/** Whether any non-recap Narration was logged in the Session. */
function hasNarration(db, sessionId) {
	return db.select({ id: event.id }).from(event).where(and(eq(event.sessionId, sessionId), eq(event.kind, "narration"), sql`coalesce(json_extract(${event.data}, '$.recap'), 0) = 0`)).get() !== void 0;
}
/** The id the next Event will get. The log is append-only, so ids are never reused. */
function nextEventId(db) {
	return (db.get(sql`SELECT max(${event.id}) AS id FROM ${event}`)?.id ?? 0) + 1;
}
/** Appends one Event, stamped with `stamp`; returns its id. */
function logEvent(db, entry, { stamp = currentStamp(db), at, id = nextEventId(db) }) {
	db.insert(event).values({
		id,
		sessionId: stamp.sessionId,
		minute: stamp.minute,
		tool: entry.tool,
		kind: entry.kind,
		summary: entry.summary,
		data: entry.data ?? null,
		dmOnly: entry.dmOnly ?? false,
		audience: entry.audience ?? partyAudience(db),
		createdAt: at
	}).run();
	return id;
}
/** Writes a Player-safe DM activity line after the Event `afterEvent` (the latest one by default). */
function logActivity(db, text, { at, afterEvent = nextEventId(db) - 1 }) {
	db.insert(activityLine).values({
		text,
		afterEvent,
		sessionId: currentStamp(db).sessionId,
		audience: partyAudience(db),
		createdAt: at
	}).run();
}
/**
* Every Character Claim lapses when a Session closes, the Host's and departed Characters'
* included. Claims on drafts are not Character Claims and survive.
*/
function lapseClaims(db) {
	db.update(character).set({ controllingPlayer: null }).run();
}
/**
* The Session for a DM attaching through `bridge` (one per Claude Code session). A reconnect of
* the same bridge keeps its Session, even one End Session closed. A new bridge opens the next
* Session; an older open one stays open for its catch-up close, unless it has no Narration, in
* which case it closes now with no summary. With no bridge, the current Session is reused.
*/
function openSession(db, at, bridge) {
	const pick = {
		id: session.id,
		number: session.number
	};
	if (bridge !== void 0) {
		const own = db.select(pick).from(session).where(eq(session.bridge, bridge)).get();
		if (own) return own;
	} else {
		const current = currentSession(db);
		if (current) return {
			id: current.id,
			number: current.number
		};
	}
	for (const stale of db.select().from(session).where(isNull(session.closedAt)).all()) if (!hasNarration(db, stale.id)) {
		db.update(session).set({ closedAt: at }).where(eq(session.id, stale.id)).run();
		lapseClaims(db);
	}
	const last = db.select({ number: session.number }).from(session).orderBy(desc(session.number)).get();
	return db.insert(session).values({
		number: (last?.number ?? 0) + 1,
		bridge: bridge ?? null,
		startedAt: at
	}).returning(pick).get();
}
/** When the open turn started waiting on the DM, or null when nothing awaits Narration. */
function awaitingNarrationSince(db) {
	return db.select({ at: campaign.awaitingNarrationSince }).from(campaign).get()?.at ?? null;
}
/** Sets (a timestamp) or clears (null) the Campaign's awaiting Narration flag. */
function setAwaitingNarration(db, since) {
	db.update(campaign).set({ awaitingNarrationSince: since }).run();
}
/** Event kinds the Player's timeline shows. */
var SHOWN = /* @__PURE__ */ new Set([
	"declaration",
	"narration",
	"turn_error",
	"roll",
	"rolls",
	"answer"
]);
/** One roll in the dice log: a Player's click on a Call, or one of an NPC's rolls. */
function rollEntry(id, data, shown) {
	const target = data.target;
	const mode = data.mode === "advantage" || data.mode === "disadvantage" ? data.mode : "normal";
	return {
		type: "roll",
		id,
		character: shown(data.characterHandle, String(data.characterName)),
		what: String(data.what),
		dice: data.dice.map(Number),
		modifier: Number(data.modifier),
		total: Number(data.total),
		outcome: "outcome" in data ? data.outcome : data.success ? "success" : "failure",
		mode,
		reason: mode === "normal" ? null : String(data.reason ?? ""),
		target: target ? {
			name: shown(target.handle, target.name),
			state: target.state
		} : null
	};
}
/** One logged Event as timeline entries: none, one, or one per roll of an NPC's `rolls`. */
function entriesFor(e, shown) {
	if (e.kind === "rolls" && !e.dmOnly) return (e.data?.rolls ?? []).map((r, i) => rollEntry(`e${e.id}-${i}`, r, shown));
	const entry = entryFor(e, shown);
	return entry ? [entry] : [];
}
/** The names of an Audience narrower than the Party, for the "🔒 to" tag; undefined otherwise. */
function tagFor(audience, party, names) {
	if (party.every((id) => audience.includes(id))) return void 0;
	return audience.flatMap((id) => names.has(id) ? [names.get(id)] : []);
}
/** One logged Event as a timeline entry, or null for one the timeline does not show. */
function entryFor(e, shown) {
	if (e.dmOnly || !SHOWN.has(e.kind)) return null;
	const data = e.data ?? {};
	const id = `e${e.id}`;
	if (e.kind === "declaration") return {
		type: "declaration",
		id,
		character: String(data.characterName),
		player: String(data.player),
		text: String(data.text)
	};
	if (e.kind === "turn_error") return {
		type: "error",
		id,
		text: String(data.text)
	};
	if (e.kind === "roll") return rollEntry(id, data, shown);
	if (e.kind === "answer") return {
		type: "answer",
		id,
		player: String(data.player),
		question: String(data.question ?? ""),
		text: String(data.text)
	};
	return {
		type: "narration",
		id,
		text: String(data.text),
		voice: typeof data.voiceName === "string" ? data.voiceName : null,
		...data.recap === true ? { recap: true } : {}
	};
}
/**
* The Player's timeline: Declarations and Narrations from the Event log (never DM-only Events),
* with each DM activity line after the Event it follows, plus the awaiting Narration flag. Every
* entry is built here from Player-safe fields; nothing raw passes through.
*/
function timeline(db, viewer) {
	const claimed = new Set(claimedBy(db, viewer));
	const party = partyAudience(db);
	const names = new Map(db.select({
		id: character.id,
		name: character.name
	}).from(character).all().map((c) => [c.id, c.name]));
	const lines = db.select().from(activityLine).orderBy(asc(activityLine.id)).all();
	const shown = (handle, name) => typeof handle === "string" && handleKind(handle) === "npc" ? believedName(db, handle) ?? "a stranger" : name;
	const entries = [];
	let next = 0;
	const flushUntil = (eventId) => {
		while (next < lines.length && lines[next].afterEvent < eventId) {
			const line = lines[next++];
			if (!reaches(line.audience, claimed)) continue;
			entries.push({
				type: "activity",
				id: `a${line.id}`,
				text: line.text
			});
		}
	};
	for (const e of db.select().from(event).orderBy(asc(event.id)).all()) {
		flushUntil(e.id);
		if (!reaches(e.audience, claimed)) continue;
		const tag = tagFor(e.audience, party, names);
		for (const entry of entriesFor(e, shown)) entries.push(tag ? {
			...entry,
			audience: tag
		} : entry);
	}
	flushUntil(Infinity);
	return {
		entries,
		awaitingSince: awaitingNarrationSince(db),
		call: openCallView(db, claimed)
	};
}
// src/lib/server/play/sequences.ts
/** A weapon or spell attack: to-hit, then damage on a hit. */
function attackSequence(source, target, bonus, damage) {
	const steps = [{
		kind: "to_hit",
		bonus,
		ac: target.ac
	}];
	if (damage) steps.push({
		kind: "damage",
		...damage
	});
	return {
		label: `${source} attack`,
		source,
		target: {
			handle: target.handle,
			name: target.name
		},
		steps,
		rolls: [],
		done: false
	};
}
/** A saving throw: the effect applies in full on a failure, half or nothing on a success. */
function saveSequence(abilityName, target, step) {
	return {
		label: `${abilityName} save`,
		source: abilityName,
		target: {
			handle: target.handle,
			name: target.name
		},
		steps: [{
			kind: "save",
			...step
		}],
		rolls: [],
		done: false
	};
}
/** A damage roll alone (a spell that always hits, a save-spell's damage), applied to the target. */
function damageSequence(source, target, damage) {
	return {
		label: `${source} damage`,
		source,
		target: {
			handle: target.handle,
			name: target.name
		},
		steps: [{
			kind: "damage",
			...damage
		}],
		rolls: [],
		done: false
	};
}
/** What the next step rolls, as the Player's button reads it; null when the sequence is done. */
function nextStep(sequence) {
	if (sequence.done) return null;
	const step = sequence.steps[sequence.rolls.length];
	return step.kind === "to_hit" ? "to hit" : step.kind;
}
/** What one step rolls, as the Player reads it in the timeline: `Crossbow, light attack`. */
function stepLabel$1(sequence, step) {
	if (step.kind === "to_hit") return `${sequence.source} attack`;
	if (step.kind === "damage") return `${sequence.source} damage`;
	return `${sequence.source} save`;
}
/**
* Rolls the sequence's next step in code against the hidden number and applies its effect: the
* target takes the damage, or the save's effect lands. A miss ends the sequence.
*/
function rollStep(db, sequence, dice, { mode = "normal", reason = "", at = Date.now() } = {}) {
	const step = sequence.steps[sequence.rolls.length];
	const target = combatant(db, sequence.target.handle);
	const d20 = () => mode === "normal" ? dice.rollD20() : dice.rollD20({
		mode,
		reason: reason ?? ""
	});
	let roll;
	let ends = false;
	if (step.kind === "to_hit") {
		const rolled = d20();
		const total = rolled.kept + step.bonus;
		const outcome = rolled.kept === 20 ? "critical hit" : rolled.kept !== 1 && total >= step.ac ? "hit" : "miss";
		ends = outcome === "miss";
		roll = {
			dice: rolled.dice,
			kept: rolled.kept,
			modifier: step.bonus,
			total,
			outcome,
			applied: null,
			after: null
		};
	} else if (step.kind === "damage") {
		const crit = sequence.rolls.at(-1)?.outcome === "critical hit";
		const rolled = dice.rollExpression(step.dice, { crit });
		const total = Math.max(0, rolled.total);
		const change = applyDamage(db, target, total, step.damageType, {
			crit,
			dice,
			at
		});
		roll = {
			dice: rolled.dice,
			kept: null,
			modifier: rolled.modifier,
			total,
			outcome: null,
			applied: {
				dealt: change.dealt,
				damageType: step.damageType,
				condition: null
			},
			after: {
				hp: change.hp,
				max: change.max
			},
			notes: change.notes,
			calls: change.calls
		};
	} else {
		const rolled = d20();
		const total = rolled.kept + step.bonus;
		const success = total >= step.dc;
		const dealt = step.damage === null ? 0 : success ? step.onSuccess === "half" ? Math.floor(step.damage / 2) : 0 : step.damage;
		const change = dealt > 0 ? applyDamage(db, target, dealt, step.damageType, {
			dice,
			at
		}) : null;
		const condition = !success && step.condition ? step.condition : null;
		if (condition && !target.conditions.includes(condition)) setConditions(db, target, [...target.conditions, condition]);
		roll = {
			dice: rolled.dice,
			kept: rolled.kept,
			modifier: step.bonus,
			total,
			outcome: success ? "success" : "failure",
			applied: {
				dealt: change?.dealt ?? 0,
				damageType: step.damageType,
				condition
			},
			after: {
				hp: change?.hp ?? target.hp,
				max: target.maxHp
			},
			notes: change?.notes ?? [],
			calls: change?.calls ?? []
		};
	}
	const rolls = [...sequence.rolls, roll];
	return {
		sequence: {
			...sequence,
			rolls,
			done: ends || rolls.length === sequence.steps.length
		},
		what: stepLabel$1(sequence, step),
		roll,
		targetState: target.kind !== "character" && roll.after && step.kind !== "to_hit" ? {
			handle: target.handle,
			name: target.name,
			state: hpState(roll.after.hp, roll.after.max)
		} : null
	};
}
/** Rolls every step at once, for an NPC or Creature acting inside the DM's tool call. */
function rollAll(db, sequence, dice, options = {}) {
	const steps = [];
	let current = sequence;
	while (!current.done) {
		const rolled = rollStep(db, current, dice, options);
		steps.push(rolled);
		current = rolled.sequence;
	}
	return {
		sequence: current,
		steps
	};
}
var signed$1 = (n) => n >= 0 ? `+ ${n}` : `- ${-n}`;
/** `d20 15 + 4 = 19`, or with two d20s `d20 3/15 (advantage) kept 15 + 4 = 19`. */
function d20Text(roll, mode) {
	return `d20 ${roll.dice.length > 1 ? `${roll.dice.join("/")} (${mode}) kept ${roll.kept}` : `${roll.kept}`} ${signed$1(roll.modifier)} = ${roll.total}`;
}
/** `5 + 2 = 7`: every die, the modifier and the total. */
function damageText(roll) {
	return `${roll.dice.join(" + ")}${roll.modifier ? ` ${signed$1(roll.modifier)}` : ""} = ${roll.total}`;
}
/**
* The DM's view of a sequence, with the hidden numbers:
* `Crossbow, light attack on Grik (npc:grik): d20 15 + 4 = 19 vs AC 15 → hit; damage 1d8+2: 5 + 2 = 7 piercing → Grik 0/7 HP (down)`.
*/
function sequenceText(sequence, mode = "normal") {
	const { target } = sequence;
	const parts = sequence.rolls.map((roll, i) => {
		const notes = roll.notes?.length ? `; ${roll.notes.join("; ")}` : "";
		return stepText(roll, i) + notes;
	});
	function stepText(roll, i) {
		const step = sequence.steps[i];
		const after = roll.after ? ` → ${target.name} ${roll.after.hp}/${roll.after.max} HP (${hpState(roll.after.hp, roll.after.max)})` : "";
		if (step.kind === "to_hit") return `${d20Text(roll, mode)} vs AC ${step.ac} → ${roll.outcome}`;
		if (step.kind === "damage") {
			const doubled = roll.dice.length > Number(/^(\d*)d/.exec(step.dice)?.[1] || 1) ? " (doubled)" : "";
			return `damage ${step.dice}${doubled}: ${damageText(roll)} ${step.damageType}${after}`;
		}
		const effect = [roll.applied?.dealt ? `takes ${roll.applied.dealt} ${step.damageType ?? ""}`.trim() : null, roll.applied?.condition ? `is ${roll.applied.condition}` : null].filter(Boolean);
		return `${d20Text(roll, mode)} vs DC ${step.dc} → ${roll.outcome}${effect.length ? `; ${effect.join(", ")}` : ""}${roll.applied?.dealt ? after : ""}`;
	}
	return `${sequence.steps[0].kind === "save" ? sequence.label : `${sequence.label} on ${target.name}`} (${target.handle}): ${parts.join("; ")}`;
}
// src/lib/server/play/calls.ts
/**
* The DC for each difficulty tier, from the SRD's "Typical Difficulty Classes" table
* (`rule:ability-checks` in the Rules Data). Server-only: no DC ever reaches a Player payload.
*/
var DC_BY_TIER = {
	easy: 10,
	medium: 15,
	hard: 20,
	"very hard": 25
};
var TIERS = Object.keys(DC_BY_TIER);
var SKILL_NAMES = new Map(skills_default.map((s) => [s.slug, s.name]));
var ABILITY_NAMES = new Map(abilities_default.map((a) => [a.slug, a.fullName]));
var skillSlug = string().transform((s) => s.trim().toLowerCase().replace(/\s+/g, "-")).refine((s) => SKILL_NAMES.has(s), { message: `Expected a skill: ${[...SKILL_NAMES.keys()]}` });
var saveKey = string().transform((s) => {
	const key = s.trim().toLowerCase();
	return ABILITY_KEYS.find((k) => k === key || ABILITY_NAMES.get(k)?.toLowerCase() === key) ?? key;
}).refine((s) => ABILITY_KEYS.includes(s), { message: `Expected an ability: ${ABILITY_KEYS}` });
/** One Check: one Character or several (each with its own roll), a skill or a save, a tier. */
var checkSpec = object({
	kind: literal("check"),
	character: union([string().min(1), array(string().min(1)).min(1)]).describe("Character name or char: handle, or several, each rolling"),
	skill: skillSlug.optional().describe("Skill slug, such as sleight-of-hand"),
	save: saveKey.optional().describe("Ability for a saving throw, such as dex"),
	tier: _enum(TIERS).describe("Difficulty; code turns it into the DC"),
	adv: _enum(["advantage", "disadvantage"]).optional(),
	reason: string().trim().min(1).describe("Why the roll, shown to the Player")
}).refine((c) => c.skill === void 0 !== (c.save === void 0), { message: "Name exactly one of skill or save" });
var questionSpec = object({
	kind: literal("question"),
	text: string().trim().min(1),
	choices: array(string().trim().min(1)).optional().describe("Buttons; free text without")
});
/**
* `narrate`'s `call`: a pending Call id from an action tool, an inline question, or inline Checks
* (one, or a list for different rolls from several Characters).
*/
var callInput = union([
	string().min(1).describe("Pending Call id from an action tool"),
	questionSpec,
	checkSpec,
	array(checkSpec).min(1)
]);
var slug = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** The Character a Call names: by id, by name, or by `char:<name>` handle. */
function findCharacter(db, ref) {
	const key = slug(ref.replace(/^char:/, ""));
	const found = db.select().from(character).all().find((c) => c.id === ref || slug(c.name) === key);
	if (!found) throw new ToolError("unknown_character", `No Character is called ${ref}`, "Name a Character in the Party and call narrate again");
	if (!canAct(found)) throw new ToolError("character_cannot_act", `${found.name} can't act`, "Call on a Character who can act");
	return found;
}
function openCallRow(db) {
	return db.select().from(call).where(eq(call.state, "open")).get();
}
/** What a part rolls, as the Player reads it. */
function labelOf(part, kind) {
	if (kind === "initiative") return "Initiative";
	if (kind === "death_save") return "Death save";
	if (part.hitDice) return "Hit Dice";
	if (part.reaction) return part.reaction;
	if (part.sequence) return part.sequence.label;
	if (part.skill) return `${SKILL_NAMES.get(part.skill) ?? part.skill} check`;
	if (part.save) return `${ABILITY_NAMES.get(part.save) ?? part.save} save`;
	return null;
}
/** Refuses a Call that asks a Character its Narration's Audience leaves out (ADR 0008). */
function requireInAudience(who, audience) {
	if (audience.includes(who.id)) return;
	throw new ToolError("not_in_audience", `${who.name} is not in this Narration's Audience, so it cannot ask them for a roll`, "Add them to `to`, or narrate without `to`, or call on a Character the Narration reaches");
}
/**
* Opens a Call in the Narration's transaction. A Call ends the turn; only one is open at a time.
* Returns its id.
*/
function openCall(db, input, { at, openedBy, audience = partyAudience(db) }) {
	if (openCallRow(db)) throw new ToolError("call_open", "A Call is already open, waiting on the Players", "Wait for its call_result, or narrate without a call");
	if (typeof input === "string") return attachPending(db, input, openedBy, audience);
	const id = db.insert(call).values({
		campaignId: db.select({ id: campaign.id }).from(campaign).get().id,
		kind: Array.isArray(input) ? "check" : input.kind,
		text: !Array.isArray(input) && input.kind === "question" ? input.text : null,
		choices: !Array.isArray(input) && input.kind === "question" ? input.choices ?? [] : [],
		openedBy,
		audience,
		createdAt: at
	}).returning({ id: call.id }).get().id;
	const scene = scenePlace(db);
	(!Array.isArray(input) && input.kind === "question" ? playersAtTable(db).map((player) => ({ player })) : (Array.isArray(input) ? input : [input]).flatMap((check) => [check.character].flat().map((ref) => {
		const who = findCharacter(db, ref);
		requireInAudience(who, audience);
		if (!inScene(scene, who)) throw new ToolError("not_in_scene", `${who.name} is not in the Scene`, "Move the Scene to where they are first, or call on a Character in the Scene");
		return {
			characterId: who.id,
			player: who.controllingPlayer ?? "player",
			skill: check.skill ?? null,
			save: check.save ?? null,
			tier: check.tier,
			dc: DC_BY_TIER[check.tier],
			mode: check.adv ?? "normal",
			reason: check.reason
		};
	}))).forEach((part, i) => {
		db.insert(callPart).values({
			...part,
			callId: id,
			position: i + 1
		}).run();
	});
	return id;
}
/** Opens a pending Call an action tool made: the Narration attaching it shows it to the Players. */
function attachPending(db, id, openedBy, audience) {
	const asked = db.select({
		id: character.id,
		name: character.name
	}).from(callPart).innerJoin(character, eq(character.id, callPart.characterId)).where(and(eq(callPart.callId, id))).all();
	for (const who of asked) requireInAudience(who, audience);
	const attached = db.update(call).set({
		state: "open",
		openedBy,
		audience
	}).where(and(eq(call.id, id), eq(call.state, "pending"))).returning({ id: call.id }).get();
	if (!attached) throw new ToolError("unknown_call", `No pending Call has the id ${id}`, "Attach a pending Call id an action tool returned, or pass the Call inline");
	return attached.id;
}
/**
* Stores an action tool's roll sequences as a pending Call, hidden from the Players until the
* closing `narrate(..., call: id)` attaches it. Returns its id.
*/
function createPendingCall(db, parts, at, kind = "roll_sequence", prompt = null) {
	const id = db.insert(call).values({
		campaignId: db.select({ id: campaign.id }).from(campaign).get().id,
		kind,
		text: prompt?.text ?? null,
		choices: prompt?.choices ?? [],
		state: "pending",
		audience: partyAudience(db),
		createdAt: at
	}).returning({ id: call.id }).get().id;
	parts.forEach((part, i) => {
		db.insert(callPart).values({
			callId: id,
			position: i + 1,
			characterId: part.characterId,
			player: part.player,
			sequence: part.sequence,
			mode: part.mode ?? "normal",
			reason: part.reason ?? null,
			save: part.save ?? null,
			dc: part.dc ?? null,
			reaction: part.reaction ?? null
		}).run();
	});
	return id;
}
/**
* Stores a short rest's Hit Dice Call as pending, for the closing `narrate(..., call: id)` to
* attach: one part per Character, each answered with how many Hit Dice to spend. Returns its id.
*/
function createHitDiceCall(db, parts, at) {
	const id = db.insert(call).values({
		campaignId: db.select({ id: campaign.id }).from(campaign).get().id,
		kind: "hit_dice",
		state: "pending",
		text: "How many Hit Dice do you spend?",
		audience: partyAudience(db),
		createdAt: at
	}).returning({ id: call.id }).get().id;
	parts.forEach((part, i) => {
		db.insert(callPart).values({
			callId: id,
			position: i + 1,
			characterId: part.characterId,
			player: part.player,
			hitDice: {
				die: part.die,
				available: part.available,
				conModifier: part.conModifier,
				rolls: null,
				healed: null,
				after: null
			}
		}).run();
	});
	return id;
}
/** The pending Calls no Narration has attached yet. */
function pendingCalls(db) {
	return db.select({ id: call.id }).from(call).where(eq(call.state, "pending")).orderBy(sql`rowid`).all().map((c) => c.id);
}
/**
* The rules' own Calls, which wait past a turn: only one Call is open at a time, so when one is,
* these stay pending for a later turn to attach instead of being dropped.
*/
var QUEUEABLE = [
	"concentration",
	"death_save",
	"reaction"
];
/**
* The pending Calls this turn must attach or cancel before it ends: all of them, less the rules'
* own while another Call is open (they wait for the next turn).
*/
function unattachedCalls(db) {
	const waiting = openCallRow(db) !== void 0;
	return db.select({
		id: call.id,
		kind: call.kind
	}).from(call).where(eq(call.state, "pending")).orderBy(sql`rowid`).all().filter((c) => !(waiting && QUEUEABLE.includes(c.kind))).map((c) => c.id);
}
/** The pending Calls left for the next Narration to attach, as a line for the DM. */
function waitingLine(db) {
	const ids = pendingCalls(db);
	return ids.length ? [`Pending Calls to attach: ${ids.join(", ")}`] : [];
}
/** Drops a pending Call the DM won't attach; refused for any other Call. */
function cancelPendingCall(db, id, at) {
	if (!db.update(call).set({
		state: "cancelled",
		closedAt: at
	}).where(and(eq(call.id, id), eq(call.state, "pending"))).returning({ id: call.id }).get()) throw new ToolError("unknown_call", `No pending Call has the id ${id}`, "Only a pending Call an action tool returned, not yet attached, can be cancelled");
}
/** The Players at the table: everyone with a Character who can act (solo play: one). */
function playersAtTable(db) {
	const players = new Set(db.select().from(character).all().filter(canAct).map((c) => c.controllingPlayer).filter((p) => p !== null));
	return players.size ? [...players] : [SOLO_PLAYER];
}
/** The open Call, Player-safe (no DC, no tier), or null when none is open. */
function openCallView(db, claimed) {
	const open = openCallRow(db);
	if (!open) return null;
	if (claimed && !open.audience.some((id) => claimed.has(id))) return null;
	const parts = db.select({
		part: callPart,
		characterName: character.name
	}).from(callPart).leftJoin(character, eq(character.id, callPart.characterId)).where(eq(callPart.callId, open.id)).orderBy(asc(callPart.position)).all();
	return {
		id: open.id,
		kind: open.kind,
		text: open.text,
		choices: open.choices,
		parts: parts.map(({ part, characterName }) => ({
			id: part.id,
			character: characterName,
			player: part.player,
			label: labelOf(part, open.kind),
			reason: part.reason,
			mode: part.mode,
			answered: part.answeredAt !== null,
			next: part.sequence ? nextStep(part.sequence) : null,
			hitDice: part.hitDice && {
				die: part.hitDice.die,
				available: part.hitDice.available
			},
			offer: open.kind === "reaction" && part.answer === null ? open.choices : null
		}))
	};
}
/**
* The Calls a Declaration can answer instead: the Players chose not to roll or reply. Initiative,
* Death saves, concentration saves and reactions are the rules' own and stay open.
*/
var WITHDRAWABLE = [
	"check",
	"question",
	"roll_sequence",
	"hit_dice"
];
/** A closed Floor with Declarations on it withdraws the open Call; returns its id, if any. */
function withdrawOpenCall(db, at) {
	return db.update(call).set({
		state: "withdrawn",
		closedAt: at
	}).where(and(eq(call.state, "open"), inArray(call.kind, [...WITHDRAWABLE]))).returning({ id: call.id }).get()?.id ?? null;
}
/** The Call or part isn't open (answered, withdrawn or unknown). */
var CallClosedError = class extends Error {};
/** The part is addressed to another Player, or the answer doesn't fit it. */
var CallRefusedError = class extends Error {};
/** What the DM hears a part rolled by code was marked with. */
var ROLLED_BY_CODE = "(unclaimed: rolled by code)";
/** Who rolled a part, as the DM hears it: the Character and its Player, or just the Character when code rolled it. */
var tag = (p, label) => p.rolledByCode ? `[${p.characterName}]` : `[${p.characterName} · ${label(p.player)}]`;
/** The DM's view of one answered part: who, what, the dice, the DC and the outcome. */
function resultLine(p, label) {
	const line = describePart(p, label);
	return p.rolledByCode ? `${line} ${ROLLED_BY_CODE}` : line;
}
function describePart(p, label) {
	if (p.kind === "reaction") return reactionLine(p, label);
	if (p.hitDice) return `${tag(p, label)} Hit Dice: ${hitDiceText(p.hitDice)}`;
	if (p.sequence) return `${tag(p, label)} ${sequenceText(p.sequence, p.mode)}`;
	if (p.result === null) return `[${label(p.player)}] ${p.answer}`;
	const r = p.result;
	const dice = r.dice.length > 1 ? `${r.dice.join("/")} (${p.mode}) kept ${r.kept}` : `${r.kept}`;
	const modifier = r.modifier >= 0 ? `+ ${r.modifier}` : `- ${-r.modifier}`;
	if (p.kind === "death_save") return `${tag(p, label)} Death save: d20 ${r.kept} → ${p.answer}`;
	if (p.kind === "concentration") return `${tag(p, label)} ${labelOf(p)}: d20 ${dice} ${modifier} = ${r.total} vs DC ${p.dc} → ${r.success ? "success" : "failure"}; ${p.answer}`;
	if (p.kind === "initiative") return `${tag(p, label)} Initiative: d20 ${dice} ${modifier} = ${r.total}`;
	return `${tag(p, label)} ${labelOf(p)}: d20 ${dice} ${modifier} = ${r.total} vs DC ${p.dc} (${p.tier}) → ${r.success ? "success" : "failure"}`;
}
/** The Player's choice on a reaction Call that passes it. */
var PASS = "Pass";
/**
* A reaction as the DM hears it: passed, taken (with its attack's rolls), and any reminder that
* the reaction was already spent. The answer is the choice, then `; ` and the reminder.
*/
function reactionLine(p, label) {
	const who = `${tag(p, label)} ${p.reaction}`;
	if (p.answer === "Pass") return `${who}: passes`;
	const [choice, reminder] = (p.answer ?? "").split("; ");
	const taken = p.sequence ? `${who}, taken: ${sequenceText(p.sequence, p.mode)}` : `${who}: takes it (${choice})`;
	return reminder ? `${taken}\n${reminder}` : taken;
}
/** What a Character's Hit Dice came to: the dice, the Con modifier per die, the HP regained. */
function hitDiceText(spend) {
	const rolls = spend.rolls ?? [];
	if (!rolls.length) return "spent none";
	const con = spend.conModifier * rolls.length;
	const modifier = con ? ` ${con > 0 ? "+" : "-"} ${Math.abs(con)}` : "";
	return `spent ${rolls.length} d${spend.die}: ${rolls.join(" + ")}${modifier} = ${spend.healed} HP → ${spend.after.hp}/${spend.after.max} HP`;
}
/** The `call_result` channel event: one body line per part, in order. */
function callResultEvent(result, label = (browser) => browser) {
	return {
		content: [...result.parts.map((p) => resultLine(p, label)), ...result.after ?? []].join("\n"),
		meta: {
			kind: "call_result",
			call_id: result.call,
			players: result.players.map(label).join(",")
		}
	};
}
/**
* A Campaign's Calls as the Players answer them: each click rolls (or answers) one part in code
* and logs it; the part that completes the Call sets awaiting Narration and returns the result.
*/
function createCalls(db, now = Date.now) {
	function modifierFor(characterId, part, kind) {
		const detail = createCharacterService(db, now).get(characterId);
		if (!detail) return 0;
		const { stats } = buildSummary(loadWizardRules(), {
			...detailToSummaryData(detail),
			equipment: detail.inventory
		});
		if (kind === "initiative") return stats.initiative.status === "ok" ? stats.initiative.value : 0;
		const stat = part.skill ? stats.skills[part.skill] : stats.savingThrows[part.save];
		return stat?.status === "ok" ? stat.value.modifier : 0;
	}
	/**
	* Who may answer a part: a Character's part belongs to the Character, so to whoever Claims it
	* now; a question part has no Character and stays with the browser it was addressed to.
	*/
	function ownerOf(part) {
		if (!part.characterId) return part.player;
		return db.select({ player: character.controllingPlayer }).from(character).where(eq(character.id, part.characterId)).get()?.player ?? null;
	}
	function answer(callId, partId, player, resolve) {
		return db.transaction(() => {
			const at = now();
			const open = db.select().from(call).where(and(eq(call.id, callId), eq(call.state, "open"))).get();
			const part = open && db.select().from(callPart).where(and(eq(callPart.id, partId), eq(callPart.callId, callId), isNull(callPart.answeredAt))).get();
			if (!part) throw new CallClosedError("That Call is no longer open");
			if (player !== null && ownerOf(part) !== player) throw new CallRefusedError("That roll is not yours");
			const { values, event, finished = true } = resolve(part, open.kind);
			db.update(callPart).set({
				...values,
				answeredAt: finished ? at : null,
				...player === null && { rolledByCode: true }
			}).where(eq(callPart.id, partId)).run();
			logEvent(db, {
				tool: "call",
				...event,
				data: {
					call: callId,
					...event.data
				},
				audience: open.audience
			}, { at });
			const parts = db.select({
				part: callPart,
				characterName: character.name
			}).from(callPart).leftJoin(character, eq(character.id, callPart.characterId)).where(eq(callPart.callId, callId)).orderBy(asc(callPart.position)).all().map(({ part, characterName }) => ({
				...part,
				characterName,
				kind: open.kind
			}));
			if (parts.some((p) => p.answeredAt === null)) return null;
			db.update(call).set({
				state: "answered",
				closedAt: at
			}).where(eq(call.id, callId)).run();
			const result = {
				call: callId,
				players: [...new Set(parts.filter((p) => !p.rolledByCode).map((p) => p.player))],
				parts,
				after: [...open.kind === "initiative" ? [orderText(db)] : [], ...waitingLine(db)]
			};
			logEvent(db, {
				tool: "call",
				kind: "call_result",
				summary: callResultEvent(result).content,
				data: { call: callId },
				dmOnly: true,
				audience: open.audience
			}, { at });
			setAwaitingNarration(db, at);
			return result;
		});
	}
	/** One click of a roll sequence: code rolls the next step against the hidden number. */
	function rollSequenceStep(part, dice, player) {
		const rolled = rollStep(db, part.sequence, dice, {
			mode: part.mode,
			reason: part.reason,
			at: now()
		});
		const name = db.select({ name: character.name }).from(character).where(eq(character.id, part.characterId)).get()?.name ?? "";
		const mode = rolled.roll.kept === null ? "normal" : part.mode;
		return {
			values: { sequence: rolled.sequence },
			finished: rolled.sequence.done,
			event: {
				kind: "roll",
				summary: `${name} ${rolled.what}: ${rolled.roll.total}${rolled.roll.outcome ? ` (${rolled.roll.outcome})` : ""}`,
				data: {
					part: part.id,
					characterName: name,
					player,
					what: rolled.what,
					mode,
					reason: mode === "normal" ? null : part.reason,
					dice: rolled.roll.dice,
					modifier: rolled.roll.modifier,
					total: rolled.roll.total,
					outcome: rolled.roll.outcome,
					target: rolled.targetState
				}
			}
		};
	}
	/** A concentration save's outcome: on a failure the spell ends. Returns the DM's note. */
	function keepConcentration(characterId, success) {
		const spell = db.select().from(character).where(eq(character.id, characterId)).get().concentration;
		if (!spell) return "no longer concentrating";
		if (success) return `keeps concentration on ${spell}`;
		db.update(character).set({ concentration: null }).where(eq(character.id, characterId)).run();
		return `concentration on ${spell} ends`;
	}
	/**
	* A reaction offered: `Pass` ends the part; taking it spends the Character's reaction (a
	* reminder, never a refusal, when it is already spent) and, with an attack, leaves the part open
	* for its rolls.
	*/
	function chooseReaction(part, choices, choice) {
		if (part.answer !== null) throw new CallRefusedError("That reaction is already taken: roll it");
		if (!choices.includes(choice)) throw new CallRefusedError(`Answer with one of: ${choices.join(", ")}`);
		const ref = characterRefs(db).find((c) => c.row.id === part.characterId);
		const taken = choice !== PASS;
		const reminder = taken && spendTurnResource(db, ref.handle, ref.row.name, "reaction");
		return {
			values: { answer: reminder ? `${choice}; ${reminder}` : choice },
			finished: !taken || !part.sequence,
			event: {
				kind: "answer",
				summary: `${ref.row.name} ${taken ? "takes" : "passes"} ${part.reaction}`,
				data: {
					part: part.id,
					player: part.player,
					question: part.reaction,
					text: choice
				}
			}
		};
	}
	/** A Death save: a d20 with no modifier, its tallies applied by code. */
	function rollDeathSave(part, dice, player) {
		const row = db.select().from(character).where(eq(character.id, part.characterId)).get();
		if (!rollsDeathSaves(row)) return {
			values: { answer: "no longer dying" },
			event: {
				kind: "answer",
				summary: `${row.name} is no longer dying`,
				data: {
					part: part.id,
					player,
					question: "Death save",
					text: "no longer dying"
				}
			}
		};
		const d20 = dice.rollD20();
		const saved = applyDeathSave(db, row, d20.kept);
		const result = {
			dice: d20.dice,
			kept: d20.kept,
			modifier: 0,
			total: d20.kept,
			success: saved.success
		};
		return {
			values: {
				result,
				answer: saved.text
			},
			event: {
				kind: "roll",
				summary: `${row.name} Death save: ${d20.kept} (${saved.outcome})`,
				data: {
					part: part.id,
					characterName: row.name,
					player,
					what: "Death save",
					mode: "normal",
					reason: null,
					...result,
					outcome: saved.outcome
				}
			}
		};
	}
	/**
	* A short rest's Hit Dice: the Player says how many; code rolls each, adds the Con modifier
	* (never below 0 a die), and heals the Character up to its maximum.
	*/
	function spendHitDice(part, spend, text, dice) {
		const count = /^\d+$/.test(text) ? Number(text) : NaN;
		if (!(count >= 0 && count <= spend.available)) throw new CallRefusedError(`Spend 0 to ${spend.available} Hit Dice`);
		if (count > 0 && !dice) throw new Error("Spending Hit Dice needs the Campaign dice");
		const row = db.select().from(character).where(eq(character.id, part.characterId)).get();
		const max = maxHp(part.characterId) ?? row.currentHp;
		const rolls = Array.from({ length: count }, () => dice.rollExpression(`1d${spend.die}`).total);
		const rolled = rolls.reduce((sum, r) => sum + Math.max(0, r + spend.conModifier), 0);
		const hp = Math.min(max, row.currentHp + rolled);
		db.update(character).set({
			currentHp: hp,
			hitDiceSpent: row.hitDiceSpent + count
		}).where(eq(character.id, row.id)).run();
		const done = {
			...spend,
			rolls,
			healed: hp - row.currentHp,
			after: {
				hp,
				max
			}
		};
		return {
			values: {
				hitDice: done,
				answer: String(count)
			},
			event: {
				kind: "roll",
				summary: `${row.name} Hit Dice: ${hitDiceText(done)}`,
				data: {
					part: part.id,
					characterName: row.name,
					player: part.player,
					what: `Hit Dice (${count}d${spend.die})`,
					mode: "normal",
					reason: null,
					dice: rolls,
					modifier: spend.conModifier * count,
					total: done.healed,
					outcome: null,
					target: null
				}
			}
		};
	}
	/** Rolls one part in code: a sequence's next step, a Death save, or a d20 Check. */
	function rollPart(part, kind, dice, player) {
		const characterId = part.characterId;
		if (part.sequence) return rollSequenceStep(part, dice, player);
		if (kind === "death_save") return rollDeathSave(part, dice, player);
		const modifier = modifierFor(characterId, part, kind);
		const d20 = part.mode === "normal" ? dice.rollD20() : dice.rollD20({
			mode: part.mode,
			reason: part.reason ?? ""
		});
		const total = d20.kept + modifier;
		const result = {
			dice: d20.dice,
			kept: d20.kept,
			modifier,
			total,
			success: total >= (part.dc ?? 0)
		};
		const name = db.select({ name: character.name }).from(character).where(eq(character.id, characterId)).get()?.name ?? "";
		const what = labelOf(part, kind) ?? "";
		if (kind === "initiative") {
			const handle = characterRefs(db).find((c) => c.row.id === characterId)?.handle;
			if (handle) recordInitiative(db, handle, total, dice);
			return {
				values: { result },
				event: {
					kind: "roll",
					summary: `${name} ${what}: ${total}`,
					data: {
						part: part.id,
						characterName: name,
						player,
						what,
						mode: part.mode,
						reason: part.reason,
						...result,
						outcome: null
					}
				}
			};
		}
		const kept = kind === "concentration" && keepConcentration(characterId, result.success);
		return {
			values: {
				result,
				...kept && { answer: kept }
			},
			event: {
				kind: "roll",
				summary: `${name} ${what}: ${total} (${result.success ? "success" : "failure"})`,
				data: {
					part: part.id,
					characterName: name,
					player,
					what,
					mode: part.mode,
					reason: part.reason,
					...result
				}
			}
		};
	}
	/** A Character's derived HP maximum. */
	function maxHp(characterId) {
		const detail = createCharacterService(db, now).get(characterId);
		if (!detail) return null;
		const { stats } = buildSummary(loadWizardRules(), {
			...detailToSummaryData(detail),
			equipment: detail.inventory
		});
		return stats.hitPoints.status === "ok" ? stats.hitPoints.value : null;
	}
	/**
	* Code answers a part for its unclaimed Character: a straight roll with no choices, a reaction
	* passed, Hit Dice spent at none. A roll sequence is rolled to its end.
	*/
	function rollByCode(callId, partId, dice) {
		for (;;) {
			const result = answer(callId, partId, null, (part, kind) => {
				if (part.hitDice) return spendHitDice(part, part.hitDice, "0", dice);
				if (kind === "reaction") {
					const { choices } = db.select().from(call).where(eq(call.id, callId)).get();
					return chooseReaction(part, choices, PASS);
				}
				return rollPart(part, kind, dice, part.player);
			});
			const left = db.select().from(callPart).where(eq(callPart.id, partId)).get();
			if (!left || left.answeredAt !== null) return result;
		}
	}
	/**
	* Rolls for the open Call's unclaimed Characters. On `opening` every unclaimed part is rolled;
	* after that a part whose Claim lapsed waits for the next Claimant, and is rolled only when it is
	* the last part outstanding. Returns the Call's result when this completes it.
	*/
	function settleUnclaimed(dice, opening = false) {
		return db.transaction(() => {
			let result = null;
			for (;;) {
				const open = openCallRow(db);
				if (!open) return result;
				const unanswered = db.select({
					part: callPart,
					owner: character.controllingPlayer
				}).from(callPart).innerJoin(character, eq(character.id, callPart.characterId)).where(and(eq(callPart.callId, open.id), isNull(callPart.answeredAt))).orderBy(asc(callPart.position)).all();
				const outstanding = db.select({ id: callPart.id }).from(callPart).where(and(eq(callPart.callId, open.id), isNull(callPart.answeredAt))).all().length;
				const next = unanswered.find(({ owner }) => owner === null);
				if (!next || !(opening || outstanding === 1)) return result;
				result = rollByCode(open.id, next.part.id, dice) ?? result;
			}
		});
	}
	/** A Player's answer, then code's roll for an unclaimed part it left as the last one outstanding. */
	function settled(dice, answered) {
		if (answered || !dice) return answered;
		return settleUnclaimed(dice);
	}
	return {
		/** The open Call, Player-safe. */
		open: () => openCallView(db),
		/**
		* Rolls one Check part in code for its Controlling Player; returns the Call's result when this
		* roll completes it, null otherwise.
		*/
		roll(callId, partId, dice, player) {
			return settled(dice, answer(callId, partId, player, (part, kind) => {
				if (!part.characterId) throw new CallRefusedError("That part is a question: answer it");
				if (part.hitDice) throw new CallRefusedError("Say how many Hit Dice to spend");
				if (kind === "reaction" && part.answer === null) throw new CallRefusedError(`${part.reaction}: take it or pass first`);
				return rollPart(part, kind, dice, player);
			}));
		},
		/**
		* Rolls for the open Call's unclaimed Characters; `opening` when the Call has just opened.
		* Returns the Call's result when that completes it.
		*/
		settleUnclaimed,
		/**
		* Answers a question part (with choices, the answer must be one of them), or a Hit Dice part
		* with how many to spend, which code then rolls with `dice`.
		*/
		answer(callId, partId, text, player, dice) {
			const clean = text.trim();
			return settled(dice, answer(callId, partId, player, (part, kind) => {
				if (part.hitDice) return spendHitDice(part, part.hitDice, clean, dice);
				const { choices, text: question } = db.select().from(call).where(eq(call.id, callId)).get();
				if (kind === "reaction") return chooseReaction(part, choices, clean);
				if (part.characterId) throw new CallRefusedError("That part is a Check: roll it");
				if (!clean) throw new CallRefusedError("Give an answer");
				if (choices.length && !choices.includes(clean)) throw new CallRefusedError(`Answer with one of: ${choices.join(", ")}`);
				return {
					values: { answer: clean },
					event: {
						kind: "answer",
						summary: `${player}: ${clean}`,
						data: {
							part: partId,
							player,
							question,
							text: clean
						}
					}
				};
			}));
		}
	};
}
// src/lib/server/play/sheets.ts
var signed = (n) => n >= 0 ? `+${n}` : `${n}`;
function toPlaySheet(c, levelUp) {
	const rules = loadWizardRules();
	const { stats, names, resolved } = buildSummary(rules, {
		...detailToSummaryData(c),
		equipment: c.inventory
	});
	const itemName = new Map(rules.equipment.map((e) => [e.slug, e.name]));
	const ok = (s) => s.status === "ok" ? s.value : null;
	const slots = ok(stats.spellSlots) ?? [];
	return {
		id: c.id,
		name: c.name,
		headline: `${[names.subrace ?? names.race, names.class].filter(Boolean).join(" ")} ${c.level}`,
		canAct: canAct(c),
		whereabouts: c.whereabouts,
		hp: {
			current: c.currentHp,
			max: ok(stats.hitPoints),
			temp: c.tempHp
		},
		hitDice: resolved.hitDie === null ? null : {
			die: resolved.hitDie,
			total: c.level,
			spent: c.hitDiceSpent
		},
		ac: characterAc(rules, c, stats),
		conditions: c.conditions,
		concentration: c.concentration,
		deathSaves: c.status === "alive" && c.currentHp === 0 ? {
			successes: c.deathSaves.successes,
			failures: c.deathSaves.failures,
			stable: c.deathSaves.stable ?? false
		} : null,
		abilities: ABILITY_KEYS.flatMap((key) => {
			const a = ok(stats.abilities[key]);
			return a ? [{
				key,
				score: a.score,
				modifier: a.modifier
			}] : [];
		}),
		attacks: (ok(stats.attacks) ?? []).map((a) => ({
			name: a.name,
			attackBonus: a.attackBonus,
			damage: a.damage && `${a.damage.dice}${a.damage.modifier ? signed(a.damage.modifier) : ""} ${a.damage.type}`
		})),
		spellSlots: slots.flatMap((max, i) => max > 0 ? [{
			level: i + 1,
			max,
			spent: c.spentSlots[i] ?? 0
		}] : []),
		features: resolved.features.map((f) => ({
			slug: f.slug,
			name: f.name,
			spent: c.featureUses[f.slug] ?? 0
		})),
		inventory: c.inventory.map((i) => ({
			name: itemName.get(i.item) ?? i.item,
			quantity: i.quantity,
			equipped: i.equipped ?? false
		})),
		coin: c.coin,
		levelUp,
		details: {
			notes: c.notes,
			personality: c.personality,
			appearance: c.appearance,
			backstory: c.backstory
		}
	};
}
/** The play sheet of every saved Character in the Party, oldest first. */
function playSheets(party, viewer) {
	return party.list().flatMap((m) => m.kind === "character" && (viewer === void 0 || party.character(m.id).character.controllingPlayer === viewer) ? [toPlaySheet(party.character(m.id).character, party.levelUpOffer(m.id))] : []);
}
// src/lib/server/play/core-block.ts
/**
* The Scene: its Place (handle and name) and the in-fiction time, then the open Call (id, kind and
* the Characters yet to answer) and the ids of pending Calls no Narration has attached.
*/
function scenePart({ db }) {
	const place = present(db).place;
	const time = formatClock(currentMinute(db));
	const lines = [place ? `Scene: ${place.name} (${place.handle}), ${time}.` : `Scene: none set yet, ${time}.`];
	const open = db.select().from(call).where(eq(call.state, "open")).get();
	if (open) {
		const refs = new Map(characterRefs(db).map((c) => [c.row.id, c]));
		const waiting = db.select({ characterId: callPart.characterId }).from(callPart).where(and(eq(callPart.callId, open.id), isNull(callPart.answeredAt))).orderBy(asc(callPart.position)).all().map(({ characterId }) => {
			const ref = characterId ? refs.get(characterId) : void 0;
			return ref ? `${ref.row.name} (${ref.handle})` : "the Player";
		});
		lines.push(`Open Call: ${open.id}, ${open.kind}, waiting on ${[...new Set(waiting)].join(", ") || "no one"}.`);
	}
	const pending = pendingCalls(db);
	if (pending.length) lines.push(`Pending Calls: ${pending.join(", ")}.`);
	return lines.join("\n");
}
var plural = (n, word, many) => `${n} ${n === 1 ? word : many}`;
/** A downed Character's Death saves: `stable`, or `Death saves 1 success, 2 failures`. */
function deathSavesText(saves) {
	if (saves.stable) return "stable";
	return `Death saves ${plural(saves.successes, "success", "successes")}, ${plural(saves.failures, "failure", "failures")}`;
}
/**
* The Party: name, handle, HP/max, conditions, status and whereabouts per Character, then what
* they concentrate on and, at 0 HP, their Death saves.
*/
function partyPart({ party, db }) {
	const status = new Map(party.list().flatMap((m) => m.kind === "character" ? [[m.id, m.status]] : []));
	const handles = new Map(characterRefs(db).map((c) => [c.row.id, c.handle]));
	const sheets = playSheets(party);
	if (sheets.length === 0) return "Party: no Characters yet.";
	return ["Party:", ...sheets.map((c) => {
		const hp = `HP ${c.hp.current}/${c.hp.max ?? "?"}${c.hp.temp ? ` (+${c.hp.temp} temp)` : ""}`;
		const conditions = c.conditions.length ? c.conditions.join(", ") : "none";
		const extra = [c.concentration && `concentrating on ${c.concentration}`, c.deathSaves && deathSavesText(c.deathSaves)].filter(Boolean);
		return [`- ${c.name} (${handles.get(c.id)}): ${hp}, conditions ${conditions}, ${status.get(c.id)}, whereabouts ${c.whereabouts ?? "unknown"}`, ...extra].join(", ");
	})].join("\n");
}
/** The NPCs at the Scene's Place: handle, name, role and one-line description. */
function npcsPart({ db }) {
	const npcs = present(db).npcs;
	if (npcs.length === 0) return "NPCs present: none.";
	return ["NPCs present:", ...npcs.map((n) => {
		const detail = [n.fields.role, n.fields.description].filter(Boolean).join(", ");
		return `- ${n.name} (${n.handle})${detail ? `: ${detail}` : ""}`;
	})].join("\n");
}
/**
* The live Combat, or null outside one: the round and whose turn, then the order (initiative,
* name, handle), with each Creature's stat block, HP state and conditions, and what each NPC or
* Creature concentrates on. This lifts the block
* from ~300 to ~500 tokens while it lasts.
*/
function combatPart({ db }) {
	const live = liveCombat(db);
	if (!live) return null;
	const order = initiativeOrder(db, live.id);
	const current = order.find((c) => c.id === live.current);
	const head = current ? `Combat: round ${live.round}, turn: ${current.name} (${current.handle}).` : "Combat: waiting on initiative.";
	const npcConcentration = new Map(db.select({
		handle: npcCombat.handle,
		concentration: npcCombat.concentration
	}).from(npcCombat).all().map((n) => [n.handle, n.concentration]));
	const lines = order.map((c) => {
		const spell = c.kind === "npc" ? npcConcentration.get(c.handle) : c.concentration;
		const detail = [...c.kind === "creature" ? [
			c.statBlock,
			hpState(c.hp, c.maxHp),
			`conditions ${c.conditions.join(", ") || "none"}`
		] : [], ...c.kind !== "character" && spell ? [`concentrating on ${spell}`] : []];
		const shown = detail.length ? `: ${detail.join(", ")}` : "";
		return `- ${c.initiative} ${c.name} (${c.handle})${shown}${c.id === live.current ? " ← turn" : ""}`;
	});
	const waiting = waitingOnInitiative(db, live.id);
	if (waiting.length) lines.push(`- waiting on initiative: ${waiting.map((c) => `${c.name} (${c.handle})`).join(", ")}`);
	return [head, ...lines].join("\n");
}
/**
* The Arc line: the current Act (the Act of the first pending Beat) with its purpose, that Act's
* pending Beats by handle and title, the next Act's name, and the drift count. No descriptions.
*/
function arcPart({ db }) {
	const drift = `Declarations since the last Beat change: ${driftCount(db)}.`;
	const found = currentArc(db);
	const at = found?.acts.findIndex((a) => a.beats.some((b) => b.state === "pending")) ?? -1;
	if (!found || at === -1) return `Arc: No current Arc. ${drift}`;
	const current = found.acts[at];
	const pending = current.beats.filter((b) => b.state === "pending").map((b) => `${b.handle} (${b.title})`);
	const next = found.acts[at + 1];
	return [
		`Arc: Act ${current.number}, ${current.name}: ${current.purpose}`,
		`- Pending: ${pending.join("; ")}`,
		`- Next Act: ${next ? next.name : "none, this is the final Act"}`,
		`- ${drift}`
	].join("\n");
}
/** When lint last ran: the Session (if any) and in-fiction time of its last `lint_ran` Event. */
function lintPart({ db }) {
	const last = lastLint(db);
	if (!last) return "Lint last ran: never.";
	const number = last.sessionId ? db.select({ number: session.number }).from(session).where(eq(session.id, last.sessionId)).get()?.number : void 0;
	return `Lint last ran: ${number ? `Session ${number}, ` : ""}${formatClock(last.minute)}.`;
}
/** The whole core block. */
function coreBlock(source) {
	return [
		"# Core block",
		scenePart(source),
		partyPart(source),
		whoIsAtTheTable(source.db),
		npcsPart(source),
		combatPart(source),
		arcPart(source),
		lintPart(source)
	].filter((part) => part !== null).join("\n");
}
// src/lib/server/play/notices.ts
var TOOL = "player";
var KIND = "change";
/**
* Logs a change the Player made outside the DM (a UI edit), so the DM hears of it next. An
* `offline` edit (no DM at the table) belongs to no Session, even while an earlier Session's
* Session is still open for its catch-up close.
*/
function logChange(db, change, { at, offline = false }) {
	logEvent(db, {
		tool: TOOL,
		kind: KIND,
		summary: change.summary,
		data: {
			handle: change.handle,
			version: change.version
		}
	}, offline ? {
		at,
		stamp: {
			...currentStamp(db),
			sessionId: null
		}
	} : { at });
}
/**
* The changes the DM has not heard about yet, marking them heard: each Player edit logged in the
* open Session since the last channel event. Offline edits belong to no Session; they reach the DM
* at the next Session's opening instead.
*/
function takeChanges(db) {
	const through = db.select({ at: campaign.noticedThrough }).from(campaign).get()?.at ?? 0;
	const { sessionId } = currentStamp(db);
	if (!sessionId) return [];
	const rows = db.select().from(event).where(and(gt(event.id, through), eq(event.sessionId, sessionId), eq(event.tool, TOOL), eq(event.kind, KIND))).orderBy(event.id).all();
	const last = db.select({ id: max(event.id) }).from(event).get()?.id ?? through;
	db.update(campaign).set({ noticedThrough: last }).run();
	return rows.map((e) => ({
		handle: String(e.data?.handle),
		version: Number(e.data?.version),
		summary: e.summary
	}));
}
/** The latest version of each changed handle, in the order they changed, as notice lines. */
function changeLines(changes) {
	return [...new Map(changes.map((c) => [c.handle, c])).values()].map((c) => `- ${c.handle} v${c.version}: ${c.summary}`);
}
/**
* The offline edits no opening has told the DM about yet, marking them told: each Player edit
* logged in no Session since the last opening.
*/
function takeOfflineChanges(db) {
	const through = db.select({ at: campaign.offlineNoticedThrough }).from(campaign).get()?.at ?? 0;
	const rows = db.select().from(event).where(and(gt(event.id, through), isNull(event.sessionId), eq(event.tool, TOOL), eq(event.kind, KIND))).orderBy(event.id).all();
	if (rows.length > 0) db.update(campaign).set({ offlineNoticedThrough: rows.at(-1).id }).run();
	return rows.map((e) => ({
		handle: String(e.data?.handle),
		version: Number(e.data?.version),
		summary: e.summary
	}));
}
/**
* What a Session's opening adds to the core block, in the caller's transaction: the "changed since
* last Session" notice for offline edits (told once), and a turn left awaiting Narration, to answer
* after the recap. Empty when neither applies.
*/
function openingNotice(db) {
	const parts = [];
	const changes = takeOfflineChanges(db);
	if (changes.length > 0) parts.push(["Changed since last Session:", ...changeLines(changes)].join("\n"));
	if (awaitingNarrationSince(db) !== null) parts.push("A turn awaits Narration: the last Session ended before the DM answered it. Read it with history and answer it with narrate after the recap.");
	return parts.join("\n\n");
}
/**
* The DM's channel: every channel event carries the changes made outside the DM since the last
* one, as `handle vN: summary` lines; a changed core-block part is re-sent whole. Notices are
* never an event of their own.
*/
function createDmChannels(library) {
	return createChannels({ annotate(folder, sent) {
		const entry = library.entryAt(folder);
		const db = library.databaseFor(folder);
		if (!entry || !db) return sent;
		const changes = db.transaction((tx) => takeChanges(tx));
		if (changes.length === 0) return sent;
		const parts = ["Changed outside the DM:", ...changeLines(changes)];
		if (changes.some((c) => handleKind(c.handle) === "char")) parts.push("", partyPart({
			party: library.party(entry.id),
			db
		}));
		const notice = parts.join("\n");
		return {
			...sent,
			content: sent.content ? `${sent.content}\n\n${notice}` : notice
		};
	} });
}
// src/lib/server/character/party.ts
/** An edit only the DM may make while no DM is at the table to make it. */
var DmOnlyEditError = class extends Error {};
var DETAIL_LIMITS = {
	notes: BACKSTORY_MAX,
	personality: 500,
	appearance: 500,
	backstory: BACKSTORY_MAX
};
/** "notes, personality and appearance". */
var listed = (words) => words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
/** A Claim the browser may not make or give up: the Character is taken, or not the browser's. */
var ClaimRefusedError = class extends Error {};
/** The Campaign has no draft with this id. */
var DraftNotFoundError = class extends Error {};
var stepLabel = (step) => STEPS.find((s) => s.id === step)?.label ?? step;
/**
* A Campaign's Characters and Character drafts, over its database. Drafts are stored with the
* Campaign so a reload loses nothing (and the DM's tools can write into them later); a draft joins
* the Party only when it is saved, which needs every wizard step to be valid.
*
* `attended` says whether a DM is at the table. Without one, a Player edit belongs to no Session
* and, after Begin, is limited to what moves no clock and sets no number code didn't compute.
*/
function createParty(db, now = Date.now, { attended = () => true } = {}) {
	const rules = loadWizardRules();
	const characters = createCharacterService(db, now);
	const begun = () => db.select({ at: campaign.begunAt }).from(campaign).get()?.at != null;
	/** Refuses an edit the DM must make, while the Campaign has begun and the DM is away. */
	function dmOnly(what) {
		if (begun() && !attended()) throw new DmOnlyEditError(`${what} is the DM’s to change once the Campaign has begun. Run dm in the Campaign folder and ask at the table.`);
	}
	function row(id) {
		const found = db.select().from(characterDraft).where(eq(characterDraft.id, id)).get();
		if (!found) throw new DraftNotFoundError("Character draft not found");
		return found;
	}
	/**
	* The Player's write. A write that changes nothing (the open wizard echoing a DM write back)
	* keeps the version; a field the Player changed loses its "✎ DM" mark.
	*/
	function write(id, { draft, step }) {
		const found = row(id);
		const before = {
			...emptyDraft(),
			...found.data
		};
		const edited = new Set(changedDraftFields(before, draft));
		db.update(characterDraft).set({
			data: draft,
			step,
			version: edited.size > 0 ? found.version + 1 : found.version,
			dmFields: found.dmFields.filter((f) => !edited.has(f)),
			updatedAt: now()
		}).where(eq(characterDraft.id, id)).run();
	}
	/** Logs a Player edit to a Character, so the DM hears of it on the next channel event. */
	function noteChange(id, summary) {
		const row = db.select().from(character).where(eq(character.id, id)).get();
		logChange(db, {
			handle: characterHandleOf(db, id),
			version: row.version,
			summary
		}, {
			at: now(),
			offline: !attended()
		});
	}
	function detail(id) {
		const found = characters.get(id);
		if (!found) throw new CharacterNotFoundError("Character not found");
		return found;
	}
	function maxHp(c) {
		const { stats } = buildSummary(rules, {
			...detailToSummaryData(c),
			equipment: c.inventory
		});
		return stats.hitPoints.status === "ok" ? stats.hitPoints.value : c.currentHp;
	}
	/** The level-up the DM awarded and the Character has not taken, or null. */
	function offerFor(c) {
		if (c.levelsAwarded <= 0 || c.level >= 20) return null;
		return levelUpOffer(rules, c.classSlug, c.level + 1, c.spells.map((s) => s.spell));
	}
	/** The draft as the service's input; refused while any step is not valid. */
	function input(draft) {
		const mapped = tryDraftToCharacterInput(rules, draft);
		if (!mapped) throw new CharacterValidationError("Finish every step before saving");
		return mapped;
	}
	const claimOf = (holder, browser) => holder === null ? "free" : holder === browser ? "yours" : "taken";
	/** The Character or draft with this id, as the table to write its Claim to. */
	function claimable(id) {
		const saved = db.select().from(character).where(eq(character.id, id)).get();
		if (saved) return {
			table: character,
			holder: saved.controllingPlayer,
			name: saved.name
		};
		const draft = db.select().from(characterDraft).where(eq(characterDraft.id, id)).get();
		if (draft) {
			const name = draft.data.name.trim();
			return {
				table: characterDraft,
				holder: draft.controllingPlayer,
				name
			};
		}
		throw new CharacterNotFoundError("Character not found");
	}
	/**
	* Refuses a write from a browser that does not hold the Claim, the Host included. Without a
	* `browser` the write is the DM's own (its tools), which no Claim gates.
	*/
	function requireClaim(id, browser) {
		if (browser === void 0) return;
		const target = claimable(id);
		if (target.holder !== browser) throw new ClaimRefusedError(`${target.name || "This Character"} is not yours: Claim it first`);
	}
	return {
		/**
		* Every Party Character with its Claim as `browser` sees it: yours, taken (never by whom) or
		* free. Saved Characters oldest first.
		*/
		claims(browser) {
			const saved = characters.list().map((c) => ({
				kind: "character",
				id: c.id,
				name: c.name,
				claim: claimOf(c.controllingPlayer, browser),
				...browser === "player" && claimOf(c.controllingPlayer, browser) === "taken" ? { releasable: true } : {}
			}));
			const drafts = db.select().from(characterDraft).orderBy(asc(characterDraft.createdAt), asc(sql`${characterDraft}.rowid`)).all().map((d) => ({
				kind: "draft",
				id: d.id,
				name: d.data.name.trim(),
				claim: claimOf(d.controllingPlayer, browser)
			}));
			return [...saved, ...drafts];
		},
		/** A saved Character's name and the browser holding it now (null when unclaimed); null for a Draft. */
		claimOf(id) {
			const saved = db.select().from(character).where(eq(character.id, id)).get();
			return saved ? {
				name: saved.name,
				holder: saved.controllingPlayer
			} : null;
		},
		/** Whether `browser` holds a Claim on any Party Character. */
		holdsClaim(browser) {
			return this.claims(browser).some((row) => row.kind === "character" && row.claim === "yours");
		},
		/** The browser Claims a Character nobody holds. A taken Character is refused for every browser. */
		claim(id, browser) {
			const target = claimable(id);
			if (target.holder !== null) throw new ClaimRefusedError(`${target.name} is taken`);
			db.update(target.table).set({ controllingPlayer: browser }).where(and(eq(target.table.id, id), isNull(target.table.controllingPlayer))).run();
		},
		/** The browser gives up a Claim it holds. */
		letGo(id, browser) {
			const target = claimable(id);
			if (target.holder !== browser) throw new ClaimRefusedError(`${target.name} is not yours`);
			db.update(target.table).set({ controllingPlayer: null }).where(and(eq(target.table.id, id), eq(target.table.controllingPlayer, browser))).run();
		},
		/** The Host frees a Character another browser holds. Refused for any other browser. */
		release(id, browser) {
			if (browser !== "player") throw new ClaimRefusedError("Only the Host can Release a Character");
			const target = claimable(id);
			db.update(target.table).set({ controllingPlayer: null }).where(eq(target.table.id, id)).run();
		},
		/** Saved Characters oldest first, then drafts oldest first. */
		list() {
			const saved = characters.list().map((c) => ({
				kind: "character",
				id: c.id,
				name: c.name,
				status: c.status,
				description: `${c.subraceName ?? c.raceName} ${c.className}, ${c.backgroundName}`
			}));
			const drafts = db.select().from(characterDraft).orderBy(asc(characterDraft.createdAt), asc(sql`${characterDraft}.rowid`)).all().map((d) => ({
				kind: "draft",
				id: d.id,
				name: d.data.name.trim(),
				step: d.step,
				stepLabel: stepLabel(d.step)
			}));
			return [...saved, ...drafts];
		},
		/** Starts an empty draft on the first step, controlled by `player`. */
		startDraft({ player = SOLO_PLAYER } = {}) {
			const owner = db.select({ id: campaign.id }).from(campaign).get();
			if (!owner) throw new Error("This database holds no Campaign");
			const at = now();
			const created = db.insert(characterDraft).values({
				campaignId: owner.id,
				controllingPlayer: player,
				data: emptyDraft(),
				step: "concept",
				createdAt: at,
				updatedAt: at
			}).returning().get();
			return this.draft(created.id);
		},
		draft(id) {
			const found = row(id);
			return {
				id: found.id,
				controllingPlayer: found.controllingPlayer,
				draft: {
					...emptyDraft(),
					...found.data
				},
				step: found.step,
				version: found.version,
				dmFields: found.dmFields
			};
		},
		/** Replaces the stored draft. Incomplete is fine: a draft is unsaved by definition. */
		writeDraft(id, value, browser) {
			requireClaim(id, browser);
			write(id, value);
		},
		discardDraft(id, browser) {
			requireClaim(id, browser);
			if (!db.delete(characterDraft).where(eq(characterDraft.id, id)).returning().get()) throw new DraftNotFoundError("Character draft not found");
		},
		/**
		* Writes the draft, then saves it into the Party and removes it, in one transaction. Refused,
		* keeping the draft, unless every step is valid.
		*/
		saveDraft(id, value, browser) {
			requireClaim(id, browser);
			return db.transaction(() => {
				write(id, value);
				const { controllingPlayer } = row(id);
				const created = characters.create(input(value.draft), { player: controllingPlayer });
				db.delete(characterDraft).where(eq(characterDraft.id, id)).run();
				noteChange(created.id, `the Player added ${created.name}`);
				return created;
			});
		},
		/** A saved Character with its wizard draft, for the edit wizard. */
		character(id) {
			const found = characters.get(id);
			if (!found) throw new CharacterNotFoundError("Character not found");
			return {
				character: found,
				draft: detailToDraft(rules, found)
			};
		},
		/**
		* Replaces a saved Character's choices from the edit wizard's draft. It resets play state (HP,
		* slots, coin, inventory), so once the Campaign has begun it is refused: play state changes only
		* through the DM's tools.
		*/
		updateCharacter(id, draft, browser) {
			requireClaim(id, browser);
			if (begun()) throw new DmOnlyEditError("Rewriting a Character in the wizard resets their play state, so once the Campaign has begun only their notes, personality and appearance can be edited. Ask the DM at the table for anything else.");
			return db.transaction(() => {
				const updated = characters.update(id, input(draft));
				db.update(character).set({ version: sql`${character.version} + 1` }).where(eq(character.id, id)).run();
				noteChange(id, `the Player edited ${updated.name}`);
				return updated;
			});
		},
		/** The level-up waiting for the Player: what one more level asks them to pick, or null. */
		levelUpOffer(id) {
			return offerFor(detail(id));
		},
		/**
		* Takes one level the DM awarded (`award_level`): the level rises, HP rises with the new
		* maximum, and the picked cantrips and spells are learned. Play state is kept. Refused without
		* an awarded level, or when the picks do not fit the offer.
		*/
		levelUp(id, picks, browser) {
			requireClaim(id, browser);
			return db.transaction(() => {
				const before = detail(id);
				const offer = offerFor(before);
				if (!offer) throw new CharacterValidationError("No level to take: the DM awards levels");
				const issue = levelUpIssue(offer, picks);
				if (issue) throw new CharacterValidationError(issue);
				db.update(character).set({
					level: offer.level,
					levelsAwarded: before.levelsAwarded - 1,
					version: sql`${character.version} + 1`,
					updatedAt: now()
				}).where(eq(character.id, id)).run();
				const learned = [...picks.cantrips ?? [], ...picks.spells ?? []];
				if (learned.length > 0) {
					const ids = db.select({ id: spell.id }).from(spell).where(inArray(spell.slug, learned)).all();
					db.insert(characterSpell).values(ids.map((s) => ({
						characterId: id,
						spellId: s.id,
						source: "class"
					}))).run();
				}
				const after = detail(id);
				const gained = Math.max(0, maxHp(after) - maxHp(before));
				const updated = db.update(character).set({ currentHp: before.currentHp > 0 ? before.currentHp + gained : 0 }).where(eq(character.id, id)).returning().get();
				noteChange(id, `the Player levelled ${updated.name} up to level ${offer.level}`);
				return updated;
			});
		},
		/**
		* Edits a Character's notes, personality, appearance or backstory, leaving play state alone.
		* Backstory after Begin is the DM's while the DM is away.
		*/
		updateDetails(id, details, browser) {
			requireClaim(id, browser);
			const fields = Object.keys(DETAIL_LIMITS).filter((f) => details[f] !== void 0);
			if (fields.includes("backstory")) dmOnly("Backstory");
			const values = {};
			for (const f of fields) {
				const value = details[f];
				if (value !== null && typeof value !== "string") throw new CharacterValidationError(`${f} must be text`);
				const trimmed = value?.trim() || null;
				if (trimmed && trimmed.length > DETAIL_LIMITS[f]) throw new CharacterValidationError(`${f} must be at most ${DETAIL_LIMITS[f]} characters`);
				values[f] = trimmed;
			}
			if (fields.length === 0) throw new CharacterValidationError("Nothing to change");
			return db.transaction(() => {
				const updated = db.update(character).set({
					...values,
					version: sql`${character.version} + 1`,
					updatedAt: now()
				}).where(eq(character.id, id)).returning().get();
				if (!updated) throw new CharacterNotFoundError("Character not found");
				noteChange(id, `the Player edited ${updated.name}’s ${listed(fields)}`);
				return updated;
			});
		}
	};
}
// src/lib/server/floor/floor.ts
/** The Character can't put a Declaration on the Floor (unknown, dead or departed, not theirs). */
var DeclarationRefusedError = class extends Error {};
/** The open Floor holds no Declaration with this id. */
var DeclarationNotFoundError = class extends Error {};
/** Done while the DM is still answering the last closed Floor. */
var DmBusyError = class extends Error {};
/**
* The spotlight cut to `place`: every Declaration on the open Floor for a Character no longer in
* the Scene goes back to its Player's composer as unsent text, and the Floor reopens (nobody has
* pressed Done on the new Scene). Runs inside the cut's transaction; returns how many went back.
*/
function returnStrandedDrafts(db, place, at) {
	const open = db.select().from(floor).where(eq(floor.state, "open")).get();
	if (!open) return 0;
	const stranded = db.select({
		id: declaration.id,
		characterId: declaration.characterId,
		player: declaration.player,
		text: declaration.text,
		whereabouts: character.whereabouts
	}).from(declaration).innerJoin(character, eq(character.id, declaration.characterId)).where(eq(declaration.floorId, open.id)).orderBy(asc(declaration.position)).all().filter((d) => d.whereabouts !== place);
	for (const d of stranded) {
		db.insert(returnedDraft).values({
			characterId: d.characterId,
			player: d.player,
			text: d.text,
			createdAt: at
		}).run();
		db.delete(declaration).where(eq(declaration.id, d.id)).run();
	}
	db.update(floor).set({ done: [] }).where(eq(floor.id, open.id)).run();
	return stranded.length;
}
/** Declarations are a sentence or a short paragraph, not an essay. */
var DECLARATION_MAX = 2e3;
/**
* A Campaign's Floor, over its database. The open Floor is created on the first Declaration; its
* Declarations stay with the Campaign until the Floor closes, so a reload loses nothing.
*/
function createFloor(db, now = Date.now) {
	function openFloorId() {
		return db.select({ id: floor.id }).from(floor).where(eq(floor.state, "open")).get()?.id;
	}
	function openFloor(at) {
		return openFloorId() ?? db.insert(floor).values({
			campaignId: db.select({ id: campaign.id }).from(campaign).get().id,
			createdAt: at
		}).returning({ id: floor.id }).get().id;
	}
	/** The Players at the table: everyone with a Character in the Scene who can act. */
	function playersAtTable() {
		const place = scenePlace(db);
		const actors = db.select().from(character).all().filter((c) => canAct(c) && inScene(place, c));
		return [...new Set(actors.map((c) => c.controllingPlayer).filter((p) => p !== null))];
	}
	function cleanText(text) {
		const trimmed = typeof text === "string" ? text.replace(/\s*[\r\n]+\s*/g, " ").trim() : "";
		if (!trimmed) throw new DeclarationRefusedError("Say what the Character does");
		if (trimmed.length > 2e3) throw new DeclarationRefusedError(`Keep a Declaration under ${DECLARATION_MAX} characters`);
		return trimmed;
	}
	function pending(id) {
		const floorId = openFloorId();
		if (!(floorId && db.select({ id: declaration.id }).from(declaration).where(and(eq(declaration.id, id), eq(declaration.floorId, floorId))).get())) throw new DeclarationNotFoundError("Declaration not found on the open Floor");
	}
	/** `player`'s drafts a cut sent back to the composer, oldest first. */
	function returned(player) {
		return db.select({
			id: returnedDraft.id,
			character: returnedDraft.characterId,
			characterName: character.name,
			text: returnedDraft.text
		}).from(returnedDraft).innerJoin(character, eq(character.id, returnedDraft.characterId)).where(eq(returnedDraft.player, player)).orderBy(asc(returnedDraft.createdAt), asc(sql`${returnedDraft}.rowid`)).all();
	}
	/** The open Floor (empty until something is sent), with `player`'s returned drafts. */
	function current(player) {
		const floorId = openFloorId();
		if (!floorId) return {
			declarations: [],
			returned: returned(player)
		};
		return {
			declarations: db.select({
				id: declaration.id,
				character: declaration.characterId,
				characterName: character.name,
				player: declaration.player,
				text: declaration.text
			}).from(declaration).innerJoin(character, eq(character.id, declaration.characterId)).where(eq(declaration.floorId, floorId)).orderBy(asc(declaration.position)).all(),
			returned: returned(player)
		};
	}
	/** Closes the open Floor when every browser at the table is Done; an empty table waits. */
	function closeIfReady(floorId, at) {
		const done = db.select().from(floor).where(eq(floor.id, floorId)).get().done;
		const table = playersAtTable();
		if (table.length === 0 || !table.every((p) => done.includes(p))) return { closed: false };
		const declarations = current(SOLO_PLAYER).declarations;
		db.update(floor).set({
			state: "closed",
			closedAt: at
		}).where(eq(floor.id, floorId)).run();
		for (const d of declarations) logEvent(db, {
			tool: "done",
			kind: "declaration",
			summary: `${d.characterName}: ${d.text}`,
			data: {
				floor: floorId,
				declaration: d.id,
				character: d.character,
				characterName: d.characterName,
				player: d.player,
				text: d.text
			}
		}, { at });
		const withdrawnCall = declarations.length > 0 ? withdrawOpenCall(db, at) : null;
		setAwaitingNarration(db, at);
		return {
			closed: true,
			floor: floorId,
			players: done,
			declarations,
			withdrawnCall
		};
	}
	return {
		/** The open Floor (empty until something is sent), with `player`'s returned drafts. */
		current,
		/** The composer has loaded a returned draft: it is no longer held for the Player. */
		clearReturned(id) {
			db.delete(returnedDraft).where(eq(returnedDraft.id, id)).run();
		},
		/**
		* Puts a Declaration for one Character on the open Floor, opening it if none is. Refused for a
		* Character who can't act or whom `player` doesn't control.
		*/
		send({ character: characterId, text, player }) {
			const clean = cleanText(text);
			return db.transaction(() => {
				const actor = db.select().from(character).where(eq(character.id, characterId)).get();
				if (!actor) throw new DeclarationRefusedError("Character not found");
				if (!canAct(actor)) throw new DeclarationRefusedError(`${actor.name} can't act`);
				if (!inScene(scenePlace(db), actor)) throw new DeclarationRefusedError(`${actor.name} is not in the Scene`);
				if (actor.controllingPlayer !== player) throw new DeclarationRefusedError(`${actor.name} is not your Character`);
				const turn = currentTurn(db);
				const handle = characterRefs(db).find((c) => c.row.id === actor.id)?.handle;
				if (turn && turn.handle !== handle) throw new DeclarationRefusedError(`It is ${turn.name}'s turn`);
				const at = now();
				const floorId = openFloor(at);
				const last = db.select({ n: max(declaration.position) }).from(declaration).where(eq(declaration.floorId, floorId)).get()?.n;
				return {
					id: db.insert(declaration).values({
						floorId,
						characterId,
						player,
						text: clean,
						position: (last ?? 0) + 1,
						createdAt: at,
						updatedAt: at
					}).returning().get().id,
					character: characterId,
					characterName: actor.name,
					player,
					text: clean
				};
			});
		},
		/**
		* The Player presses Done. Once every browser with a Claimed Character in the Scene has, the
		* Floor closes in one transaction: its Declarations are logged (stamped with the Session) in
		* send order, they withdraw any open Call, and the Campaign awaits Narration. With no Claimed
		* Character in the Scene the Floor waits. Refused while the DM is still answering the last Floor.
		*/
		done(player) {
			return db.transaction(() => {
				if (awaitingNarrationSince(db) !== null) throw new DmBusyError("The DM is still answering the last turn");
				const at = now();
				const floorId = openFloor(at);
				const row = db.select().from(floor).where(eq(floor.id, floorId)).get();
				const done = row.done.includes(player) ? row.done : [...row.done, player];
				db.update(floor).set({ done }).where(eq(floor.id, floorId)).run();
				return closeIfReady(floorId, at);
			});
		},
		/** Not done yet: takes `player`'s Done back, until the Floor closes. */
		undone(player) {
			const floorId = openFloorId();
			if (!floorId) return;
			const row = db.select().from(floor).where(eq(floor.id, floorId)).get();
			db.update(floor).set({ done: row.done.filter((p) => p !== player) }).where(eq(floor.id, floorId)).run();
		},
		/**
		* A browser lost a Character (Let go, Release): its open Declarations are withdrawn and the
		* close is re-checked, so the Floor closes if every remaining browser in the Scene is Done.
		* A pending Call part stays with the Character.
		*/
		lose(characterId) {
			return db.transaction(() => {
				const floorId = openFloorId();
				if (!floorId) return { closed: false };
				db.delete(declaration).where(and(eq(declaration.floorId, floorId), eq(declaration.characterId, characterId))).run();
				if (awaitingNarrationSince(db) !== null) return { closed: false };
				return closeIfReady(floorId, now());
			});
		},
		/** Rewrites a Declaration still on the open Floor. */
		edit(id, text) {
			const clean = cleanText(text);
			pending(id);
			db.update(declaration).set({
				text: clean,
				updatedAt: now()
			}).where(eq(declaration.id, id)).run();
		},
		/** Takes a Declaration back off the open Floor. */
		withdraw(id) {
			pending(id);
			db.delete(declaration).where(eq(declaration.id, id)).run();
		}
	};
}
// src/lib/server/knowledge/journal.ts
/** What the Player sees for a linked Entity no Character knows. */
var SOMEONE = "someone";
/**
* Shows `[[Name]]` links as plain names for the Player. A link kept as a handle (its name was
* ambiguous) reads as the name the Characters believe, or "someone": never the handle.
*/
var plainFor = (db) => (text) => text.replace(/\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]/g, (_, inner) => HANDLE.test(inner) ? believedName(db, inner) ?? SOMEONE : inner);
/**
* The Player's Journal: their Characters' current Beliefs as each was learned, one entry per
* thing believed with every Character who holds it. Built from the Knowledge layer only, never
* from the World layer or an NPC's Beliefs, and with the truth stripped (ADR 0007).
*/
function journal(db, player) {
	const plain = plainFor(db);
	const characters = characterHolders(db).filter((c) => player === void 0 || c.player === player);
	const types = new Map(db.select({
		handle: entity.handle,
		type: entity.type
	}).from(entity).all().map((e) => [e.handle, e.type]));
	const rows = db.select().from(belief).where(and(isNotNull(belief.holderCharacter), isNull(belief.replacedBy), isNull(belief.retiredAt))).orderBy(asc(belief.id)).all();
	const entries = /* @__PURE__ */ new Map();
	for (const b of rows) {
		const holder = characters.find((c) => c.id === b.holderCharacter);
		const type = b.about === null ? void 0 : types.get(b.about);
		if (!holder || !type) continue;
		const text = plain(b.text);
		const source = b.source === null ? null : plain(b.source);
		const key = JSON.stringify([
			b.aboutName,
			type,
			text,
			source
		]);
		const entry = entries.get(key) ?? {
			id: `b${b.id}`,
			about: {
				name: b.aboutName ?? "",
				type
			},
			text,
			source,
			holders: []
		};
		if (!entry.holders.some((h) => h.id === holder.id)) entry.holders.push({
			id: holder.id,
			name: holder.name
		});
		entries.set(key, entry);
	}
	return { entries: [...entries.values()] };
}
// src/lib/server/play/sessions.ts
/** The in-fiction span of a Session: the clock minutes of its first and last Events. */
function span(db, sessionId) {
	const row = db.get(sql`SELECT min(${event.minute}) AS "from", max(${event.minute}) AS "to" FROM ${event}
        WHERE ${event.sessionId} = ${sessionId}`);
	return row?.from == null || row.to == null ? null : {
		from: row.from,
		to: row.to
	};
}
/** Whether the Session closed with no summary (it had no Narration): it is left out of lists. */
var empty = (s) => s.closedAt !== null && s.summary === null;
/**
* Closes a Session with its summary, in the caller's transaction: the current Session, or the
* numbered one for a catch-up close. A Session with no Narration closes with no summary.
*/
function closeSession(db, { summary, threads, session: number, at }) {
	const target = number === void 0 ? currentSession(db) : db.select().from(session).where(eq(session.number, number)).get();
	if (!target) throw number === void 0 ? new ToolError("no_open_session", "No Session is open", "Call sessions to see which Sessions exist") : new ToolError("unknown_session", `There is no Session ${number}`, "Call sessions for the Session numbers");
	if (target.closedAt !== null) throw new ToolError("session_closed", `Session ${target.number} is already closed; summaries are not rewritten`, "Fix anything wrong in play through the ordinary tools");
	const written = hasNarration(db, target.id);
	db.update(session).set({
		closedAt: at,
		summary: written ? summary : null,
		summaryAudience: written ? partyAudience(db) : null,
		threads: written ? threads : null
	}).where(eq(session.id, target.id)).run();
	lapseClaims(db);
	return written ? {
		session: target.number,
		summarised: true
	} : {
		session: target.number,
		summarised: false,
		note: "The Session had no Narration, so it closed with no summary"
	};
}
/**
* What the DM recalls of earlier Sessions: Session summaries newest first (none for empty
* Sessions), the current Session, older unclosed ones awaiting a catch-up close, and whether a
* recap is due (an earlier Session has a summary, or will once its catch-up close writes one,
* and no recap was given this one).
*/
function sessionsView(db, last) {
	const all = db.select().from(session).orderBy(desc(session.number)).all();
	const current = currentSession(db);
	const listed = all.filter((s) => !empty(s) && s.id !== current?.id);
	const recapGiven = current !== void 0 && db.select({ id: event.id }).from(event).where(and(eq(event.sessionId, current.id), eq(event.kind, "narration"), sql`json_extract(${event.data}, '$.recap') = 1`)).get() !== void 0;
	return {
		current: current?.number ?? null,
		unclosed: all.filter((s) => s.closedAt === null && s.id !== current?.id).map((s) => s.number).reverse(),
		recap_due: current !== void 0 && !recapGiven && all.some((s) => s.number < current.number && (s.summary !== null || s.closedAt === null && hasNarration(db, s.id))),
		sessions: listed.slice(0, last).map((s) => ({
			number: s.number,
			closed: s.closedAt !== null,
			started_at: new Date(s.startedAt).toISOString(),
			span: span(db, s.id),
			summary: s.summary,
			threads: s.threads ?? []
		}))
	};
}
/**
* The Player's Session history: each closed Session with a summary, newest first. It reads only
* summaries, which are Player-safe, so it cannot leak.
*/
function sessionHistory(db, viewer) {
	const claimed = new Set(claimedBy(db, viewer));
	return { sessions: db.select().from(session).where(and(isNotNull(session.closedAt), isNotNull(session.summary))).orderBy(desc(session.number)).all().filter((s) => reaches(s.summaryAudience ?? [], claimed)).map((s) => ({
		number: s.number,
		startedAt: s.startedAt,
		span: span(db, s.id),
		summary: s.summary,
		threads: s.threads ?? []
	})) };
}
/** Indexes a Narration's text for `history`'s full-text query. Recaps are never indexed. */
function indexNarration(db, eventId, text) {
	db.run(sql`INSERT INTO narration_search (event_id, text) VALUES (${eventId}, ${text})`);
}
/**
* The Event log for the DM, newest first: every Event (DM-only ones too) but recaps, which never
* feed later summaries. `query` is full-text over Narration.
*/
function history(db, { about, session: number, since, query, limit = 50 }) {
	const numbers = new Map(db.select({
		id: session.id,
		number: session.number
	}).from(session).all().map((s) => [s.id, s.number]));
	const where = [sql`NOT (${event.kind} = 'narration' AND coalesce(json_extract(${event.data}, '$.recap'), 0) = 1)`];
	if (number !== void 0) {
		const id = [...numbers].find(([, n]) => n === number)?.[0];
		where.push(id === void 0 ? sql`0` : eq(event.sessionId, id));
	}
	if (since !== void 0) where.push(gt(event.id, since));
	if (about !== void 0) where.push(sql`(instr(${event.summary}, ${about}) > 0 OR instr(coalesce(${event.data}, ''), ${about}) > 0)`);
	if (query !== void 0) {
		const words = query.match(/[\p{L}\p{N}]+/gu) ?? [];
		if (!words.length) return [];
		const match = words.map((w) => `"${w}"*`).join(" OR ");
		where.push(sql`${event.id} IN (SELECT event_id FROM narration_search WHERE narration_search MATCH ${match})`);
	}
	return db.select().from(event).where(and(...where)).orderBy(desc(event.id)).limit(limit).all().map((e) => ({
		id: e.id,
		session: e.sessionId === null ? null : numbers.get(e.sessionId) ?? null,
		minute: e.minute,
		tool: e.tool,
		kind: e.kind,
		summary: e.summary,
		...e.dmOnly ? { dm_only: true } : {}
	}));
}
// src/lib/server/creation/conversation.ts
/** Adds a line to the creation conversation. It is out of fiction: never an Event. */
function addConversationLine(db, line, at) {
	return db.insert(conversationMessage).values({
		author: line.author,
		player: line.player ?? null,
		text: line.text,
		createdAt: at
	}).returning().get();
}
/** A Campaign's creation conversation, oldest first. */
function conversationLines(db) {
	return db.select().from(conversationMessage).orderBy(asc(conversationMessage.id)).all();
}
// src/lib/server/creation/begin.ts
/** Begin is not allowed yet (or any more): the message says why. */
var BeginRefusedError = class extends Error {};
/** Where the Campaign in this database stands, with the missing Seed fields and saved Characters. */
function creationStage(db) {
	const found = db.select().from(campaign).get();
	if (!found) throw new Error("The Campaign database has no Campaign");
	const missing = missingSeedFields(campaignSeedCard(found));
	const characters = db.select({ id: character.id }).from(character).where(ne(character.status, "departed")).all().length;
	return {
		state: found.begunAt !== null ? "begun" : missing.length > 0 ? "seed_incomplete" : characters === 0 ? "party_empty" : "ready",
		missing,
		characters
	};
}
/**
* Begins the story: sets `begunAt`, which locks the Seed. Refused unless creation is ready (the
* Seed complete and a Character saved). Nothing in the fiction changes, and nothing awaits Narration.
*/
function begin(db, at) {
	const { state } = creationStage(db);
	if (state !== "ready") throw new BeginRefusedError(state === "begun" ? "The story has already begun" : state === "seed_incomplete" ? "Complete the Seed before you Begin" : "Save a Character to the Party before you Begin");
	db.update(campaign).set({
		begunAt: at,
		updatedAt: at
	}).run();
}
/** The Seed is locked: the story has begun, and the World was built from it. */
var SeedLockedError = class extends Error {};
/**
* The one guard every Seed write goes through (the Seed card, `set_seed`): after Begin the Seed is
* read-only until Start over.
*/
function refuseLockedSeed(found) {
	if (found.begunAt !== null) throw new SeedLockedError("The story has begun, so the Seed is locked. Start over to change it.");
}
/** Start over is not allowed: before Begin, or once the story has a Narration. */
var StartOverRefusedError = class extends Error {};
/**
* Start over: discards the World (Entities, Pages, Facts, links), every Belief and the Arc, and
* clears `begunAt` so the Seed unlocks. Allowed only after Begin and until the first Narration.
* It needs no DM. The Scene, the clock and the Characters' whereabouts go back to the start with
* the World they pointed into. `offline` (the DM away) logs it in no Session, so the next
* opening tells the DM.
*/
function startOver(db, at, { offline = false } = {}) {
	const found = db.select().from(campaign).get();
	if (!found) throw new Error("The Campaign database has no Campaign");
	if (found.begunAt === null) throw new StartOverRefusedError("The story has not begun, so there is nothing to start over");
	if (db.select({ id: event.id }).from(event).where(and(eq(event.kind, "narration"), gte(event.createdAt, found.begunAt))).get()) throw new StartOverRefusedError("The story has a Narration now, so it can no longer start over");
	db.delete(belief).run();
	db.delete(worldLink).run();
	db.delete(fact).run();
	db.delete(pageRevision).run();
	db.delete(entityAlias).run();
	db.run(sql`DELETE FROM world_search`);
	db.delete(entity).run();
	discardArcs(db);
	db.update(character).set({ whereabouts: null }).run();
	logChange(db, {
		handle: "campaign",
		version: db.update(campaign).set({
			begunAt: null,
			scene: null,
			clockMinute: 0,
			updatedAt: at
		}).returning().get().version,
		summary: "the Player chose Start over: the World and the Arc are gone and the Seed is unlocked"
	}, {
		at,
		offline
	});
}
// src/lib/server/campaign/registry.ts
/**
* The list of Campaign folders the server knows, as `registry.json` in the user-level state
* directory. The file is read on every call, so edits by another process are picked up.
*/
function createRegistry(home) {
	const file = path.join(home, "registry.json");
	function read() {
		if (!fs.existsSync(file)) return [];
		return JSON.parse(fs.readFileSync(file, "utf8")).campaigns ?? [];
	}
	function write(campaigns) {
		fs.mkdirSync(home, { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify({ campaigns }, null, 2) + "\n");
		fs.renameSync(tmp, file);
	}
	return {
		list: read,
		get(id) {
			return read().find((e) => e.id === id);
		},
		/** Adds the entry, or replaces the one with the same id (a re-added, moved folder). */
		put(entry) {
			write([...read().filter((e) => e.id !== entry.id && e.path !== entry.path), entry]);
		},
		remove(id) {
			write(read().filter((e) => e.id !== id));
		}
	};
}
// src/lib/server/campaign/library.ts
/** No registered Campaign has this id. */
var CampaignNotFoundError = class extends Error {};
/** The Campaign is registered, but its folder is gone. Re-add the folder to use it. */
var CampaignMissingError = class extends Error {};
/** The folder already holds a Campaign. */
var CampaignExistsError = class extends Error {};
/** An archived Campaign is read-only until restored. */
var CampaignArchivedError = class extends Error {};
/** Archive, delete and unregister wait until the Campaign's live session ends. */
var SessionLiveError = class extends Error {};
/** The folder has no `.dm/` Campaign database. */
var NotACampaignFolderError = class extends Error {};
/**
* Every Campaign the server knows: each lives in its own folder, with its database in `.dm/`, and
* the registry in the user-level state directory lists the folders.
*/
function createCampaignLibrary({ home, live = () => false, now = Date.now, initDatabase = openSeededDatabase }) {
	const registry = createRegistry(home);
	const open = /* @__PURE__ */ new Map();
	/** The folder's Campaign database, opened (migrated and Rules Data seeded) once per server. */
	function database(folder) {
		let db = open.get(folder);
		if (!db) {
			db = openSeededDatabase(campaignDatabasePath(folder));
			open.set(folder, db);
		}
		return db;
	}
	/** The folder's Campaign, or undefined when the folder (or its database) is gone. */
	function readCampaign(folder) {
		if (!fs.existsSync(campaignDatabasePath(folder))) {
			forget(folder);
			return;
		}
		return database(folder).select().from(campaign).get();
	}
	function forget(folder) {
		open.get(folder)?.$client.close();
		open.delete(folder);
	}
	/** The registered Campaign's folder and row; throws when unknown or Missing. */
	function find(id) {
		const entry = registry.get(id);
		if (!entry) throw new CampaignNotFoundError("Campaign not found");
		const found = readCampaign(entry.path);
		if (!found) throw new CampaignMissingError(`${entry.name} is missing from ${entry.path}`);
		return {
			folder: entry.path,
			found
		};
	}
	function refuseWhileLive(id, name) {
		if (live(id)) throw new SessionLiveError(`${name} has a live session. End it before changing the Campaign.`);
	}
	function update(id, values) {
		const { folder, found } = find(id);
		return database(folder).update(campaign).set({
			...values,
			updatedAt: now()
		}).where(eq(campaign.id, found.id)).returning().get();
	}
	return {
		/** Creates the Campaign folder (or uses an existing one without a Campaign) and registers it. */
		create(input) {
			const { name } = parseCampaignSeed({ name: input.name });
			const folder = path.resolve(input.folder);
			if (fs.existsSync(campaignDatabasePath(folder))) throw new CampaignExistsError(`${folder} already holds a Campaign`);
			fs.mkdirSync(path.dirname(campaignDatabasePath(folder)), { recursive: true });
			const db = initDatabase(campaignDatabasePath(folder));
			open.set(folder, db);
			const at = now();
			const created = db.insert(campaign).values({
				name,
				createdAt: at,
				updatedAt: at
			}).returning().get();
			registry.put({
				id: created.id,
				path: folder,
				name: created.name
			});
			return created;
		},
		/**
		* Registers an existing Campaign folder. A folder whose Campaign is already registered under
		* another path (it was moved) replaces that entry, so a Missing Campaign comes back. A live
		* Campaign keeps its folder: a copy of it (a git clone) registering must not repoint the
		* session's calls.
		*/
		register(input) {
			const folder = path.resolve(input);
			const found = readCampaign(folder);
			if (!found) throw new NotACampaignFolderError(`No Campaign in ${folder}`);
			if (live(found.id) && registry.get(found.id)) return found;
			registry.put({
				id: found.id,
				path: folder,
				name: found.name
			});
			return found;
		},
		list() {
			return registry.list().map((entry) => {
				const found = readCampaign(entry.path);
				if (!found) return {
					...entry,
					status: "missing",
					campaign: null
				};
				return {
					...entry,
					name: found.name,
					status: found.archivedAt === null ? "active" : "archived",
					campaign: found
				};
			});
		},
		/** One library row, or undefined when the id is not registered. */
		get(id) {
			return this.list().find((e) => e.id === id);
		},
		/** The Campaign Seed as card values. */
		seed(id) {
			return campaignSeedCard(find(id).found);
		},
		/** The Seed fields the DM set and the Player has not edited since: the card's "✎ DM" marks. */
		dmSeedFields(id) {
			return find(id).found.dmSeedFields;
		},
		/**
		* Saves the whole Seed; an incomplete one is fine, an invalid one is refused. A field the
		* Player changed loses its "✎ DM" mark.
		*/
		saveSeed(id, card) {
			const { folder, found } = find(id);
			if (found.archivedAt !== null) throw new CampaignArchivedError("An archived Campaign cannot be changed");
			refuseLockedSeed(found);
			const seed = parseCampaignSeed(card);
			const edited = new Set(CAMPAIGN_SEED_FIELDS.filter((f) => seed[f] !== found[f]));
			const saved = database(folder).transaction((tx) => {
				const row = update(id, {
					...seed,
					version: found.version + 1,
					dmSeedFields: found.dmSeedFields.filter((f) => !edited.has(f))
				});
				logChange(tx, {
					handle: "campaign",
					version: row.version,
					summary: "the Player edited the Campaign Seed"
				}, {
					at: now(),
					offline: !live(id)
				});
				return row;
			});
			registry.put({
				id,
				path: folder,
				name: saved.name
			});
			return saved;
		},
		/** Where creation stands: the Begin step reads it. */
		creation(id) {
			return creationStage(database(find(id).folder));
		},
		/** The Player pressed Begin: locks the Seed. Refused (`BeginRefusedError`) unless creation is ready. */
		begin(id) {
			const { folder, found } = find(id);
			if (found.archivedAt !== null) throw new CampaignArchivedError("An archived Campaign cannot be changed");
			begin(database(folder), now());
		},
		/**
		* Start over: discards the World and the Arc and unlocks the Seed. Refused
		* (`StartOverRefusedError`) before Begin and after the first Narration; it needs no DM.
		*/
		startOver(id) {
			const { folder, found } = find(id);
			if (found.archivedAt !== null) throw new CampaignArchivedError("An archived Campaign cannot be changed");
			database(folder).transaction((tx) => startOver(tx, now(), { offline: !live(id) }));
		},
		/** The creation conversation in the DM pane. It is out of fiction and never logged. */
		conversation(id) {
			const db = database(find(id).folder);
			return {
				list: () => conversationLines(db),
				add: (line) => addConversationLine(db, {
					...line,
					author: "player"
				}, now())
			};
		},
		/** Names a browser as the DM hears it, by the Characters it Claims now. */
		labels(id) {
			return playerLabels(database(find(id).folder));
		},
		/** The Campaign's Characters and Character drafts. */
		party(id) {
			return createParty(database(find(id).folder), now, { attended: () => live(id) });
		},
		/** The Campaign's open Floor and the Declarations on it. */
		floor(id) {
			return createFloor(database(find(id).folder), now);
		},
		/** The Campaign's Calls, as the Players roll and answer them. */
		calls(id) {
			return createCalls(database(find(id).folder), now);
		},
		/** The Campaign's record of play: the Player's timeline and Journal, and its Sessions. */
		record(id) {
			const db = database(find(id).folder);
			return {
				timeline: (viewer) => timeline(db, viewer),
				/** When the open turn started waiting on the DM, or null. */
				awaitingSince: () => awaitingNarrationSince(db),
				journal: (viewer) => journal(db, viewer),
				/** The Player's read-only Session history. */
				sessionHistory: (viewer) => sessionHistory(db, viewer),
				openSession: (bridge) => openSession(db, now(), bridge),
				/** The DM's core block. */
				coreBlock: () => coreBlock({
					party: createParty(db, now),
					db
				}),
				/**
				* What a Session's opening injects: the core block, then what changed since the last
				* Session (told once) and any turn still awaiting Narration.
				*/
				opening: () => db.transaction((tx) => {
					const notice = openingNotice(tx);
					const core = coreBlock({
						party: createParty(db, now),
						db
					});
					return notice ? `${core}\n\n${notice}` : core;
				}),
				/** Pending Calls an action tool stored that no narrate has attached yet. */
				/** The pending Calls this turn must attach or cancel (rules' Calls can wait). */
				pendingCalls: () => unattachedCalls(db),
				/** Drops the pending Calls a turn ended without attaching, leaving those that can wait. */
				dropPendingCalls: () => db.transaction((tx) => unattachedCalls(tx).forEach((id) => cancelPendingCall(tx, id, now()))),
				/** Logs a turn that went wrong, as the Player sees it in the timeline. */
				turnError: (text) => logEvent(db, {
					tool: "stop",
					kind: "turn_error",
					summary: text,
					data: { text }
				}, { at: now() }),
				scene: () => playerScene(db),
				spotlight: (character, player) => spotlightRequest(db, character, player)
			};
		},
		/**
		* The database of the registered Campaign in this folder, or undefined when the folder is not
		* a registered Campaign (or its database is gone). How game tools find their Campaign.
		*/
		databaseFor(input) {
			const entry = this.entryAt(input);
			return entry && database(entry.path);
		},
		/** The registered Campaign in this folder, or undefined (unregistered, or its database gone). */
		entryAt(input) {
			const folder = canonicalFolder(input);
			const entry = registry.list().find((e) => canonicalFolder(e.path) === folder);
			if (!entry || !readCampaign(entry.path)) return void 0;
			return entry;
		},
		/** A no-op when already archived. */
		archive(id) {
			const { found } = find(id);
			refuseWhileLive(id, found.name);
			return found.archivedAt === null ? update(id, { archivedAt: now() }) : found;
		},
		/** A no-op when already active. */
		restore(id) {
			const { found } = find(id);
			return found.archivedAt === null ? found : update(id, { archivedAt: null });
		},
		/**
		* Deletes the Campaign: its `.dm/` directory goes, then the folder itself if nothing else is
		* left in it, so the Player's own files (a git checkout, notes) are never removed.
		*/
		delete(id) {
			const { folder, found } = find(id);
			refuseWhileLive(id, found.name);
			forget(folder);
			fs.rmSync(path.dirname(campaignDatabasePath(folder)), {
				recursive: true,
				force: true
			});
			if (fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
			registry.remove(id);
			return found;
		},
		/** Forgets the Campaign, Missing or not, and leaves its folder alone. */
		unregister(id) {
			const entry = registry.get(id);
			if (!entry) throw new CampaignNotFoundError("Campaign not found");
			refuseWhileLive(id, entry.name);
			forget(entry.path);
			registry.remove(id);
		},
		/** Closes every open Campaign database. */
		close() {
			for (const db of open.values()) db.$client.close();
			open.clear();
		}
	};
}
// src/lib/server/campaign/index.ts
var env = {
	DUNGEON_MASTER_HOME,
	DUNGEON_MASTER_CAMPAIGNS
};
/** Which Campaigns have a DM at the table. */
var sessions = createSessions();
/** The browser's live updates stream. */
var live = createLiveUpdates({ sessions });
/** The server's Campaign library, over the registry in the user-level state directory. */
var library = createCampaignLibrary({
	home: userStateDir(env),
	live: (id) => sessions.attached(id)
});
/** The default root the New Campaign dialog suggests folders under. */
var campaignRoot = defaultCampaignRoot(env);
export { partyAudience as $, characterRefs as $t, ABILITY_NAMES as A, CharacterValidationError as At, createHitDiceCall as B, pastArcs as Bt, DmBusyError as C, advanceClock as Ct, DraftNotFoundError as D, believedName as Dt, DmOnlyEditError as E, scenePlace as Et, TIERS as F, renderLinks as Ft, damageSequence as G, ToolError as Gt, openCall as H, retireArc as Ht, callInput as I, resolveLinks as It, sequenceText as J, readTool as Jt, rollAll as K, creationTool as Kt, callResultEvent as L, CurrentArcError as Lt, CallRefusedError as M, lintWorld as Mt, DC_BY_TIER as N, createWorld as Nt, createDmChannels as O, loadWizardRules as Ot, PASS as P, fieldNames as Pt, nextEventId as Q, characterHolders as Qt, cancelPendingCall as R, createArc as Rt, DeclarationRefusedError as S, SpotlightRefusedError as St, ClaimRefusedError as T, present as Tt, saveKey as U, reviseArc as Ut, createPendingCall as V, resolveBeat as Vt, attackSequence as W, PLUGIN_NAME as Wt, logActivity as X, formatClock as Xt, currentStamp as Y, writeTool as Yt, logEvent as Z, parseClock as Zt, closeSession as _, setConcentration as _t, CampaignArchivedError as a, orderText as at, sessionsView as b, deathSaveCall as bt, CampaignNotFoundError as c, startCombat as ct, BeginRefusedError as d, combatant as dt, SESSION_LIVE_MESSAGE as en, setAwaitingNarration as et, SeedLockedError as f, incapacitates as ft, addConversationLine as g, concentrate as gt, refuseLockedSeed as h, setConditions as ht, sessions as i, nextTurn as it, CallClosedError as j, hpState as jt, playSheets as k, CharacterNotFoundError as kt, NotACampaignFolderError as l, applyDamage as lt, creationStage as m, saveBonus as mt, library as n, combatState as nt, CampaignExistsError as o, refuseDuringCombat as ot, StartOverRefusedError as p, mustAct as pt, saveSequence as q, expectVersion as qt, live as r, endCombat as rt, CampaignMissingError as s, spendTurnResource as st, campaignRoot as t, addCombatants as tt, SessionLiveError as u, applyHealing as ut, history as v, equippable as vt, returnStrandedDrafts as w, currentMinute as wt, DeclarationNotFoundError as x, ClockBackwardsError as xt, indexNarration as y, isBodyArmor as yt, createCalls as z, currentArc as zt };

//# sourceMappingURL=campaign.js.map