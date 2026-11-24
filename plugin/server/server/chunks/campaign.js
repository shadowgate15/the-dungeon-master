import { $ as equipment, At as CUSTOM_BACKGROUND_FEATURE_MAX, Bt as isNull, C as event, D as entity, E as belief, F as abilityScoreMethod, Ft as and, Gt as is, I as alignment, It as eq, Jt as DUNGEON_MASTER_HOME, L as background, Lt as gt, Mt as SOLO_PLAYER, Nt as asc, Ot as ABILITY_METHODS, Pt as desc, Rt as inArray, S as declaration, St as subrace, T as session, Ut as sql, Wt as Column, X as classTable, _ as characterDraft, a as userStateDir, b as characterSkill, c as abilities_default, d as activityLine, f as call, ft as race, g as characterChoice, h as character, i as defaultCampaignRoot, kt as BACKSTORY_MAX, l as migrateDatabase, m as campaign, n as campaignDatabasePath, o as loadRulesDataset, p as callPart, qt as DUNGEON_MASTER_CAMPAIGNS, r as canonicalFolder, s as skills_default, t as seedRulesData, u as openDatabase, v as characterEquipment, vt as skill, w as floor, x as characterSpell, xt as subclass, y as characterItem, yt as spell, zt as isNotNull } from "./seed.js";
import { A as equipmentGroupKeys, P as resolveFeatures, c as WIZARD_RULES_KEYS, d as resolverDraft, i as tryDraftToCharacterInput, j as equipmentGroups, l as emptyDraft, m as STEPS, n as detailToSummaryData, o as deriveStats, t as buildSummary } from "./summary.js";
import { c as literal, m as union, p as string, r as array, t as _enum, u as object } from "./schemas.js";
import { s as ABILITY_KEYS } from "./schema.js";
import { o as parseCampaignSeed, r as campaignSeedCard } from "./seed2.js";
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
					attached: true
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
				attached: false
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
// node_modules/.pnpm/drizzle-orm@0.45.4_@types+better-sqlite3@9.6.0_better-sqlite3@13.0.3/node_modules/drizzle-orm/sql/functions/aggregate.js
function max(expression) {
	return sql`max(${expression})`.mapWith(is(expression, Column) ? expression : String);
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
// src/lib/server/world/names.ts
/** Names: handle slugs and the near-duplicate test `establish` and link near-matches use. */
var plain$1 = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** The slug part of a handle: `Mira Voss` → `mira-voss`. */
function slug$1(name) {
	return plain$1(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unnamed";
}
/** A name reduced for comparison: lower case, letters and digits only, no leading "the". */
function normalizeName(name) {
	return plain$1(name).replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");
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
// src/lib/character/acting.ts
/**
* Whether a Character can act: put a Declaration on the Floor or be picked as the acting
* Character. Dead and departed Characters can't. The one rule the sheet tabs, the composer and the
* server all use; presence in the Scene (#328) and Unconscious (#332) join it later.
*/
function canAct(character) {
	return character.status === "alive";
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
// src/lib/server/play/sheets.ts
var signed = (n) => n >= 0 ? `+${n}` : `${n}`;
function toPlaySheet(c) {
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
		ac: stats.unarmoredAc.status === "ok" ? {
			value: stats.unarmoredAc.value.value,
			note: "unarmored"
		} : null,
		conditions: c.conditions,
		concentration: c.concentration,
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
			quantity: i.quantity
		}))
	};
}
/** The play sheet of every saved Character in the Party, oldest first. */
function playSheets(party) {
	return party.list().flatMap((m) => m.kind === "character" ? [toPlaySheet(party.character(m.id).character)] : []);
}
// src/lib/server/play/core-block.ts
/** A Character's handle, from its name. */
var characterHandle = (name) => `char:${slug$1(name)}`;
/** The Scene: its Place and the in-fiction time. No Scene exists until the clock and Scene do. */
function scenePart() {
	return "Scene: none set yet.";
}
/** The Party: name, handle, HP/max, conditions, status and whereabouts per Character. */
function partyPart({ party }) {
	const status = new Map(party.list().flatMap((m) => m.kind === "character" ? [[m.id, m.status]] : []));
	const sheets = playSheets(party);
	if (sheets.length === 0) return "Party: no Characters yet.";
	return ["Party:", ...sheets.map((c) => {
		const hp = `HP ${c.hp.current}/${c.hp.max ?? "?"}${c.hp.temp ? ` (+${c.hp.temp} temp)` : ""}`;
		const conditions = c.conditions.length ? c.conditions.join(", ") : "none";
		return `- ${c.name} (${characterHandle(c.name)}): ${hp}, conditions ${conditions}, ${status.get(c.id)}, whereabouts ${c.whereabouts ?? "unknown"}`;
	})].join("\n");
}
/** The NPCs at the Scene's Place. Presence needs a Scene, so none are present yet. */
function npcsPart() {
	return "NPCs present: none.";
}
/** When lint last ran. */
function lintPart() {
	return "Lint last ran: never.";
}
/** The whole core block. */
function coreBlock(source) {
	return [
		"# Core block",
		scenePart(),
		partyPart(source),
		npcsPart(),
		lintPart()
	].join("\n");
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
				quantity: characterItem.quantity
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
/** What a Check part rolls, as the Player reads it. */
function labelOf(part) {
	if (part.skill) return `${SKILL_NAMES.get(part.skill) ?? part.skill} check`;
	if (part.save) return `${ABILITY_NAMES.get(part.save) ?? part.save} save`;
	return null;
}
/**
* Opens a Call in the Narration's transaction. A Call ends the turn; only one is open at a time.
* Returns its id.
*/
function openCall(db, input, { at, openedBy }) {
	if (typeof input === "string") throw new ToolError("unknown_call", `No pending Call has the id ${input}`, "Attach a pending Call id an action tool returned, or pass the Call inline");
	if (openCallRow(db)) throw new ToolError("call_open", "A Call is already open, waiting on the Players", "Wait for its call_result, or narrate without a call");
	const id = db.insert(call).values({
		campaignId: db.select({ id: campaign.id }).from(campaign).get().id,
		kind: Array.isArray(input) ? "check" : input.kind,
		text: !Array.isArray(input) && input.kind === "question" ? input.text : null,
		choices: !Array.isArray(input) && input.kind === "question" ? input.choices ?? [] : [],
		openedBy,
		createdAt: at
	}).returning({ id: call.id }).get().id;
	(!Array.isArray(input) && input.kind === "question" ? playersAtTable(db).map((player) => ({ player })) : (Array.isArray(input) ? input : [input]).flatMap((check) => [check.character].flat().map((ref) => {
		const who = findCharacter(db, ref);
		return {
			characterId: who.id,
			player: who.controllingPlayer,
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
/** The Players at the table: everyone with a Character who can act (solo play: one). */
function playersAtTable(db) {
	const players = new Set(db.select().from(character).all().filter(canAct).map((c) => c.controllingPlayer));
	return players.size ? [...players] : [SOLO_PLAYER];
}
/** The open Call, Player-safe (no DC, no tier), or null when none is open. */
function openCallView(db) {
	const open = openCallRow(db);
	if (!open) return null;
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
			label: labelOf(part),
			reason: part.reason,
			mode: part.mode,
			answered: part.answeredAt !== null
		}))
	};
}
/** A closed Floor with Declarations on it withdraws the open Call; returns its id, if any. */
function withdrawOpenCall(db, at) {
	return db.update(call).set({
		state: "withdrawn",
		closedAt: at
	}).where(eq(call.state, "open")).returning({ id: call.id }).get()?.id ?? null;
}
/** The Call or part isn't open (answered, withdrawn or unknown). */
var CallClosedError = class extends Error {};
/** The part is addressed to another Player, or the answer doesn't fit it. */
var CallRefusedError = class extends Error {};
/** The DM's view of one answered part: who, what, the dice, the DC and the outcome. */
function resultLine(p) {
	if (p.result === null) return `[${p.player}] ${p.answer}`;
	const r = p.result;
	const dice = r.dice.length > 1 ? `${r.dice.join("/")} (${p.mode}) kept ${r.kept}` : `${r.kept}`;
	const modifier = r.modifier >= 0 ? `+ ${r.modifier}` : `- ${-r.modifier}`;
	return `[${p.characterName} · ${p.player}] ${labelOf(p)}: d20 ${dice} ${modifier} = ${r.total} vs DC ${p.dc} (${p.tier}) → ${r.success ? "success" : "failure"}`;
}
/** The `call_result` channel event: one body line per part, in order. */
function callResultEvent(result) {
	return {
		content: result.parts.map(resultLine).join("\n"),
		meta: {
			kind: "call_result",
			call_id: result.call,
			players: result.players.join(",")
		}
	};
}
/**
* A Campaign's Calls as the Players answer them: each click rolls (or answers) one part in code
* and logs it; the part that completes the Call sets awaiting Narration and returns the result.
*/
function createCalls(db, now = Date.now) {
	function modifierFor(characterId, part) {
		const detail = createCharacterService(db, now).get(characterId);
		if (!detail) return 0;
		const { stats } = buildSummary(loadWizardRules(), {
			...detailToSummaryData(detail),
			equipment: detail.inventory
		});
		const stat = part.skill ? stats.skills[part.skill] : stats.savingThrows[part.save];
		return stat?.status === "ok" ? stat.value.modifier : 0;
	}
	function answer(callId, partId, player, resolve) {
		return db.transaction(() => {
			const at = now();
			const part = db.select().from(call).where(and(eq(call.id, callId), eq(call.state, "open"))).get() && db.select().from(callPart).where(and(eq(callPart.id, partId), eq(callPart.callId, callId), isNull(callPart.answeredAt))).get();
			if (!part) throw new CallClosedError("That Call is no longer open");
			if (part.player !== player) throw new CallRefusedError("That roll is not yours");
			const { values, event } = resolve(part);
			db.update(callPart).set({
				...values,
				answeredAt: at
			}).where(eq(callPart.id, partId)).run();
			logEvent(db, {
				tool: "call",
				...event,
				data: {
					call: callId,
					...event.data
				}
			}, { at });
			const parts = db.select({
				part: callPart,
				characterName: character.name
			}).from(callPart).leftJoin(character, eq(character.id, callPart.characterId)).where(eq(callPart.callId, callId)).orderBy(asc(callPart.position)).all().map(({ part, characterName }) => ({
				...part,
				characterName
			}));
			if (parts.some((p) => p.answeredAt === null)) return null;
			db.update(call).set({
				state: "answered",
				closedAt: at
			}).where(eq(call.id, callId)).run();
			const result = {
				call: callId,
				players: [...new Set(parts.map((p) => p.player))],
				parts
			};
			logEvent(db, {
				tool: "call",
				kind: "call_result",
				summary: callResultEvent(result).content,
				data: { call: callId },
				dmOnly: true
			}, { at });
			setAwaitingNarration(db, at);
			return result;
		});
	}
	return {
		/** The open Call, Player-safe. */
		open: () => openCallView(db),
		/**
		* Rolls one Check part in code for its Controlling Player; returns the Call's result when this
		* roll completes it, null otherwise.
		*/
		roll(callId, partId, dice, player = SOLO_PLAYER) {
			return answer(callId, partId, player, (part) => {
				if (!part.characterId) throw new CallRefusedError("That part is a question: answer it");
				const modifier = modifierFor(part.characterId, part);
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
				const name = db.select({ name: character.name }).from(character).where(eq(character.id, part.characterId)).get()?.name ?? "";
				const what = labelOf(part) ?? "";
				return {
					values: { result },
					event: {
						kind: "roll",
						summary: `${name} ${what}: ${total} (${result.success ? "success" : "failure"})`,
						data: {
							part: partId,
							characterName: name,
							player,
							what,
							mode: part.mode,
							reason: part.reason,
							...result
						}
					}
				};
			});
		},
		/** Answers a question part; with choices, the answer must be one of them. */
		answer(callId, partId, text, player = SOLO_PLAYER) {
			const clean = text.trim();
			return answer(callId, partId, player, (part) => {
				if (part.characterId) throw new CallRefusedError("That part is a Check: roll it");
				const { choices, text: question } = db.select().from(call).where(eq(call.id, callId)).get();
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
			});
		}
	};
}
// src/lib/server/play/log.ts
/**
* The Campaign's current stamp: the open Session (null offline) and the in-fiction minute (0 until
* the clock exists).
*/
function currentStamp(db) {
	return {
		sessionId: db.select({ id: session.id }).from(session).where(isNull(session.closedAt)).get()?.id ?? null,
		minute: 0
	};
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
		createdAt: at
	}).run();
}
/** The open Session, opened now (numbered after the last) if none is. */
function openSession(db, at) {
	const open = db.select({
		id: session.id,
		number: session.number
	}).from(session).where(isNull(session.closedAt)).get();
	if (open) return open;
	const last = db.select({ number: session.number }).from(session).orderBy(desc(session.number)).get();
	return db.insert(session).values({
		number: (last?.number ?? 0) + 1,
		startedAt: at
	}).returning({
		id: session.id,
		number: session.number
	}).get();
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
	"answer"
]);
/** One logged Event as a timeline entry, or null for one the timeline does not show. */
function entryFor(e) {
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
	if (e.kind === "roll") {
		const mode = data.mode === "advantage" || data.mode === "disadvantage" ? data.mode : "normal";
		return {
			type: "roll",
			id,
			character: String(data.characterName),
			what: String(data.what),
			dice: data.dice.map(Number),
			modifier: Number(data.modifier),
			total: Number(data.total),
			outcome: data.success ? "success" : "failure",
			mode,
			reason: mode === "normal" ? null : String(data.reason ?? "")
		};
	}
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
		voice: typeof data.voiceName === "string" ? data.voiceName : null
	};
}
/**
* The Player's timeline: Declarations and Narrations from the Event log (never DM-only Events),
* with each DM activity line after the Event it follows, plus the awaiting Narration flag. Every
* entry is built here from Player-safe fields; nothing raw passes through.
*/
function timeline(db) {
	const lines = db.select().from(activityLine).orderBy(asc(activityLine.id)).all();
	const entries = [];
	let next = 0;
	const flushUntil = (eventId) => {
		while (next < lines.length && lines[next].afterEvent < eventId) {
			const line = lines[next++];
			entries.push({
				type: "activity",
				id: `a${line.id}`,
				text: line.text
			});
		}
	};
	for (const e of db.select().from(event).orderBy(asc(event.id)).all()) {
		flushUntil(e.id);
		const entry = entryFor(e);
		if (entry) entries.push(entry);
	}
	flushUntil(Infinity);
	return {
		entries,
		awaitingSince: awaitingNarrationSince(db),
		call: openCallView(db)
	};
}
// src/lib/server/play/notices.ts
var TOOL = "player";
var KIND = "change";
/** Logs a change the Player made outside the DM (a UI edit), so the DM hears of it next. */
function logChange(db, change, { at }) {
	logEvent(db, {
		tool: TOOL,
		kind: KIND,
		summary: change.summary,
		data: {
			handle: change.handle,
			version: change.version
		}
	}, { at });
}
/**
* The changes the DM has not heard about yet, marking them heard: each Player edit logged in the
* open Session since the last channel event. Offline edits belong to no Session; they reach the DM
* at the next sitting's opening instead.
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
		const latest = new Map(changes.map((c) => [c.handle, c]));
		const parts = ["Changed outside the DM:", ...[...latest.values()].map((c) => `- ${c.handle} v${c.version}: ${c.summary}`)];
		if ([...latest.keys()].some((h) => h.startsWith("char:"))) parts.push("", partyPart({ party: library.party(entry.id) }));
		const notice = parts.join("\n");
		return {
			...sent,
			content: sent.content ? `${sent.content}\n\n${notice}` : notice
		};
	} });
}
// src/lib/server/character/party.ts
/** The Campaign has no draft with this id. */
var DraftNotFoundError = class extends Error {};
var stepLabel = (step) => STEPS.find((s) => s.id === step)?.label ?? step;
/**
* A Campaign's Characters and Character drafts, over its database. Drafts are stored with the
* Campaign so a reload loses nothing (and the DM's tools can write into them later); a draft joins
* the Party only when it is saved, which needs every wizard step to be valid.
*/
function createParty(db, now = Date.now) {
	const rules = loadWizardRules();
	const characters = createCharacterService(db, now);
	function row(id) {
		const found = db.select().from(characterDraft).where(eq(characterDraft.id, id)).get();
		if (!found) throw new DraftNotFoundError("Character draft not found");
		return found;
	}
	function write(id, { draft, step }) {
		row(id);
		db.update(characterDraft).set({
			data: draft,
			step,
			updatedAt: now()
		}).where(eq(characterDraft.id, id)).run();
	}
	/** Logs a Player edit to a Character, so the DM hears of it on the next channel event. */
	function noteChange(id, summary) {
		const row = db.select().from(character).where(eq(character.id, id)).get();
		logChange(db, {
			handle: characterHandle(row.name),
			version: row.version,
			summary
		}, { at: now() });
	}
	/** The draft as the service's input; refused while any step is not valid. */
	function input(draft) {
		const mapped = tryDraftToCharacterInput(rules, draft);
		if (!mapped) throw new CharacterValidationError("Finish every step before saving");
		return mapped;
	}
	return {
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
				step: found.step
			};
		},
		/** Replaces the stored draft. Incomplete is fine: a draft is unsaved by definition. */
		writeDraft(id, value) {
			write(id, value);
		},
		discardDraft(id) {
			if (!db.delete(characterDraft).where(eq(characterDraft.id, id)).returning().get()) throw new DraftNotFoundError("Character draft not found");
		},
		/**
		* Writes the draft, then saves it into the Party and removes it, in one transaction. Refused,
		* keeping the draft, unless every step is valid.
		*/
		saveDraft(id, value) {
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
		/** Replaces a saved Character's choices from the edit wizard's draft. */
		updateCharacter(id, draft) {
			return db.transaction(() => {
				const updated = characters.update(id, input(draft));
				db.update(character).set({ version: sql`${character.version} + 1` }).where(eq(character.id, id)).run();
				noteChange(id, `the Player edited ${updated.name}`);
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
	/** The Players at the table: everyone with a Character who can act. */
	function playersAtTable() {
		const actors = db.select().from(character).all().filter(canAct);
		return [...new Set(actors.map((c) => c.controllingPlayer))];
	}
	function cleanText(text) {
		const trimmed = typeof text === "string" ? text.trim() : "";
		if (!trimmed) throw new DeclarationRefusedError("Say what the Character does");
		if (trimmed.length > 2e3) throw new DeclarationRefusedError(`Keep a Declaration under ${DECLARATION_MAX} characters`);
		return trimmed;
	}
	function pending(id) {
		const floorId = openFloorId();
		if (!(floorId && db.select({ id: declaration.id }).from(declaration).where(and(eq(declaration.id, id), eq(declaration.floorId, floorId))).get())) throw new DeclarationNotFoundError("Declaration not found on the open Floor");
	}
	/** The open Floor (empty until something is sent). */
	function current() {
		const floorId = openFloorId();
		if (!floorId) return { declarations: [] };
		return { declarations: db.select({
			id: declaration.id,
			character: declaration.characterId,
			characterName: character.name,
			player: declaration.player,
			text: declaration.text
		}).from(declaration).innerJoin(character, eq(character.id, declaration.characterId)).where(eq(declaration.floorId, floorId)).orderBy(asc(declaration.position)).all() };
	}
	return {
		/** The open Floor (empty until something is sent). */
		current,
		/**
		* Puts a Declaration for one Character on the open Floor, opening it if none is. Refused for a
		* Character who can't act or whom `player` doesn't control.
		*/
		send({ character: characterId, text, player = SOLO_PLAYER }) {
			const clean = cleanText(text);
			return db.transaction(() => {
				const actor = db.select().from(character).where(eq(character.id, characterId)).get();
				if (!actor) throw new DeclarationRefusedError("Character not found");
				if (!canAct(actor)) throw new DeclarationRefusedError(`${actor.name} can't act`);
				if (actor.controllingPlayer !== player) throw new DeclarationRefusedError(`${actor.name} is not your Character`);
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
		* The Player presses Done. Once every Player at the table has, the Floor closes in one
		* transaction: its Declarations are logged (stamped with the Session) in send order, they
		* withdraw any open Call, and the Campaign awaits Narration. An empty Floor closes too, handing the DM the initiative. Refused
		* while the DM is still answering the last Floor.
		*/
		done(player = SOLO_PLAYER) {
			return db.transaction(() => {
				if (awaitingNarrationSince(db) !== null) throw new DmBusyError("The DM is still answering the last turn");
				const at = now();
				const floorId = openFloor(at);
				const row = db.select().from(floor).where(eq(floor.id, floorId)).get();
				const done = row.done.includes(player) ? row.done : [...row.done, player];
				if (!playersAtTable().every((p) => done.includes(p))) {
					db.update(floor).set({ done }).where(eq(floor.id, floorId)).run();
					return { closed: false };
				}
				const declarations = current().declarations;
				db.update(floor).set({
					done,
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
// src/lib/server/knowledge/holders.ts
/**
* Every Character in the Campaign with its readable handle, `char:` plus its name's slug. Two
* Characters with the same slug are told apart by creation order (`char:wren-2`).
*/
function characterHolders(db) {
	const taken = /* @__PURE__ */ new Set();
	return db.select({
		id: character.id,
		name: character.name,
		player: character.controllingPlayer
	}).from(character).orderBy(asc(character.createdAt), asc(character.id)).all().map((c) => {
		const base = `char:${slug$1(c.name) || "character"}`;
		let handle = base;
		for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`;
		taken.add(handle);
		return {
			...c,
			handle
		};
	});
}
/**
* The Characters present in the Scene. There is no Scene yet (#328 adds it and presence from
* whereabouts), so until then every Character in the Party is present.
*/
function charactersInScene(db) {
	return characterHolders(db);
}
// src/lib/server/knowledge/journal.ts
/** Shows `[[Name]]` links as plain names for the Player. */
var plain = (text) => text.replace(/\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]/g, "$1");
/**
* The Player's Journal: their Characters' current Beliefs as each was learned, one entry per
* thing believed with every Character who holds it. Built from the Knowledge layer only, never
* from the World layer or an NPC's Beliefs, and with the truth stripped (ADR 0007).
*/
function journal(db, player) {
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
function createCampaignLibrary({ home, live = () => false, now = Date.now }) {
	const registry = createRegistry(home);
	const open = /* @__PURE__ */ new Map();
	/** The folder's Campaign database, opened (migrated and Rules Data seeded) once per server. */
	function database(folder) {
		let db = open.get(folder);
		if (!db) {
			db = openDatabase(campaignDatabasePath(folder));
			migrateDatabase(db);
			seedRulesData(db);
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
			const at = now();
			const created = database(folder).insert(campaign).values({
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
		* another path (it was moved) replaces that entry, so a Missing Campaign comes back.
		*/
		register(input) {
			const folder = path.resolve(input);
			const found = readCampaign(folder);
			if (!found) throw new NotACampaignFolderError(`No Campaign in ${folder}`);
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
		/** Saves the whole Seed; an incomplete one is fine, an invalid one is refused. */
		saveSeed(id, card) {
			const { folder, found } = find(id);
			if (found.archivedAt !== null) throw new CampaignArchivedError("An archived Campaign cannot be changed");
			const saved = database(folder).transaction((tx) => {
				const row = update(id, {
					...parseCampaignSeed(card),
					version: found.version + 1
				});
				logChange(tx, {
					handle: "campaign",
					version: row.version,
					summary: "the Player edited the Campaign Seed"
				}, { at: now() });
				return row;
			});
			registry.put({
				id,
				path: folder,
				name: saved.name
			});
			return saved;
		},
		/** The Campaign's Characters and Character drafts. */
		party(id) {
			return createParty(database(find(id).folder), now);
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
				timeline: () => timeline(db),
				journal: () => journal(db),
				openSession: () => openSession(db, now()),
				/** The DM's core block. */
				coreBlock: () => coreBlock({ party: createParty(db, now) }),
				/** Logs a turn that went wrong, as the Player sees it in the timeline. */
				turnError: (text) => logEvent(db, {
					tool: "stop",
					kind: "turn_error",
					summary: text,
					data: { text }
				}, { at: now() })
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
export { expectVersion as A, SESSION_LIVE_MESSAGE as B, CallClosedError as C, openCall as D, callResultEvent as E, playSheets as F, loadWizardRules as I, isNearName as L, writeTool as M, CharacterNotFoundError as N, PLUGIN_NAME as O, CharacterValidationError as P, normalizeName as R, setAwaitingNarration as S, callInput as T, createDmChannels as _, CampaignArchivedError as a, logEvent as b, CampaignNotFoundError as c, characterHolders as d, charactersInScene as f, DraftNotFoundError as g, DmBusyError as h, sessions as i, readTool as j, ToolError as k, NotACampaignFolderError as l, DeclarationRefusedError as m, library as n, CampaignExistsError as o, DeclarationNotFoundError as p, live as r, CampaignMissingError as s, campaignRoot as t, SessionLiveError as u, currentStamp as v, CallRefusedError as w, nextEventId as x, logActivity as y, slug$1 as z };

//# sourceMappingURL=campaign.js.map