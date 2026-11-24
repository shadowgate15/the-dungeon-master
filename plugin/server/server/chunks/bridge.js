import { A as fact, Bt as isNotNull, C as event, D as belief, Ft as desc, Ht as like, It as and, Lt as eq, M as worldLink, N as ENTITY_TYPES, Nt as SOLO_PLAYER, O as entity, P as NPC_STATUSES, Pt as asc, Ut as or, Vt as isNull, Wt as sql, Xt as DUNGEON_MASTER_PORT, Yt as DUNGEON_MASTER_HOME, Zt as DUNGEON_MASTER_VERSION, a as userStateDir, h as character, j as pageRevision, k as entityAlias, m as campaign, zt as inArray } from "./seed.js";
import { A as ToolError, B as advanceClock, C as setAwaitingNarration, D as callResultEvent, E as callInput, G as isNearName, H as currentMinute, J as formatClock, K as normalizeName, M as readTool, N as writeTool, O as openCall, R as ClockBackwardsError, S as nextEventId, U as present, V as characterRefs, W as scenePlace, X as SESSION_LIVE_MESSAGE, Y as parseClock, b as logActivity, c as CampaignNotFoundError, d as characterHolders, f as charactersInScene, g as returnStrandedDrafts, i as sessions, j as expectVersion, k as PLUGIN_NAME, l as NotACampaignFolderError, n as library, q as slug, r as live, v as createDmChannels, x as logEvent, y as currentStamp } from "./campaign.js";
import { _ as prettifyError, d as record, f as strictObject, g as toJSONSchema, h as unknown, i as boolean, m as union, o as int, p as string, r as array, t as _enum, u as object } from "./schemas.js";
import { n as CampaignSeedError, o as parseCampaignSeed, r as campaignSeedCard, t as CAMPAIGN_SEED_FIELDS } from "./seed2.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
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
// src/lib/server/world/links.ts
/** `[[Name]]`, `[[alias]]` or `[[npc:handle]]`; text after a `|` is a label and ignored. */
var LINK = /\[\[([^[\]]+?)\]\]/g;
var HANDLE$1 = new RegExp(`^(${ENTITY_TYPES.join("|")}):[a-z0-9-]+$`);
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
			if (HANDLE$1.test(name) && known.has(name)) {
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
		if (!HANDLE$1.test(handle)) return whole;
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
		if (!isCurrent(found)) {
			const state = found.retiredAt !== null ? "retired" : `superseded by Fact ${found.supersededBy}`;
			throw new ToolError("not_current", `Fact ${id} is already ${state}`, `Open ${found.subject} with history to see its Facts`);
		}
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
// src/lib/server/knowledge/knowledge.ts
var isCurrentBelief = (b) => b.replacedBy === null && b.retiredAt === null;
var isCurrentFact = (f) => f.supersededBy === null && f.retiredAt === null;
/** A field value in words: handles shown by name, lists joined, objects by their name. */
function formatValue(value, all) {
	if (value === null || value === void 0) return "none";
	if (typeof value === "string") return all.find((k) => k.handle === value)?.name ?? value;
	if (Array.isArray(value)) return value.map((v) => formatValue(v, all)).join(", ") || "none";
	if (typeof value === "object") {
		const named = value;
		return typeof named.name === "string" ? named.name : JSON.stringify(value);
	}
	return String(value);
}
/** The Knowledge layer over one Campaign database: who believes what (ADR 0007). */
function createKnowledge(ctx) {
	const { db, stamp } = ctx;
	const world = createWorld(ctx);
	function findEntity(handle) {
		const found = db.select().from(entity).where(eq(entity.handle, handle)).get();
		if (!found) throw ToolError.unknownHandle(handle);
		return found;
	}
	function liveEntity(handle, tool) {
		const found = findEntity(handle);
		if (found.retiredAt !== null) {
			const instead = found.mergedInto ? `; use ${found.mergedInto}` : "";
			throw ToolError.invalidInput(tool, `${handle} is retired${instead}`);
		}
		return found;
	}
	function findFact(id) {
		const found = db.select().from(fact).where(eq(fact.id, id)).get();
		if (!found) throw new ToolError("unknown_fact", `No Fact has the id ${id}`, "Check the id against open");
		return found;
	}
	/** Every Fact connected to `id` through supersession, both ways. */
	function chainOf(id) {
		const all = db.select().from(fact).all();
		const seen = /* @__PURE__ */ new Set([id]);
		for (let grew = true; grew;) {
			grew = false;
			for (const f of all) {
				if (!(seen.has(f.id) || f.supersededBy !== null && seen.has(f.supersededBy))) continue;
				for (const n of [f.id, f.supersededBy]) if (n !== null && !seen.has(n)) {
					seen.add(n);
					grew = true;
				}
			}
		}
		return [...seen];
	}
	/** The Facts that now stand where `id` stood: the current ends of its supersession chain. */
	function currentSuccessors(id) {
		const chain = new Set(chainOf(id));
		return db.select().from(fact).all().filter((f) => chain.has(f.id) && isCurrentFact(f) && f.id !== id);
	}
	function fieldValue(row, field) {
		return field === "name" ? row.name : row.fields[field] ?? null;
	}
	function target(input, tool) {
		const all = world.known();
		if ("claim" in input) {
			const about = liveEntity(input.about, tool);
			const resolved = resolveLinks(input.claim, all);
			return {
				kind: "claim",
				factId: null,
				about: about.handle,
				aboutName: about.name,
				field: null,
				value: null,
				claim: resolved.text,
				text: renderLinks(resolved.text, all),
				chain: []
			};
		}
		const { of } = input;
		if (typeof of === "number") {
			const found = findFact(of);
			if (found.retiredAt !== null) throw ToolError.invalidInput(tool, `Fact ${of} is retired (${found.retiredReason})`);
			const subject = findEntity(found.subject);
			return {
				kind: "fact",
				factId: found.id,
				about: subject.handle,
				aboutName: subject.name,
				field: null,
				value: null,
				claim: null,
				text: renderLinks(found.claim, all),
				chain: chainOf(found.id)
			};
		}
		const dot = of.lastIndexOf(".");
		const found = liveEntity(dot === -1 ? of : of.slice(0, dot), tool);
		if (dot === -1) return {
			kind: "entity",
			factId: null,
			about: found.handle,
			aboutName: found.name,
			field: null,
			value: null,
			claim: null,
			text: found.name,
			chain: []
		};
		const field = of.slice(dot + 1);
		if (field !== "name" && !fieldNames(found.type).includes(field)) throw ToolError.invalidInput(tool, `A ${found.type} has no field ${field}; its fields are name, ${fieldNames(found.type).join(", ")}`);
		const value = fieldValue(found, field);
		return {
			kind: "field",
			factId: null,
			about: found.handle,
			aboutName: found.name,
			field,
			value,
			claim: null,
			text: `${found.name}'s ${field.replaceAll("_", " ")}: ${formatValue(value, all)}`,
			chain: []
		};
	}
	function holderFor(handle, characters, tool) {
		if (handle.startsWith("char:")) {
			const found = characters.find((c) => c.handle === handle);
			if (!found) throw ToolError.unknownHandle(handle);
			return {
				handle,
				character: found.id,
				npc: null
			};
		}
		const found = findEntity(handle);
		if (found.type !== "npc") throw ToolError.invalidInput(tool, `${handle} is a ${found.type}; only Characters and NPCs hold Beliefs`);
		return {
			handle,
			character: null,
			npc: found.handle
		};
	}
	const heldBy = (h) => h.character !== null ? eq(belief.holderCharacter, h.character) : eq(belief.holderNpc, h.npc);
	function currentBeliefsOf(h) {
		return db.select().from(belief).where(and(heldBy(h), isNull(belief.replacedBy), isNull(belief.retiredAt))).orderBy(asc(belief.id)).all();
	}
	/** Whether a held Belief already says what `t` says. */
	function matches(b, t) {
		if (b.kind !== t.kind || b.about !== t.about) return false;
		switch (t.kind) {
			case "fact": return b.factId === t.factId;
			case "entity": return true;
			case "field": return b.field === t.field && isDeepStrictEqual(b.value ?? null, t.value ?? null);
			case "claim": return b.claim === t.claim;
		}
	}
	/** Whether a held Belief is about the same thing as `t`, so a new one replaces it. */
	function sameTarget(b, t) {
		if (t.kind === "fact") return b.kind === "fact" && t.chain.includes(b.factId ?? -1);
		if (t.kind === "field") return b.kind === "field" && b.about === t.about && b.field === t.field;
		return false;
	}
	function holderHandleOf(b, characters) {
		if (b.holderNpc !== null) return b.holderNpc;
		return characters.find((c) => c.id === b.holderCharacter)?.handle ?? "char:unknown";
	}
	function view(b, characters, all) {
		const truth = truthOf(b, all);
		return {
			id: b.id,
			holder: holderHandleOf(b, characters),
			kind: b.kind,
			about: b.about,
			...b.field !== null && { field: b.field },
			claim: b.text,
			source: b.source,
			learned: {
				session: b.sessionId,
				minute: b.learnedMinute
			},
			outdated: truth !== null,
			...truth !== null && { truth },
			...b.replacedBy !== null && { replaced_by: b.replacedBy },
			...b.retiredAt !== null && { retired_reason: b.retiredReason }
		};
	}
	/** The current truth beside an outdated Belief, or null when the Belief still matches the World. */
	function truthOf(b, all) {
		if (b.kind === "fact" && b.factId !== null) {
			const found = db.select().from(fact).where(eq(fact.id, b.factId)).get();
			if (!found || isCurrentFact(found)) return null;
			if (found.retiredAt !== null) return `Fact ${found.id} was retired: ${found.retiredReason}`;
			const now = currentSuccessors(found.id);
			return now.length ? now.map((f) => renderLinks(f.claim, all)).join("; ") : `Fact ${found.id} no longer holds`;
		}
		if (b.kind === "field" && b.about !== null && b.field !== null) {
			const found = db.select().from(entity).where(eq(entity.handle, b.about)).get();
			if (!found) return null;
			const current = fieldValue(found, b.field);
			if (isDeepStrictEqual(current ?? null, b.value ?? null)) return null;
			return `${found.name}'s ${b.field.replaceAll("_", " ")}: ${formatValue(current, all)}`;
		}
		return null;
	}
	return {
		/**
		* Makes Holders learn something. Holders default to the Characters in the Scene. A Holder who
		* already believes it is skipped; a new Belief replaces the Holder's older one on the same
		* Fact chain or field, and any named in `replaces`.
		*/
		reveal(input, tool = "reveal") {
			const t = target(input, tool);
			const characters = characterHolders(db);
			const handles = input.holders?.length ? [...new Set(input.holders)] : charactersInScene(db).map((c) => c.handle);
			if (!handles.length) throw new ToolError("no_holders", "No Characters are in the Scene to learn this", "Name the holders explicitly");
			const holders = handles.map((h) => holderFor(h, characters, tool));
			const named = [...new Set(input.replaces ?? [])].map((id) => {
				const found = db.select().from(belief).where(eq(belief.id, id)).get();
				if (!found) throw new ToolError("unknown_belief", `No Belief has the id ${id}`, "Check the id against beliefs_of");
				if (!isCurrentBelief(found)) throw ToolError.invalidInput(tool, `Belief ${id} is already replaced or retired`);
				const owner = holderHandleOf(found, characters);
				if (!handles.includes(owner)) throw ToolError.invalidInput(tool, `Belief ${id} is held by ${owner}, who is not among the holders`);
				return {
					...found,
					owner
				};
			});
			const beliefs = [];
			const skipped = [];
			for (const h of holders) {
				const held = currentBeliefsOf(h);
				const already = held.find((b) => matches(b, t));
				if (already) {
					skipped.push({
						holder: h.handle,
						belief: already.id
					});
					continue;
				}
				const row = db.insert(belief).values({
					holderCharacter: h.character,
					holderNpc: h.npc,
					kind: t.kind,
					factId: t.factId,
					about: t.about,
					field: t.field,
					value: t.kind === "field" ? t.value ?? null : null,
					claim: t.claim,
					text: t.text,
					aboutName: t.aboutName,
					source: input.source ?? null,
					sessionId: stamp.sessionId,
					eventId: stamp.eventId,
					learnedMinute: stamp.minute
				}).returning().get();
				const replaced = [...held.filter((b) => sameTarget(b, t)).map((b) => b.id), ...named.filter((b) => b.owner === h.handle).map((b) => b.id)];
				const unique = [...new Set(replaced)];
				if (unique.length) db.update(belief).set({ replacedBy: row.id }).where(inArray(belief.id, unique)).run();
				beliefs.push({
					id: row.id,
					holder: h.handle,
					claim: t.text,
					replaced: unique
				});
			}
			return {
				beliefs,
				skipped
			};
		},
		/** A Holder's current Beliefs (every one with `history`), with outdatedness and the truth. */
		beliefsOf(holder, about, history = false) {
			const characters = characterHolders(db);
			const h = holderFor(holder, characters, "beliefs_of");
			if (about !== void 0) findEntity(about);
			const all = world.known();
			return {
				holder,
				beliefs: db.select().from(belief).where(heldBy(h)).orderBy(asc(belief.id)).all().filter((b) => history || isCurrentBelief(b)).filter((b) => about === void 0 || b.about === about).map((b) => view(b, characters, all))
			};
		},
		/** How many current Beliefs are about an Entity. */
		countAbout(handle) {
			return db.select().from(belief).where(eq(belief.about, handle)).all().filter(isCurrentBelief).length;
		},
		/** Retires every current Belief about an Entity (or held by it), returning their ids. */
		retireAbout(handle, reason) {
			const rows = db.select().from(belief).where(or(eq(belief.about, handle), eq(belief.holderNpc, handle))).all().filter(isCurrentBelief);
			if (rows.length) db.update(belief).set({
				retiredAt: stamp.minute,
				retiredReason: reason
			}).where(inArray(belief.id, rows.map((b) => b.id))).run();
			return rows.map((b) => b.id);
		},
		/** Moves Beliefs about, and held by, `from` onto `into`; returns how many moved. */
		move(from, into) {
			const about = db.update(belief).set({ about: into }).where(eq(belief.about, from)).returning({ id: belief.id }).all();
			const held = db.update(belief).set({ holderNpc: into }).where(eq(belief.holderNpc, from)).returning({ id: belief.id }).all();
			return new Set([...about, ...held].map((b) => b.id)).size;
		}
	};
}
// src/lib/server/tools/knowledge-tools.ts
var handle$1 = string().min(1);
/** What a Reveal teaches: `of` a Fact, Entity or field, or a lie or rumour's own claim. */
var revealTargetFields = {
	of: union([int(), handle$1]).optional().describe("A Fact id, an Entity handle (its existence), or handle.field (its value now)"),
	claim: string().trim().min(1).optional().describe("A lie or rumour, never a Fact"),
	about: handle$1.optional().describe("The Entity the claim is about")
};
var oneTarget = (i) => i.of !== void 0 ? i.claim === void 0 : i.claim !== void 0 && i.about !== void 0;
/** The refinement a Reveal target needs: exactly one of `of`, or `claim` with `about`. */
var revealTargetRule = [oneTarget, { message: "Pass either of, or claim with about" }];
/** The parsed target as the Knowledge layer takes it. */
var revealTarget = (i) => i.of !== void 0 ? { of: i.of } : {
	claim: i.claim,
	about: i.about
};
/** The Knowledge layer: who believes what (ADR 0007). */
var knowledgeTools = [writeTool({
	name: "reveal",
	description: "Make Holders learn something: pass `of` (a Fact id, an Entity handle, or handle.field) or a lie or rumour as `claim` + `about`. Holders default to the Characters in the Scene; name Characters (char:…) or NPCs to narrow or widen. A new Belief on the same Fact chain or field replaces the Holder's older one; name `replaces` for lies (or to re-point a rumour made true at its Fact). No version: it writes Beliefs, not the Entity. Returns the Beliefs created and the Holders skipped because they already believed it.",
	input: object({
		...revealTargetFields,
		holders: array(handle$1).optional(),
		source: string().trim().min(1).optional().describe("Who or what they learned it from"),
		replaces: array(int()).default([])
	}).refine(...revealTargetRule),
	run: (ctx, { holders, source, replaces, ...rest }) => {
		const result = createKnowledge(ctx).reveal({
			...revealTarget(rest),
			holders,
			source,
			replaces
		});
		return {
			result,
			event: {
				kind: "beliefs_revealed",
				summary: `Revealed to ${result.beliefs.map((b) => b.holder).join(", ") || "nobody new"}`,
				data: {
					beliefs: result.beliefs.map((b) => b.id),
					skipped: result.skipped
				},
				dmOnly: true
			}
		};
	}
}), readTool({
	name: "beliefs_of",
	description: "A Holder's Beliefs (a Character char:… or an NPC), optionally only those about one Entity: each claim, source and when it was learned, and `outdated` with the current truth beside it, so you voice a mistake on purpose. `history` adds replaced and retired Beliefs.",
	input: object({
		holder: handle$1,
		about: handle$1.optional(),
		history: boolean().default(false)
	}),
	run: (ctx, { holder, about, history }) => createKnowledge(ctx).beliefsOf(holder, about, history)
})];
// src/lib/server/tools/narration-tools.ts
/** The NPC a Narration is voiced by; refused unless the handle names a live NPC. */
function speaker({ db }, handle) {
	const found = db.select().from(entity).where(eq(entity.handle, handle)).get();
	if (!found || found.type !== "npc" || found.retiredAt !== null) throw ToolError.unknownHandle(handle);
	return found;
}
/** Telling the Players what happens. */
var narrationTools = [writeTool({
	name: "narrate",
	description: "Narrate to the Players: the Narration shows in their timeline. Pass voice (an NPC handle) when an NPC speaks. The first Narration after a closed Floor answers it; later ones in the same turn are fine.",
	input: object({
		text: string().trim().min(1),
		voice: string().min(1).optional().describe("NPC handle, when an NPC speaks"),
		call: callInput.optional().describe("Ask the Players: inline {kind: \"check\", character, skill | save, tier, adv?, reason} (or a list of them, one roll per Character) or {kind: \"question\", text, choices?}. A Call ends your turn; its call_result wakes you.")
	}),
	activity: null,
	run: (ctx, { text, voice, call }) => {
		const npc = voice === void 0 ? void 0 : speaker(ctx, voice);
		setAwaitingNarration(ctx.db, null);
		const callId = call === void 0 ? null : openCall(ctx.db, call, {
			at: ctx.now,
			openedBy: ctx.stamp.eventId
		});
		return {
			result: callId ? {
				narrated: true,
				call: callId,
				next: "End your turn: the Players answer the Call"
			} : { narrated: true },
			event: {
				kind: "narration",
				summary: npc ? `${npc.name}: ${text}` : text,
				data: {
					text,
					voice: npc?.handle ?? null,
					voiceName: npc?.name ?? null,
					call: callId
				}
			}
		};
	}
})];
// src/lib/server/tools/scene-tools.ts
/** A live Place, or `unknown_handle`. */
function placeAt(db, handle) {
	const found = db.select().from(entity).where(eq(entity.handle, handle)).get();
	if (!found || found.type !== "place" || found.retiredAt !== null) throw ToolError.unknownHandle(handle);
	return found;
}
function bump(db, handle, fields) {
	return db.update(entity).set({
		fields,
		version: sql`${entity.version} + 1`
	}).where(eq(entity.handle, handle)).returning({ version: entity.version }).get().version;
}
/** Whoever `who` names: Characters by `char:` handle, live NPCs by `npc:` handle. */
function movers({ db }, who) {
	const party = characterRefs(db);
	return who.map((handle) => {
		const member = party.find((c) => c.handle === handle);
		if (member) return {
			handle,
			name: member.row.name,
			at: member.row.whereabouts,
			character: member.row.id
		};
		const npc = db.select().from(entity).where(eq(entity.handle, handle)).get();
		if (!npc || npc.type !== "npc" || npc.retiredAt !== null) throw ToolError.unknownHandle(handle);
		const at = typeof npc.fields.whereabouts === "string" ? npc.fields.whereabouts : null;
		return {
			handle,
			name: npc.name,
			at,
			character: null
		};
	});
}
/** The Scene as the DM reads it: Place, clock, who is present and where the rest of the Party is. */
function sceneView(db) {
	const { place, characters, elsewhere, npcs } = present(db);
	const minute = currentMinute(db);
	return {
		scene: place && {
			handle: place.handle,
			name: place.name
		},
		clock: formatClock(minute),
		minute,
		present: {
			characters: characters.map((c) => ({
				handle: c.handle,
				name: c.row.name
			})),
			npcs: npcs.map((n) => ({
				handle: n.handle,
				name: n.name,
				role: n.fields.role ?? null,
				description: n.fields.description ?? null
			}))
		},
		elsewhere: elsewhere.map((c) => ({
			handle: c.handle,
			name: c.row.name,
			whereabouts: c.row.whereabouts
		}))
	};
}
var count = int().min(0);
var advanceInput = strictObject({
	minutes: count.optional(),
	hours: count.optional(),
	days: count.optional(),
	to: union([count, string()]).optional().describe("A clock reading (\"day 3, 14:20\") or a minute, instead of minutes/hours/days")
}).refine((d) => d.to === void 0 !== (d.minutes === void 0 && d.hours === void 0 && d.days === void 0), { message: "Pass minutes, hours or days, or to (not both)" });
/** Where the spotlight is and what time it is. */
var sceneTools = [
	readTool({
		name: "scene",
		description: "Read the Scene: its Place, the clock, the Characters and NPCs present, and where each Character elsewhere is.",
		input: strictObject({}),
		run: ({ db }) => sceneView(db)
	}),
	writeTool({
		name: "move",
		description: "Set where Characters (char:…) and NPCs (npc:…) are. Pass to (a Place), or via (an exit of the Place they are at) to go through it. An exit whose destination is open needs to as well, and is fixed to it for good. Moving does not move the spotlight: call set_scene for that.",
		input: strictObject({
			who: array(string().min(1)).min(1),
			to: string().min(1).optional().describe("Place handle"),
			via: string().min(1).optional().describe("Exit name on the movers' Place")
		}).refine((m) => m.to !== void 0 || m.via !== void 0, { message: "Pass to or via" }),
		activity: (_, result) => {
			const names = result.moved.filter((m) => m.handle.startsWith("char:")).map((m) => m.name);
			return names.length ? `DM moves ${names.join(", ")}` : null;
		},
		run: (ctx, { who, to, via }) => {
			const { db } = ctx;
			const moving = movers(ctx, [...new Set(who)]);
			let destination = to;
			let fixed = null;
			if (via !== void 0) {
				const from = [...new Set(moving.map((m) => m.at))];
				if (from.length !== 1 || from[0] === null) throw new ToolError("not_together", `To go via an exit, everyone must be at the same Place (${moving.map((m) => `${m.handle} at ${m.at ?? "nowhere"}`).join(", ")})`, "Move them separately, or pass to instead of via");
				const place = placeAt(db, from[0]);
				const exits = place.fields.exits ?? [];
				const index = exits.findIndex((e) => e.name.toLowerCase() === via.toLowerCase());
				if (index < 0) throw new ToolError("unknown_exit", `${place.handle} has no exit named "${via}" (exits: ${exits.map((e) => e.name).join(", ") || "none"})`, `Open ${place.handle} to see its exits`);
				const exit = exits[index];
				if (exit.to !== void 0) {
					if (to !== void 0 && to !== exit.to) throw ToolError.invalidInput("move", `"${exit.name}" leads to ${exit.to}, not ${to}`);
					destination = exit.to;
				} else {
					if (to === void 0) throw ToolError.invalidInput("move", `"${exit.name}" has no destination yet: pass to, and it leads there for good`);
					placeAt(db, to);
					const next = exits.map((e, i) => i === index ? {
						...e,
						to
					} : e);
					const version = bump(db, place.handle, {
						...place.fields,
						exits: next
					});
					fixed = {
						place: place.handle,
						exit: exit.name,
						to,
						version
					};
				}
			}
			const target = placeAt(db, destination);
			for (const m of moving) if (m.character !== null) db.update(character).set({ whereabouts: target.handle }).where(eq(character.id, m.character)).run();
			else {
				const npc = db.select().from(entity).where(eq(entity.handle, m.handle)).get();
				bump(db, m.handle, {
					...npc.fields,
					whereabouts: target.handle
				});
			}
			const moved = moving.map((m) => ({
				handle: m.handle,
				name: m.name
			}));
			return {
				result: {
					moved,
					to: {
						handle: target.handle,
						name: target.name
					},
					fixed
				},
				event: {
					kind: "moved",
					summary: `${moved.map((m) => m.name).join(", ")} to ${target.name}${via ? ` via ${via}` : ""}`,
					data: {
						who: moved.map((m) => m.handle),
						to: target.handle,
						via: via ?? null,
						fixed
					},
					dmOnly: !moving.some((m) => m.character !== null)
				}
			};
		}
	}),
	writeTool({
		name: "set_scene",
		description: "Move the spotlight to a Place. Refused unless a Character is there (move them first). Who is present follows from whereabouts. On a cut, Declarations for Characters no longer in the Scene go back to their Player as unsent text and the Floor reopens. Honour a spotlight request within a Floor or two, at a natural break.",
		input: strictObject({ place: string().min(1).describe("Place handle") }),
		activity: (_, result) => `DM sets the Scene: ${result.scene.name}`,
		run: ({ db, now }, { place: handle }) => {
			const place = placeAt(db, handle);
			if (!characterRefs(db).filter((c) => c.row.status === "alive").some((c) => c.row.whereabouts === place.handle)) throw new ToolError("nobody_there", `No Character is at ${place.handle}`, `Call move with the Characters going to ${place.handle} first`);
			const cut = scenePlace(db)?.handle !== place.handle;
			db.update(campaign).set({ scene: place.handle }).run();
			const returned = cut ? returnStrandedDrafts(db, place.handle, now) : 0;
			const view = sceneView(db);
			return {
				result: {
					...view,
					scene: view.scene,
					returned
				},
				event: {
					kind: "scene_set",
					summary: `Scene: ${place.name}`,
					data: {
						place: place.handle,
						name: place.name,
						returned
					}
				}
			};
		}
	}),
	writeTool({
		name: "advance_time",
		description: "Move the Campaign clock forward: by {minutes, hours, days} (they add up) or to a clock reading (\"day 3, 14:20\"). The clock never moves backwards. Keep split groups roughly in step: advance before a cut and narrate \"meanwhile\" for a group that fell behind.",
		input: advanceInput,
		activity: (_, result) => `Time passes: ${String(result.clock)}`,
		run: ({ db }, input) => {
			const from = currentMinute(db);
			let to;
			if (input.to !== void 0) {
				const parsed = typeof input.to === "number" ? input.to : parseClock(input.to);
				if (parsed === null) throw ToolError.invalidInput("advance_time", `"${input.to}" is not a clock reading like "day 3, 14:20"`);
				to = parsed;
			} else to = from + (input.minutes ?? 0) + (input.hours ?? 0) * 60 + (input.days ?? 0) * 24 * 60;
			try {
				advanceClock(db, to);
			} catch (e) {
				if (e instanceof ClockBackwardsError) throw new ToolError("clock_backwards", e.message, "Pass a later time, or leave the clock as it is");
				throw e;
			}
			const clock = formatClock(to);
			return {
				result: {
					minute: to,
					clock
				},
				event: {
					kind: "time_advanced",
					summary: `Clock: ${clock}`,
					data: {
						from,
						to
					}
				}
			};
		}
	})
];
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
/** Reading and writing the Campaign Seed: the first versioned Entity the DM can touch. */
var seedTools = [readTool({
	name: "seed",
	description: "Read the Campaign Seed (name, premise, tone, length and optional World details) and its version.",
	input: object({}),
	activity: "DM checks the Campaign Seed",
	run: (ctx) => view(current(ctx))
}), writeTool({
	name: "set_seed",
	description: "Set Campaign Seed fields. Pass the version from your last `seed` read; an empty string clears an optional field.",
	input: object({
		version: int(),
		...fields
	}),
	activity: "DM updates the Campaign Seed",
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
})];
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
		run: (ctx, { handle, history }) => ({
			...createWorld(ctx).open(handle, history),
			beliefs: createKnowledge(ctx).countAbout(handle)
		})
	}),
	writeTool({
		name: "establish",
		description: "Establish a new NPC, Place, Faction or Topic. Refuses a name close to an existing Entity (returning the matches) unless you list them in distinct_from. [[Name]] links in the Page and Facts resolve to handles; unresolved ones come back with near-matches. An NPC's knows seeds its Beliefs, secrets included: each item is `of` (a Fact id, handle or handle.field) or a `claim` + `about`, as in reveal.",
		input: object({
			type: _enum(ENTITY_TYPES),
			name: string().trim().min(1),
			aliases: array(string().trim().min(1)).default([]),
			fields: record(string(), unknown()).default({}),
			page: string().optional(),
			facts: array(newFact).default([]),
			distinct_from: array(handle).default([]),
			knows: array(object({
				...revealTargetFields,
				source: string().trim().min(1).optional()
			}).refine(...revealTargetRule)).default([])
		}),
		run: (ctx, { knows, ...input }) => {
			if (knows.length && input.type !== "npc") throw ToolError.invalidInput("establish", `Only an NPC knows things; a ${input.type} holds no Beliefs`);
			const established = createWorld(ctx).establish(input);
			const knowledge = createKnowledge(ctx);
			const beliefs = knows.flatMap(({ source, ...item }) => knowledge.reveal({
				...revealTarget(item),
				source,
				holders: [established.handle]
			}, "establish").beliefs.map((b) => b.id));
			const result = {
				...established,
				beliefs
			};
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
		description: "Retire a Fact (pass its subject's version) or a whole Entity (its version), with a reason. Retiring an Entity retires its current Facts and every Belief pointing at it, and returns them. Retired records stay on file but are no longer used.",
		input: object({
			fact: int().optional(),
			handle: handle.optional(),
			version: int(),
			reason: string().trim().min(1)
		}).refine((i) => i.fact === void 0 !== (i.handle === void 0), { message: "Pass either fact or handle, not both" }),
		run: (ctx, { fact, handle, version, reason }) => {
			const world = createWorld(ctx);
			const result = fact !== void 0 ? world.retireFact(fact, version, reason) : world.retireEntity(handle, version, reason);
			const retired_beliefs = fact !== void 0 ? [] : createKnowledge(ctx).retireAbout(handle, reason);
			const what = fact !== void 0 ? `Fact ${fact}` : handle;
			return {
				result: {
					...result,
					retired_beliefs
				},
				event: {
					kind: "retired",
					summary: `Retired ${what}: ${reason}`,
					data: {
						fact,
						handle: result.handle,
						reason,
						facts: result.retired_facts.map((f) => f.id),
						beliefs: retired_beliefs
					},
					dmOnly
				}
			};
		}
	}),
	writeTool({
		name: "merge",
		description: "Merge a duplicate Entity into another: moves its Facts, Beliefs, aliases (and its name, as an alias) and incoming links, appends its Page to the survivor as a new revision, and retires it. Pass both versions.",
		input: object({
			from: handle,
			into: handle,
			versions: object({
				from: int(),
				into: int()
			})
		}),
		run: (ctx, { from, into, versions }) => {
			const merged = createWorld(ctx).merge(from, into, versions);
			const beliefs = createKnowledge(ctx).move(from, into);
			return {
				result: {
					...merged,
					moved: {
						...merged.moved,
						beliefs
					}
				},
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
var gameTools = [
	...seedTools,
	...worldTools,
	...knowledgeTools,
	...narrationTools,
	...sceneTools
];
// src/lib/server/dice.ts
var MAX_COUNT = 100;
var MAX_SIDES = 1e3;
var EXPRESSION = /^(\d*)d(\d+)(?:([+-])(\d+))?$/;
/** Parses `NdM+K` (count optional, modifier optional); throws on an invalid expression. */
function parseDiceExpression(expression) {
	const match = EXPRESSION.exec(expression.replace(/\s+/g, "").toLowerCase());
	const count = match ? match[1] === "" ? 1 : Number(match[1]) : 0;
	const sides = match ? Number(match[2]) : 0;
	if (!match || count < 1 || count > MAX_COUNT || sides < 1 || sides > MAX_SIDES) throw new Error(`Invalid dice expression: ${JSON.stringify(expression)}`);
	return {
		count,
		sides,
		modifier: match[4] === void 0 ? 0 : Number(match[4]) * (match[3] === "-" ? -1 : 1)
	};
}
/** mulberry32: a small, fast, seedable generator; plenty for dice. */
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function createDice(source) {
	const random = source === void 0 ? Math.random : typeof source === "number" ? mulberry32(source) : source.random;
	const roll = (sides) => 1 + Math.floor(random() * sides);
	const rollExpression = (expression, { crit = false } = {}) => {
		const parsed = parseDiceExpression(expression);
		const count = crit ? parsed.count * 2 : parsed.count;
		const dice = Array.from({ length: count }, () => roll(parsed.sides));
		const total = dice.reduce((sum, die) => sum + die, parsed.modifier);
		return {
			expression,
			...parsed,
			dice,
			total,
			crit
		};
	};
	const rollD20 = (options) => {
		if (!options) {
			const die = roll(20);
			return {
				mode: "normal",
				dice: [die],
				kept: die
			};
		}
		const dice = [roll(20), roll(20)];
		const kept = options.mode === "advantage" ? Math.max(...dice) : Math.min(...dice);
		return {
			mode: options.mode,
			reason: options.reason,
			dice,
			kept
		};
	};
	return {
		random,
		roll,
		d20: () => roll(20),
		rollExpression,
		rollD20
	};
}
/** FNV-1a over the Campaign id, mixed with the base seed: one independent seed per Campaign. */
function campaignSeed(seed, campaignId) {
	let hash = (2166136261 ^ seed) >>> 0;
	for (let i = 0; i < campaignId.length; i++) hash = Math.imul(hash ^ campaignId.charCodeAt(i), 16777619) >>> 0;
	return hash;
}
/** With a seed, each Campaign's roller is seeded from it and the Campaign id; random otherwise. */
function createCampaignDice(seed) {
	const rollers = /* @__PURE__ */ new Map();
	return { for(campaignId) {
		let roller = rollers.get(campaignId);
		if (!roller) {
			roller = createDice(seed === void 0 ? void 0 : campaignSeed(seed, campaignId));
			rollers.set(campaignId, roller);
		}
		return roller;
	} };
}
var envSeed = process.env.DICE_SEED;
var seed = envSeed !== void 0 && envSeed !== "" && Number.isFinite(Number(envSeed)) ? Number(envSeed) : void 0;
createDice(seed);
/** The process-wide per-Campaign rollers; seeded by `DICE_SEED` when it is a number. */
var campaignDice = createCampaignDice(seed);
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
/** The Player-safe activity line for a successful call, or null for none. */
function activityLine(tool, input, result, dmOnly) {
	const { activity } = tool;
	if (activity === void 0) {
		if (!tool.mutates) return "DM checks their notes";
		return dmOnly ? null : "DM updates the game";
	}
	return typeof activity === "function" ? activity(input, result) : activity;
}
/**
* The game's tools, called by name against a Campaign folder. Every call follows the contract in
* `./contract`: validated input, `{code, message, next}` refusals, and for mutating tools one
* transaction that logs exactly one Event.
*/
function createToolHost({ library, tools, stamp = currentStamp, now = Date.now, dice = (id) => campaignDice.for(id), publish = () => {} }) {
	const byName = new Map(tools.map((t) => [t.name, t]));
	function campaignDb(folder) {
		const db = library.databaseFor(folder);
		const entry = library.entryAt(folder);
		if (!db || !entry) throw new ToolError("not_a_campaign", `${folder} is not a registered Campaign folder`, "Ask the Player to open or create the Campaign in the web UI, then run dm in its folder");
		return {
			db,
			campaignId: entry.id
		};
	}
	/** Runs one call; returns its result and whether the Player's timeline changed. */
	function run(tool, folder, args) {
		const { db, campaignId } = campaignDb(folder);
		const parsed = tool.input.safeParse(args ?? {});
		if (!parsed.success) throw ToolError.invalidInput(tool.name, prettifyError(parsed.error));
		const at = now();
		const context = {
			folder,
			campaignId,
			dice: dice(campaignId),
			now: at
		};
		if (!tool.mutates) {
			const result = tool.run({
				...context,
				db,
				stamp: {
					...stamp(db),
					eventId: null
				}
			}, parsed.data);
			const line = activityLine(tool, parsed.data, result, false);
			if (line) logActivity(db, line, { at });
			return {
				result,
				campaignId,
				changed: line !== null
			};
		}
		return db.transaction((tx) => {
			const current = stamp(tx);
			const eventId = nextEventId(tx);
			const { result, skill, event: logged } = tool.run({
				...context,
				db: tx,
				stamp: {
					...current,
					eventId
				}
			}, parsed.data);
			logEvent(tx, {
				tool: tool.name,
				...logged
			}, {
				stamp: current,
				at,
				id: eventId
			});
			const line = activityLine(tool, parsed.data, result, logged.dmOnly ?? false);
			if (line) logActivity(tx, line, {
				at,
				afterEvent: eventId
			});
			return {
				result: withSkill(result, skill),
				campaignId,
				changed: true
			};
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
				const { result, campaignId, changed } = run(tool, folder, args);
				if (changed) publish({
					type: "timeline",
					campaign: campaignId
				});
				return json$1(result);
			} catch (e) {
				if (e instanceof ToolError) return failure(e);
				throw e;
			}
		},
		/** The Campaign's Event log, oldest first. */
		events(folder) {
			return campaignDb(folder).db.select().from(event).orderBy(asc(event.id)).all().map((e) => ({
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
// src/lib/server/play/play.ts
/**
* A closed Floor as the DM hears it: one `floor` channel event, one body line per Declaration in
* send order (`[d1 Wren · player] picks the lock`). An empty body hands the DM the initiative.
* `withdrawn_call` names the open Call the Declarations withdrew.
*/
function floorEvent(closed) {
	return {
		content: closed.declarations.map((d, i) => `[d${i + 1} ${d.characterName} · ${d.player}] ${d.text}`).join("\n"),
		meta: {
			kind: "floor",
			floor_id: closed.floor,
			players: closed.players.join(","),
			...closed.withdrawnCall ? { withdrawn_call: closed.withdrawnCall } : {}
		}
	};
}
/**
* The play turn across the server: the Players' Done wakes the DM over its channel, Sessions open
* as the DM attaches, and the Player's timeline is read from the Event log.
*/
function createPlay({ library, channels, publish, dice = (id) => campaignDice.for(id) }) {
	function folderOf(campaignId) {
		const entry = library.get(campaignId);
		if (!entry) throw new CampaignNotFoundError("Campaign not found");
		return entry.path;
	}
	function answered(campaignId, result) {
		if (result) channels.send(folderOf(campaignId), callResultEvent(result));
		publish({
			type: "timeline",
			campaign: campaignId
		});
		return { complete: result !== null };
	}
	return {
		/**
		* The Player presses Done. When it closes the Floor, the DM gets exactly one floor event and
		* the Campaign awaits Narration.
		*/
		done(campaignId, player = SOLO_PLAYER) {
			const outcome = library.floor(campaignId).done(player);
			if (outcome.closed) channels.send(folderOf(campaignId), floorEvent(outcome));
			publish({
				type: "floor",
				campaign: campaignId
			});
			if (outcome.closed) publish({
				type: "timeline",
				campaign: campaignId
			});
			return outcome;
		},
		/**
		* The Player clicks one roll of the open Call; code rolls it. The roll that completes the Call
		* wakes the DM with one call_result event and sets awaiting Narration.
		*/
		roll(campaignId, callId, partId, player = SOLO_PLAYER) {
			return answered(campaignId, library.calls(campaignId).roll(callId, partId, dice(campaignId), player));
		},
		/** The Player answers a question Call; the last answer wakes the DM like a roll does. */
		answer(campaignId, callId, partId, text, player = SOLO_PLAYER) {
			return answered(campaignId, library.calls(campaignId).answer(callId, partId, text, player));
		},
		/**
		* A Player's "Cut to <Name>": one spotlight channel event to the DM. Doesn't await Narration.
		* Refused (`SpotlightRefusedError`) for a Character who is already in the Scene.
		*/
		spotlight(campaignId, character, player = SOLO_PLAYER) {
			const request = library.record(campaignId).spotlight(character, player);
			channels.send(folderOf(campaignId), request);
		},
		/** The Scene as the Player's rail shows it. */
		scene(campaignId) {
			return library.record(campaignId).scene();
		},
		/** Opens the Campaign's Session as a DM attaches; a reattaching DM keeps the open one. */
		openSession(campaignId) {
			return library.record(campaignId).openSession();
		},
		/**
		* The Stop hook asks whether the DM may end its turn. It may not while a closed Floor awaits
		* Narration; on the second attempt (`again`) it may, and the Player's timeline shows an error.
		*/
		stopCheck(campaignId, again) {
			const record = library.record(campaignId);
			if (record.timeline().awaitingSince === null) return { block: false };
			if (!again) return {
				block: true,
				reason: "A closed Floor awaits Narration. Answer it with narrate before ending your turn."
			};
			record.turnError("The DM ended its turn without a Narration.");
			publish({
				type: "timeline",
				campaign: campaignId
			});
			return { block: false };
		},
		/** The DM's core block, for SessionStart and after compaction. */
		coreBlock(campaignId) {
			return library.record(campaignId).coreBlock();
		},
		/** The Player's timeline and whether the DM is working on a turn. */
		timeline(campaignId) {
			return library.record(campaignId).timeline();
		}
	};
}
/** Opens a Campaign's Session whenever a DM attaches to it; returns the unsubscribe. */
function openSessionsOnAttach(sessions, play) {
	return sessions.onChange(({ campaign, attached }) => {
		if (attached) play.openSession(campaign);
	});
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
* A Campaign's channel events (`event: channel`) and permission verdicts (`event: permission`)
* as Server-Sent Events, until the bridge hangs up. While the stream
* is open, the bridge's session is attached to the Campaign.
*/
function eventStream(channels, folder, detach) {
	let stop = () => {};
	const body = new ReadableStream({
		start(controller) {
			const write = (text) => controller.enqueue(encoder.encode(text));
			write(": open\n\n");
			const unlisten = channels.listen(folder, (event) => write(`event: channel\ndata: ${JSON.stringify(event)}\n\n`));
			const unlistenVerdicts = channels.listenVerdicts(folder, (verdict) => write(`event: permission\ndata: ${JSON.stringify(verdict)}\n\n`));
			const keepAlive = setInterval(() => write(": ka\n\n"), 15e3);
			stop = () => {
				unlisten();
				unlistenVerdicts();
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
* - `POST stop-check` with `{campaign, again}`: whether the Stop hook refuses to end the DM's turn,
*   as `{block, reason}`.
* - `GET  core-block?campaign=<folder>`: the DM's core block, as `{text}`, for SessionStart.
* - `POST permission_request` with `{campaign, request_id, tool_name, description, input_preview}`:
*   the session's permission prompt, shown to the Player; the verdict comes back on `events`.
*/
function createBridgeApi({ library, host, channels, sessions, permissions, play, token }) {
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
			if (entry) permissions.movedOn(entry.id);
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
		if (route === "stop-check" && request.method === "POST") {
			const { campaign, again } = await request.json();
			const entry = campaign && library.entryAt(campaign);
			if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404);
			return json(play.stopCheck(entry.id, again === true));
		}
		if (route === "core-block" && request.method === "GET") {
			const campaign = url.searchParams.get("campaign");
			const entry = campaign && library.entryAt(campaign);
			if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404);
			return json({ text: play.coreBlock(entry.id) });
		}
		if (route === "permission_request" && request.method === "POST") {
			const body = await request.json();
			const { campaign, request_id, tool_name } = body;
			if (!campaign || !request_id || !tool_name) return json({ error: "campaign, request_id and tool_name are required" }, 400);
			const entry = library.entryAt(campaign);
			if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404);
			const session = request.headers.get("x-dm-session") ?? "";
			if (sessions.heldByOther(entry.id, session)) return json(SESSION_LIVE, 409);
			permissions.request(entry.id, campaign, {
				requestId: request_id,
				toolName: tool_name,
				description: body.description ?? "",
				inputPreview: body.input_preview ?? ""
			});
			return json({ ok: true });
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
// src/lib/server/bridge/permissions.ts
/**
* The permission prompts the DM's session is waiting on, one per Campaign, held in memory: they
* die with the session. The terminal's dialog stays open beside the browser's card and the first
* answer wins, but Claude Code never tells a channel server the terminal answered. So the server
* infers it, clearing the card when:
* - the session moves on: its next tool call for the Campaign;
* - a newer prompt arrives (only the newest shows);
* - the session leaves.
*/
function createPermissions({ channels, sessions, publish }) {
	const pending = /* @__PURE__ */ new Map();
	function clear(campaign) {
		if (pending.delete(campaign)) publish({
			type: "permission",
			campaign
		});
	}
	sessions.onChange(({ campaign, attached }) => {
		if (!attached) clear(campaign);
	});
	return {
		/** The session raised a prompt: the Player's console shows it, replacing any older one. */
		request(campaign, folder, request) {
			pending.set(campaign, {
				folder,
				request
			});
			publish({
				type: "permission",
				campaign
			});
		},
		/** The prompt the Campaign's session is waiting on, or null. */
		pending(campaign) {
			return pending.get(campaign)?.request ?? null;
		},
		/**
		* The Player answers in the browser: the verdict goes to the session and the card clears.
		* False when the prompt is no longer waiting (answered in the terminal, or replaced).
		*/
		answer(campaign, requestId, behavior) {
			const held = pending.get(campaign);
			if (!held || held.request.requestId !== requestId) return false;
			channels.sendVerdict(held.folder, {
				request_id: requestId,
				behavior
			});
			clear(campaign);
			return true;
		},
		/** The session moved on (it called a tool), so any prompt was answered in the terminal. */
		movedOn(campaign) {
			clear(campaign);
		}
	};
}
// src/lib/server/bridge/index.ts
/** A fresh token each server start; only processes that can read the runtime file know it. */
var token = randomBytes(24).toString("hex");
/** The game's tools, over the server's Campaign library. */
var host = createToolHost({
	library,
	tools: gameTools,
	publish: live.publish
});
/** Channel events for the DM, per Campaign folder. */
var channels = createDmChannels(library);
/** The play turn: Done wakes the DM, and a DM attaching opens a Session. */
var play = createPlay({
	library,
	channels,
	publish: live.publish
});
openSessionsOnAttach(sessions, play);
/** The permission prompts the DM's sessions are waiting on, relayed to the Player. */
var permissions = createPermissions({
	channels,
	sessions,
	publish: live.publish
});
var bridgeApi = createBridgeApi({
	library,
	host,
	channels,
	sessions,
	permissions,
	play,
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
export { permissions as a, host as i, bridgeApi as n, play as o, channels as r, port as s, announceServer as t };

//# sourceMappingURL=bridge.js.map