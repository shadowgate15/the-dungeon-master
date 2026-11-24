import { I as fact, K as race, N as belief, P as entity, St as DUNGEON_MASTER_VERSION, T as event, U as background, W as classTable, at as eq, bt as DUNGEON_MASTER_HOME, ct as inArray, g as character, h as campaign, ht as sql, it as and, mt as or, n as createRulesRepository, nt as asc, o as userStateDir, pt as ne, tt as SOLO_PLAYER, ut as isNull, v as characterDraft, xt as DUNGEON_MASTER_PORT, z as ENTITY_TYPES } from "./seed.js";
import { $ as saveBonus, A as logEvent, At as expectVersion, B as cancelPendingCall, Ct as pastArcs, D as createDmChannels, Dt as PLUGIN_NAME, Et as reviseArc, Ft as SESSION_LIVE_MESSAGE, G as damageSequence, H as openCall, I as DC_BY_TIER, J as sequenceText, K as rollAll, L as TIERS, M as setAwaitingNarration, Mt as writeTool, N as ABILITY_NAMES, Nt as formatClock, O as currentStamp, Ot as ToolError, Pt as parseClock, Q as mustAct, R as callInput, St as currentArc, Tt as retireArc, U as saveKey, V as createPendingCall, W as attackSequence, X as applyHealing, Y as applyDamage, Z as combatant, _ as closeSession, _t as resolveLinks, at as loadWizardRules, b as sessionsView, bt as CurrentArcError, c as CampaignNotFoundError, ct as advanceClock, dt as present, et as setConditions, f as SeedLockedError, ft as scenePlace, g as addConversationLine, gt as renderLinks, h as refuseLockedSeed, ht as fieldNames, i as sessions, j as nextEventId, jt as readTool, k as logActivity, kt as creationTool, l as NotACampaignFolderError, lt as characterRefs, m as creationStage, mt as createWorld, n as library, ot as ClockBackwardsError, pt as lintWorld, q as saveSequence, r as live, tt as hpState, ut as currentMinute, v as history, vt as characterHolders, w as returnStrandedDrafts, wt as resolveBeat, xt as createArc, y as indexNarration, yt as charactersInScene, z as callResultEvent } from "./campaign.js";
import { n as CampaignSeedError, o as parseCampaignSeed, r as campaignSeedCard, t as CAMPAIGN_SEED_FIELDS } from "./seed2.js";
import { _ as prettifyError, a as discriminatedUnion, c as literal, d as record, f as strictObject, g as toJSONSchema, h as unknown, i as boolean, l as number, m as union, o as int, p as string, r as array, t as _enum, u as object } from "./schemas.js";
import { d as reconcile, j as rollTotals, l as changedDraftFields, u as emptyDraft, w as arrangementProblem, y as lengthIssue } from "./summary.js";
import { s as ABILITY_KEYS } from "./schema.js";
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
// src/lib/server/tools/action-tools.ts
var adv = {
	adv: _enum(["advantage", "disadvantage"]).optional(),
	reason: string().trim().min(1).optional().describe("Why advantage or disadvantage, shown to the Player")
};
var modeOf = (input) => ({
	mode: input.adv ?? "normal",
	reason: input.adv ? input.reason ?? "" : null
});
var pendingNext = (id) => `Attach it with your closing narrate(text, call: "${id}"), or drop it with cancel_call`;
var withModifier = (dice, modifier) => modifier === 0 ? dice : `${dice}${modifier > 0 ? "+" : "-"}${Math.abs(modifier)}`;
/** The attacks a combatant has: a Character's weapons, an NPC's stat block actions. */
function attacksOf(who) {
	if (who.kind === "character") return (who.stats.attacks.status === "ok" ? who.stats.attacks.value : []).map((a) => ({
		name: a.name,
		bonus: a.attackBonus,
		damage: a.damage && {
			dice: withModifier(a.damage.dice, a.damage.modifier),
			damageType: a.damage.type
		}
	}));
	return who.monster.actions.flatMap((a) => {
		if (a.attack_bonus === void 0) return [];
		const first = a.damage?.find((d) => d.damage_dice && d.damage_type);
		return [{
			name: a.name,
			bonus: a.attack_bonus,
			damage: first ? {
				dice: first.damage_dice,
				damageType: first.damage_type.toLowerCase()
			} : null
		}];
	});
}
/** The attack `with` names: exactly by name, or the one whose name contains it. */
function findAttack(who, name) {
	const attacks = attacksOf(who);
	const key = name.trim().toLowerCase();
	const found = attacks.find((a) => a.name.toLowerCase() === key) ?? attacks.find((a) => a.name.toLowerCase().includes(key));
	if (!found) throw new ToolError("unknown_attack", `${who.name} has no attack called ${name}`, attacks.length ? `Use one of ${who.name}'s attacks: ${attacks.map((a) => a.name).join(", ")}` : `${who.name} has no attacks; use roll and damage for an improvised one`);
	return found;
}
function diceLogRoll(roller, rolled, mode) {
	const d20 = rolled.roll.kept !== null;
	return {
		characterName: roller,
		what: rolled.what,
		dice: rolled.roll.dice,
		modifier: rolled.roll.modifier,
		total: rolled.roll.total,
		outcome: rolled.roll.outcome,
		mode: d20 ? mode.mode : "normal",
		reason: d20 ? mode.reason : null,
		target: rolled.targetState
	};
}
/**
* Resolves rolls by who makes them. A Character's rolls go into one pending Call for the closing
* narrate to attach; an NPC's roll now. Returns the DM's result and the one Event: the dice log
* when anything rolled, else a DM-only note of the pending Call.
*/
function resolve(db, dice, now, rolls, { summary, pre = [], result = {} }) {
	const parts = rolls.flatMap(({ roller, sequence, mode }) => roller.kind === "character" ? [{
		characterId: roller.id,
		player: roller.player,
		sequence,
		...mode
	}] : []);
	const id = parts.length ? createPendingCall(db, parts, now) : null;
	const outcomes = rolls.filter((r) => r.roller.kind !== "character").map((r) => ({
		...r,
		...rollAll(db, r.sequence, dice, r.mode)
	}));
	const log = [...pre.map((p) => p.log), ...outcomes.flatMap((o) => o.steps.map((s) => diceLogRoll(o.roller.name, s, o.mode)))];
	const text = [...pre.map((p) => p.text), ...outcomes.map((o) => sequenceText(o.sequence, o.mode.mode))];
	const full = {
		...result,
		...text.length && {
			rolled: text.join("\n"),
			targets: outcomes.map((o) => {
				const last = o.sequence.rolls.findLast((r) => r.after);
				return {
					handle: o.sequence.target.handle,
					hp: last?.after?.hp ?? null
				};
			})
		},
		...id && {
			pending_call: id,
			next: pendingNext(id)
		}
	};
	if (!log.length) return {
		result: full,
		event: {
			kind: id ? "call_pending" : "action",
			summary,
			data: { call: id },
			dmOnly: true
		}
	};
	return {
		result: full,
		event: {
			kind: "rolls",
			summary: log.map((r) => `${r.characterName} ${r.what}: ${r.total}${r.outcome ? ` (${r.outcome})` : ""}`).join("; "),
			data: {
				rolls: log,
				call: id
			}
		}
	};
}
var abilityName = (ability) => ABILITY_NAMES.get(ability) ?? ability;
/** Rolls an effect's damage once, for every target's save. */
function preRollDamage(dice, by, what, expression, damageType) {
	const rolled = dice.rollExpression(expression);
	const total = Math.max(0, rolled.total);
	const modifier = rolled.modifier ? ` ${rolled.modifier > 0 ? "+" : "-"} ${Math.abs(rolled.modifier)}` : "";
	return {
		total,
		pre: {
			text: `${what}: ${rolled.dice.join(" + ")}${modifier} = ${total}${damageType ? ` ${damageType}` : ""}`,
			log: {
				characterName: by,
				what,
				dice: rolled.dice,
				modifier: rolled.modifier,
				total,
				outcome: null,
				mode: "normal",
				reason: null,
				target: null
			}
		}
	};
}
var slugOf = (s) => s.trim().toLowerCase().replace(/^(spell|condition):/, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-");
/** What a caster casts with: spell attack bonus, save DC, caster level, and the spells it has. */
function casting(who) {
	if (who.kind === "character") {
		const stat = who.stats.spellcasting;
		const value = stat.status === "ok" ? stat.value : null;
		if (!value) return null;
		return {
			attackBonus: value.attackBonus,
			saveDc: value.saveDc,
			level: who.detail.level,
			spells: who.detail.spells.map((s) => s.spell)
		};
	}
	const block = who.monster.specialAbilities?.find((a) => a.spellcasting)?.spellcasting;
	if (!block) return null;
	return {
		attackBonus: block.modifier ?? 0,
		saveDc: block.dc ?? 10,
		level: block.level ?? 1,
		spells: (block.spells ?? []).map((s) => s.url.split("/").at(-1))
	};
}
/** The spell's damage at this slot level, or at the caster's level for a cantrip. */
function spellDamage(spell, level, casterLevel) {
	const first = spell.damage?.find((d) => d.damage_type);
	if (!first) return null;
	const bySlot = first.damage_at_slot_level?.[String(level)];
	const byCaster = Object.entries(first.damage_at_character_level ?? {}).filter(([at]) => Number(at) <= casterLevel).sort(([a], [b]) => Number(b) - Number(a))[0]?.[1];
	const dice = bySlot ?? byCaster;
	return dice ? {
		dice: dice.replace(/\s+/g, ""),
		damageType: first.damage_type.toLowerCase()
	} : null;
}
/** Spends a Character's slot of this level, or refuses when none is free. */
function spendSlot(db, who, level) {
	const slots = who.stats.spellSlots.status === "ok" ? who.stats.spellSlots.value : [];
	const max = slots[level - 1] ?? 0;
	const spent = who.detail.spentSlots[level - 1] ?? 0;
	if (spent >= max) {
		const free = slots.flatMap((m, i) => i + 1 > level && (who.detail.spentSlots[i] ?? 0) < m ? [i + 1] : []);
		throw new ToolError("no_slot", `${who.name} has no level ${level} spell slot free (${spent} of ${max} spent)`, free.length ? `Cast it at a higher level with a free slot (${free.join(", ")}), or choose another action` : `${who.name} needs a rest to regain slots; choose another action`);
	}
	const spentSlots = [...who.detail.spentSlots];
	spentSlots[level - 1] = spent + 1;
	db.update(character).set({ spentSlots }).where(eq(character.id, who.id)).run();
	return {
		level,
		spent: spent + 1,
		max
	};
}
/** Rolls a dice expression, or refuses one that isn't. */
function rollExpressionOrRefuse(dice, expr) {
	try {
		return dice.rollExpression(expr);
	} catch {
		throw new ToolError("bad_dice", `${expr} is not a dice expression`, "Write it as NdS+M, such as 2d6+1");
	}
}
/** An SRD condition's slug, or a refusal naming them. */
function srdCondition(db, name) {
	const rules = createRulesRepository(db);
	const slug = slugOf(name);
	if (!rules.entry(`condition:${slug}`)) {
		const all = rules.conditions().map((c) => c.slug);
		throw new ToolError("unknown_condition", `${name} is not an SRD condition`, `Use one of: ${all.join(", ")}`);
	}
	return slug;
}
var actionTools = [
	writeTool({
		name: "attack",
		description: "Make a weapon or natural attack. A Character attacker returns a pending Call: attach it with your closing narrate(text, call: id) and the Player rolls to hit, then damage (you hear one call_result). An NPC attacker rolls and applies at once, in the dice log. The target's AC stays hidden from the Player.",
		input: object({
			actor: string().min(1).describe("Who attacks: char:… or npc:…"),
			target: string().min(1).describe("Who is attacked: char:… or npc:…"),
			with: string().trim().min(1).describe("The weapon or stat block action, such as longsword"),
			...adv
		}),
		activity: "DM resolves an attack",
		run: ({ db, dice, now }, input) => {
			const actor = combatant(db, input.actor);
			mustAct(actor);
			const target = combatant(db, input.target);
			const attack = findAttack(actor, input.with);
			const sequence = attackSequence(attack.name, target, attack.bonus, attack.damage);
			return resolve(db, dice, now, [{
				roller: actor,
				sequence,
				mode: modeOf(input)
			}], { summary: `${actor.name}'s ${sequence.label} on ${target.name}` });
		}
	}),
	writeTool({
		name: "cast",
		description: "Cast a spell: checks the caster has it and a free slot of the level, and spends the slot (cantrips are level 0). A spell attack from a Character returns a pending Call (to hit, then damage) to attach with narrate; an NPC's rolls at once. A save spell rolls its damage once; NPC targets save at once against the caster's DC, Character targets get a pending Call. Healing and other effects: apply them with heal, add_condition and the like.",
		input: object({
			caster: string().min(1).describe("Who casts: char:… or npc:…"),
			spell: string().min(1).describe("The spell: spell:fire-bolt, fire-bolt or Fire Bolt"),
			level: number().int().min(0).max(9).describe("The slot level; 0 for a cantrip"),
			targets: array(string().min(1)).default([]).describe("Who the spell affects: char:… or npc:…"),
			...adv
		}),
		activity: "DM resolves a spell",
		run: ({ db, dice, now }, input) => {
			const caster = combatant(db, input.caster);
			mustAct(caster);
			const found = createRulesRepository(db).entry(`spell:${slugOf(input.spell)}`);
			if (!found || found.kind !== "spell") throw new ToolError("unknown_spell", `No SRD spell is called ${input.spell}`, "Find the spell with lookup({query}) and call again");
			const spell = found.entry;
			const powers = casting(caster);
			if (!powers || !powers.spells.includes(spell.slug)) throw new ToolError("spell_not_known", `${caster.name} doesn't have ${spell.name}`, powers?.spells.length ? `Cast one of ${caster.name}'s spells: ${powers.spells.join(", ")}` : `${caster.name} casts no spells; choose another action`);
			if (spell.level === 0 ? input.level !== 0 : input.level < spell.level) throw new ToolError("bad_spell_level", `${spell.name} can't be cast at level ${input.level}`, spell.level === 0 ? "Cast a cantrip at level 0" : `Cast it at level ${spell.level} or higher`);
			const targets = input.targets.map((t) => combatant(db, t));
			if ((spell.attackType || spell.dcAbility) && !targets.length) throw new ToolError("no_targets", `${spell.name} needs a target`, "Name its targets and call again");
			const slot = caster.kind === "character" && input.level > 0 ? spendSlot(db, caster, input.level) : null;
			const damage = spellDamage(spell, input.level, powers.level);
			const result = {
				cast: spell.name,
				level: input.level,
				slot
			};
			const summary = `${caster.name} casts ${spell.name}${targets.length ? ` on ${targets.map((t) => t.name).join(", ")}` : ""}`;
			if (spell.attackType) {
				const label = `${spell.name}`;
				return resolve(db, dice, now, targets.map((t) => ({
					roller: caster,
					sequence: attackSequence(label, t, powers.attackBonus, damage),
					mode: modeOf(input)
				})), {
					summary,
					result
				});
			}
			if (spell.dcAbility) {
				const ability = spell.dcAbility;
				const rolled = damage && preRollDamage(dice, caster.name, `${spell.name} damage`, damage.dice, damage.damageType);
				return resolve(db, dice, now, targets.map((t) => ({
					roller: t,
					sequence: saveSequence(abilityName(ability), t, {
						ability,
						bonus: saveBonus(t, ability),
						dc: powers.saveDc,
						damage: rolled?.total ?? null,
						damageType: damage?.damageType ?? null,
						condition: null,
						onSuccess: spell.dcSuccess === "half" ? "half" : "none"
					}),
					mode: {
						mode: "normal",
						reason: null
					}
				})), {
					summary,
					result,
					pre: rolled ? [rolled.pre] : []
				});
			}
			if (damage && targets.length) return resolve(db, dice, now, targets.map((t) => ({
				roller: caster,
				sequence: damageSequence(spell.name, t, damage),
				mode: {
					mode: "normal",
					reason: null
				}
			})), {
				summary,
				result
			});
			return resolve(db, dice, now, [], {
				summary,
				result
			});
		}
	}),
	writeTool({
		name: "force_save",
		description: "Force a saving throw: a trap, a breath, an NPC's spell. Code rolls the damage once; Character targets get a pending Call to attach with narrate (each Player rolls their save), NPC targets save at once. A failure takes the damage and the condition; a success takes half or none. The DC stays hidden from the Player.",
		input: object({
			targets: array(string().min(1)).min(1).describe("Who saves: char:… or npc:…"),
			ability: saveKey.describe("The save: dex or Dexterity"),
			dc_tier: _enum(TIERS).optional().describe("Difficulty; code turns it into the DC"),
			dc: number().int().min(1).max(30).optional().describe("An exact DC, such as a stat block's"),
			on_fail: object({
				damage: string().min(1).optional().describe("Dice for the damage, such as 2d6"),
				type: string().min(1).optional().describe("The damage type, such as fire"),
				condition: string().min(1).optional().describe("A condition a failure lands, such as prone")
			}),
			on_success: _enum(["half", "none"]).default("none"),
			source: string().trim().min(1).optional().describe("What forces it, shown in the dice log")
		}).refine((i) => i.dc === void 0 !== (i.dc_tier === void 0), { message: "Give exactly one of dc_tier and dc" }),
		activity: "DM calls for a saving throw",
		run: ({ db, dice, now }, input) => {
			const targets = input.targets.map((t) => combatant(db, t));
			const ability = input.ability;
			const dc = input.dc ?? DC_BY_TIER[input.dc_tier];
			const source = input.source ?? "Effect";
			const damageType = input.on_fail.type?.toLowerCase() ?? null;
			const rolled = input.on_fail.damage ? preRollDamage(dice, source, `${source} damage`, input.on_fail.damage, damageType) : null;
			return resolve(db, dice, now, targets.map((t) => ({
				roller: t,
				sequence: saveSequence(abilityName(ability), t, {
					ability,
					bonus: saveBonus(t, ability),
					dc,
					damage: rolled?.total ?? null,
					damageType,
					condition: input.on_fail.condition?.toLowerCase() ?? null,
					onSuccess: input.on_success
				}),
				mode: {
					mode: "normal",
					reason: null
				}
			})), {
				summary: `${abilityName(ability)} save for ${targets.map((t) => t.name).join(", ")}`,
				pre: rolled ? [rolled.pre] : []
			});
		}
	}),
	writeTool({
		name: "cancel_call",
		description: "Drop a pending Call an action tool returned that you won't attach.",
		input: object({ id: string().min(1) }),
		activity: null,
		run: ({ db, now }, { id }) => {
			cancelPendingCall(db, id, now);
			return {
				result: { cancelled: id },
				event: {
					kind: "call_cancelled",
					summary: `Pending Call ${id} cancelled`,
					data: { call: id },
					dmOnly: true
				}
			};
		}
	}),
	writeTool({
		name: "roll",
		description: "Roll dice for yourself alone: a hidden check, a random table, an improvised effect. Nothing is applied and the Player doesn't see it; use damage, heal and the like to apply a result.",
		input: object({
			expr: string().min(1).describe("Dice such as 2d6+1 or d20+3"),
			...adv
		}),
		activity: null,
		run: ({ dice }, input) => {
			const d20 = /^\s*1?d20\s*([+-]\s*\d+)?\s*$/i.exec(input.expr);
			if (input.adv && !d20) throw new ToolError("adv_needs_d20", "Advantage and disadvantage apply to a single d20", "Roll d20+N with adv, or drop adv");
			let result;
			if (input.adv && d20) {
				const modifier = d20[1] ? Number(d20[1].replace(/\s+/g, "")) : 0;
				const rolled = dice.rollD20({
					mode: input.adv,
					reason: input.reason ?? ""
				});
				result = {
					dice: rolled.dice,
					kept: rolled.kept,
					modifier,
					total: rolled.kept + modifier
				};
			} else {
				const rolled = rollExpressionOrRefuse(dice, input.expr);
				result = {
					dice: rolled.dice,
					kept: null,
					modifier: rolled.modifier,
					total: rolled.total
				};
			}
			return {
				result,
				event: {
					kind: "dm_roll",
					summary: `${input.expr}: ${result.total}`,
					data: {
						...result,
						expr: input.expr
					},
					dmOnly: true
				}
			};
		}
	}),
	writeTool({
		name: "damage",
		description: "Deal damage outside an attack or save, such as a fall. Temporary HP absorb it first, HP stop at 0, and an NPC's resistances apply.",
		input: object({
			target: string().min(1).describe("char:… or npc:…"),
			amount: number().int().min(0),
			type: string().min(1).describe("The damage type, such as bludgeoning")
		}),
		activity: "DM applies damage",
		run: ({ db }, input) => {
			const who = combatant(db, input.target);
			const type = input.type.toLowerCase();
			const change = applyDamage(db, who, input.amount, type);
			return {
				result: {
					...change,
					state: hpState(change.hp, change.max)
				},
				event: {
					kind: "damage",
					summary: `${who.name} takes ${change.dealt} ${type}`,
					data: {
						target: who.handle,
						dealt: change.dealt,
						type,
						state: hpState(change.hp, change.max)
					}
				}
			};
		}
	}),
	writeTool({
		name: "heal",
		description: "Restore HP, never above the maximum. Roll a healing spell or potion with roll first.",
		input: object({
			target: string().min(1).describe("char:… or npc:…"),
			amount: number().int().min(0)
		}),
		activity: "DM applies healing",
		run: ({ db }, input) => {
			const who = combatant(db, input.target);
			const change = applyHealing(db, who, input.amount);
			return {
				result: {
					healed: change.dealt,
					hp: change.hp,
					max: change.max,
					state: hpState(change.hp, change.max)
				},
				event: {
					kind: "heal",
					summary: `${who.name} regains ${change.dealt} HP`,
					data: {
						target: who.handle,
						healed: change.dealt,
						state: hpState(change.hp, change.max)
					}
				}
			};
		}
	}),
	writeTool({
		name: "add_condition",
		description: "Give a Character or NPC an SRD condition, such as prone or frightened.",
		input: object({
			target: string().min(1),
			condition: string().min(1)
		}),
		activity: "DM applies a condition",
		run: ({ db }, input) => {
			const who = combatant(db, input.target);
			const condition = srdCondition(db, input.condition);
			if (!who.conditions.includes(condition)) setConditions(db, who, [...who.conditions, condition]);
			return {
				result: {
					target: who.handle,
					conditions: [.../* @__PURE__ */ new Set([...who.conditions, condition])]
				},
				event: {
					kind: "condition_added",
					summary: `${who.name} is ${condition}`,
					data: {
						target: who.handle,
						condition
					}
				}
			};
		}
	}),
	writeTool({
		name: "remove_condition",
		description: "End a condition a Character or NPC has.",
		input: object({
			target: string().min(1),
			condition: string().min(1)
		}),
		activity: "DM ends a condition",
		run: ({ db }, input) => {
			const who = combatant(db, input.target);
			const condition = slugOf(input.condition);
			if (!who.conditions.includes(condition)) throw new ToolError("condition_absent", `${who.name} isn't ${condition}`, who.conditions.length ? `${who.name} has: ${who.conditions.join(", ")}` : `${who.name} has no conditions`);
			const conditions = who.conditions.filter((c) => c !== condition);
			setConditions(db, who, conditions);
			return {
				result: {
					target: who.handle,
					conditions
				},
				event: {
					kind: "condition_removed",
					summary: `${who.name} is no longer ${condition}`,
					data: {
						target: who.handle,
						condition
					}
				}
			};
		}
	}),
	writeTool({
		name: "spend",
		description: "Spend a Character's resource outside cast: a spell slot (slot:1 to slot:9) or one use of a feature by its slug, such as second-wind.",
		input: object({
			character: string().min(1).describe("char:…"),
			resource: string().min(1).describe("slot:N or a feature slug")
		}),
		activity: null,
		run: ({ db }, input) => {
			const who = combatant(db, input.character);
			if (who.kind !== "character") throw new ToolError("not_a_character", `${who.name} is not a Character`, "NPC resources are yours to pace; no tool call needed");
			const slot = /^slot:([1-9])$/.exec(input.resource.trim());
			if (slot) {
				const spent = spendSlot(db, who, Number(slot[1]));
				return {
					result: {
						character: who.handle,
						slot: spent
					},
					event: {
						kind: "spend",
						summary: `${who.name} spends a level ${spent.level} slot`,
						data: {
							character: who.handle,
							resource: input.resource
						}
					}
				};
			}
			const key = slugOf(input.resource);
			const feature = who.features.find((f) => f.slug === key || slugOf(f.name) === key);
			if (!feature) throw new ToolError("unknown_resource", `${who.name} has no resource called ${input.resource}`, `Spend slot:N or one of ${who.name}'s features: ${who.features.map((f) => f.slug).join(", ")}`);
			const featureUses = {
				...who.detail.featureUses,
				[feature.slug]: (who.detail.featureUses[feature.slug] ?? 0) + 1
			};
			db.update(character).set({ featureUses }).where(eq(character.id, who.id)).run();
			return {
				result: {
					character: who.handle,
					feature: feature.slug,
					spent: featureUses[feature.slug]
				},
				event: {
					kind: "spend",
					summary: `${who.name} uses ${feature.name}`,
					data: {
						character: who.handle,
						resource: feature.slug
					}
				}
			};
		}
	})
];
// src/lib/server/tools/arc-tools.ts
var words = string().trim().min(1);
var version = number().int().positive();
var position = number().int().positive();
/** Arc changes point the DM at the replanning procedure. */
var ARC_REVIEW = "arc-review";
/** The Arc: the DM's hidden plan. Every Arc event is DM-only and never reaches the Player. */
var arcTools = [
	readTool({
		name: "arc",
		description: "Read the current Arc in full: its Acts, their Beats with descriptions, states and reasons, and the version every Arc write must pass. With history, also the concluded and retired Arcs (their resolutions and abandoned Beats are dangling threads). Never reaches the Player.",
		input: object({ history: boolean().optional() }),
		activity: null,
		run: (ctx, { history }) => ({
			current: currentArc(ctx.db),
			...history ? { history: pastArcs(ctx.db) } : {}
		})
	}),
	writeTool({
		name: "resolve_beat",
		description: "Settle a pending Beat: reached when play clearly established its outcome, abandoned when the story made it impossible or irrelevant, with a one-line reason. Call it before narrate when play settles a Beat. Reaching a Beat in a later Act abandons the pending Beats of earlier Acts; the result lists them. When no Beat is left pending the Arc concludes and you must load arc-review. Never reaches the Player.",
		input: object({
			beat: words,
			version,
			to: _enum(["reached", "abandoned"]),
			reason: words
		}),
		activity: null,
		run: (ctx, input) => {
			const result = resolveBeat(ctx, input);
			const concluded = result.arc.state === "concluded";
			return {
				result,
				...concluded ? { skill: ARC_REVIEW } : {},
				event: {
					kind: "beat_resolved",
					summary: `${input.beat} ${input.to}: ${input.reason}${concluded ? " (Arc concluded)" : ""}`,
					data: {
						beat: input.beat,
						to: input.to,
						abandoned: result.abandoned.map((b) => b.handle),
						concluded
					},
					dmOnly: true
				}
			};
		}
	}),
	writeTool({
		name: "revise_arc",
		description: "Revise the current Arc in one atomic call: edit its title, premise, stakes or resolution; edit an Act (numbered from 1) or add one before an existing Act; edit, add or move pending Beats (positions within an Act from 1, the end by default). Reached and abandoned Beats stay as history, nothing goes after the final Act, and there is no delete: abandon a dropped Beat with resolve_beat. An unplanned turning point is a new Beat you then resolve as reached. Never reaches the Player.",
		input: object({
			version,
			ops: array(discriminatedUnion("op", [
				object({
					op: literal("edit_arc"),
					title: words.optional(),
					premise: words.optional(),
					stakes: words.optional(),
					resolution: words.optional()
				}),
				object({
					op: literal("edit_act"),
					act: position,
					name: words.optional(),
					purpose: words.optional()
				}),
				object({
					op: literal("add_act"),
					before: position,
					name: words,
					purpose: words
				}),
				object({
					op: literal("edit_beat"),
					beat: words,
					title: words.optional(),
					description: words.optional()
				}),
				object({
					op: literal("add_beat"),
					act: position,
					position: position.optional(),
					title: words,
					description: words
				}),
				object({
					op: literal("move_beat"),
					beat: words,
					act: position,
					position: position.optional()
				})
			])).min(1)
		}),
		activity: null,
		run: (ctx, input) => {
			const result = reviseArc(ctx, input);
			return {
				result,
				event: {
					kind: "arc_revised",
					summary: `Arc revised: ${input.ops.map((o) => o.op).join(", ")}`,
					data: {
						ops: input.ops,
						added: result.added
					},
					dmOnly: true
				}
			};
		}
	}),
	writeTool({
		name: "retire_arc",
		description: "Retire the current Arc when its premise or stakes no longer fit (otherwise revise it): every pending Beat is abandoned with the reason and returned. Then load arc-review. Never reaches the Player.",
		input: object({
			version,
			reason: words
		}),
		activity: null,
		run: (ctx, input) => {
			const result = retireArc(ctx, input);
			return {
				result,
				skill: ARC_REVIEW,
				event: {
					kind: "arc_retired",
					summary: `Arc retired: ${result.title}: ${input.reason}`,
					data: { abandoned: result.abandoned.map((b) => b.handle) },
					dmOnly: true
				}
			};
		}
	}),
	writeTool({
		name: "create_arc",
		description: "Create the current Arc (builder calls it at Begin and for each later Arc): a title, premise, stakes, the Acts in order (each a name, a purpose and its Beats in order, each a title and a description) and the intended resolution. Refused while a current Arc exists. Returns the Arc with its Beat handles and version. Never reaches the Player.",
		input: object({
			title: words,
			premise: words,
			stakes: words,
			acts: array(object({
				name: words,
				purpose: words,
				beats: array(object({
					title: words,
					description: words
				})).min(1)
			})).min(1),
			resolution: words
		}),
		activity: null,
		run: (ctx, input) => {
			let created;
			try {
				created = createArc(ctx.db, input, ctx.now);
			} catch (e) {
				if (!(e instanceof CurrentArcError)) throw e;
				throw new ToolError("current_arc", e.message, "Read the current Arc; conclude or retire it before creating another");
			}
			return {
				result: created,
				event: {
					kind: "arc_created",
					summary: `Arc created: ${created.title}`,
					data: { title: created.title },
					dmOnly: true
				}
			};
		}
	})
];
// src/lib/server/tools/seed-tools.ts
/** The Seed is one Entity per Campaign, so its handle is fixed. */
var SEED_HANDLE = "campaign";
function currentSeed({ db }) {
	const found = db.select().from(campaign).get();
	if (!found) throw ToolError.unknownHandle(SEED_HANDLE);
	return found;
}
function seedView(found) {
	const seed = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, found[f]]));
	return {
		handle: SEED_HANDLE,
		version: found.version,
		...seed
	};
}
/** Reading the Campaign Seed; `set_seed` is a creation tool. */
var seedTools = [readTool({
	name: "seed",
	description: "Read the Campaign Seed (name, premise, tone, length and optional World details) and its version.",
	input: object({}),
	activity: "DM checks the Campaign Seed",
	run: (ctx) => seedView(currentSeed(ctx))
})];
// src/lib/server/tools/creation-tools.ts
/** A Character draft's handle: drafts are Entities the DM writes into while the Player creates. */
var draftHandle = (id) => `draft:${id}`;
/** How the conversation's muted lines name the Seed fields. */
var SEED_FIELD_NAMES = {
	name: "name",
	premise: "premise",
	tone: "tone",
	length: "length",
	worldName: "World name",
	genreFlavor: "genre flavor",
	scale: "scale",
	magicLevel: "magic level",
	techLevel: "tech level"
};
/** "a", "a and b", "a, b and c". */
function listOf(items) {
	return items.length <= 1 ? items[0] ?? "" : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
/** How the conversation's muted lines name the draft fields the DM may set. */
var DRAFT_FIELD_NAMES = {
	name: "name",
	race: "race",
	subrace: "subrace",
	class: "class",
	subclass: "subclass",
	background: "background",
	alignment: "alignment",
	appearance: "appearance",
	personality: "personality traits",
	ideal: "ideal",
	bond: "bond",
	flaw: "flaw",
	backstory: "backstory",
	customBackgroundName: "custom background name",
	customBackgroundFeature: "custom background feature",
	baseScores: "ability scores"
};
var STRUCTURE = {
	race: "races",
	subrace: "subraces",
	class: "classes",
	subclass: "subclasses",
	background: "backgrounds",
	alignment: "alignments"
};
var TEXT_FIELDS = [
	"name",
	"appearance",
	"personality",
	"ideal",
	"bond",
	"flaw",
	"backstory",
	"customBackgroundName",
	"customBackgroundFeature"
];
var slug = string().min(1).nullable();
var score = int();
/** The draft fields the DM may set. The Ability Score Method and the rolls are the Player's. */
var draftFields = strictObject({
	...Object.fromEntries(TEXT_FIELDS.map((f) => [f, string().optional()])),
	...Object.fromEntries(Object.keys(STRUCTURE).map((f) => [f, slug.optional()])),
	baseScores: strictObject(Object.fromEntries(ABILITY_KEYS.map((k) => [k, score]))).optional().describe("All six base scores: an arrangement of what the draft’s method gave"),
	abilityMethod: unknown().optional().describe("Refused: the Player chooses the method"),
	abilityRolls: unknown().optional().describe("Refused: only the wizard rolls")
});
function draftRow({ db }, handle) {
	const id = handle.startsWith("draft:") ? handle.slice(6) : null;
	const found = id && db.select().from(characterDraft).where(eq(characterDraft.id, id)).get();
	if (!found) throw ToolError.unknownHandle(handle);
	return {
		...found,
		draft: {
			...emptyDraft(),
			...found.data
		}
	};
}
var playerChoice = (message) => new ToolError("player_choice", message, "Ask the Player to make that choice in the Character wizard, then read the draft again");
/** Refuses fields the wizard would not accept; the DM never gets a silent fix. */
function checkDraftFields(draft, fields) {
	const invalid = (message) => ToolError.invalidInput("set_draft_fields", message);
	if (fields.abilityMethod !== void 0 || fields.abilityRolls !== void 0) throw playerChoice("The Player chooses the Ability Score Method and the wizard rolls the dice; you may only arrange the values they gave");
	const rules = loadWizardRules();
	for (const [field, collection] of Object.entries(STRUCTURE)) {
		const value = fields[field];
		if (!value) continue;
		if (!rules[collection].some((e) => e.slug === value)) throw invalid(`Unknown ${field}: ${value}`);
	}
	for (const field of TEXT_FIELDS) {
		const value = fields[field];
		const issue = value === void 0 ? null : lengthIssue(field, value);
		if (issue) throw invalid(issue);
	}
	if (fields.baseScores) {
		if (!draft.abilityMethod) throw playerChoice("The Player has not chosen an Ability Score Method yet");
		if (draft.abilityMethod === "rolling" && !draft.abilityRolls?.length) throw playerChoice("The Player has not rolled ability scores yet");
		const problem = arrangementProblem(draft.abilityMethod, fields.baseScores, rollTotals(draft.abilityRolls ?? []));
		if (problem) throw invalid(`Ability scores: ${problem}`);
	}
}
var seedFields = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, string().optional()]));
/** Helping the Player create the Campaign: where creation stands, and the forms' fields. */
var creationTools = [
	readTool({
		name: "creation_state",
		description: "Where creation stands: seed_incomplete (offer to help with the Seed), party_empty (point the Player to the Character wizard), ready (wait for the Player to press Begin) or begun (play). Also lists the missing Seed fields and the Character drafts.",
		input: object({}),
		activity: null,
		run: (ctx) => {
			const { state, missing, characters } = creationStage(ctx.db);
			return {
				state,
				missing,
				characters,
				drafts: ctx.db.select().from(characterDraft).orderBy(asc(characterDraft.createdAt)).all().map((d) => ({
					handle: draftHandle(d.id),
					name: d.data.name,
					step: d.step,
					version: d.version
				}))
			};
		}
	}),
	readTool({
		name: "party",
		description: "The Party as builder needs it: each Character’s handle (char:…), name, level, race, class, background, alignment, appearance, personality, ideal, bond, flaw and backstory. Build the World and the Arc from these.",
		input: object({}),
		activity: "DM reads the Party",
		run: (ctx) => {
			const handles = new Map(characterHolders(ctx.db).map((c) => [c.id, c.handle]));
			return { characters: ctx.db.select({
				id: character.id,
				name: character.name,
				level: character.level,
				race: race.name,
				class: classTable.name,
				background: background.name,
				customBackground: character.customBackgroundName,
				alignment: character.alignment,
				appearance: character.appearance,
				personality: character.personality,
				ideal: character.ideal,
				bond: character.bond,
				flaw: character.flaw,
				backstory: character.backstory
			}).from(character).innerJoin(race, eq(race.id, character.raceId)).innerJoin(classTable, eq(classTable.id, character.classId)).innerJoin(background, eq(background.id, character.backgroundId)).where(ne(character.status, "departed")).orderBy(asc(character.createdAt)).all().map(({ id, customBackground, ...c }) => ({
				handle: handles.get(id),
				...c,
				background: customBackground ?? c.background
			})) };
		}
	}),
	creationTool({
		name: "set_seed",
		description: "Set Campaign Seed fields on the Player’s Seed card, which shows them marked \"✎ DM\". Pass the version from your last `seed` read; an empty string clears an optional field. Only set what the Player asked for or agreed to.",
		input: object({
			version: int(),
			...seedFields
		}),
		run: (ctx, { version, ...changes }) => {
			const found = currentSeed(ctx);
			expectVersion({
				handle: SEED_HANDLE,
				version: found.version,
				read: "seed"
			}, version);
			if (found.archivedAt !== null) throw new ToolError("archived", "An archived Campaign cannot be changed", "Stop here");
			try {
				refuseLockedSeed(found);
			} catch (e) {
				if (!(e instanceof SeedLockedError)) throw e;
				throw new ToolError("seed_locked", e.message, "Leave the Seed as it is; only the Player can Start over");
			}
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
			const set = CAMPAIGN_SEED_FIELDS.filter((f) => seed[f] !== found[f]);
			if (set.length === 0) return {
				result: seedView(found),
				changed: []
			};
			return {
				result: seedView(ctx.db.update(campaign).set({
					...seed,
					version: found.version + 1,
					dmSeedFields: [.../* @__PURE__ */ new Set([...found.dmSeedFields, ...set])],
					updatedAt: ctx.now
				}).returning().get()),
				line: `DM set the Seed’s ${listOf(set.map((f) => SEED_FIELD_NAMES[f]))}`,
				changed: [{
					type: "seed",
					campaign: ctx.campaignId
				}]
			};
		}
	}),
	creationTool({
		name: "reply",
		description: "Answer the Player in the DM conversation pane (creation help and out-of-character talk). Out of fiction: it is not Narration and is never logged.",
		input: object({ text: string().trim().min(1) }),
		run: (ctx, { text }) => {
			addConversationLine(ctx.db, {
				author: "dm",
				text
			}, ctx.now);
			return {
				result: { replied: true },
				changed: [{
					type: "conversation",
					campaign: ctx.campaignId
				}]
			};
		}
	}),
	readTool({
		name: "draft",
		description: "Read a Character draft (handle from creation_state): its fields, version, wizard step, the fields you set (\"✎ DM\"), and the totals a rolled method gave.",
		input: object({ draft: string() }),
		activity: null,
		run: (ctx, { draft: handle }) => {
			const found = draftRow(ctx, handle);
			return {
				handle,
				version: found.version,
				step: found.step,
				fields: found.draft,
				dmFields: found.dmFields,
				rolledTotals: found.draft.abilityRolls ? rollTotals(found.draft.abilityRolls) : null
			};
		}
	}),
	creationTool({
		name: "set_draft_fields",
		description: "Set fields of a Character draft in the Player’s open wizard, which shows them marked \"✎ DM\". Pass the version from your last `draft` read. Slugs as the rules data names them. baseScores only arranges what the Player’s chosen method gave (a permutation of the standard array or of the rolled totals, or a point-buy spend within budget); never set the method or the rolls.",
		input: object({
			draft: string(),
			version: int(),
			fields: draftFields
		}),
		run: (ctx, { draft: handle, version, fields }) => {
			const found = draftRow(ctx, handle);
			expectVersion({
				handle,
				version: found.version,
				read: `draft ${handle}`
			}, version);
			checkDraftFields(found.draft, fields);
			const settable = Object.fromEntries(Object.entries(fields).filter(([k]) => k !== "abilityMethod" && k !== "abilityRolls"));
			const { draft: next, notices } = reconcile(loadWizardRules(), {
				...found.draft,
				...settable
			});
			for (const field of Object.keys(settable)) if (changedDraftFields({
				...found.draft,
				...settable
			}, next).includes(field)) throw ToolError.invalidInput("set_draft_fields", `The ${field} ${String(settable[field])} does not fit the rest of the draft`);
			const set = changedDraftFields(found.draft, next).filter((f) => f in settable);
			if (set.length === 0) return {
				result: {
					handle,
					version: found.version,
					notices
				},
				changed: []
			};
			const saved = ctx.db.update(characterDraft).set({
				data: next,
				version: found.version + 1,
				dmFields: [.../* @__PURE__ */ new Set([...found.dmFields, ...set])],
				updatedAt: ctx.now
			}).where(eq(characterDraft.id, found.id)).returning().get();
			const who = next.name.trim() || "a new Character";
			return {
				result: {
					handle,
					version: saved.version,
					set,
					notices
				},
				line: `DM set ${who}’s ${listOf(set.map((f) => DRAFT_FIELD_NAMES[f]))}`,
				changed: [{
					type: "draft",
					campaign: ctx.campaignId,
					draft: found.id
				}]
			};
		}
	})
];
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
// src/lib/server/tools/lint-tools.ts
/**
* Lint: the DM tidies its own World. Its only effect is one DM-only `lint_ran` event, which marks
* when lint last ran; it changes no World or Knowledge state, and its findings never reach the
* Player (no activity line).
*/
var lintTools = [writeTool({
	name: "lint",
	description: "Check the World for what code can detect: near-duplicate names, broken [[links]], Facts restating a typed field, Beliefs pointing at retired Facts and Pages linking to retired Entities. Also returns the Pages of Entities changed since the last lint, for you to check each Page against its fields. Changes nothing: fix each finding with the ordinary tools. Run it when ending a sitting.",
	input: object({}),
	run: (ctx) => {
		const result = lintWorld(ctx);
		return {
			result,
			skill: "lint-review",
			event: {
				kind: "lint_ran",
				summary: `Lint found ${result.findings.length} finding(s)`,
				data: { findings: result.findings.length },
				dmOnly: true
			}
		};
	}
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
	description: "Narrate to the Players: the Narration shows in their timeline. Pass voice (an NPC handle) when an NPC speaks. The first Narration after a closed Floor answers it; later ones in the same turn are fine. Pass recap: true for the opening recap of a sitting: it shows as \"Previously\", answers nothing and is left out of later summaries.",
	input: object({
		text: string().trim().min(1),
		voice: string().min(1).optional().describe("NPC handle, when an NPC speaks"),
		call: callInput.optional().describe("Ask the Players: inline {kind: \"check\", character, skill | save, tier, adv?, reason} (or a list of them, one roll per Character) or {kind: \"question\", text, choices?}. A Call ends your turn; its call_result wakes you."),
		recap: boolean().optional().describe("The opening recap of a sitting")
	}),
	activity: null,
	run: (ctx, { text, voice, call, recap = false }) => {
		const npc = voice === void 0 ? void 0 : speaker(ctx, voice);
		if (!recap) {
			setAwaitingNarration(ctx.db, null);
			indexNarration(ctx.db, ctx.stamp.eventId, text);
		}
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
					call: callId,
					...recap ? { recap: true } : {}
				}
			}
		};
	}
})];
// src/lib/server/tools/rules-tools.ts
/** SRD rules content: never secret, never World content, so kept apart from `search`. */
var rulesTools = [readTool({
	name: "lookup",
	description: "Read SRD rules data (spells, monsters, conditions, magic items, rules sections): by handle (spell:fireball, monster:goblin, condition:prone, magic-item:…, rule:…) or by a free-text query. Separate from the World search.",
	input: object({
		handle: string().trim().min(1).optional().describe("A rules handle, such as spell:fireball"),
		query: string().trim().min(1).optional().describe("Words to search the rules for"),
		limit: number().int().min(1).max(25).optional()
	}).refine((i) => i.handle === void 0 !== (i.query === void 0), { message: "Pass exactly one of handle or query" }),
	activity: "DM checks the rules",
	run: ({ db }, { handle, query, limit }) => {
		const rules = createRulesRepository(db);
		if (query !== void 0) return { results: rules.search(query, { limit }) };
		const found = rules.entry(handle);
		if (!found) throw new ToolError("unknown_rules_entry", `No rules entry has the handle ${handle}`, "Find the handle with lookup({query}) and call again");
		return found;
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
// src/lib/server/tools/session-tools.ts
/** The most words a Session summary may have (the target is about 250). */
var SUMMARY_WORDS = 300;
/** Continuity between sittings: Session summaries and the Event log. */
var sessionTools = [
	writeTool({
		name: "close_session",
		description: "Close a Session with its summary: about 250 words or fewer of Player-safe past-tense prose about what the Characters did and learned (only what they know), plus open threads (unresolved hooks the Characters know about). Closes the current Session; pass session (a number) for the catch-up close of an older unclosed one. A Session with no Narration closes with no summary.",
		input: object({
			summary: string().trim().min(1).refine((s) => s.split(/\s+/).length <= SUMMARY_WORDS, { message: `Keep the summary to about 250 words (at most ${SUMMARY_WORDS})` }),
			threads: array(string().trim().min(1)).max(12),
			session: number().int().positive().optional().describe("Session number, for a catch-up")
		}),
		activity: "DM writes the Session summary",
		run: (ctx, input) => {
			const closed = closeSession(ctx.db, {
				...input,
				at: ctx.now
			});
			return {
				result: closed,
				event: {
					kind: "session_closed",
					summary: `Session ${closed.session} closed`,
					data: closed
				}
			};
		}
	}),
	readTool({
		name: "sessions",
		description: "Session summaries and open threads, newest first (last limits how many). Also says which Session is current, which older ones are unclosed (catch-up close them first) and whether a recap is due this sitting.",
		input: object({ last: number().int().positive().optional() }),
		activity: "DM remembers earlier sittings",
		run: ({ db }, { last }) => sessionsView(db, last)
	}),
	readTool({
		name: "history",
		description: "The Event log, newest first. Filter by about (a handle the Event mentions), session (number), since (only Events after this Event id) and query (full-text over Narration). Includes DM-only Events, so never show them to the Players as they are. Recaps are left out.",
		input: object({
			about: string().min(1).optional(),
			session: number().int().positive().optional(),
			since: number().int().nonnegative().optional(),
			query: string().trim().min(1).optional(),
			limit: number().int().positive().max(200).optional()
		}),
		activity: "DM looks back over the story",
		run: ({ db }, input) => ({ events: history(db, input) })
	})
];
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
						type: input.type,
						...input.distinct_from.length && { distinct_from: input.distinct_from }
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
			const result = createWorld(ctx).supersede(old, by);
			return {
				result,
				event: {
					kind: "fact_superseded",
					summary: `Fact ${old} superseded by Fact ${by}`,
					data: {
						old,
						by,
						subject: result.subject
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
	...creationTools,
	...worldTools,
	...knowledgeTools,
	...narrationTools,
	...sceneTools,
	...sessionTools,
	...rulesTools,
	...actionTools,
	...arcTools,
	...lintTools
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
		if (tool.mutates === false) return "DM checks their notes";
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
	/** Runs one call; returns its result and what the browser must refetch. */
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
		const timelineChanged = [{
			type: "timeline",
			campaign: campaignId
		}];
		if (tool.mutates === false) {
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
				changed: line === null ? [] : timelineChanged
			};
		}
		if (tool.mutates === "creation") return db.transaction((tx) => {
			const { result, line, changed } = tool.run({
				...context,
				db: tx,
				stamp: {
					...stamp(tx),
					eventId: null
				}
			}, parsed.data);
			if (!line) return {
				result,
				changed
			};
			addConversationLine(tx, {
				author: "dm_write",
				text: line
			}, at);
			return {
				result,
				changed: [...changed, {
					type: "conversation",
					campaign: campaignId
				}]
			};
		});
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
				changed: timelineChanged
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
				const { result, changed } = run(tool, folder, args);
				for (const message of changed) publish(message);
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
/** Play input (and a creation conversation message) needs a DM at the table to hear it. */
var DmAwayError = class extends Error {};
/** What every refused play input says while no session is attached. */
var DM_AWAY_MESSAGE = "The DM is away. Run dm in the Campaign folder to start a sitting; your drafts wait here.";
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
	/**
	* The Campaign's folder, refusing play input while no DM is at the table. Open Calls and waiting
	* Floors stay as they are for the next opening.
	*/
	function atTable(campaignId) {
		const folder = folderOf(campaignId);
		if (!channels.listening(folder)) throw new DmAwayError(DM_AWAY_MESSAGE);
		return folder;
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
		/** Whether a DM is at the table for the Campaign. */
		attended(campaignId) {
			return channels.listening(folderOf(campaignId));
		},
		/** The open Floor, to send, edit or withdraw Declarations; refused while the DM is away. */
		floor(campaignId) {
			atTable(campaignId);
			return library.floor(campaignId);
		},
		/**
		* The Player presses Done. When it closes the Floor, the DM gets exactly one floor event and
		* the Campaign awaits Narration.
		*/
		done(campaignId, player = SOLO_PLAYER) {
			atTable(campaignId);
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
			atTable(campaignId);
			return answered(campaignId, library.calls(campaignId).roll(callId, partId, dice(campaignId), player));
		},
		/** The Player answers a question Call; the last answer wakes the DM like a roll does. */
		answer(campaignId, callId, partId, text, player = SOLO_PLAYER) {
			atTable(campaignId);
			return answered(campaignId, library.calls(campaignId).answer(callId, partId, text, player));
		},
		/**
		* A Player's "Cut to <Name>": one spotlight channel event to the DM. Doesn't await Narration.
		* Refused (`SpotlightRefusedError`) for a Character who is already in the Scene.
		*/
		spotlight(campaignId, character, player = SOLO_PLAYER) {
			const folder = atTable(campaignId);
			const request = library.record(campaignId).spotlight(character, player);
			channels.send(folder, request);
		},
		/** The Scene as the Player's rail shows it. */
		scene(campaignId) {
			return library.record(campaignId).scene();
		},
		/**
		* The Player writes in the DM pane: the message is kept for the pane and reaches the DM as one
		* conversation event. It is out of fiction, so it never touches the Floor or the Event log.
		*/
		converse(campaignId, text, player = SOLO_PLAYER) {
			const folder = folderOf(campaignId);
			if (!channels.listening(folder)) throw new DmAwayError("The DM is away. Run dm in the Campaign folder to ask for help.");
			const message = library.conversation(campaignId).add({
				text,
				player
			});
			channels.send(folder, {
				content: text,
				meta: {
					kind: "conversation",
					player
				}
			});
			publish({
				type: "conversation",
				campaign: campaignId
			});
			return message;
		},
		/**
		* The Player presses Begin: the Seed locks and the DM gets one begin event, which it hands to
		* `builder`. It needs a DM at the table, and it doesn't set awaiting Narration.
		*/
		begin(campaignId, player = SOLO_PLAYER) {
			const folder = folderOf(campaignId);
			if (!channels.listening(folder)) throw new DmAwayError("The DM is away. Run dm in the Campaign folder, then press Begin.");
			library.begin(campaignId);
			channels.send(folder, {
				content: "The Player pressed Begin. Hand the Seed and the Party to builder to create the World and the first Arc, then open play.",
				meta: {
					kind: "begin",
					player
				}
			});
			publish({
				type: "seed",
				campaign: campaignId
			});
		},
		/** The Player chooses Start over; it works with the DM away too. */
		startOver(campaignId) {
			library.startOver(campaignId);
			publish({
				type: "seed",
				campaign: campaignId
			});
			publish({
				type: "timeline",
				campaign: campaignId
			});
		},
		/**
		* The Player presses End Session: the DM gets one `end_session` event and closes the sitting
		* (closing beat, summary, Arc review, lint) with the ending-a-sitting skill.
		*/
		endSession(campaignId) {
			channels.send(atTable(campaignId), {
				content: "The Player pressed End Session. Close the sitting.",
				meta: { kind: "end_session" }
			});
		},
		/**
		* Opens the Campaign's Session as a DM attaches through `bridge`; a reconnecting bridge keeps
		* its own Session.
		*/
		openSession(campaignId, bridge) {
			return library.record(campaignId).openSession(bridge);
		},
		/**
		* The Stop hook asks whether the DM may end its turn. It may not while a closed Floor awaits
		* Narration, or while an action tool's pending Call is unattached. On the second attempt
		* (`again`) it may, and the Player's timeline shows an error.
		*/
		stopCheck(campaignId, again) {
			const record = library.record(campaignId);
			const pending = record.pendingCalls();
			const awaiting = record.timeline().awaitingSince !== null;
			if (!pending.length && !awaiting) return { block: false };
			if (!again) return {
				block: true,
				reason: [awaiting && "A closed Floor awaits Narration. Answer it with narrate before ending your turn.", pending.length && `A pending Call is unattached (${pending.join(", ")}). Attach it with narrate(text, call: id), or drop it with cancel_call.`].filter(Boolean).join(" ")
			};
			record.dropPendingCalls();
			record.turnError(awaiting ? "The DM ended its turn without a Narration." : "The DM ended its turn before asking for a roll.");
			publish({
				type: "timeline",
				campaign: campaignId
			});
			return { block: false };
		},
		/**
		* What SessionStart injects when a sitting opens: the core block, the "changed since last
		* sitting" notice for offline edits (told once) and any turn left awaiting Narration.
		*/
		sessionStart(campaignId) {
			return library.record(campaignId).opening();
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
	return sessions.onChange(({ campaign, attached, session }) => {
		if (attached) play.openSession(campaign, session);
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
* - `GET  core-block?campaign=<folder>`: the DM's core block, as `{text}`, after compaction.
* - `POST session-start` with `{campaign}`: what a sitting's opening injects, as `{text}`: the core
*   block, then what changed since the last sitting (told once) and a turn awaiting Narration.
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
		if (route === "session-start" && request.method === "POST") {
			const { campaign } = await request.json();
			const entry = campaign && library.entryAt(campaign);
			if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404);
			return json({ text: play.sessionStart(entry.id) });
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
export { permissions as a, DmAwayError as c, host as i, bridgeApi as n, play as o, channels as r, port as s, announceServer as t };

//# sourceMappingURL=bridge.js.map