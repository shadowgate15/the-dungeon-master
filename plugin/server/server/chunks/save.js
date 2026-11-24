import { c as acBonus, d as weaponAttackBonus, f as weaponDamageBonus, l as bestUnarmoredAc, o as slug, s as ABILITY_KEYS, u as hpBonus } from "./schema.js";
import { a as discriminatedUnion, c as literal$1, d as record, f as strictObject, l as number, p as string, r as array, t as _enum } from "./schemas.js";
// src/lib/rules/overlay.ts
/**
* The hand-written overlay (#96): choice groups and fixed grants the upstream dataset leaves as
* prose or buries in free-form JSON. Every entry cites the SRD 5.1 page it comes from. It is
* committed code, validated by zod when this module loads, and the resolver merges it with the
* choice groups carried by the Rules Data. Pure: no database or server imports.
*
* A group's full key is `${ownerType}/${ownerSlug}/${key}`, the stable handle stored as
* `character_choice.choice_key`.
*/
var OVERLAY_OWNER_TYPES = [
	"class",
	"race",
	"trait",
	"subclass",
	"background"
];
var overlayOption = strictObject({
	slug,
	name: string(),
	/** Extra facts about the option, for the resolver and derived stats (dragon damage type). */
	data: record(string(), string()).optional()
});
/** Where a group's options come from. Computed sources are resolved against the Rules Data. */
var overlayOptions = discriminatedUnion("from", [
	strictObject({
		from: literal$1("literal"),
		options: array(overlayOption).min(1)
	}),
	strictObject({ from: literal$1("subclasses") }),
	strictObject({ from: literal$1("races") }),
	strictObject({ from: literal$1("standardLanguages") }),
	strictObject({ from: literal$1("wizardCantrips") }),
	strictObject({ from: literal$1("expertise") }),
	strictObject({ from: literal$1("skills") }),
	strictObject({ from: literal$1("toolsAndLanguages") })
]);
var overlayGroup = strictObject({
	ownerType: _enum(OVERLAY_OWNER_TYPES),
	ownerSlug: slug,
	key: string().regex(/^[a-zA-Z]+-\d+$/),
	kind: _enum([
		"skill",
		"toolOrLanguage",
		"feature",
		"creatureType",
		"terrain",
		"dragonType",
		"race",
		"language",
		"spell",
		"expertise",
		"subclass"
	]),
	choose: number().int().positive(),
	description: string(),
	/** SRD 5.1 page citation. */
	source: string().regex(/^SRD p\.\d+(-\d+)?$/),
	options: overlayOptions,
	/** The group only exists while another group has this option picked. */
	requires: strictObject({
		group: string(),
		option: slug
	}).optional()
});
/** Fixed grants the dataset does not encode as data. */
var overlayGrant = strictObject({
	ownerType: _enum(OVERLAY_OWNER_TYPES),
	ownerSlug: slug,
	source: string().regex(/^SRD p\.\d+(-\d+)?$/),
	proficiencies: array(slug).default([]),
	languages: array(slug).default([]),
	/** Damage type slugs. */
	resistances: array(slug).default([]),
	/** Spell slugs the Character always has. */
	spells: array(slug).default([])
});
var dragonOptions = [
	{
		slug: "black",
		name: "Black",
		damageType: "acid",
		breath: "line 5 by 30 ft",
		save: "dex"
	},
	{
		slug: "blue",
		name: "Blue",
		damageType: "lightning",
		breath: "line 5 by 30 ft",
		save: "dex"
	},
	{
		slug: "brass",
		name: "Brass",
		damageType: "fire",
		breath: "line 5 by 30 ft",
		save: "dex"
	},
	{
		slug: "bronze",
		name: "Bronze",
		damageType: "lightning",
		breath: "line 5 by 30 ft",
		save: "dex"
	},
	{
		slug: "copper",
		name: "Copper",
		damageType: "acid",
		breath: "line 5 by 30 ft",
		save: "dex"
	},
	{
		slug: "gold",
		name: "Gold",
		damageType: "fire",
		breath: "cone 15 ft",
		save: "dex"
	},
	{
		slug: "green",
		name: "Green",
		damageType: "poison",
		breath: "cone 15 ft",
		save: "con"
	},
	{
		slug: "red",
		name: "Red",
		damageType: "fire",
		breath: "cone 15 ft",
		save: "dex"
	},
	{
		slug: "silver",
		name: "Silver",
		damageType: "cold",
		breath: "cone 15 ft",
		save: "con"
	},
	{
		slug: "white",
		name: "White",
		damageType: "cold",
		breath: "cone 15 ft",
		save: "con"
	}
].map((d) => ({
	slug: d.slug,
	name: d.name,
	data: {
		damageType: d.damageType,
		breath: d.breath,
		save: d.save
	}
}));
var literal = (options) => ({
	from: "literal",
	options
});
var rawGroups = [
	{
		ownerType: "class",
		ownerSlug: "cleric",
		key: "subclass-0",
		kind: "subclass",
		choose: 1,
		description: "Divine Domain",
		source: "SRD p.15",
		options: { from: "subclasses" }
	},
	{
		ownerType: "class",
		ownerSlug: "sorcerer",
		key: "subclass-0",
		kind: "subclass",
		choose: 1,
		description: "Sorcerous Origin",
		source: "SRD p.42",
		options: { from: "subclasses" }
	},
	{
		ownerType: "class",
		ownerSlug: "warlock",
		key: "subclass-0",
		kind: "subclass",
		choose: 1,
		description: "Otherworldly Patron",
		source: "SRD p.46",
		options: { from: "subclasses" }
	},
	{
		ownerType: "background",
		ownerSlug: "custom",
		key: "skills-0",
		kind: "skill",
		choose: 2,
		description: "Custom background: two skill proficiencies",
		source: "SRD p.60",
		options: { from: "skills" }
	},
	{
		ownerType: "background",
		ownerSlug: "custom",
		key: "toolsOrLanguages-0",
		kind: "toolOrLanguage",
		choose: 2,
		description: "Custom background: two tool proficiencies or languages",
		source: "SRD p.60",
		options: { from: "toolsAndLanguages" }
	},
	{
		ownerType: "class",
		ownerSlug: "fighter",
		key: "fightingStyle-0",
		kind: "feature",
		choose: 1,
		description: "Fighting Style",
		source: "SRD p.24",
		options: literal([
			{
				slug: "fighter-fighting-style-archery",
				name: "Archery"
			},
			{
				slug: "fighter-fighting-style-defense",
				name: "Defense"
			},
			{
				slug: "fighter-fighting-style-dueling",
				name: "Dueling"
			},
			{
				slug: "fighter-fighting-style-great-weapon-fighting",
				name: "Great Weapon Fighting"
			},
			{
				slug: "fighter-fighting-style-protection",
				name: "Protection"
			},
			{
				slug: "fighter-fighting-style-two-weapon-fighting",
				name: "Two-Weapon Fighting"
			}
		])
	},
	{
		ownerType: "class",
		ownerSlug: "rogue",
		key: "expertise-0",
		kind: "expertise",
		choose: 2,
		description: "Expertise: two proficient skills, or one skill and thieves' tools",
		source: "SRD p.39",
		options: { from: "expertise" }
	},
	{
		ownerType: "class",
		ownerSlug: "ranger",
		key: "favoredEnemy-0",
		kind: "creatureType",
		choose: 1,
		description: "Favored Enemy: a creature type, or humanoids (then two races)",
		source: "SRD p.35",
		options: literal([
			"aberrations",
			"beasts",
			"celestials",
			"constructs",
			"dragons",
			"elementals",
			"fey",
			"fiends",
			"giants",
			"monstrosities",
			"oozes",
			"plants",
			"undead",
			"humanoids"
		].map((s) => ({
			slug: s,
			name: s[0].toUpperCase() + s.slice(1)
		})))
	},
	{
		ownerType: "class",
		ownerSlug: "ranger",
		key: "favoredEnemyRaces-0",
		kind: "race",
		choose: 2,
		description: "Favored Enemy: the two humanoid races",
		source: "SRD p.35",
		options: { from: "races" },
		requires: {
			group: "class/ranger/favoredEnemy-0",
			option: "humanoids"
		}
	},
	{
		ownerType: "class",
		ownerSlug: "ranger",
		key: "favoredEnemyLanguage-0",
		kind: "language",
		choose: 1,
		description: "Favored Enemy: one language spoken by your favored enemies",
		source: "SRD p.35",
		options: { from: "standardLanguages" }
	},
	{
		ownerType: "class",
		ownerSlug: "ranger",
		key: "favoredTerrain-0",
		kind: "terrain",
		choose: 1,
		description: "Natural Explorer: favored terrain",
		source: "SRD p.35",
		options: literal([
			"arctic",
			"coast",
			"desert",
			"forest",
			"grassland",
			"mountain",
			"swamp"
		].map((s) => ({
			slug: s,
			name: s[0].toUpperCase() + s.slice(1)
		})))
	},
	{
		ownerType: "trait",
		ownerSlug: "draconic-ancestry",
		key: "dragonType-0",
		kind: "dragonType",
		choose: 1,
		description: "Draconic Ancestry",
		source: "SRD p.5-6",
		options: literal(dragonOptions)
	},
	{
		ownerType: "subclass",
		ownerSlug: "draconic",
		key: "dragonType-0",
		kind: "dragonType",
		choose: 1,
		description: "Dragon Ancestor",
		source: "SRD p.45",
		options: literal(dragonOptions)
	},
	{
		ownerType: "trait",
		ownerSlug: "high-elf-cantrip",
		key: "cantrip-0",
		kind: "spell",
		choose: 1,
		description: "One wizard cantrip",
		source: "SRD p.4",
		options: { from: "wizardCantrips" }
	}
];
var OVERLAY_GROUPS = array(overlayGroup).parse(rawGroups);
var OVERLAY_GRANTS = array(overlayGrant).parse([
	{
		ownerType: "trait",
		ownerSlug: "dwarven-resilience",
		source: "SRD p.3",
		resistances: ["poison"]
	},
	{
		ownerType: "trait",
		ownerSlug: "hellish-resistance",
		source: "SRD p.7",
		resistances: ["fire"]
	},
	{
		ownerType: "trait",
		ownerSlug: "infernal-legacy",
		source: "SRD p.7",
		spells: ["thaumaturgy"]
	},
	{
		ownerType: "subclass",
		ownerSlug: "life",
		source: "SRD p.17",
		proficiencies: ["heavy-armor"]
	},
	{
		ownerType: "subclass",
		ownerSlug: "draconic",
		source: "SRD p.45",
		languages: ["draconic"]
	}
]);
/** The stable handle for a choice group: `${ownerType}/${ownerSlug}/${key}`. */
var choiceKey = (ownerType, ownerSlug, key) => `${ownerType}/${ownerSlug}/${key}`;
// src/lib/rules/resolver.ts
var STRUCTURAL = [
	"race",
	"subrace",
	"class",
	"subclass",
	"background"
];
/** Proficiency types that are not tools (everything else, vehicles and kits included, is). */
var NON_TOOL_TYPES = /* @__PURE__ */ new Set([
	"Skills",
	"Armor",
	"Weapons",
	"Saving Throws"
]);
var byKey = (rows) => new Map(rows.map((r) => [r.slug, r]));
function resolveFeatures(rules, draft) {
	const races = byKey(rules.races);
	const subraces = byKey(rules.subraces);
	const classes = byKey(rules.classes);
	const subclasses = byKey(rules.subclasses);
	const backgrounds = byKey(rules.backgrounds);
	const traits = byKey(rules.traits);
	const features = byKey(rules.features);
	const languages = byKey(rules.languages);
	const proficiencies = byKey(rules.proficiencies);
	const spells = byKey(rules.spells);
	const race = draft.race ? races.get(draft.race) : void 0;
	const subrace = draft.subrace ? subraces.get(draft.subrace) : void 0;
	const cls = draft.class ? classes.get(draft.class) : void 0;
	const subclass = draft.subclass ? subclasses.get(draft.subclass) : void 0;
	const background = draft.background ? backgrounds.get(draft.background) : void 0;
	const structure = [];
	const known = {
		race,
		subrace,
		class: cls,
		subclass,
		background
	};
	for (const field of STRUCTURAL) if (draft[field] && !known[field]) structure.push({
		field,
		type: "unknown"
	});
	if (!draft.race) structure.push({
		field: "race",
		type: "missing"
	});
	if (!draft.class) structure.push({
		field: "class",
		type: "missing"
	});
	if (!draft.background) structure.push({
		field: "background",
		type: "missing"
	});
	if (race && !subrace && !draft.subrace && rules.subraces.some((s) => s.race === race.slug)) structure.push({
		field: "subrace",
		type: "missing"
	});
	if (subrace && race && subrace.race !== race.slug) structure.push({
		field: "subrace",
		type: "mismatch"
	});
	const subclassGroup = cls ? OVERLAY_GROUPS.find((g) => g.ownerType === "class" && g.ownerSlug === cls.slug && g.kind === "subclass") : void 0;
	if (subclass) {
		if (cls && subclass.class !== cls.slug) structure.push({
			field: "subclass",
			type: "mismatch"
		});
		else if (cls && !subclassGroup) structure.push({
			field: "subclass",
			type: "not-available"
		});
	} else if (subclassGroup && !draft.subclass) structure.push({
		field: "subclass",
		type: "missing"
	});
	const activeSubrace = subrace && race && subrace.race === race.slug ? subrace : void 0;
	const activeSubclass = subclass && cls && subclass.class === cls.slug && subclassGroup ? subclass : void 0;
	const abilityBonuses = [];
	const proficiencyList = [];
	const languageList = [];
	const resistances = /* @__PURE__ */ new Set();
	const grantedSpells = [];
	const featureList = [];
	const active = /* @__PURE__ */ new Set();
	const addProficiency = (slug, source, via, key) => {
		if (proficiencyList.some((p) => p.slug === slug)) return;
		const p = proficiencies.get(slug);
		proficiencyList.push({
			slug,
			name: p?.name ?? slug,
			type: p?.type ?? "Other",
			source,
			via,
			choiceKey: key
		});
	};
	const addLanguage = (slug, source, via, key) => {
		if (languageList.some((l) => l.slug === slug)) return;
		languageList.push({
			slug,
			name: languages.get(slug)?.name ?? slug,
			source,
			via,
			choiceKey: key
		});
	};
	const addSpell = (spell, source) => {
		if (grantedSpells.some((s) => s.spell === spell)) return;
		grantedSpells.push({
			spell,
			level: spells.get(spell)?.level ?? 0,
			source
		});
	};
	const applyOverlayGrants = (ownerType, ownerSlug, source, spellSource) => {
		for (const g of OVERLAY_GRANTS) {
			if (g.ownerType !== ownerType || g.ownerSlug !== ownerSlug) continue;
			g.proficiencies.forEach((p) => addProficiency(p, source, "fixed", null));
			g.languages.forEach((l) => addLanguage(l, source, "fixed", null));
			g.resistances.forEach((r) => resistances.add(r));
			g.spells.forEach((s) => addSpell(s, spellSource));
		}
	};
	const rawGroups = [];
	const sourceOfTrait = /* @__PURE__ */ new Map();
	const dataGroups = (ownerType, ownerSlug, groups, source) => {
		for (const g of groups) {
			if (g.kind === "equipment") continue;
			const options = g.options.map((o, i) => {
				const item = o.items[0];
				if (o.items.length === 1 && item.type === "proficiency") return {
					slug: item.proficiency,
					name: proficiencies.get(item.proficiency)?.name ?? item.proficiency
				};
				if (o.items.length === 1 && item.type === "language") return {
					slug: item.language,
					name: languages.get(item.language)?.name ?? item.language
				};
				if (o.items.length === 1 && item.type === "abilityBonus") return {
					slug: item.ability,
					name: `${item.ability.toUpperCase()} +${item.bonus}`
				};
				return {
					slug: `option-${i}`,
					name: `Option ${i + 1}`
				};
			});
			let kind;
			let finalOptions = options;
			if (g.kind === "language") {
				kind = "language";
				finalOptions = options.filter((o) => languages.get(o.slug)?.type === "Standard");
			} else if (g.kind === "abilityBonus") kind = "abilityBonus";
			else kind = options.every((o) => proficiencies.get(o.slug)?.type === "Skills") ? "skill" : "tool";
			rawGroups.push({
				key: choiceKey(ownerType, ownerSlug, g.key),
				ownerType,
				ownerSlug,
				groupKey: g.key,
				kind,
				source,
				description: g.description,
				citation: null,
				choose: g.choose,
				options: finalOptions
			});
		}
	};
	const overlayGroups = (ownerType, ownerSlug, source) => {
		for (const g of OVERLAY_GROUPS) {
			if (g.ownerType !== ownerType || g.ownerSlug !== ownerSlug) continue;
			let options = [];
			switch (g.options.from) {
				case "literal":
					options = g.options.options.map((o) => ({
						slug: o.slug,
						name: o.name,
						data: o.data
					}));
					break;
				case "subclasses":
					options = rules.subclasses.filter((s) => s.class === ownerSlug).map((s) => ({
						slug: s.slug,
						name: s.name
					}));
					break;
				case "races":
					options = rules.races.map((r) => ({
						slug: r.slug,
						name: r.name
					}));
					break;
				case "standardLanguages":
					options = rules.languages.filter((l) => l.type === "Standard").map((l) => ({
						slug: l.slug,
						name: l.name
					}));
					break;
				case "wizardCantrips":
					options = rules.spells.filter((s) => s.level === 0 && s.classes.includes("wizard")).map((s) => ({
						slug: s.slug,
						name: s.name
					}));
					break;
				case "expertise":
					options = [];
					break;
				case "skills":
					options = rules.proficiencies.filter((p) => p.type === "Skills").map((p) => ({
						slug: p.slug,
						name: p.name
					}));
					break;
				case "toolsAndLanguages": options = [...rules.proficiencies.filter((p) => !NON_TOOL_TYPES.has(p.type)), ...rules.languages.filter((l) => l.type === "Standard")].map((o) => ({
					slug: o.slug,
					name: o.name
				}));
			}
			rawGroups.push({
				key: choiceKey(g.ownerType, g.ownerSlug, g.key),
				ownerType: g.ownerType,
				ownerSlug: g.ownerSlug,
				groupKey: g.key,
				kind: g.kind === "language" ? "language" : g.kind,
				source,
				description: g.description,
				citation: g.source,
				choose: g.choose,
				options,
				requires: g.requires
			});
		}
	};
	const applyTrait = (slug, source, featureSource) => {
		const trait = traits.get(slug);
		if (!trait) return;
		sourceOfTrait.set(slug, source);
		active.add(slug);
		featureList.push({
			slug,
			name: trait.name,
			source: featureSource
		});
		trait.proficiencies.forEach((p) => addProficiency(p, source, "fixed", null));
		applyOverlayGrants("trait", slug, source, "race");
		dataGroups("trait", slug, trait.choiceGroups, source);
		overlayGroups("trait", slug, source);
	};
	if (race) {
		for (const a of race.abilityBonuses) abilityBonuses.push({
			ability: a.ability,
			bonus: a.bonus,
			source: "race",
			via: "fixed"
		});
		race.languages.forEach((l) => addLanguage(l, "race", "fixed", null));
		dataGroups("race", race.slug, race.choiceGroups, "race");
		race.traits.forEach((t) => applyTrait(t, "race", "race"));
	}
	if (activeSubrace) {
		for (const a of activeSubrace.abilityBonuses) abilityBonuses.push({
			ability: a.ability,
			bonus: a.bonus,
			source: "subrace",
			via: "fixed"
		});
		activeSubrace.traits.forEach((t) => applyTrait(t, "race", "subrace"));
	}
	if (cls) {
		cls.proficiencies.forEach((p) => addProficiency(p, "class", "fixed", null));
		dataGroups("class", cls.slug, cls.choiceGroups, "class");
		overlayGroups("class", cls.slug, "class");
		const levelOne = rules.classLevels.find((l) => l.class === cls.slug && l.level === 1);
		for (const slug of levelOne?.features ?? []) {
			const f = features.get(slug);
			if (!f) continue;
			active.add(slug);
			featureList.push({
				slug,
				name: f.name,
				source: "class"
			});
		}
	}
	if (activeSubclass) {
		applyOverlayGrants("subclass", activeSubclass.slug, "class", "subclass");
		overlayGroups("subclass", activeSubclass.slug, "class");
		const levelOne = rules.subclassLevels.find((l) => l.subclass === activeSubclass.slug && l.level === 1);
		for (const slug of levelOne?.features ?? []) {
			const f = features.get(slug);
			if (!f) continue;
			active.add(slug);
			featureList.push({
				slug,
				name: f.name,
				source: "subclass"
			});
		}
		for (const s of activeSubclass.spells) if (s.minClassLevel <= 1) addSpell(s.spell, "subclass");
	}
	if (background) {
		background.proficiencies.forEach((p) => addProficiency(p, "background", "fixed", null));
		dataGroups("background", background.slug, background.choiceGroups, "background");
		overlayGroups("background", background.slug, "background");
		if (background.feature) featureList.push({
			slug: background.slug,
			name: background.feature.name,
			source: "background"
		});
	}
	const picksOf = (key) => draft.picks[key] ?? [];
	const subclassKey = cls && subclassGroup ? choiceKey("class", cls.slug, subclassGroup.key) : null;
	const live = rawGroups.filter((g) => !g.requires || picksOf(g.requires.group).includes(g.requires.option));
	const liveKeys = new Set(live.map((g) => g.key));
	const picksFor = (g) => g.key === subclassKey ? draft.subclass ? [draft.subclass] : [] : picksOf(g.key);
	const isLanguage = (slug) => languages.has(slug) && !proficiencies.has(slug);
	/** The namespace a pick lives in; one pool group (tool or language) decides per option. */
	const spaceOf = (g, slug) => g.kind === "language" ? "language" : g.kind === "toolOrLanguage" ? isLanguage(slug) ? "language" : "proficiency" : g.kind === "skill" || g.kind === "tool" ? "proficiency" : null;
	const fixedTaken = /* @__PURE__ */ new Set([...proficiencyList.map((p) => `proficiency:${p.slug}`), ...languageList.map((l) => `language:${l.slug}`)]);
	const chosenBy = /* @__PURE__ */ new Map();
	for (const g of live) {
		const valid = new Set(g.options.map((o) => o.slug));
		for (const slug of new Set(picksFor(g))) {
			const space = spaceOf(g, slug);
			if (!space || !valid.has(slug)) continue;
			const id = `${space}:${slug}`;
			chosenBy.set(id, [...chosenBy.get(id) ?? [], g.key]);
		}
	}
	const resolveGroup = (g, options) => {
		const picks = picksFor(g);
		const optionSlugs = new Set(options.map((o) => o.slug));
		const issues = [];
		const seen = /* @__PURE__ */ new Set();
		for (const slug of picks) {
			if (seen.has(slug)) {
				issues.push({
					type: "duplicate",
					slug
				});
				continue;
			}
			seen.add(slug);
			if (!optionSlugs.has(slug)) {
				issues.push({
					type: "unknown-option",
					slug
				});
				continue;
			}
			const space = spaceOf(g, slug);
			if (space) {
				const id = `${space}:${slug}`;
				if (fixedTaken.has(id)) issues.push({
					type: "conflict",
					slug,
					with: "granted"
				});
				else {
					const other = (chosenBy.get(id) ?? []).find((k) => k !== g.key);
					if (other) issues.push({
						type: "conflict",
						slug,
						with: other
					});
				}
			}
		}
		if (new Set(picks).size > g.choose) issues.push({ type: "excess" });
		const resolved = options.map((o) => {
			let disabled = null;
			const space = spaceOf(g, o.slug);
			if (space) {
				const id = `${space}:${o.slug}`;
				if (fixedTaken.has(id)) disabled = "granted";
				else if ((chosenBy.get(id) ?? []).some((k) => k !== g.key)) disabled = "chosen-elsewhere";
			}
			return {
				...o,
				disabled
			};
		});
		const distinct = new Set(picks).size;
		return {
			key: g.key,
			ownerType: g.ownerType,
			ownerSlug: g.ownerSlug,
			groupKey: g.groupKey,
			kind: g.kind,
			source: g.source,
			description: g.description,
			citation: g.citation,
			choose: g.choose,
			options: resolved,
			picks,
			autoSelect: options.length === 1 ? options[0].slug : null,
			status: issues.length ? "attention" : distinct < g.choose ? "incomplete" : "valid",
			issues
		};
	};
	const skillProficiencies = /* @__PURE__ */ new Set();
	const noteSkill = (slug) => {
		if (proficiencies.get(slug)?.type === "Skills") skillProficiencies.add(slug);
	};
	proficiencyList.forEach((p) => noteSkill(p.slug));
	for (const g of live) {
		if (g.kind !== "skill") continue;
		const valid = new Set(g.options.map((o) => o.slug));
		picksFor(g).filter((s) => valid.has(s)).forEach(noteSkill);
	}
	const toolProficiencies = /* @__PURE__ */ new Set();
	proficiencyList.filter((p) => p.type !== "Skills" && p.type !== "Armor" && p.type !== "Weapons" && p.type !== "Saving Throws").forEach((p) => toolProficiencies.add(p.slug));
	for (const g of live) {
		if (g.kind !== "tool" && g.kind !== "toolOrLanguage") continue;
		const valid = new Set(g.options.map((o) => o.slug));
		picksFor(g).filter((s) => valid.has(s) && !isLanguage(s)).forEach((s) => toolProficiencies.add(s));
	}
	const groups = live.map((g) => {
		if (g.kind !== "expertise") return resolveGroup(g, g.options);
		const options = [...[...skillProficiencies].map((slug) => ({
			slug,
			name: proficiencies.get(slug)?.name ?? slug
		})), ...toolProficiencies.has("thieves-tools") ? [{
			slug: "thieves-tools",
			name: proficiencies.get("thieves-tools")?.name ?? "Thieves’ tools"
		}] : []];
		const resolved = resolveGroup(g, options);
		if (new Set(picksFor(g).filter((s) => !skillProficiencies.has(s) && options.some((o) => o.slug === s))).size > 1) {
			resolved.issues.push({ type: "too-many-tools" });
			resolved.status = "attention";
		}
		return resolved;
	});
	const expertise = [];
	for (const g of groups) {
		const legal = new Set(g.options.map((o) => o.slug));
		const picks = [...new Set(g.picks)].filter((s) => legal.has(s));
		switch (g.kind) {
			case "skill":
			case "tool":
				picks.forEach((s) => addProficiency(s, g.source, "choice", g.key));
				break;
			case "toolOrLanguage":
				picks.forEach((s) => isLanguage(s) ? addLanguage(s, g.source, "choice", g.key) : addProficiency(s, g.source, "choice", g.key));
				break;
			case "language":
				picks.forEach((s) => addLanguage(s, g.source, "choice", g.key));
				break;
			case "abilityBonus":
				for (const s of picks) abilityBonuses.push({
					ability: s,
					bonus: 1,
					source: "race",
					via: "choice"
				});
				break;
			case "feature":
				picks.forEach((s) => {
					active.add(s);
					const f = features.get(s);
					if (f) featureList.push({
						slug: s,
						name: f.name,
						source: "class"
					});
				});
				break;
			case "dragonType":
				for (const o of g.options) if (picks.includes(o.slug) && o.data?.damageType && g.ownerType === "trait") resistances.add(o.data.damageType);
				break;
			case "expertise": expertise.push(...picks);
		}
	}
	const skills = proficiencyList.filter((p) => p.type === "Skills").map((p) => ({
		skill: proficiencies.get(p.slug)?.reference?.slug ?? p.slug.replace(/^skill-/, ""),
		proficiency: p.slug,
		source: p.source,
		expertise: expertise.includes(p.slug)
	}));
	const abilityBonusTotals = {};
	for (const a of abilityBonuses) abilityBonusTotals[a.ability] = (abilityBonusTotals[a.ability] ?? 0) + a.bonus;
	const orphanPicks = Object.entries(draft.picks).filter(([key, slugs]) => slugs.length > 0 && !liveKeys.has(key)).map(([key, slugs]) => ({
		key,
		slugs
	}));
	return {
		valid: structure.length === 0 && groups.every((g) => g.status === "valid"),
		structure,
		groups,
		orphanPicks,
		abilityBonuses,
		abilityBonusTotals,
		speed: race?.speed ?? null,
		hitDie: cls?.hitDie ?? null,
		savingThrows: cls?.savingThrows ?? [],
		proficiencies: proficiencyList,
		expertise,
		skills,
		languages: languageList,
		resistances: [...resistances],
		grantedSpells,
		features: featureList,
		activeFeatureSlugs: [...active]
	};
}
// src/lib/character/equipment.ts
/** Full choice key of an equipment group: `${ownerType}/${ownerSlug}/${groupKey}`. */
var equipmentGroupKey = (ownerType, ownerSlug, groupKey) => `${ownerType}/${ownerSlug}/${groupKey}`;
/**
* The full keys of an owner's equipment groups. Every one of them needs an option picked (#113);
* the wizard and the Character service both derive the required set from this.
*/
var equipmentGroupKeys = (ownerType, ownerSlug, groups = []) => groups.filter((g) => g.kind === "equipment").map((g) => equipmentGroupKey(ownerType, ownerSlug, g.key));
var nameOf = (rules, slug) => rules.equipment.find((e) => e.slug === slug)?.name ?? slug;
/** The legal items of a wildcard category, in name order. */
function categoryItems(rules, category) {
	return (rules.equipmentCategories?.find((c) => c.slug === category)?.items ?? []).map((slug) => ({
		slug,
		name: nameOf(rules, slug)
	})).sort((a, b) => a.name.localeCompare(b.name));
}
function isProficient(rules, resolved, proficiency, item) {
	return resolved.proficiencies.some((p) => {
		if (p.slug === proficiency) return true;
		const ref = rules.proficiencies.find((r) => r.slug === p.slug)?.reference;
		if (!ref) return false;
		if (ref.type === "equipment") return ref.slug === item;
		if (ref.type === "equipment-category") return rules.equipmentCategories?.find((c) => c.slug === ref.slug)?.items.includes(item);
		return false;
	});
}
function describeLine(rules, item) {
	if (item.type === "equipment") return {
		kind: "item",
		item: item.equipment,
		name: nameOf(rules, item.equipment),
		count: item.count
	};
	if (item.type === "equipmentCategory") {
		const name = rules.equipmentCategories?.find((c) => c.slug === item.category)?.name;
		return {
			kind: "wildcard",
			category: item.category,
			name: name ?? item.category,
			count: item.count
		};
	}
	return null;
}
var lineLabel = (l) => l.kind === "item" ? l.count > 1 ? `${l.name} ×${l.count}` : l.name : l.count > 1 ? `${l.count} from ${l.name}` : `Any of ${l.name}`;
/**
* Every equipment choice group the draft's class and background own, with its options (disabled
* with a reason when the player lacks a required proficiency) and the player's current pick.
*/
function equipmentGroups(rules, draft, resolved) {
	const owners = [["class", draft.class], ["background", draft.background]];
	const groups = [];
	for (const [ownerType, ownerSlug] of owners) {
		if (!ownerSlug) continue;
		const owner = (ownerType === "class" ? rules.classes : rules.backgrounds).find((o) => o.slug === ownerSlug);
		for (const g of owner?.choiceGroups ?? []) {
			if (g.kind !== "equipment") continue;
			const key = equipmentGroupKey(ownerType, ownerSlug, g.key);
			const options = g.options.map((o, index) => {
				const lines = o.items.flatMap((i) => describeLine(rules, i) ?? []);
				const slots = lines.flatMap((l) => l.kind === "wildcard" ? Array(l.count).fill(l.category) : []);
				let disabled = null;
				for (const i of o.items) if (i.type === "equipment" && i.requiresProficiency) {
					if (!isProficient(rules, resolved, i.requiresProficiency, i.equipment)) disabled = `Requires proficiency with ${rules.proficiencies.find((p) => p.slug === i.requiresProficiency)?.name ?? i.requiresProficiency}.`;
				}
				return {
					index,
					label: lines.map(lineLabel).join(", "),
					lines,
					slots,
					disabled
				};
			});
			groups.push({
				key,
				ownerType,
				ownerSlug,
				ownerName: owner?.name ?? ownerSlug,
				label: options.map((o) => o.label).join(" or "),
				options,
				pick: draft.equipment[key] ?? null
			});
		}
	}
	return groups;
}
/** The fixed class items and background package: given, not chosen. Shown read-only. */
function fixedEquipment(rules, draft) {
	const out = [];
	const sources = [["class", draft.class], ["background", draft.background]];
	for (const [source, slug] of sources) {
		const owner = (source === "class" ? rules.classes : rules.backgrounds).find((o) => o.slug === slug);
		if (!owner || owner.startingEquipment.length === 0) continue;
		out.push({
			source,
			ownerName: owner.name,
			items: owner.startingEquipment.map((e) => ({
				item: e.item,
				name: nameOf(rules, e.item),
				quantity: e.quantity
			}))
		});
	}
	return out;
}
/** Why a group's pick is not good yet, or null when it is. `attention` means it was once legal. */
function groupProblem(rules, g) {
	if (!g.pick) return {
		state: "incomplete",
		issue: `Choose an option for: ${g.label}.`
	};
	const option = g.options[g.pick.option];
	if (!option) return {
		state: "attention",
		issue: `The ${g.ownerName} choice "${g.label}" no longer exists; choose again.`
	};
	if (option.disabled) return {
		state: "attention",
		issue: `${option.label}: ${option.disabled} Choose another option.`
	};
	for (let i = 0; i < option.slots.length; i++) {
		const item = g.pick.wild[i] ?? null;
		if (!item) return {
			state: "incomplete",
			issue: `Pick an item for ${option.label}.`
		};
		if (!categoryItems(rules, option.slots[i]).some((c) => c.slug === item)) return {
			state: "attention",
			issue: `${nameOf(rules, item)} is not a legal pick for ${option.label}.`
		};
	}
	return null;
}
/** Step validity: every group has an option and every wildcard slot a legal item. */
function validateEquipment({ rules, draft, resolved }) {
	const issues = [];
	let attention = false;
	for (const g of equipmentGroups(rules, draft, resolved)) {
		const problem = groupProblem(rules, g);
		if (!problem) continue;
		issues.push(problem.issue);
		if (problem.state === "attention") attention = true;
	}
	return {
		state: attention ? "attention" : issues.length ? "incomplete" : "valid",
		issues
	};
}
/** The stored rows (`CharacterInput.equipment`): one per distinct item per group, merged by quantity. */
function equipmentRows(rules, draft, resolved) {
	const rows = [];
	for (const g of equipmentGroups(rules, draft, resolved)) {
		const option = g.pick ? g.options[g.pick.option] : void 0;
		if (!g.pick || !option) continue;
		const add = (item, quantity) => {
			const row = rows.find((r) => r.choiceKey === g.key && r.item === item);
			if (row) row.quantity += quantity;
			else rows.push({
				choiceKey: g.key,
				item,
				quantity
			});
		};
		let slot = 0;
		for (const line of option.lines) if (line.kind === "item") add(line.item, line.count);
		else for (let n = 0; n < line.count; n++) {
			const item = g.pick.wild[slot++];
			if (item) add(item, 1);
		}
	}
	return rows;
}
/** Every item slug the Character owns: fixed items plus the picks. Feeds `deriveStats`. */
function ownedEquipment(rules, draft, resolved) {
	const slugs = [...fixedEquipment(rules, draft).flatMap((f) => f.items.map((i) => i.item)), ...equipmentRows(rules, draft, resolved).map((r) => r.item)];
	return [...new Set(slugs)];
}
/**
* The equipment part of the wizard's change rules (#89): picks whose group no longer belongs to
* the draft's class or background are cleared with one notice per owner; a group with a single
* option is picked for the player (the always-picked focus variants). Picks that still have a
* group are kept; validation flags the ones that stopped being legal.
*/
function reconcileEquipment(rules, draft) {
	/** Live group keys; the value is the slot count of a single-option group (auto-picked), else null. */
	const live = /* @__PURE__ */ new Map();
	const owners = [["class", draft.class], ["background", draft.background]];
	for (const [ownerType, ownerSlug] of owners) {
		if (!ownerSlug) continue;
		const owner = (ownerType === "class" ? rules.classes : rules.backgrounds).find((o) => o.slug === ownerSlug);
		for (const g of owner?.choiceGroups ?? []) {
			if (g.kind !== "equipment") continue;
			live.set(equipmentGroupKey(ownerType, ownerSlug, g.key), g.options.length === 1 ? slotCount(g.options[0].items) : null);
		}
	}
	const equipment = {};
	const notices = [];
	const cleared = /* @__PURE__ */ new Set();
	for (const [key, pick] of Object.entries(draft.equipment)) if (live.has(key)) equipment[key] = pick;
	else {
		const [ownerType, ownerSlug] = key.split("/");
		const list = ownerType === "class" ? rules.classes : rules.backgrounds;
		cleared.add(list.find((o) => o.slug === ownerSlug)?.name ?? ownerSlug);
	}
	for (const owner of cleared) notices.push(`Cleared your ${owner} equipment choices: they no longer apply.`);
	for (const [key, slots] of live) {
		if (slots === null || equipment[key]) continue;
		equipment[key] = {
			option: 0,
			wild: Array(slots).fill(null)
		};
	}
	return {
		equipment,
		notices
	};
}
var slotCount = (items) => items.reduce((n, i) => n + (i.type === "equipmentCategory" ? i.count : 0), 0);
// src/lib/character/ability-scores.ts
var ABILITY_LABELS = {
	str: "Strength",
	dex: "Dexterity",
	con: "Constitution",
	int: "Intelligence",
	wis: "Wisdom",
	cha: "Charisma"
};
var STANDARD_ARRAY = [
	15,
	14,
	13,
	12,
	10,
	8
];
var POINT_BUY = {
	budget: 27,
	min: 8,
	max: 15,
	costs: {
		"8": 0,
		"9": 1,
		"10": 2,
		"11": 3,
		"12": 4,
		"13": 5,
		"14": 7,
		"15": 9
	}
};
var ROLL = {
	count: 6,
	dice: 4,
	sides: 6,
	dropLowest: 1
};
/**
* Rolls a full set: six rolls of four d6, every die recorded (the dropped one included). Code is
* the only roller; `random` is injectable for tests. Rows are in roll order.
*/
function rollAbilityScores(random = Math.random) {
	return Array.from({ length: ROLL.count }, () => Array.from({ length: ROLL.dice }, () => 1 + Math.floor(random() * ROLL.sides)));
}
/**
* The draft patch for choosing a method: base scores are specific to a method (point buy starts
* at 8s), the rolled set is kept (#95).
*/
function methodPatch(next) {
	return {
		abilityMethod: next,
		baseScores: next === "point-buy" ? {
			str: 8,
			dex: 8,
			con: 8,
			int: 8,
			wis: 8,
			cha: 8
		} : {
			str: null,
			dex: null,
			con: null,
			int: null,
			wis: null,
			cha: null
		}
	};
}
/** One roll's score: the dice sum without the lowest die. */
function rollTotal(dice) {
	return [...dice].sort((a, b) => a - b).slice(ROLL.dropLowest).reduce((a, b) => a + b, 0);
}
var rollTotals = (rolls) => rolls.map(rollTotal);
/** Point buy cost of one base score; undefined outside 8 to 15. */
var pointCost = (score) => POINT_BUY.costs[String(score)];
/** Points spent by the assigned scores (unassigned count as 8). */
function pointsSpent(scores) {
	return ABILITY_KEYS.reduce((sum, k) => sum + (pointCost(scores[k] ?? POINT_BUY.min) ?? 0), 0);
}
var sorted = (xs) => [...xs].sort((a, b) => a - b).join();
/**
* The pool values not yet taken by another ability (duplicates counted), for the assignment
* selects. `except` is the ability being edited: its own value stays available.
*/
function availableValues(pool, scores, except) {
	const left = [...pool];
	for (const k of ABILITY_KEYS) {
		const v = scores[k];
		if (k === except || v === null) continue;
		const i = left.indexOf(v);
		if (i >= 0) left.splice(i, 1);
	}
	return left.sort((a, b) => b - a);
}
/**
* Why an AI-proposed arrangement is not legal, or null when it is: a permutation of the standard
* array (or of the rolled `pool` of totals), or a point buy spend within the budget. Pure code
* decides legality; the model only ever sees totals.
*/
function arrangementProblem(method, scores, pool) {
	const values = ABILITY_KEYS.map((k) => scores[k]);
	if (values.some((v) => !Number.isInteger(v))) return "every ability needs a whole-number score";
	if (method === "standard-array" || method === "rolling") {
		const allowed = method === "standard-array" ? STANDARD_ARRAY : pool;
		return sorted(values) === sorted(allowed) ? null : `use each of ${allowed.join(", ")} exactly once`;
	}
	if (method === "point-buy") {
		if (values.some((v) => pointCost(v) === void 0)) return `base scores must be between ${POINT_BUY.min} and ${POINT_BUY.max}`;
		const spent = pointsSpent(scores);
		return spent > POINT_BUY.budget ? `${spent} points is over the ${POINT_BUY.budget} budget` : null;
	}
	return "no ability score method is chosen";
}
/** Checks the method, the six base scores and (for rolling) the rolled set. */
function validateAbilityScores(method, scores, rolls) {
	if (!method) return {
		state: "incomplete",
		issues: ["Choose how to set your ability scores."]
	};
	const issues = [];
	if (method === "rolling" && !rolls?.length) return {
		state: "incomplete",
		issues: ["Roll your ability scores."]
	};
	if (ABILITY_KEYS.some((k) => scores[k] === null)) return {
		state: "incomplete",
		issues: ["Assign a score to every ability."]
	};
	const values = ABILITY_KEYS.map((k) => scores[k]);
	if (method === "standard-array") {
		if (sorted(values) !== sorted(STANDARD_ARRAY)) issues.push(`Use each of ${STANDARD_ARRAY.join(", ")} exactly once.`);
	} else if (method === "point-buy") {
		if (values.some((v) => pointCost(v) === void 0)) issues.push(`Base scores must be between ${POINT_BUY.min} and ${POINT_BUY.max}.`);
		else if (pointsSpent(scores) > POINT_BUY.budget) issues.push(`You have spent ${pointsSpent(scores)} of ${POINT_BUY.budget} points.`);
	} else if (!(rolls.length === ROLL.count && rolls.every((r) => r.length === ROLL.dice && r.every((d) => Number.isInteger(d) && d >= 1 && d <= ROLL.sides)))) issues.push("The rolled set is not valid; roll again.");
	else if (sorted(values) !== sorted(rollTotals(rolls))) issues.push("Assign each rolled total to exactly one ability.");
	return {
		state: issues.length ? "attention" : "valid",
		issues
	};
}
/**
* The Ability scores step's validity (#110): the method's rules, plus the race's "choose abilities"
* bonus groups (Half-Elf's two +1 picks), which live in `draft.picks`.
*/
function validateAbilitiesStep({ draft, resolved }) {
	const base = validateAbilityScores(draft.abilityMethod, draft.baseScores, draft.abilityRolls);
	const issues = [...base.issues];
	let state = base.state;
	for (const g of resolved.groups.filter((g) => g.kind === "abilityBonus")) {
		if (g.status === "valid") continue;
		if (g.status === "attention") {
			issues.push("A racial ability bonus choice is not allowed; change it.");
			state = "attention";
		} else {
			issues.push(`Choose ${g.choose} abilities for your racial bonus.`);
			if (state === "valid") state = "incomplete";
		}
	}
	return {
		state,
		issues
	};
}
// src/lib/character/steps.ts
var LENGTH_FIELDS = [
	"name",
	"appearance",
	"personality",
	"ideal",
	"bond",
	"flaw",
	"backstory"
];
/** Why a text field is too long ("Backstory is over 2000 characters."), or null when it fits. */
function lengthIssue(field, value) {
	if (value.length <= LIMITS[field]) return null;
	return `${field[0].toUpperCase()}${field.slice(1)} is over ${LIMITS[field]} characters.`;
}
function validateConcept({ draft, resolved }) {
	const issues = [];
	let attention = false;
	if (!draft.name.trim()) issues.push("Give your character a name.");
	const labels = {
		race: "a race",
		subrace: "a subrace",
		class: "a class",
		subclass: "a subclass",
		background: "a background"
	};
	for (const s of resolved.structure) if (s.type === "missing") issues.push(`Choose ${labels[s.field]}.`);
	else {
		attention = true;
		issues.push(`The ${s.field} choice no longer fits; choose another.`);
	}
	for (const field of LENGTH_FIELDS) {
		const issue = lengthIssue(field, draft[field]);
		if (issue) {
			attention = true;
			issues.push(issue);
		}
	}
	return {
		state: attention ? "attention" : issues.length ? "incomplete" : "valid",
		issues
	};
}
/**
* The choice-group kinds step 3 owns. The rest belong elsewhere: the subclass chooser to Concept,
* Half-Elf ability bonuses to Ability scores (#110), the High Elf cantrip to Spells (#114).
*/
var SKILLS_STEP_KINDS = [
	"skill",
	"tool",
	"toolOrLanguage",
	"language",
	"expertise",
	"feature",
	"creatureType",
	"terrain",
	"dragonType",
	"race"
];
var skillsStepGroups = (resolved) => resolved.groups.filter((g) => SKILLS_STEP_KINDS.includes(g.kind));
var KIND_LABELS = {
	skill: "Skills",
	tool: "Tools",
	toolOrLanguage: "Tools or languages",
	language: "Languages",
	expertise: "Expertise",
	feature: "Fighting Style",
	creatureType: "Favored enemy",
	terrain: "Favored terrain",
	dragonType: "Draconic ancestry",
	race: "Favored enemy races"
};
/** A plain-language name for a choice group. */
var groupLabel = (g) => g.description ?? KIND_LABELS[g.kind] ?? g.groupKey;
/** Plain-language reasons a choice group is not valid yet. */
function groupIssues(g) {
	const name = (slug) => g.options.find((o) => o.slug === slug)?.name ?? slug;
	const out = [];
	for (const i of g.issues) if (i.type === "conflict") out.push(`${groupLabel(g)}: ${name(i.slug)} is already ${i.with === "granted" ? "granted to you" : "chosen elsewhere"}. Pick another.`);
	else if (i.type === "unknown-option") out.push(`${groupLabel(g)}: ${i.slug} is no longer an option. Pick another.`);
	else if (i.type === "duplicate") out.push(`${groupLabel(g)}: ${name(i.slug)} is picked twice.`);
	else if (i.type === "excess") out.push(`${groupLabel(g)}: too many picks; choose ${g.choose}.`);
	else out.push(`${groupLabel(g)}: choose at most one tool.`);
	if (g.status === "incomplete") {
		const left = g.choose - new Set(g.picks).size;
		out.push(`${groupLabel(g)}: choose ${left} more.`);
	}
	return out;
}
function validateSkills({ draft, resolved }) {
	const issues = [];
	let attention = false;
	if (draft.background === "custom") {
		if (!draft.customBackgroundName.trim()) issues.push("Name your custom background.");
		if (!draft.customBackgroundFeature.trim()) issues.push("Describe your custom background feature.");
		for (const f of ["customBackgroundName", "customBackgroundFeature"]) if (draft[f].length > LIMITS[f]) {
			attention = true;
			issues.push(`The custom background ${f === "customBackgroundName" ? "name" : "feature"} is over ${LIMITS[f]} characters.`);
		}
	}
	for (const g of skillsStepGroups(resolved)) {
		if (g.status === "attention") attention = true;
		if (g.status !== "valid") issues.push(...groupIssues(g));
	}
	return {
		state: attention ? "attention" : issues.length ? "incomplete" : "valid",
		issues
	};
}
/** A class that casts at level 1, or any draft with a spell pick (High Elf cantrip). */
function castsAtLevel1({ rules, draft, resolved }) {
	const sc = rules.classLevels.find((l) => l.class === draft.class && l.level === 1)?.spellcasting;
	return !!sc && ((sc.cantripsKnown ?? 0) > 0 || (sc.spellsKnown ?? 0) > 0 || sc.slots.some((n) => n > 0)) || resolved.groups.some((g) => g.kind === "spell");
}
/**
* The steps in rail order. Every step is built; a new step replaces or adds an entry here and
* a component in `step-views.ts`.
*/
var STEPS = [
	{
		id: "concept",
		label: "Concept",
		unlock: "always",
		validate: validateConcept
	},
	{
		id: "abilities",
		label: "Ability scores",
		validate: validateAbilitiesStep
	},
	{
		id: "skills",
		label: "Skills & features",
		validate: validateSkills
	},
	{
		id: "equipment",
		label: "Equipment",
		validate: validateEquipment
	},
	{
		id: "spells",
		label: "Spells",
		applies: castsAtLevel1,
		validate: validateSpells
	},
	{
		id: "review",
		label: "Review",
		unlock: "all-valid",
		validate: () => ({
			state: "valid",
			issues: []
		})
	}
];
/**
* Rail state for every applicable step, in order. Locked steps still report their issues so the
* rail can explain itself, but a locked step never counts as valid.
*/
function computeSteps(ctx, defs = STEPS) {
	const results = defs.filter((d) => d.applies?.(ctx) ?? true).map((d) => ({
		def: d,
		v: d.validate(ctx)
	}));
	const conceptValid = results.find((r) => r.def.id === "concept")?.v.state === "valid";
	return results.map(({ def, v }) => {
		const unlock = def.unlock ?? "concept-valid";
		const open = unlock === "always" || unlock === "concept-valid" && conceptValid || unlock === "all-valid" && results.every((r) => r.def.id === def.id || r.v.state === "valid");
		return {
			id: def.id,
			label: def.label,
			status: open ? v.state : "locked",
			issues: v.issues
		};
	});
}
/** How many cantrips and level 1 spells a class picks at level 1; zeros for no class or a non-caster. */
function spellAllowance(rules, classSlug) {
	const sc = rules.classLevels.find((l) => l.class === classSlug && l.level === 1)?.spellcasting;
	return {
		cantrips: sc?.cantripsKnown ?? 0,
		spells: sc?.spellsKnown ?? (classSlug === "wizard" ? 6 : 0)
	};
}
/** Spells of one level on a class's list, by name. */
function classSpellOptions(rules, classSlug, level) {
	if (!classSlug) return [];
	return rules.spells.filter((s) => s.level === level && s.classes.includes(classSlug)).map((s) => ({
		slug: s.slug,
		name: s.name
	})).sort((a, b) => a.name.localeCompare(b.name));
}
/** The High Elf cantrip group, or any other racial spell choice: resolver groups of kind `spell`. */
var spellGroups = (ctx) => ctx.resolved.groups.filter((g) => g.kind === "spell");
/** Slugs already taken by a granted spell or a spell choice group, which class picks must not repeat. */
function takenElsewhere(ctx) {
	return /* @__PURE__ */ new Set([...ctx.resolved.grantedSpells.map((s) => s.spell), ...spellGroups(ctx).flatMap((g) => g.picks)]);
}
/** Why individual class picks are illegal, in pick order. Excess and shortage are counted separately. */
function spellPickFlags(ctx) {
	const { rules, draft } = ctx;
	const className = rules.classes.find((c) => c.slug === draft.class)?.name ?? "chosen";
	const taken = takenElsewhere(ctx);
	const seen = /* @__PURE__ */ new Set();
	const flags = [];
	for (const slug of draft.classSpells) {
		const spell = rules.spells.find((s) => s.slug === slug);
		const name = spell?.name ?? slug;
		let reason = null;
		if (!spell) reason = `${name} is no longer a known spell.`;
		else if (spell.level > 1) reason = `${name} is above level 1.`;
		else if (!draft.class || !spell.classes.includes(draft.class)) reason = `${name} is not on the ${className} spell list.`;
		else if (seen.has(slug)) reason = `${name} is picked twice.`;
		else if (taken.has(slug)) reason = `${name} is already granted or chosen elsewhere.`;
		seen.add(slug);
		if (reason) flags.push({
			slug,
			reason
		});
	}
	return flags;
}
var plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function validateSpells(ctx) {
	const { rules, draft } = ctx;
	const allowance = spellAllowance(rules, draft.class);
	const issues = [];
	let attention = false;
	const flags = spellPickFlags(ctx);
	for (const f of flags) {
		attention = true;
		issues.push(f.reason);
	}
	const flagged = new Set(flags.map((f) => f.slug));
	const count = (level, max, label) => {
		const have = draft.classSpells.filter((slug) => {
			if (flagged.has(slug)) return false;
			return rules.spells.find((s) => s.slug === slug)?.level === level;
		}).length;
		if (have === max) return;
		if (have > max) attention = true;
		issues.push(`Pick exactly ${label}, you have ${have}.`);
	};
	if (allowance.cantrips > 0 || draft.classSpells.length) count(0, allowance.cantrips, plural(allowance.cantrips, "cantrip", "cantrips"));
	if (allowance.spells > 0 || draft.classSpells.length) count(1, allowance.spells, plural(allowance.spells, "level 1 spell", "level 1 spells"));
	for (const g of spellGroups(ctx)) {
		if (g.status === "attention") attention = true;
		if (g.status !== "valid") issues.push(...groupIssues(g));
	}
	return {
		state: attention ? "attention" : issues.length ? "incomplete" : "valid",
		issues
	};
}
/** Everything the Spells step renders, derived from the step context. */
function spellsView(ctx) {
	const { rules, draft, stats, resolved } = ctx;
	const allowance = spellAllowance(rules, draft.class);
	const levelOf = (slug) => rules.spells.find((s) => s.slug === slug)?.level;
	const cs = stats.spellcasting;
	const prepares = cs.status === "ok" ? cs.value?.preparedCount ?? null : null;
	const prepClass = [
		"cleric",
		"druid",
		"wizard"
	].includes(draft.class ?? "");
	return {
		cantrips: {
			max: allowance.cantrips,
			picked: draft.classSpells.filter((s) => levelOf(s) === 0),
			options: classSpellOptions(rules, draft.class, 0)
		},
		spells: {
			max: allowance.spells,
			picked: draft.classSpells.filter((s) => levelOf(s) === 1),
			options: classSpellOptions(rules, draft.class, 1)
		},
		prepares,
		preparesPending: prepClass && prepares === null,
		granted: resolved.grantedSpells.map((g) => ({
			...g,
			name: rules.spells.find((s) => s.slug === g.spell)?.name ?? g.spell
		})),
		groups: spellGroups(ctx)
	};
}
/**
* Change rule for class spells (#89, #97): picks stay across a class change and illegal ones are
* flagged by `validateSpells`; only a class with no level 1 casting clears them, with a notice.
*/
function reconcileSpells(rules, draft) {
	const { cantrips, spells } = spellAllowance(rules, draft.class);
	if (cantrips + spells > 0 || draft.classSpells.length === 0) return {
		classSpells: draft.classSpells,
		notices: []
	};
	return {
		classSpells: [],
		notices: [draft.class ? "Cleared your class spell picks: your class has no spells to pick at level 1." : "Cleared your class spell picks: they need a class."]
	};
}
// src/lib/character/draft.ts
/** The collection names a server load must hand the browser. */
var WIZARD_RULES_KEYS = [
	"races",
	"subraces",
	"classes",
	"classLevels",
	"subclasses",
	"subclassLevels",
	"traits",
	"features",
	"backgrounds",
	"languages",
	"proficiencies",
	"spells",
	"skills",
	"equipment",
	"equipmentCategories",
	"alignments"
];
/** Field length limits from the data model (#91). */
var LIMITS = {
	name: 80,
	appearance: 500,
	personality: 500,
	ideal: 500,
	bond: 500,
	flaw: 500,
	backstory: 2e3,
	customBackgroundName: 80,
	customBackgroundFeature: 1e3
};
function emptyDraft() {
	return {
		name: "",
		race: null,
		subrace: null,
		class: null,
		subclass: null,
		background: null,
		alignment: null,
		appearance: "",
		personality: "",
		ideal: "",
		bond: "",
		flaw: "",
		backstory: "",
		level: 1,
		abilityMethod: null,
		baseScores: {
			str: null,
			dex: null,
			con: null,
			int: null,
			wis: null,
			cha: null
		},
		abilityRolls: null,
		picks: {},
		equipment: {},
		classSpells: [],
		customBackgroundName: "",
		customBackgroundFeature: ""
	};
}
var resolverDraft = (d) => ({
	race: d.race,
	subrace: d.subrace,
	class: d.class,
	subclass: d.subclass,
	background: d.background,
	picks: d.picks
});
/**
* Applies the wizard's change rules after any edit (#89): a structural pick that no longer fits
* is cleared and reported, a single subclass option is selected for the player, and feature
* choices whose group no longer exists are cleared and reported. Picks that still have a group to
* attach to are kept (flagging them is the resolver's job). Pure; returns a new draft.
*/
function reconcile(rules, input) {
	const draft = {
		...input,
		picks: { ...input.picks },
		classSpells: [...input.classSpells]
	};
	const notices = [];
	const nameOf = (list, slug) => list.find((e) => e.slug === slug)?.name ?? slug;
	const subrace = rules.subraces.find((s) => s.slug === draft.subrace);
	if (draft.subrace && (!subrace || subrace.race !== draft.race)) {
		notices.push(`Cleared the subrace ${nameOf(rules.subraces, draft.subrace)}: it no longer fits your race.`);
		draft.subrace = null;
	}
	const subclass = rules.subclasses.find((s) => s.slug === draft.subclass);
	if (draft.subclass && (!subclass || subclass.class !== draft.class)) {
		notices.push(`Cleared the subclass ${nameOf(rules.subclasses, draft.subclass)}: it no longer fits your class.`);
		draft.subclass = null;
	}
	if (draft.background !== "custom") {
		draft.customBackgroundName = "";
		draft.customBackgroundFeature = "";
	}
	const resolved = resolveFeatures(rules, resolverDraft(draft));
	if (!draft.subclass) {
		const only = resolved.groups.find((g) => g.kind === "subclass")?.autoSelect;
		if (only) draft.subclass = only;
	}
	const owners = /* @__PURE__ */ new Set();
	for (const orphan of resolved.orphanPicks) {
		delete draft.picks[orphan.key];
		const [ownerType, ownerSlug] = orphan.key.split("/");
		const collection = ownerType === "race" ? rules.races : ownerType === "class" ? rules.classes : ownerType === "background" ? rules.backgrounds : ownerType === "subclass" ? rules.subclasses : rules.traits;
		owners.add(nameOf(collection, ownerSlug));
	}
	for (const owner of owners) notices.push(`Cleared your ${owner} choices: they no longer apply.`);
	const gear = reconcileEquipment(rules, draft);
	draft.equipment = gear.equipment;
	notices.push(...gear.notices);
	const spells = reconcileSpells(rules, draft);
	draft.classSpells = spells.classSpells;
	notices.push(...spells.notices);
	return {
		draft,
		notices
	};
}
/** A value as JSON with object keys sorted, so equal drafts compare equal whatever the key order. */
function canonical(value) {
	return JSON.stringify(value, (_key, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
}
/** The draft fields whose values differ between two drafts. */
function changedDraftFields(a, b) {
	return [.../* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => canonical(a[k]) !== canonical(b[k]));
}
// src/lib/rules/derive-stats.ts
/** floor((score - 10) / 2): 8 and 9 are -1, 1 is -5. */
var abilityModifier = (score) => Math.floor((score - 10) / 2);
/** A base score plus its racial bonus, never above 20. */
var cappedScore = (base, racialBonus) => Math.min(20, base + racialBonus);
/** SRD p.56: +2 at levels 1 to 4, rising one every four levels. */
var proficiencyBonusForLevel = (level) => 2 + Math.floor((level - 1) / 4);
/** Casting modifier + level, minimum 1 (Cleric, Druid, Wizard; #97). */
var preparedSpellCount = (castingModifier, level) => Math.max(1, castingModifier + level);
var PREPARING_CLASSES = [
	"cleric",
	"druid",
	"wizard"
];
var NO_SLOTS = [
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0
];
/** Spell slots for a class at a level, from the class level table. */
function spellSlotsFor(rules, classSlug, level) {
	const row = rules.classLevels.find((l) => l.class === classSlug && l.level === level);
	return row?.spellcasting ? [...row.spellcasting.slots] : [...NO_SLOTS];
}
var FORMULA_LABELS = {
	unarmored: "10 + DEX",
	"barbarian-unarmored-defense": "Barbarian Unarmored Defense",
	"monk-unarmored-defense": "Monk Unarmored Defense",
	"draconic-resilience": "Draconic Resilience"
};
var unique = (items) => [...new Set(items)];
var stat = (missing, value) => missing.length ? {
	status: "pending",
	missing: unique(missing)
} : {
	status: "ok",
	value: value()
};
function deriveStats(rules, resolved, input) {
	const level = input.level;
	const levelMissing = Number.isInteger(level) && level >= 1 && level <= 20 ? [] : ["level"];
	const active = resolved.activeFeatureSlugs;
	const structural = (...fields) => resolved.structure.filter((i) => fields.includes(i.field)).map((i) => i.field);
	const incompleteChoices = (...kinds) => resolved.groups.filter((g) => kinds.includes(g.kind) && g.status === "incomplete").map((g) => `choice:${g.key}`);
	const raceMissing = [...structural("race", "subrace"), ...incompleteChoices("abilityBonus")];
	const abilityResults = Object.fromEntries(ABILITY_KEYS.map((key) => {
		const base = input.baseScores[key];
		const missing = [...raceMissing];
		if (typeof base !== "number" || !Number.isFinite(base)) missing.push(`score:${key}`);
		return [key, stat(missing, () => {
			const racialBonus = resolved.abilityBonusTotals[key] ?? 0;
			const score = cappedScore(base, racialBonus);
			return {
				base,
				racialBonus,
				score,
				modifier: abilityModifier(score)
			};
		})];
	}));
	const abilityMissing = (key) => {
		const s = abilityResults[key];
		return s.status === "pending" ? s.missing : [];
	};
	const mod = (key) => {
		const s = abilityResults[key];
		return s.status === "ok" ? s.value.modifier : 0;
	};
	const proficiencyBonus = stat(levelMissing, () => proficiencyBonusForLevel(level));
	const pb = proficiencyBonusForLevel(level);
	const proficiencyMissing = [...structural("race", "subrace", "class", "subclass", "background"), ...incompleteChoices("skill", "expertise")];
	const hitPoints = stat([
		...levelMissing,
		...structural("race", "subrace", "class", "subclass"),
		...abilityMissing("con"),
		...resolved.hitDie === null ? ["class"] : []
	], () => {
		const die = resolved.hitDie;
		const perLevel = Math.floor(die / 2) + 1;
		const total = die + (level - 1) * perLevel + level * mod("con") + hpBonus(active, level);
		return Math.max(1, total);
	});
	const classMissing = [...structural("class"), ...resolved.savingThrows.length === 0 ? ["class"] : []];
	const savingThrows = Object.fromEntries(ABILITY_KEYS.map((key) => [key, stat([...classMissing, ...abilityMissing(key)], () => {
		const proficient = resolved.savingThrows.includes(key);
		return {
			modifier: mod(key) + (proficient ? pb : 0),
			proficient
		};
	})]));
	const skills = {};
	for (const skill of rules.skills) {
		const ability = skill.ability;
		skills[skill.slug] = stat([
			...levelMissing,
			...proficiencyMissing,
			...abilityMissing(ability)
		], () => {
			const entry = resolved.skills.find((s) => s.skill === skill.slug);
			const proficient = !!entry;
			const expertise = !!entry?.expertise;
			const bonus = !proficient ? 0 : expertise ? pb * 2 : pb;
			return {
				ability,
				modifier: mod(ability) + bonus,
				proficient,
				expertise
			};
		});
	}
	const initiative = stat(abilityMissing("dex"), () => mod("dex"));
	const speed = stat(resolved.speed === null ? ["race"] : [], () => resolved.speed);
	const perception = skills["perception"];
	const passivePerception = perception && perception.status === "ok" ? {
		status: "ok",
		value: 10 + perception.value.modifier
	} : {
		status: "pending",
		missing: perception?.status === "pending" ? perception.missing : []
	};
	const needsCon = active.includes("barbarian-unarmored-defense");
	const needsWis = active.includes("monk-unarmored-defense");
	const unarmoredAc = stat([
		...structural("class", "subclass"),
		...abilityMissing("dex"),
		...needsCon ? abilityMissing("con") : [],
		...needsWis ? abilityMissing("wis") : []
	], () => {
		const mods = {
			str: mod("str"),
			dex: mod("dex"),
			con: mod("con"),
			int: mod("int"),
			wis: mod("wis"),
			cha: mod("cha")
		};
		const state = {
			armor: false,
			shield: false
		};
		let best = {
			value: 10 + mods.dex,
			source: "unarmored",
			formula: "10 + DEX"
		};
		const formula = bestUnarmoredAc(active, mods, state);
		if (formula && formula.value >= best.value) best = {
			value: formula.value,
			source: formula.source,
			formula: FORMULA_LABELS[formula.source] ?? formula.source
		};
		return {
			...best,
			value: best.value + acBonus(active, state)
		};
	});
	const cls = input.class ? rules.classes.find((c) => c.slug === input.class) : void 0;
	const spellClassMissing = [...levelMissing, ...cls ? [] : ["class"]];
	const spellSlots = stat(spellClassMissing, () => spellSlotsFor(rules, cls.slug, level));
	const casting = cls?.spellcasting ?? null;
	const casts = casting !== null && level >= casting.level;
	const spellcasting = stat([...spellClassMissing, ...cls && casts ? abilityMissing(casting.ability) : []], () => {
		if (!cls || !casting || !casts) return null;
		const ability = casting.ability;
		const row = rules.classLevels.find((l) => l.class === cls.slug && l.level === level);
		return {
			ability,
			saveDc: 8 + pb + mod(ability),
			attackBonus: pb + mod(ability),
			cantripsKnown: row?.spellcasting?.cantripsKnown ?? null,
			spellsKnown: row?.spellcasting?.spellsKnown ?? null,
			preparedCount: PREPARING_CLASSES.includes(cls.slug) ? preparedSpellCount(mod(ability), level) : null
		};
	});
	const proficiencyBySlug = new Map(rules.proficiencies.map((p) => [p.slug, p]));
	const weaponProficiencies = resolved.proficiencies.filter((p) => p.type === "Weapons").map((p) => proficiencyBySlug.get(p.slug)?.reference);
	const isProficient = (weapon) => weaponProficiencies.some((ref) => ref && (ref.type === "equipment" && ref.slug === weapon.slug || ref.type === "equipment-category" && ref.slug === `${(weapon.weaponCategory ?? "").toLowerCase()}-weapons`));
	const owned = [...new Set(input.equipment ?? [])];
	return {
		abilities: abilityResults,
		proficiencyBonus,
		hitPoints,
		savingThrows,
		skills,
		initiative,
		speed,
		passivePerception,
		unarmoredAc,
		spellSlots,
		spellcasting,
		attacks: stat([
			...levelMissing,
			...proficiencyMissing,
			...incompleteChoices("feature"),
			...abilityMissing("str"),
			...abilityMissing("dex")
		], () => owned.flatMap((slug) => {
			const weapon = rules.equipment.find((e) => e.slug === slug);
			if (!weapon || !weapon.weaponCategory) return [];
			const ranged = weapon.weaponRange === "Ranged";
			const shape = {
				ranged,
				twoHanded: weapon.properties.includes("two-handed")
			};
			const finesse = weapon.properties.includes("finesse");
			const ability = ranged ? "dex" : finesse && mod("dex") > mod("str") ? "dex" : "str";
			const proficient = isProficient(weapon);
			return [{
				weapon: weapon.slug,
				name: weapon.name,
				ability,
				proficient,
				attackBonus: mod(ability) + (proficient ? pb : 0) + weaponAttackBonus(active, shape),
				damage: weapon.damage && {
					dice: weapon.damage.dice,
					modifier: mod(ability) + weaponDamageBonus(active, shape),
					type: weapon.damage.type
				}
			}];
		}))
	};
}
// src/lib/character/save.ts
/**
* Maps the wizard draft to the service's `CharacterInput`. Vocabulary differences live here:
* draft `rolling` is service `roll`, draft `baseScores` is service `scores`. Throws when the draft
* is incomplete (Review is only reachable when it is not). Steps that add draft fields (roll dice
* #110, class spells #114, custom background) extend this mapper.
*/
function draftToCharacterInput(rules, draft) {
	const need = (label, value) => {
		if (value === null) throw new Error(`The draft has no ${label}`);
		return value;
	};
	const scores = {};
	for (const key of ABILITY_KEYS) scores[key] = need(`${key} score`, draft.baseScores[key]);
	const method = need("ability method", draft.abilityMethod);
	const rolls = draft.abilityRolls;
	const custom = draft.background === "custom";
	return {
		name: draft.name,
		alignment: draft.alignment,
		appearance: draft.appearance,
		personality: draft.personality,
		ideal: draft.ideal,
		bond: draft.bond,
		flaw: draft.flaw,
		backstory: draft.backstory,
		race: need("race", draft.race),
		subrace: draft.subrace,
		class: need("class", draft.class),
		subclass: draft.subclass,
		background: need("background", draft.background),
		abilityMethod: method === "rolling" ? "roll" : method,
		scores,
		...method === "rolling" && rolls ? { abilityRolls: rolls } : {},
		...custom ? {
			customBackgroundName: draft.customBackgroundName,
			customBackgroundFeature: draft.customBackgroundFeature
		} : {},
		picks: draft.picks,
		equipment: equipmentRows(rules, draft, resolveFeatures(rules, resolverDraft(draft))),
		classSpells: draft.classSpells
	};
}
/** `draftToCharacterInput`, or null when the draft is not complete enough to map. */
function tryDraftToCharacterInput(rules, draft) {
	try {
		return draftToCharacterInput(rules, draft);
	} catch {
		return null;
	}
}
export { equipmentGroupKeys as A, methodPatch as C, rollTotal as D, rollAbilityScores as E, resolveFeatures as F, equipmentRows as M, fixedEquipment as N, rollTotals as O, ownedEquipment as P, availableValues as S, pointsSpent as T, skillsStepGroups as _, WIZARD_RULES_KEYS as a, STANDARD_ARRAY as b, reconcile as c, spellsView as d, STEPS as f, lengthIssue as g, groupLabel as h, LIMITS as i, equipmentGroups as j, categoryItems as k, resolverDraft as l, groupIssues as m, cappedScore as n, changedDraftFields as o, computeSteps as p, deriveStats as r, emptyDraft as s, tryDraftToCharacterInput as t, spellPickFlags as u, ABILITY_LABELS as v, pointCost as w, arrangementProblem as x, POINT_BUY as y };

//# sourceMappingURL=save.js.map