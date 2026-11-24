import { $ as equipmentContent, At as asc, B as choiceOption, Bt as sql, Ct as traitProficiency, F as backgroundEquipment, G as classSavingThrow, Gt as DUNGEON_MASTER_HOME, H as classLevel, I as backgroundOption, J as condition, K as classStartingEquipment, L as backgroundOptionAlignment, M as abilityScoreMethod, N as alignment, Nt as eq, P as background, Q as equipmentCategoryItem, R as backgroundProficiency, St as trait, U as classLevelFeature, Ut as DATABASE_URL, V as choiceOptionItem, W as classProficiency, X as equipment, Y as damageType, Z as equipmentCategory, _t as spellClass, a as seedRulesData, at as monster, bt as subraceAbilityBonus, c as openDatabase, ct as proficiency, dt as raceLanguage, et as equipmentWeaponProperty, ft as raceTrait, gt as spell, ht as skill, i as userStateDir, it as magicSchool, j as ability, lt as race, mt as rulesDataset, nt as language, ot as monsterConditionImmunity, pt as ruleSection, q as classTable, rt as magicItem, s as migrateDatabase, st as monsterProficiency, tt as feature, ut as raceAbilityBonus, vt as subclass, wt as weaponProperty, xt as subraceTrait, yt as subrace, z as choiceGroup } from "../../../chunks/paths.js";
import path from "node:path";
// src/lib/server/db/index.ts
var db;
/**
* The server's own rules database (for the credits page), opened on first use so building the
* app opens nothing. Defaults to `rules.db` in the user-level state directory.
*/
function rulesDatabase() {
	if (!db) {
		db = openDatabase(DATABASE_URL || path.join(userStateDir({ DUNGEON_MASTER_HOME }), "rules.db"));
		migrateDatabase(db);
		seedRulesData(db);
	}
	return db;
}
// src/lib/rules/attribution.ts
/** Attribution the CC-BY-4.0 licence of the SRD 5.1 requires, in its exact published wording. */
var SRD_ATTRIBUTION = "This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.";
var SRD_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/legalcode";
/** The MIT licence of the 5e-bits/5e-database data the SRD content is normalized from. */
var DATABASE_MIT_NOTICE = `MIT License

Copyright (c) [2018-2020] [Adrian Padua, Christopher Ward]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
// src/lib/server/rules/credits.ts
/** Each kind of SRD content the seeded Rules Data includes, with how many entries it has. */
function contents(repo) {
	return [
		{
			name: "Races",
			count: repo.races().length
		},
		{
			name: "Subraces",
			count: repo.subraces().length
		},
		{
			name: "Classes",
			count: repo.classes().length
		},
		{
			name: "Subclasses",
			count: repo.subclasses().length
		},
		{
			name: "Class features",
			count: repo.features().length
		},
		{
			name: "Backgrounds",
			count: repo.backgrounds().filter((b) => !b.appAuthored).length
		},
		{
			name: "Spells",
			count: repo.spells().length
		},
		{
			name: "Equipment",
			count: repo.equipment().length
		},
		{
			name: "Magic items",
			count: repo.magicItems().length
		},
		{
			name: "Monsters",
			count: repo.monsters().length
		},
		{
			name: "Conditions",
			count: repo.conditions().length
		},
		{
			name: "Rules sections",
			count: repo.ruleSections().length
		}
	];
}
/** What the credits page shows: the licence texts and the seeded dataset version. */
function loadCredits(repo) {
	const dataset = repo.datasetInfo();
	return {
		attribution: SRD_ATTRIBUTION,
		licenseUrl: SRD_LICENSE_URL,
		mitNotice: DATABASE_MIT_NOTICE,
		dataset: dataset && {
			version: dataset.datasetVersion,
			tag: dataset.sourceTag,
			repository: dataset.sourceRepository,
			srdVersion: dataset.srdVersion,
			contents: contents(repo)
		}
	};
}
// src/lib/server/rules/repository.ts
function group(rows, key) {
	const out = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const list = out.get(key(row));
		if (list) list.push(row);
		else out.set(key(row), [row]);
	}
	return out;
}
var slugs = (rows) => new Map(rows.map((r) => [r.id, r.slug]));
function createRulesRepository(db) {
	const abilitySlugs = () => slugs(db.select().from(ability).all());
	const choiceGroups = (ownerType) => {
		const groups = db.select().from(choiceGroup).where(eq(choiceGroup.ownerType, ownerType)).all();
		const options = db.select().from(choiceOption).orderBy(asc(choiceOption.position)).all();
		const items = db.select().from(choiceOptionItem).orderBy(asc(choiceOptionItem.position)).all();
		const proficiency$5 = slugs(db.select().from(proficiency).all());
		const language$2 = slugs(db.select().from(language).all());
		const ability = abilitySlugs();
		const equipment$2 = slugs(db.select().from(equipment).all());
		const category = slugs(db.select().from(equipmentCategory).all());
		const itemsByOption = group(items, (i) => i.optionId);
		const optionsByGroup = group(options, (o) => o.groupId);
		const toItem = (i) => {
			switch (i.itemType) {
				case "proficiency": return {
					type: "proficiency",
					proficiency: proficiency$5.get(i.proficiencyId)
				};
				case "language": return {
					type: "language",
					language: language$2.get(i.languageId)
				};
				case "abilityBonus": return {
					type: "abilityBonus",
					ability: ability.get(i.abilityId),
					bonus: i.bonus
				};
				case "equipment": return {
					type: "equipment",
					equipment: equipment$2.get(i.equipmentId),
					count: i.count,
					requiresProficiency: i.requiresProficiencyId ? proficiency$5.get(i.requiresProficiencyId) : null
				};
				case "equipmentCategory": return {
					type: "equipmentCategory",
					category: category.get(i.equipmentCategoryId),
					count: i.count
				};
			}
		};
		const byOwner = /* @__PURE__ */ new Map();
		for (const g of groups) {
			const built = {
				key: g.key.split("/").slice(2).join("/"),
				kind: g.kind,
				choose: g.choose,
				description: g.description,
				options: (optionsByGroup.get(g.id) ?? []).map((o) => ({ items: (itemsByOption.get(o.id) ?? []).map(toItem) }))
			};
			const list = byOwner.get(g.ownerSlug);
			if (list) list.push(built);
			else byOwner.set(g.ownerSlug, [built]);
		}
		return byOwner;
	};
	const bonuses = (rows) => {
		const ability = abilitySlugs();
		return rows.map((r) => ({
			ability: ability.get(r.abilityId),
			bonus: r.bonus
		}));
	};
	function races() {
		const rows = db.select().from(race).orderBy(asc(race.slug)).all();
		const choices = choiceGroups("race");
		const bonusRows = group(db.select().from(raceAbilityBonus).all(), (r) => r.raceId);
		const languageRows = group(db.select().from(raceLanguage).all(), (r) => r.raceId);
		const traitRows = group(db.select().from(raceTrait).all(), (r) => r.raceId);
		const language$1 = slugs(db.select().from(language).all());
		const trait$3 = slugs(db.select().from(trait).all());
		return rows.map((r) => ({
			...r,
			abilityBonuses: bonuses(bonusRows.get(r.id) ?? []),
			languages: (languageRows.get(r.id) ?? []).map((l) => language$1.get(l.languageId)),
			traits: (traitRows.get(r.id) ?? []).map((x) => trait$3.get(x.traitId)),
			choiceGroups: choices.get(r.slug) ?? []
		}));
	}
	function subraces() {
		const race$1 = slugs(db.select().from(race).all());
		const bonusRows = group(db.select().from(subraceAbilityBonus).all(), (r) => r.subraceId);
		const traitRows = group(db.select().from(subraceTrait).all(), (r) => r.subraceId);
		const trait$2 = slugs(db.select().from(trait).all());
		return db.select().from(subrace).orderBy(asc(subrace.slug)).all().map(({ raceId, ...s }) => ({
			...s,
			race: race$1.get(raceId),
			abilityBonuses: bonuses(bonusRows.get(s.id) ?? []),
			traits: (traitRows.get(s.id) ?? []).map((x) => trait$2.get(x.traitId))
		}));
	}
	function traits() {
		const rows = db.select().from(trait).orderBy(asc(trait.slug)).all();
		const trait$1 = slugs(rows);
		const proficiency$2 = slugs(db.select().from(proficiency).all());
		const profRows = group(db.select().from(traitProficiency).all(), (r) => r.traitId);
		const choices = choiceGroups("trait");
		return rows.map(({ parentId, ...r }) => ({
			...r,
			parent: parentId ? trait$1.get(parentId) : null,
			proficiencies: (profRows.get(r.id) ?? []).map((p) => proficiency$2.get(p.proficiencyId)),
			choiceGroups: choices.get(r.slug) ?? []
		}));
	}
	function classes() {
		const rows = db.select().from(classTable).orderBy(asc(classTable.slug)).all();
		const ability = abilitySlugs();
		const proficiency$4 = slugs(db.select().from(proficiency).all());
		const equipment$3 = slugs(db.select().from(equipment).all());
		const saves = group(db.select().from(classSavingThrow).all(), (r) => r.classId);
		const profs = group(db.select().from(classProficiency).all(), (r) => r.classId);
		const gear = group(db.select().from(classStartingEquipment).all(), (r) => r.classId);
		const choices = choiceGroups("class");
		return rows.map(({ spellcastingAbilityId, ...c }) => ({
			...c,
			spellcastingAbility: spellcastingAbilityId ? ability.get(spellcastingAbilityId) : null,
			savingThrows: (saves.get(c.id) ?? []).map((s) => ability.get(s.abilityId)),
			proficiencies: (profs.get(c.id) ?? []).map((p) => proficiency$4.get(p.proficiencyId)),
			startingEquipment: (gear.get(c.id) ?? []).map((e) => ({
				item: equipment$3.get(e.itemId),
				quantity: e.quantity
			})),
			choiceGroups: choices.get(c.slug) ?? []
		}));
	}
	function classLevels(classSlug) {
		const cls = db.select().from(classTable).where(eq(classTable.slug, classSlug)).get();
		if (!cls) return [];
		const feature$2 = slugs(db.select().from(feature).all());
		const levels = db.select().from(classLevel).where(eq(classLevel.classId, cls.id)).orderBy(asc(classLevel.level)).all();
		const links = group(db.select().from(classLevelFeature).all(), (r) => r.classLevelId);
		return levels.map((l) => ({
			...l,
			features: (links.get(l.id) ?? []).map((f) => feature$2.get(f.featureId))
		}));
	}
	function subclasses() {
		const cls = slugs(db.select().from(classTable).all());
		return db.select().from(subclass).orderBy(asc(subclass.slug)).all().map(({ classId, ...s }) => ({
			...s,
			class: cls.get(classId)
		}));
	}
	function features(filter = {}) {
		const cls = slugs(db.select().from(classTable).all());
		const sub = slugs(db.select().from(subclass).all());
		const rows = db.select().from(feature).orderBy(asc(feature.slug)).all();
		const feature$1 = slugs(rows);
		return rows.map(({ classId, subclassId, parentId, ...f }) => ({
			...f,
			class: cls.get(classId),
			subclass: subclassId ? sub.get(subclassId) : null,
			parent: parentId ? feature$1.get(parentId) : null
		})).filter((f) => (filter.classSlug === void 0 || f.class === filter.classSlug) && (filter.level === void 0 || f.level === filter.level));
	}
	function spells(filter = {}) {
		const school = slugs(db.select().from(magicSchool).all());
		const ability = abilitySlugs();
		const cls = slugs(db.select().from(classTable).all());
		const links = group(db.select().from(spellClass).all(), (r) => r.spellId);
		return db.select().from(spell).orderBy(asc(spell.slug)).all().map(({ schoolId, dcAbilityId, ...s }) => ({
			...s,
			school: school.get(schoolId),
			dcAbility: dcAbilityId ? ability.get(dcAbilityId) : null,
			classes: (links.get(s.id) ?? []).map((l) => cls.get(l.classId)).sort()
		})).filter((s) => (filter.level === void 0 || s.level === filter.level) && (filter.classSlug === void 0 || s.classes.includes(filter.classSlug)));
	}
	function equipment$1(filter = {}) {
		const category = slugs(db.select().from(equipmentCategory).all());
		const damage = slugs(db.select().from(damageType).all());
		const property = slugs(db.select().from(weaponProperty).all());
		const rows = db.select().from(equipment).orderBy(asc(equipment.slug)).all();
		const item = slugs(rows);
		const props = group(db.select().from(equipmentWeaponProperty).all(), (r) => r.equipmentId);
		const contents = group(db.select().from(equipmentContent).all(), (r) => r.packId);
		const inCategory = group(db.select().from(equipmentCategoryItem).all(), (r) => r.equipmentId);
		return rows.map(({ categoryId, gearCategoryId, damageTypeId, twoHandedDamageTypeId, ...e }) => ({
			...e,
			category: category.get(categoryId),
			gearCategory: gearCategoryId ? category.get(gearCategoryId) : null,
			damageType: damageTypeId ? damage.get(damageTypeId) : null,
			twoHandedDamageType: twoHandedDamageTypeId ? damage.get(twoHandedDamageTypeId) : null,
			properties: (props.get(e.id) ?? []).map((p) => property.get(p.propertyId)).sort(),
			contents: (contents.get(e.id) ?? []).map((c) => ({
				item: item.get(c.itemId),
				quantity: c.quantity
			})),
			categories: (inCategory.get(e.id) ?? []).map((c) => category.get(c.categoryId)).sort()
		})).filter((e) => filter.categorySlug === void 0 || e.categories.includes(filter.categorySlug));
	}
	function backgrounds() {
		const proficiency$3 = slugs(db.select().from(proficiency).all());
		const item = slugs(db.select().from(equipment).all());
		const alignment$1 = slugs(db.select().from(alignment).all());
		const profs = group(db.select().from(backgroundProficiency).all(), (r) => r.backgroundId);
		const gear = group(db.select().from(backgroundEquipment).all(), (r) => r.backgroundId);
		const options = group(db.select().from(backgroundOption).orderBy(asc(backgroundOption.kind), asc(backgroundOption.position)).all(), (o) => o.backgroundId);
		const optionAlignments = group(db.select().from(backgroundOptionAlignment).all(), (r) => r.optionId);
		const choices = choiceGroups("background");
		return db.select().from(background).orderBy(asc(background.slug)).all().map((b) => ({
			...b,
			proficiencies: (profs.get(b.id) ?? []).map((p) => proficiency$3.get(p.proficiencyId)),
			startingEquipment: (gear.get(b.id) ?? []).map((e) => ({
				item: item.get(e.itemId),
				quantity: e.quantity
			})),
			options: (options.get(b.id) ?? []).map((o) => ({
				kind: o.kind,
				text: o.text,
				alignments: (optionAlignments.get(o.id) ?? []).map((a) => alignment$1.get(a.alignmentId))
			})),
			choiceGroups: choices.get(b.slug) ?? []
		}));
	}
	function monsters() {
		const proficiency$1 = slugs(db.select().from(proficiency).all());
		const condition$1 = slugs(db.select().from(condition).all());
		const profs = group(db.select().from(monsterProficiency).orderBy(asc(monsterProficiency.position)).all(), (r) => r.monsterId);
		const immunities = group(db.select().from(monsterConditionImmunity).all(), (r) => r.monsterId);
		return db.select().from(monster).orderBy(asc(monster.slug)).all().map(({ str, dex, con, int, wis, cha, ...m }) => ({
			...m,
			abilityScores: {
				str,
				dex,
				con,
				int,
				wis,
				cha
			},
			proficiencies: (profs.get(m.id) ?? []).map((p) => ({
				proficiency: proficiency$1.get(p.proficiencyId),
				value: p.value
			})),
			conditionImmunities: (immunities.get(m.id) ?? []).map((c) => condition$1.get(c.conditionId)).sort()
		}));
	}
	function magicItems() {
		const category = slugs(db.select().from(equipmentCategory).all());
		const rows = db.select().from(magicItem).orderBy(asc(magicItem.slug)).all();
		const item = slugs(rows);
		const variants = group(rows.filter((r) => r.variantOfId !== null), (r) => r.variantOfId);
		return rows.map(({ categoryId, variantOfId, ...i }) => ({
			...i,
			category: category.get(categoryId),
			variantOf: variantOfId ? item.get(variantOfId) : null,
			variants: (variants.get(i.id) ?? []).map((v) => v.slug)
		}));
	}
	const conditions = () => db.select().from(condition).orderBy(asc(condition.slug)).all();
	const ruleSections = () => db.select().from(ruleSection).orderBy(asc(ruleSection.slug)).all();
	/** Each rules kind a handle can name, and how to read its entries. */
	const kinds = {
		spell: () => spells(),
		monster: monsters,
		condition: conditions,
		"magic-item": magicItems,
		rule: ruleSections
	};
	/** Resolves a rules handle (`monster:goblin`, `condition:prone`) to its entry, or null. */
	function entry(handle) {
		const [kind, slug, ...rest] = handle.split(":");
		if (rest.length || !slug || !Object.hasOwn(kinds, kind)) return null;
		const found = kinds[kind]().find((e) => e.slug === slug);
		return found ? {
			handle,
			kind,
			name: found.name,
			entry: found
		} : null;
	}
	/**
	* Ranked matches for a free-text query across every rules kind. An entry named exactly by the
	* query comes first; then entries holding every word, then entries holding any, by relevance
	* (a word in the name weighs more than one in the text). Words match other forms of themselves
	* ("grappling" finds Grappled).
	*/
	function search(query, { limit = 10 } = {}) {
		const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
		if (!words.length) return [];
		const terms = words.map((w) => `"${w}"`);
		const name = words.join(" ");
		const run = (match, max) => db.all(sql`
        SELECT handle, kind, name,
          snippet(rules_search, 3, '', '', '…', 16) AS snippet
        FROM rules_search
        WHERE rules_search MATCH ${match}
        ORDER BY lower(name) = ${name} DESC, bm25(rules_search, 0, 0, 10, 1)
        LIMIT ${max}
      `);
		const results = run(terms.join(" AND "), limit);
		if (results.length < limit && terms.length > 1) {
			const seen = new Set(results.map((r) => r.handle));
			for (const r of run(terms.join(" OR "), limit)) {
				if (results.length >= limit) break;
				if (!seen.has(r.handle)) results.push(r);
			}
		}
		return results;
	}
	return {
		datasetInfo: () => db.select().from(rulesDataset).where(eq(rulesDataset.id, 1)).get() ?? null,
		abilities: () => db.select().from(ability).orderBy(asc(ability.id)).all(),
		skills: () => {
			const ability = abilitySlugs();
			return db.select().from(skill).orderBy(asc(skill.slug)).all().map(({ abilityId, ...s }) => ({
				...s,
				ability: ability.get(abilityId)
			}));
		},
		languages: () => db.select().from(language).orderBy(asc(language.slug)).all(),
		alignments: () => db.select().from(alignment).orderBy(asc(alignment.id)).all(),
		proficiencies: () => db.select().from(proficiency).orderBy(asc(proficiency.slug)).all(),
		traits,
		races,
		race: (slug) => races().find((r) => r.slug === slug) ?? null,
		subraces,
		classes,
		classBySlug: (slug) => classes().find((c) => c.slug === slug) ?? null,
		classLevels,
		subclasses,
		features,
		spells,
		spell: (slug) => spells().find((s) => s.slug === slug) ?? null,
		equipment: equipment$1,
		equipmentItem: (slug) => equipment$1().find((e) => e.slug === slug) ?? null,
		backgrounds,
		background: (slug) => backgrounds().find((b) => b.slug === slug) ?? null,
		monsters,
		conditions,
		magicItems,
		ruleSections,
		entry,
		search,
		abilityScoreMethods: () => db.select().from(abilityScoreMethod).orderBy(asc(abilityScoreMethod.id)).all()
	};
}
// src/routes/credits/+page.server.ts
var load = () => loadCredits(createRulesRepository(rulesDatabase()));
export { load };

//# sourceMappingURL=_page.server.ts.js.map