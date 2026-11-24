import { t as error } from "../../../../../chunks/exports.js";
import { I as loadWizardRules, P as canAct, i as sessions, n as library } from "../../../../../chunks/campaign.js";
import { a as permissions, o as play } from "../../../../../chunks/bridge.js";
import { n as detailToSummaryData, t as buildSummary } from "../../../../../chunks/summary.js";
import { s as ABILITY_KEYS } from "../../../../../chunks/schema.js";
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
// src/routes/campaigns/[id]/play/+page.server.ts
/** The play console: the Party's sheets, the open Floor, the timeline, the Journal and any permission prompt, begun or not. */
var load = ({ params }) => {
	const entry = library.get(params.id);
	if (!entry) error(404, "Campaign not found");
	if (entry.status === "missing") error(404, "This Campaign's folder is missing");
	return {
		campaign: {
			id: entry.id,
			name: entry.name,
			path: entry.path,
			status: entry.status
		},
		sheets: playSheets(library.party(entry.id)),
		floor: library.floor(entry.id).current(),
		timeline: play.timeline(entry.id),
		scene: play.scene(entry.id),
		journal: library.record(entry.id).journal(),
		permission: permissions.pending(entry.id),
		attached: sessions.list()
	};
};
export { load };

//# sourceMappingURL=_page.server.ts.js.map