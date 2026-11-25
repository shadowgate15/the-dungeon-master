import { a as discriminatedUnion, c as literal, d as record, f as strictObject, i as boolean, l as number, m as union, n as _null, p as string, r as array, s as lazy, t as _enum } from "./schemas.js";
// src/lib/rules/registry.ts
/**
* Code registry for the few features whose effect is arithmetic rather than text (#96). Everything
* else in the SRD is narrative and is never evaluated. Each entry is a pure function keyed by the
* feature or trait slug it implements; derived stats (#105) call them with the resolver's active
* feature slugs. Pure: no database or server imports.
*/
/** The six abilities in canonical order; the single source for every ability list. */
var ABILITY_KEYS = [
	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha"
];
/** Unarmored Defense x3: Barbarian, Monk and the Draconic Sorcerer (Draconic Resilience). */
var UNARMORED = {
	"barbarian-unarmored-defense": {
		base: 10,
		abilities: ["dex", "con"],
		shieldAllowed: true
	},
	"monk-unarmored-defense": {
		base: 10,
		abilities: ["dex", "wis"],
		shieldAllowed: false
	},
	"draconic-resilience": {
		base: 13,
		abilities: ["dex"],
		shieldAllowed: true
	}
};
/** AC from one unarmored formula, or null when it does not apply to this feature or loadout. */
function unarmoredDefenseAc(featureSlug, mods, state) {
	const formula = UNARMORED[featureSlug];
	if (!formula || state.armor || state.shield && !formula.shieldAllowed) return null;
	return formula.base + formula.abilities.reduce((sum, a) => sum + mods[a], 0);
}
/** The best unarmored formula among the active features, with the feature that provided it. */
function bestUnarmoredAc(activeSlugs, mods, state) {
	let best = null;
	for (const slug of activeSlugs) {
		const value = unarmoredDefenseAc(slug, mods, state);
		if (value !== null && (!best || value > best.value)) best = {
			value,
			source: slug
		};
	}
	return best;
}
/** Hill Dwarf: +1 hit point maximum, and +1 per level. */
var dwarvenToughnessHp = (level) => level;
/** Draconic Bloodline Sorcerer: +1 hit point maximum, and +1 per level. */
var draconicResilienceHp = (level) => level;
var HP_BONUS = {
	"dwarven-toughness": dwarvenToughnessHp,
	"draconic-resilience": draconicResilienceHp
};
/** Flat hit point maximum bonus from every active registered feature. */
function hpBonus(activeSlugs, level) {
	return activeSlugs.reduce((sum, slug) => sum + (HP_BONUS[slug]?.(level) ?? 0), 0);
}
/** Fighting Style: Defense, +1 AC while wearing armor. */
var fightingStyleDefenseAc = (armor) => armor ? 1 : 0;
var AC_BONUS = { "fighter-fighting-style-defense": (state) => fightingStyleDefenseAc(state.armor) };
/** Flat AC bonus from every active registered feature. */
function acBonus(activeSlugs, state) {
	return activeSlugs.reduce((sum, slug) => sum + (AC_BONUS[slug]?.(state) ?? 0), 0);
}
/** Fighting Style: Archery, +2 to attack rolls with ranged weapons. */
function weaponAttackBonus(activeSlugs, weapon) {
	return weapon.ranged && activeSlugs.includes("fighter-fighting-style-archery") ? 2 : 0;
}
/**
* Fighting Style: Dueling, +2 damage with a melee weapon held in one hand. Whether the other hand
* is free is not tracked (no off-hand logic), so any melee weapon that is not two-handed counts.
*/
function weaponDamageBonus(activeSlugs, weapon) {
	return !weapon.ranged && !weapon.twoHanded && activeSlugs.includes("fighter-fighting-style-dueling") ? 2 : 0;
}
// src/lib/rules/schema.ts
/**
* The normalized Rules Data format: what the build-time normalizer writes to
* `src/lib/rules/data/*.json`, what the seed reads, and what the app's own data (ability score
* methods, the custom background) is authored in. Everything is keyed by a stable slug (the
* upstream `index`); cross-references are slugs, never URLs. Pure: no database or server imports.
*/
var slug = string().regex(/^[a-z0-9]+(?:-+[a-z0-9]+)*$/, "must be a slug");
var text = string();
var lines = array(string());
var int = number().int();
var nullableText = string().nullable();
var nullableInt = int.nullable();
/** Arbitrary upstream JSON kept as-is where no rule has needed it as columns yet. */
var jsonValue = lazy(() => union([
	string(),
	number(),
	boolean(),
	_null(),
	array(jsonValue),
	record(string(), jsonValue)
]));
var nullableJson = jsonValue.nullable();
/** What a choice group picks: the kind decides which `OptionItem` types its options hold. */
var CHOICE_KINDS = [
	"proficiency",
	"language",
	"abilityBonus",
	"equipment"
];
/** Entities that own choice groups. */
var CHOICE_OWNER_TYPES = [
	"class",
	"race",
	"trait",
	"background"
];
/**
* One thing an option hands out. A wildcard such as "any martial melee weapon" is an
* `equipmentCategory` item: the player picks `count` items out of the category.
*/
var optionItem = discriminatedUnion("type", [
	strictObject({
		type: literal("proficiency"),
		proficiency: slug
	}),
	strictObject({
		type: literal("language"),
		language: slug
	}),
	strictObject({
		type: literal("abilityBonus"),
		ability: slug,
		bonus: int
	}),
	strictObject({
		type: literal("equipment"),
		equipment: slug,
		count: int,
		/** The option is only usable while proficient with this (Cleric "if proficient"). */
		requiresProficiency: slug.nullable()
	}),
	strictObject({
		type: literal("equipmentCategory"),
		category: slug,
		count: int
	})
]);
/** A selectable bundle: choosing the option grants all of its items. */
var choiceOption = strictObject({ items: array(optionItem).min(1) });
/** "Choose `choose` of these options". Flat: nested upstream choices are folded in. */
var choiceGroup = strictObject({
	/** Unique within its owner; the full key is `${ownerType}/${ownerSlug}/${key}`. */
	key: string().regex(/^[a-zA-Z]+-\d+$/),
	kind: _enum(CHOICE_KINDS),
	choose: int.positive(),
	description: nullableText,
	options: array(choiceOption).min(1)
});
var withChoices = { choiceGroups: array(choiceGroup) };
var ability = strictObject({
	slug,
	name: text,
	fullName: text,
	description: lines
});
var skill = strictObject({
	slug,
	name: text,
	ability: slug,
	description: lines
});
var language = strictObject({
	slug,
	name: text,
	type: text,
	script: nullableText,
	typicalSpeakers: lines,
	description: nullableText
});
var alignment = strictObject({
	slug,
	name: text,
	abbreviation: text,
	description: text
});
var damageType = strictObject({
	slug,
	name: text,
	description: lines
});
var magicSchool = strictObject({
	slug,
	name: text,
	description: text
});
var weaponProperty = strictObject({
	slug,
	name: text,
	description: lines
});
var PROFICIENCY_REFERENCE_TYPES = [
	"equipment",
	"equipment-category",
	"skill",
	"ability"
];
var proficiency = strictObject({
	slug,
	name: text,
	type: text,
	reference: strictObject({
		type: _enum(PROFICIENCY_REFERENCE_TYPES),
		slug
	}).nullable()
});
var equipmentCategory = strictObject({
	slug,
	name: text,
	/** Member item slugs, sorted. */
	items: array(slug)
});
var damage = strictObject({
	dice: text,
	type: slug
});
var range = strictObject({
	normal: int,
	long: nullableInt
});
var equipment = strictObject({
	slug,
	name: text,
	category: slug,
	gearCategory: slug.nullable(),
	description: lines,
	costQuantity: number(),
	costUnit: text,
	weight: number().nullable(),
	weaponCategory: nullableText,
	weaponRange: nullableText,
	categoryRange: nullableText,
	damage: damage.nullable(),
	twoHandedDamage: damage.nullable(),
	range: range.nullable(),
	throwRange: range.nullable(),
	properties: array(slug),
	special: lines,
	armorCategory: nullableText,
	armorClassBase: nullableInt,
	armorClassDexBonus: boolean().nullable(),
	armorClassMaxBonus: nullableInt,
	strMinimum: nullableInt,
	stealthDisadvantage: boolean().nullable(),
	toolCategory: nullableText,
	vehicleCategory: nullableText,
	speedQuantity: number().nullable(),
	speedUnit: nullableText,
	capacity: nullableText,
	/** Items bundled into a pack. */
	contents: array(strictObject({
		item: slug,
		quantity: int
	})),
	/** Units per purchase (arrows come 20 to a quiver). */
	quantity: nullableInt
});
var abilityBonus = strictObject({
	ability: slug,
	bonus: int
});
var trait = strictObject({
	slug,
	name: text,
	description: lines,
	parent: slug.nullable(),
	/** Proficiencies the trait grants outright. */
	proficiencies: array(slug),
	/** Upstream `trait_specific` (spell options, ancestry, breath weapon...) kept as JSON. */
	specific: nullableJson,
	...withChoices
});
var race = strictObject({
	slug,
	name: text,
	speed: int,
	size: text,
	sizeDescription: text,
	age: text,
	alignment: text,
	languageDescription: text,
	abilityBonuses: array(abilityBonus),
	languages: array(slug),
	traits: array(slug),
	...withChoices
});
var subrace = strictObject({
	slug,
	name: text,
	race: slug,
	description: text,
	abilityBonuses: array(abilityBonus),
	traits: array(slug)
});
var classSpellcasting = strictObject({
	level: int,
	ability: slug,
	info: array(strictObject({
		name: text,
		description: lines
	}))
});
var classEntity = strictObject({
	slug,
	name: text,
	hitDie: int,
	savingThrows: array(slug),
	proficiencies: array(slug),
	startingEquipment: array(strictObject({
		item: slug,
		quantity: int
	})),
	spellcasting: classSpellcasting.nullable(),
	...withChoices
});
/** Spell slots by spell level 1 to 9, as `[level1, ..., level9]`. */
var levelSpellcasting = strictObject({
	cantripsKnown: nullableInt,
	spellsKnown: nullableInt,
	slots: array(int).length(9)
});
var classLevel = strictObject({
	class: slug,
	level: int.min(1).max(20),
	abilityScoreBonuses: int,
	proficiencyBonus: int,
	features: array(slug),
	spellcasting: levelSpellcasting.nullable(),
	classSpecific: nullableJson
});
var subclass = strictObject({
	slug,
	name: text,
	class: slug,
	flavor: text,
	description: lines,
	/** Spells the subclass always has (domain spells), from `minClassLevel`. */
	spells: array(strictObject({
		spell: slug,
		minClassLevel: int
	}))
});
var subclassLevel = strictObject({
	subclass: slug,
	level: int.min(1).max(20),
	features: array(slug),
	subclassSpecific: nullableJson
});
var feature = strictObject({
	slug,
	name: text,
	class: slug,
	subclass: slug.nullable(),
	level: int.min(1).max(20),
	description: lines,
	parent: slug.nullable(),
	/** Upstream `reference` (e.g. a class's spellcasting path), kept as-is. */
	reference: nullableText,
	/** Upstream `feature_specific` (expertise options, invocations...) kept as JSON. */
	specific: nullableJson
});
var spell = strictObject({
	slug,
	name: text,
	level: int.min(0).max(9),
	school: slug,
	description: lines,
	higherLevel: lines,
	range: text,
	components: array(text),
	material: nullableText,
	ritual: boolean(),
	concentration: boolean(),
	duration: text,
	castingTime: text,
	attackType: nullableText,
	dc: strictObject({
		ability: slug,
		success: text,
		description: nullableText
	}).nullable(),
	areaOfEffect: strictObject({
		type: text,
		size: int
	}).nullable(),
	/** Damage by slot or character level, upstream shape kept as JSON. */
	damage: nullableJson,
	healAtSlotLevel: nullableJson,
	classes: array(slug)
});
var abilityScores = strictObject({
	str: int,
	dex: int,
	con: int,
	int,
	wis: int,
	cha: int
});
/** A full SRD stat block. Attack, trait and action entries keep the upstream shape as JSON. */
var monster = strictObject({
	slug,
	name: text,
	size: text,
	type: text,
	subtype: nullableText,
	alignment: text,
	/** Each way the AC is worked out (natural, armor, spell...), upstream shape kept as JSON. */
	armorClass: array(jsonValue),
	hitPoints: int,
	hitDice: text,
	hitPointsRoll: text,
	/** Movement modes to distances (`{ walk: "30 ft." }`); `hover` is a boolean. */
	speed: record(string(), union([string(), boolean()])),
	abilityScores,
	/** Saving throw and skill bonuses. */
	proficiencies: array(strictObject({
		proficiency: slug,
		value: int
	})),
	damageVulnerabilities: array(text),
	damageResistances: array(text),
	damageImmunities: array(text),
	conditionImmunities: array(slug),
	senses: record(string(), union([string(), number()])),
	languages: text,
	challengeRating: number(),
	proficiencyBonus: int,
	xp: int,
	specialAbilities: array(jsonValue),
	actions: array(jsonValue),
	legendaryActions: array(jsonValue),
	reactions: array(jsonValue),
	/** Other stat blocks the same creature can take (a vampire's bat and mist forms). */
	forms: array(slug),
	description: nullableText
});
var condition = strictObject({
	slug,
	name: text,
	description: lines
});
var magicItem = strictObject({
	slug,
	name: text,
	category: slug,
	rarity: text,
	/** Specific versions of a generic item ("Ammunition, +1"), each its own magic item. */
	variants: array(slug),
	/** The generic item this one is a version of. */
	variantOf: slug.nullable(),
	description: lines
});
/** One section of the SRD rules text, under its top-level rule (Combat, Spellcasting...). */
var ruleSection = strictObject({
	slug,
	name: text,
	rule: slug,
	ruleName: text,
	/** The section's text, in Markdown. */
	description: text
});
var BACKGROUND_OPTION_KINDS = [
	"personalityTrait",
	"ideal",
	"bond",
	"flaw"
];
var background = strictObject({
	slug,
	name: text,
	/** True for rules the app defines itself because the SRD is silent. */
	appAuthored: boolean(),
	description: nullableText,
	feature: strictObject({
		name: text,
		description: lines
	}).nullable(),
	proficiencies: array(slug),
	startingEquipment: array(strictObject({
		item: slug,
		quantity: int
	})),
	startingGoldQuantity: number().nullable(),
	startingGoldUnit: nullableText,
	/** The SRD personality, ideal, bond and flaw tables. */
	options: array(strictObject({
		kind: _enum(BACKGROUND_OPTION_KINDS),
		text,
		alignments: array(slug)
	})),
	...withChoices
});
/**
* Ability score methods are PHB mechanics the SRD leaves out, so they are defined here, not
* imported. Their configuration is data: the repository returns it and code reads the numbers.
*/
var abilityScoreMethod = strictObject({
	slug,
	name: text,
	description: text,
	appAuthored: literal(true),
	config: discriminatedUnion("type", [
		strictObject({
			type: literal("standardArray"),
			values: array(int).length(6)
		}),
		strictObject({
			type: literal("pointBuy"),
			budget: int,
			min: int,
			max: int,
			/** Point cost by base score, e.g. `{ "8": 0, "15": 9 }`. */
			costs: record(string(), int)
		}),
		strictObject({
			type: literal("roll"),
			count: int,
			dice: int,
			sides: int,
			dropLowest: int
		})
	])
});
var datasetMeta = strictObject({
	/** The pinned 5e-bits release, without the leading "v": the dataset version shown in credits. */
	datasetVersion: text,
	sourceTag: text,
	sourceRepository: text,
	sourcePath: text,
	sourceLicense: literal("MIT"),
	srdVersion: literal("5.1"),
	srdLicense: literal("CC-BY-4.0")
});
var rulesDataset = strictObject({
	meta: datasetMeta,
	abilities: array(ability),
	skills: array(skill),
	languages: array(language),
	alignments: array(alignment),
	damageTypes: array(damageType),
	magicSchools: array(magicSchool),
	weaponProperties: array(weaponProperty),
	proficiencies: array(proficiency),
	equipmentCategories: array(equipmentCategory),
	equipment: array(equipment),
	traits: array(trait),
	races: array(race),
	subraces: array(subrace),
	classes: array(classEntity),
	classLevels: array(classLevel),
	subclasses: array(subclass),
	subclassLevels: array(subclassLevel),
	features: array(feature),
	spells: array(spell),
	monsters: array(monster),
	conditions: array(condition),
	magicItems: array(magicItem),
	ruleSections: array(ruleSection),
	backgrounds: array(background),
	abilityScoreMethods: array(abilityScoreMethod)
});
export { rulesDataset as a, acBonus as c, weaponAttackBonus as d, weaponDamageBonus as f, PROFICIENCY_REFERENCE_TYPES as i, bestUnarmoredAc as l, CHOICE_KINDS as n, slug as o, CHOICE_OWNER_TYPES as r, ABILITY_KEYS as s, BACKGROUND_OPTION_KINDS as t, hpBonus as u };

//# sourceMappingURL=schema.js.map