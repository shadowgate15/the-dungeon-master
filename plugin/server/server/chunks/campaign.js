import { At as desc, Bt as is, C as entity, Et as CUSTOM_BACKGROUND_FEATURE_MAX, Ft as isNull, Ht as DUNGEON_MASTER_CAMPAIGNS, K as classTable, M as alignment, Mt as eq, N as background, Nt as inArray, Ot as SOLO_PLAYER, Rt as sql, S as session, Tt as BACKSTORY_MAX, Ut as DUNGEON_MASTER_HOME, Y as equipment, _ as characterSpell, _t as subclass, a as seedRulesData, b as floor, c as openDatabase, ct as race, d as character, f as characterChoice, g as characterSkill, h as characterItem, ht as spell, i as userStateDir, j as abilityScoreMethod, jt as and, kt as asc, l as activityLine, m as characterEquipment, mt as skill, n as canonicalFolder, o as loadRulesDataset, p as characterDraft, r as defaultCampaignRoot, s as migrateDatabase, t as campaignDatabasePath, u as campaign, v as declaration, vt as subrace, wt as ABILITY_METHODS, x as returnedDraft, y as event, zt as Column } from "./paths.js";
import { D as equipmentGroupKeys, M as resolveFeatures, O as equipmentGroups, a as WIZARD_RULES_KEYS, c as resolverDraft, d as STEPS, o as emptyDraft, r as deriveStats, t as tryDraftToCharacterInput } from "./save.js";
import { s as ABILITY_KEYS } from "./schema.js";
import { o as parseCampaignSeed, r as campaignSeedCard } from "./seed.js";
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
			return characters.update(id, input(draft));
		}
	};
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
/**
* Every Character with its handle, in the order they joined the Party. A handle is `char:` and the
* name's slug, numbered (`char:wren-2`) when two Characters share a name. Characters are not
* Entities, but Facts, Beliefs and tools link to them by handle.
*/
function characterRefs(db) {
	const rows = db.select().from(character).orderBy(sql`rowid`).all();
	const taken = /* @__PURE__ */ new Set();
	return rows.map((row) => {
		const base = `char:${slug(row.name)}`;
		let handle = base;
		for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`;
		taken.add(handle);
		return {
			handle,
			row
		};
	});
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
	const placeName = (handle) => handle === null ? null : db.select({ name: entity.name }).from(entity).where(eq(entity.handle, handle)).get()?.name ?? null;
	return {
		clock: {
			minute,
			...clockParts(minute)
		},
		place: place && { name: place.name },
		present: characters.map((c) => ({
			id: c.row.id,
			name: c.row.name
		})),
		elsewhere: elsewhere.map((c) => ({
			id: c.row.id,
			name: c.row.name,
			whereabouts: placeName(c.row.whereabouts)
		}))
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
// src/lib/server/play/log.ts
/**
* The Campaign's current stamp: the open Session (null offline) and the Campaign clock's minute.
*/
function currentStamp(db) {
	return {
		sessionId: db.select({ id: session.id }).from(session).where(isNull(session.closedAt)).get()?.id ?? null,
		minute: currentMinute(db)
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
var SHOWN = /* @__PURE__ */ new Set(["declaration", "narration"]);
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
		awaitingSince: awaitingNarrationSince(db)
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
	function current(player = SOLO_PLAYER) {
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
		send({ character: characterId, text, player = SOLO_PLAYER }) {
			const clean = cleanText(text);
			return db.transaction(() => {
				const actor = db.select().from(character).where(eq(character.id, characterId)).get();
				if (!actor) throw new DeclarationRefusedError("Character not found");
				if (!canAct(actor)) throw new DeclarationRefusedError(`${actor.name} can't act`);
				if (!inScene(scenePlace(db), actor)) throw new DeclarationRefusedError(`${actor.name} is not in the Scene`);
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
		* transaction: its Declarations are logged (stamped with the Session) in send order and the
		* Campaign awaits Narration. An empty Floor closes too, handing the DM the initiative. Refused
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
				setAwaitingNarration(db, at);
				return {
					closed: true,
					floor: floorId,
					players: done,
					declarations
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
			const saved = update(id, {
				...parseCampaignSeed(card),
				version: found.version + 1
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
		/** The Campaign's record of play: the Player's timeline and its Sessions. */
		record(id) {
			const db = database(find(id).folder);
			return {
				timeline: () => timeline(db),
				openSession: () => openSession(db, now()),
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
export { formatClock as A, characterRefs as C, isNearName as D, scenePlace as E, CharacterNotFoundError as F, CharacterValidationError as I, SESSION_LIVE_MESSAGE as L, canAct as M, DraftNotFoundError as N, normalizeName as O, loadWizardRules as P, advanceClock as S, present as T, logEvent as _, CampaignArchivedError as a, ClockBackwardsError as b, CampaignNotFoundError as c, DeclarationNotFoundError as d, DeclarationRefusedError as f, logActivity as g, currentStamp as h, sessions as i, parseClock as j, slug as k, NotACampaignFolderError as l, returnStrandedDrafts as m, library as n, CampaignExistsError as o, DmBusyError as p, live as r, CampaignMissingError as s, campaignRoot as t, SessionLiveError as u, nextEventId as v, currentMinute as w, SpotlightRefusedError as x, setAwaitingNarration as y };

//# sourceMappingURL=campaign.js.map