import { Bt as DUNGEON_MASTER_HOME, C as pageRevision, Dt as desc, E as NPC_STATUSES, Et as asc, Ft as sql, Ht as DUNGEON_MASTER_VERSION, Mt as isNull, Nt as like, Ot as and, Pt as or, S as fact, T as ENTITY_TYPES, Vt as DUNGEON_MASTER_PORT, b as entity, i as userStateDir, jt as isNotNull, kt as eq, l as campaign, n as canonicalFolder, v as event, w as worldLink, x as entityAlias } from "./paths.js";
import { i as sessions, l as NotACampaignFolderError, n as library, v as SESSION_LIVE_MESSAGE } from "./campaign.js";
import { _ as prettifyError, d as record, f as strictObject, g as toJSONSchema, h as unknown, i as boolean, o as int, p as string, r as array, t as _enum, u as object } from "./schemas.js";
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
var HANDLE$1 = "campaign";
function current({ db }) {
	const found = db.select().from(campaign).get();
	if (!found) throw ToolError.unknownHandle(HANDLE$1);
	return found;
}
function view(found) {
	const seed = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, found[f]]));
	return {
		handle: HANDLE$1,
		version: found.version,
		...seed
	};
}
var fields = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, string().optional()]));
/** Reading and writing the Campaign Seed: the first versioned Entity the DM can touch. */
var seedTools = [readTool({
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
			handle: HANDLE$1,
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
})];
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
// src/lib/server/world/names.ts
/** Names: handle slugs and the near-duplicate test `establish` and link near-matches use. */
var plain = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** The slug part of a handle: `Mira Voss` → `mira-voss`. */
function slug(name) {
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
// src/lib/server/world/links.ts
/** `[[Name]]`, `[[alias]]` or `[[npc:handle]]`; text after a `|` is a label and ignored. */
var LINK = /\[\[([^[\]]+?)\]\]/g;
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
		const base = `${type}:${slug(name)}`;
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
				beliefs: 0,
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
// src/lib/server/tools/world-tools.ts
/** Every World-layer event is DM-only: the World layer never reaches the Player. */
var dmOnly = true;
var handle = string().min(1);
var minute = int().min(0).nullable();
var newFact = object({
	claim: string().trim().min(1),
	valid_from: minute.optional().describe("In-fiction minute; null = since before the Campaign")
});
/** The DM's record of what is true: Entities, their Pages and their Facts (ADR 0007). */
var worldTools = [
	readTool({
		name: "search",
		description: "Full-text search over World Entities: names, aliases, Pages and current Facts. Returns ranked handles with snippets. Retired Entities are left out. Use lookup for SRD rules content.",
		input: object({
			query: string().min(1),
			type: _enum(ENTITY_TYPES).optional()
		}),
		run: (ctx, { query, type }) => ({ results: createWorld(ctx).search(query, type) })
	}),
	readTool({
		name: "open",
		description: "Open an Entity: typed fields, version, Page, current Facts (superseded and retired ones and every Page revision with history), links, backlinks and the count of Beliefs about it.",
		input: object({
			handle,
			history: boolean().default(false)
		}),
		run: (ctx, { handle, history }) => createWorld(ctx).open(handle, history)
	}),
	writeTool({
		name: "establish",
		description: "Establish a new NPC, Place, Faction or Topic. Refuses a name close to an existing Entity (returning the matches) unless you list them in distinct_from. [[Name]] links in the Page and Facts resolve to handles; unresolved ones come back with near-matches.",
		input: object({
			type: _enum(ENTITY_TYPES),
			name: string().trim().min(1),
			aliases: array(string().trim().min(1)).default([]),
			fields: record(string(), unknown()).default({}),
			page: string().optional(),
			facts: array(newFact).default([]),
			distinct_from: array(handle).default([])
		}),
		run: (ctx, input) => {
			const result = createWorld(ctx).establish(input);
			return {
				result,
				event: {
					kind: "entity_established",
					summary: `Established ${result.handle} (${input.name})`,
					data: {
						handle: result.handle,
						type: input.type
					},
					dmOnly
				}
			};
		}
	}),
	writeTool({
		name: "edit_page",
		description: "Edit an Entity's Page. Pass patches of old/new text (each old must appear exactly once), or full text only into an empty Page. Every revision is kept. Unresolved [[links]] come back with near-matches; nothing is stubbed.",
		input: object({
			handle,
			version: int(),
			text: string().min(1).optional(),
			patches: array(object({
				old: string().min(1),
				new: string()
			})).min(1).optional()
		}).refine((i) => i.text === void 0 !== (i.patches === void 0), { message: "Pass either text or patches, not both" }),
		run: (ctx, { handle, version, text, patches }) => {
			const change = text !== void 0 ? { text } : { patches };
			return {
				result: createWorld(ctx).editPage(handle, version, change),
				event: {
					kind: "page_edited",
					summary: `Edited the Page of ${handle}`,
					data: { handle },
					dmOnly
				}
			};
		}
	}),
	writeTool({
		name: "set_field",
		description: "Set one typed field of an Entity (or its name); null clears an optional field. Returns old, new and the version, and warns naming any current Fact that restates the field.",
		input: object({
			handle,
			version: int(),
			field: string().min(1),
			value: unknown()
		}),
		run: (ctx, { handle, version, field, value }) => {
			const result = createWorld(ctx).setField(handle, version, field, value ?? null);
			return {
				result,
				event: {
					kind: "field_set",
					summary: `Set ${handle}.${field}`,
					data: {
						handle,
						field,
						old: result.old,
						new: result.new
					},
					dmOnly
				}
			};
		}
	}),
	writeTool({
		name: "add_fact",
		description: "Add a Fact about an Entity. Pass the subject's version. valid_from is the in-fiction minute it became true (default now; null = since before the Campaign). Name in supersedes the current Facts it replaces: code closes them at valid_from. Nothing is superseded automatically.",
		input: object({
			subject: handle,
			version: int(),
			claim: string().trim().min(1),
			valid_from: minute.optional(),
			supersedes: array(int()).default([])
		}),
		run: (ctx, input) => {
			const result = createWorld(ctx).addFact(input);
			return {
				result,
				event: {
					kind: "fact_added",
					summary: `Fact ${result.fact} about ${input.subject}`,
					data: {
						fact: result.fact,
						subject: input.subject,
						superseded: result.superseded
					},
					dmOnly
				}
			};
		}
	}),
	writeTool({
		name: "supersede",
		description: "Record a supersession noticed later: Fact `by` replaces Fact `old`, which closes at the start of `by`.",
		input: object({
			old: int(),
			by: int()
		}),
		run: (ctx, { old, by }) => {
			return {
				result: createWorld(ctx).supersede(old, by),
				event: {
					kind: "fact_superseded",
					summary: `Fact ${old} superseded by Fact ${by}`,
					data: {
						old,
						by
					},
					dmOnly
				}
			};
		}
	}),
	writeTool({
		name: "retire",
		description: "Retire a Fact (pass its subject's version) or a whole Entity (its version), with a reason. Retiring an Entity retires its current Facts and returns them. Retired records stay on file but are no longer used.",
		input: object({
			fact: int().optional(),
			handle: handle.optional(),
			version: int(),
			reason: string().trim().min(1)
		}).refine((i) => i.fact === void 0 !== (i.handle === void 0), { message: "Pass either fact or handle, not both" }),
		run: (ctx, { fact, handle, version, reason }) => {
			const world = createWorld(ctx);
			const result = fact !== void 0 ? world.retireFact(fact, version, reason) : world.retireEntity(handle, version, reason);
			return {
				result,
				event: {
					kind: "retired",
					summary: `Retired ${fact !== void 0 ? `Fact ${fact}` : handle}: ${reason}`,
					data: {
						fact,
						handle: result.handle,
						reason,
						facts: result.retired_facts.map((f) => f.id)
					},
					dmOnly
				}
			};
		}
	}),
	writeTool({
		name: "merge",
		description: "Merge a duplicate Entity into another: moves its Facts, aliases (and its name, as an alias) and incoming links, appends its Page to the survivor as a new revision, and retires it. Pass both versions.",
		input: object({
			from: handle,
			into: handle,
			versions: object({
				from: int(),
				into: int()
			})
		}),
		run: (ctx, { from, into, versions }) => {
			return {
				result: createWorld(ctx).merge(from, into, versions),
				event: {
					kind: "entities_merged",
					summary: `Merged ${from} into ${into}`,
					data: {
						from,
						into
					},
					dmOnly
				}
			};
		}
	})
];
// src/lib/server/tools/index.ts
/** Every game tool the server exposes to the DM. */
var gameTools = [...seedTools, ...worldTools];
// src/lib/server/tools/host.ts
var json$1 = (value) => ({ content: [{
	type: "text",
	text: JSON.stringify(value)
}] });
var failure = (e) => ({
	...json$1({
		code: e.code,
		message: e.message,
		next: e.next,
		...e.details
	}),
	isError: true
});
/** The id the next Event will get. The log is append-only, so ids are never reused. */
function nextEventId(db) {
	return (db.get(sql`SELECT max(${event.id}) AS id FROM ${event}`)?.id ?? 0) + 1;
}
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
		if (!tool.mutates) return tool.run({
			db,
			stamp: {
				...stamp(db),
				eventId: null
			}
		}, parsed.data);
		return db.transaction((tx) => {
			const { sessionId, minute } = stamp(tx);
			const eventId = nextEventId(tx);
			const { result, skill, event: logged } = tool.run({
				db: tx,
				stamp: {
					sessionId,
					minute,
					eventId
				}
			}, parsed.data);
			tx.insert(event).values({
				id: eventId,
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