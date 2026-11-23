import { A as fixedEquipment, M as resolveFeatures, c as resolverDraft, k as equipmentRows, r as deriveStats } from "./save.js";
// src/lib/character/summary.ts
function draftToSummaryData(rules, draft) {
	const resolved = resolveFeatures(rules, resolverDraft(draft));
	const custom = draft.background === "custom";
	return {
		...draft,
		equipment: equipmentRows(rules, draft, resolved),
		classSpells: draft.classSpells,
		customBackgroundName: custom ? draft.customBackgroundName : null,
		customBackgroundFeature: custom ? draft.customBackgroundFeature : null
	};
}
function detailToSummaryData(c) {
	return {
		name: c.name,
		alignment: c.alignment,
		race: c.raceSlug,
		subrace: c.subraceSlug,
		class: c.classSlug,
		subclass: c.subclassSlug,
		background: c.backgroundSlug,
		customBackgroundName: c.customBackgroundName,
		customBackgroundFeature: c.customBackgroundFeature,
		level: c.level,
		appearance: c.appearance ?? "",
		personality: c.personality ?? "",
		ideal: c.ideal ?? "",
		bond: c.bond ?? "",
		flaw: c.flaw ?? "",
		backstory: c.backstory ?? "",
		baseScores: {
			str: c.str,
			dex: c.dex,
			con: c.con,
			int: c.int,
			wis: c.wis,
			cha: c.cha
		},
		picks: c.picks,
		equipment: c.equipment.map((e) => ({
			item: e.item,
			quantity: e.quantity
		})),
		classSpells: c.classSpells
	};
}
function buildSummary(rules, data) {
	const resolved = resolveFeatures(rules, {
		race: data.race,
		subrace: data.subrace,
		class: data.class,
		subclass: data.subclass,
		background: data.background,
		picks: data.picks
	});
	const owned = [...fixedEquipment(rules, data).flatMap((f) => f.items), ...data.equipment ?? []].reduce((all, e) => {
		const row = all.find((r) => r.item === e.item);
		if (row) row.quantity += e.quantity;
		else all.push({
			item: e.item,
			quantity: e.quantity
		});
		return all;
	}, []);
	const stats = deriveStats(rules, resolved, {
		class: data.class,
		level: data.level,
		baseScores: data.baseScores,
		equipment: owned.map((e) => e.item)
	});
	const name = (list, slug) => slug === null ? null : list.find((e) => e.slug === slug)?.name ?? slug;
	const spellsBySlug = new Map(rules.spells.map((s) => [s.slug, s]));
	const spellSlugs = [
		...resolved.grantedSpells.map((s) => s.spell),
		...data.classSpells ?? [],
		...resolved.groups.filter((g) => g.kind === "spell").flatMap((g) => g.picks)
	];
	return {
		data,
		resolved,
		stats,
		names: {
			race: name(rules.races, data.race),
			subrace: name(rules.subraces, data.subrace),
			class: name(rules.classes, data.class),
			subclass: name(rules.subclasses, data.subclass),
			background: data.customBackgroundName || name(rules.backgrounds, data.background),
			alignment: name(rules.alignments, data.alignment)
		},
		equipment: owned.map((e) => ({
			name: name(rules.equipment, e.item) ?? e.item,
			quantity: e.quantity
		})),
		spells: [...new Set(spellSlugs)].map((slug) => spellsBySlug.get(slug)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
	};
}
export { detailToSummaryData as n, draftToSummaryData as r, buildSummary as t };

//# sourceMappingURL=summary.js.map