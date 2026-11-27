import { ft as resolve } from "../../../../../chunks/internal.js";
import { S as escape_html, c as ensure_array_like, l as head, o as derived, t as attr_class, u as props_id, v as attr, y as clsx } from "../../../../../chunks/server2.js";
import "../../../../../chunks/forms.js";
import "../../../../../chunks/paths.js";
import { i as CreationStepper, n as createDraftQuery, t as CreationPage } from "../../../../../chunks/CreationPage.js";
import { t as Badge } from "../../../../../chunks/Badge.js";
import { t as Link } from "../../../../../chunks/Link.js";
import "../../../../../chunks/index-server.js";
import { n as beforeNavigate, r as goto } from "../../../../../chunks/navigation.js";
import { t as Alert } from "../../../../../chunks/Alert.js";
import { t as Button } from "../../../../../chunks/Button.js";
import { t as Dialog } from "../../../../../chunks/Dialog.js";
import { s as ABILITY_KEYS } from "../../../../../chunks/schema.js";
import { A as rollAbilityScores, C as POINT_BUY, D as methodPatch, E as availableValues, F as equipmentGroups, I as fixedEquipment, L as ownedEquipment, M as rollTotals, N as categoryItems, O as pointCost, R as resolveFeatures, S as ABILITY_LABELS, _ as computeSteps, a as cappedScore, d as reconcile, f as resolverDraft, g as STEPS, h as spellsView, i as tryDraftToCharacterInput, j as rollTotal, k as pointsSpent, m as spellPickFlags, o as deriveStats, r as draftToSummaryData, s as LIMITS, t as buildSummary, u as emptyDraft, v as groupIssues, w as STANDARD_ARRAY, x as skillsStepGroups, y as groupLabel } from "../../../../../chunks/summary.js";
import { t as Checkbox } from "../../../../../chunks/Checkbox.js";
import { t as Field } from "../../../../../chunks/Field.js";
import { t as Select } from "../../../../../chunks/Select.js";
import { t as Textarea } from "../../../../../chunks/Textarea.js";
import { t as TextInput } from "../../../../../chunks/TextInput.js";
import { t as Panel } from "../../../../../chunks/Panel.js";
import { n as createSessionsQuery, t as DmBadge } from "../../../../../chunks/DmBadge.js";
// src/lib/campaign/PartyList.svelte
function PartyList($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Saved Characters and drafts, in list order. */
		/** The id of the Character or draft open in the wizard. */
		let { campaignId, members, selected = null } = $$props;
		const party = derived(() => resolve("/campaigns/[id]/party", { id: campaignId }));
		const href = (m) => `${party()}?${m.kind === "draft" ? "draft" : "character"}=${encodeURIComponent(m.id)}`;
		if (members.length === 0) $$renderer.push(`<!--[0--><p class="text-sm text-muted">No Characters yet.</p>`);
		else {
			$$renderer.push(`<!--[-1--><ul class="divide-y divide-border rounded-panel border border-border"><!--[-->`);
			const each_array = ensure_array_like(members);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let m = each_array[$$index];
				$$renderer.push(`<li${attr_class(clsx(["flex items-center justify-between gap-3 px-3 py-2", selected === m.id && "bg-raised"]))}${attr("aria-current", selected === m.id ? "true" : void 0)}>`);
				Link($$renderer, {
					href: href(m),
					class: "font-semibold",
					children: ($$renderer) => {
						$$renderer.push(`<!---->${escape_html(m.name || "Unnamed Character")}`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> `);
				if (m.kind === "draft") {
					$$renderer.push(`<!--[0--><span class="flex items-center gap-2 text-sm text-muted">`);
					Badge($$renderer, {
						size: "sm",
						variant: "info",
						children: ($$renderer) => {
							$$renderer.push(`<!---->Draft`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----> on ${escape_html(m.stepLabel)}</span>`);
				} else {
					$$renderer.push(`<!--[-1--><span class="flex items-center gap-2 text-sm text-muted">${escape_html(m.description)} `);
					if (m.status !== "alive") {
						$$renderer.push("<!--[0-->");
						Badge($$renderer, {
							size: "sm",
							children: ($$renderer) => {
								$$renderer.push(`<!---->${escape_html(m.status)}`);
							},
							$$slots: { default: true }
						});
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></span>`);
				}
				$$renderer.push(`<!--]--></li>`);
			}
			$$renderer.push(`<!--]--></ul>`);
		}
		$$renderer.push(`<!--]-->`);
	});
}
// src/lib/character/StatsStrip.svelte
function StatsStrip($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Pure view of `deriveStats`: a pending stat shows a dash and says what it waits for. */
		let { stats } = $$props;
		const signed = (n) => n >= 0 ? `+${n}` : `${n}`;
		const why = (s) => s.status === "pending" ? `Needs ${s.missing.join(", ")}` : void 0;
		const show = (s, format) => s.status === "ok" ? format(s.value) : "—";
		const tiles = derived(() => [
			{
				label: "HP",
				hint: why(stats.hitPoints),
				text: show(stats.hitPoints, String)
			},
			{
				label: "AC (unarmored)",
				hint: why(stats.unarmoredAc),
				text: show(stats.unarmoredAc, (a) => String(a.value))
			},
			{
				label: "Speed",
				hint: why(stats.speed),
				text: show(stats.speed, String)
			}
		]);
		$$renderer.push(`<div role="group" aria-label="Computed stats" class="grid grid-cols-6 gap-2 text-center text-xs"><!--[-->`);
		const each_array = ensure_array_like(ABILITY_KEYS);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let key = each_array[$$index];
			const a = stats.abilities[key];
			$$renderer.push(`<div role="group"${attr("aria-label", key.toUpperCase())}${attr("title", why(a))} class="rounded-control border border-border bg-raised p-1.5"><div class="text-muted uppercase">${escape_html(key)}</div> <div class="text-base font-semibold">${escape_html(show(a, (v) => String(v.score)))}</div> <div>${escape_html(show(a, (v) => signed(v.modifier)) === "—" ? "" : show(a, (v) => signed(v.modifier)))}</div></div>`);
		}
		$$renderer.push(`<!--]--> <!--[-->`);
		const each_array_1 = ensure_array_like(tiles());
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let tile = each_array_1[$$index_1];
			$$renderer.push(`<div role="group"${attr("aria-label", tile.label)}${attr("title", tile.hint)} class="col-span-2 rounded-control border border-border bg-raised p-1.5"><span class="text-muted">${escape_html(tile.label)}</span> <strong>${escape_html(tile.text)}</strong></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
// src/lib/character/StepRail.svelte
var STATUS_LABEL = {
	locked: "locked",
	incomplete: "incomplete",
	attention: "needs attention",
	valid: "valid"
};
function StepRail($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Sits under the heading, e.g. the AI status chip. */
		let { steps, current, onselect, onabandon, header } = $$props;
		$$renderer.push(`<nav aria-label="Steps" class="space-y-1"><h1 class="font-display text-xl">New Character</h1> `);
		header?.($$renderer);
		$$renderer.push(`<!----> <ol class="space-y-1"><!--[-->`);
		const each_array = ensure_array_like(steps);
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			let step = each_array[i];
			$$renderer.push(`<li><button type="button"${attr("disabled", step.status === "locked", true)}${attr("aria-current", current === step.id ? "step" : void 0)}${attr("title", step.issues?.join(" ") || void 0)}${attr_class(clsx([
				"flex w-full items-center gap-2 rounded-control border px-3 py-2 text-left text-sm",
				"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
				"disabled:cursor-not-allowed disabled:opacity-50",
				current === step.id ? "border-primary bg-raised font-semibold" : "border-transparent hover:bg-raised"
			]))}><svg aria-hidden="true" viewBox="0 0 16 16"${attr_class(clsx([
				"h-4 w-4 shrink-0 fill-none stroke-current stroke-2",
				step.status === "attention" && "text-warning",
				step.status === "valid" && "text-success"
			]))}>`);
			if (step.status === "locked") $$renderer.push(`<!--[0--><rect x="3" y="7" width="10" height="7" rx="1"></rect><path d="M5 7V5a3 3 0 0 1 6 0v2"></path>`);
			else if (step.status === "valid") $$renderer.push(`<!--[1--><path d="M3 8.5l3.5 3.5L13 4.5"></path>`);
			else if (step.status === "attention") $$renderer.push(`<!--[2--><path d="M8 2l6.5 12h-13z"></path><path d="M8 6.5v3.5M8 12v.01"></path>`);
			else $$renderer.push(`<!--[-1--><circle cx="8" cy="8" r="5"></circle>`);
			$$renderer.push(`<!--]--></svg> <span>${escape_html(i + 1)}. ${escape_html(step.label)}</span> <span class="sr-only">, ${escape_html(STATUS_LABEL[step.status])}</span></button></li>`);
		}
		$$renderer.push(`<!--]--></ol> `);
		Button($$renderer, {
			variant: "ghost",
			size: "sm",
			class: "mt-3",
			onclick: onabandon,
			children: ($$renderer) => {
				$$renderer.push(`<!---->Abandon`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></nav>`);
	});
}
// src/lib/character/AbilitiesStep.svelte
function AbilitiesStep($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { wizard } = $$props;
		const draft = derived(() => wizard.draft);
		const method = derived(() => draft().abilityMethod);
		const bonusGroups = derived(() => wizard.resolved.groups.filter((g) => g.kind === "abilityBonus"));
		const spent = derived(() => pointsSpent(draft().baseScores));
		const remaining = derived(() => POINT_BUY.budget - spent());
		const pool = derived(() => method() === "standard-array" ? [...STANDARD_ARRAY] : method() === "rolling" && draft().abilityRolls ? rollTotals(draft().abilityRolls) : []);
		const METHODS = [
			{
				id: "standard-array",
				label: "Standard array",
				hint: `Assign ${STANDARD_ARRAY.join(", ")}, one to each ability.`
			},
			{
				id: "point-buy",
				label: "Point buy",
				hint: `Spend up to ${POINT_BUY.budget} points; scores run ${POINT_BUY.min} to ${POINT_BUY.max} before racial bonuses.`
			},
			{
				id: "rolling",
				label: "Rolling",
				hint: "Roll four dice six times and drop the lowest of each; assign the totals."
			}
		];
		function chooseMethod(next) {
			if (next === method()) return;
			wizard.update(methodPatch(next));
		}
		function setScore(key, value) {
			wizard.update({ baseScores: {
				...draft().baseScores,
				[key]: value
			} });
		}
		function adjust(key, delta) {
			const current = draft().baseScores[key] ?? POINT_BUY.min;
			const next = current + delta;
			if (pointCost(next) === void 0) return;
			if (delta > 0 && pointCost(next) - pointCost(current) > remaining()) return;
			setScore(key, next);
		}
		/** A reroll replaces the whole set, so earlier assignments no longer mean anything. */
		function roll() {
			wizard.rollAbilities();
		}
		function togglePick(groupKey, slug, on, current) {
			const next = on ? [...current, slug] : current.filter((s) => s !== slug);
			wizard.update({ picks: {
				...draft().picks,
				[groupKey]: next
			} });
		}
		const bonusOf = (key) => wizard.resolved.abilityBonusTotals[key] ?? 0;
		const signed = (n) => n >= 0 ? `+${n}` : `${n}`;
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="space-y-5"><div class="space-y-1">`);
			{
				function children($$renderer, id, describedby) {
					var bind_get = () => method() ?? "";
					var bind_set = (v) => {
						if (v && v !== method()) chooseMethod(v);
					};
					Select($$renderer, {
						id,
						"aria-describedby": describedby,
						get value() {
							return bind_get();
						},
						set value($$value) {
							bind_set($$value);
						},
						children: ($$renderer) => {
							$$renderer.option({ value: "" }, ($$renderer) => {
								$$renderer.push(`Choose…`);
							});
							$$renderer.push(` <!--[-->`);
							const each_array = ensure_array_like(METHODS);
							for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
								let m = each_array[$$index];
								$$renderer.option({ value: m.id }, ($$renderer) => {
									$$renderer.push(`${escape_html(m.label)}`);
								});
							}
							$$renderer.push(`<!--]-->`);
						},
						$$slots: { default: true }
					});
				}
				Field($$renderer, {
					label: "Ability score method",
					children,
					$$slots: { default: true }
				});
			}
			$$renderer.push(`<!----> `);
			if (method()) $$renderer.push(`<!--[0--><p class="text-sm text-muted">${escape_html(METHODS.find((m) => m.id === method())?.hint)}</p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> `);
			if (method() === "point-buy") $$renderer.push(`<!--[0--><p class="text-sm font-medium text-text" aria-live="polite">Points remaining: <span data-testid="points-remaining">${escape_html(remaining())}</span> of ${escape_html(POINT_BUY.budget)}</p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (method() === "rolling") {
				$$renderer.push(`<!--[0--><section class="space-y-2" aria-label="Rolled dice"><div class="flex items-center gap-3">`);
				Button($$renderer, {
					variant: "secondary",
					onclick: roll,
					children: ($$renderer) => {
						$$renderer.push(`<!---->${escape_html(draft().abilityRolls ? "Reroll all" : "Roll scores")}`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> <span class="text-sm text-muted">Rerolling replaces the whole set. Switching method keeps it.</span></div> `);
				if (draft().abilityRolls) {
					$$renderer.push(`<!--[0--><ol class="grid gap-1 sm:grid-cols-2"><!--[-->`);
					const each_array_1 = ensure_array_like(draft().abilityRolls);
					for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
						let dice = each_array_1[i];
						const lowest = dice.indexOf(Math.min(...dice));
						$$renderer.push(`<li class="text-sm text-text"${attr("aria-label", `Roll ${i + 1}`)}>Roll ${escape_html(i + 1)}: <!--[-->`);
						const each_array_2 = ensure_array_like(dice);
						for (let j = 0, $$length = each_array_2.length; j < $$length; j++) {
							let d = each_array_2[j];
							$$renderer.push(`<span${attr_class(clsx(["mr-1 inline-block", j === lowest ? "text-muted line-through" : "font-medium"]))}${attr("title", j === lowest ? "Dropped" : void 0)}>${escape_html(d)}</span>`);
						}
						$$renderer.push(`<!--]--> = <strong>${escape_html(rollTotal(dice))}</strong></li>`);
					}
					$$renderer.push(`<!--]--></ol>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></section>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (method() && !(method() === "rolling" && !draft().abilityRolls)) {
				$$renderer.push("<!--[0-->");
				if (wizard.dmFields.includes("baseScores")) $$renderer.push(`<!--[0--><p class="text-xs text-accent">✎ DM arranged these scores. Change any to make them yours.</p>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <table class="w-full text-left text-sm"><thead class="text-muted"><tr><th scope="col" class="py-1 pr-2 font-medium">Ability</th><th scope="col" class="py-1 pr-2 font-medium">Base</th><th scope="col" class="py-1 pr-2 font-medium">Racial</th><th scope="col" class="py-1 font-medium">Score</th></tr></thead><tbody><!--[-->`);
				const each_array_3 = ensure_array_like(ABILITY_KEYS);
				for (let $$index_4 = 0, $$length = each_array_3.length; $$index_4 < $$length; $$index_4++) {
					let key = each_array_3[$$index_4];
					const base = draft().baseScores[key];
					const bonus = bonusOf(key);
					const total = base === null ? null : cappedScore(base, bonus);
					$$renderer.push(`<tr class="border-t border-control-border"><th scope="row" class="py-2 pr-2 font-medium text-text">${escape_html(ABILITY_LABELS[key])}</th><td class="py-2 pr-2">`);
					if (method() === "point-buy") {
						$$renderer.push(`<!--[0--><div class="flex items-center gap-2">`);
						Button($$renderer, {
							size: "sm",
							variant: "secondary",
							"aria-label": `Decrease ${ABILITY_LABELS[key]}`,
							disabled: (base ?? POINT_BUY.min) <= POINT_BUY.min,
							onclick: () => adjust(key, -1),
							children: ($$renderer) => {
								$$renderer.push(`<!---->−`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----> <span class="w-6 text-center"${attr("data-testid", `base-${key}`)}>${escape_html(base)}</span> `);
						Button($$renderer, {
							size: "sm",
							variant: "secondary",
							"aria-label": `Increase ${ABILITY_LABELS[key]}`,
							disabled: (base ?? POINT_BUY.min) >= POINT_BUY.max || pointCost((base ?? POINT_BUY.min) + 1) - pointCost(base ?? POINT_BUY.min) > remaining(),
							onclick: () => adjust(key, 1),
							children: ($$renderer) => {
								$$renderer.push(`<!---->+`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----> <span class="text-muted">${escape_html(pointCost(base ?? POINT_BUY.min))} pts</span></div>`);
					} else {
						$$renderer.push("<!--[-1-->");
						Select($$renderer, {
							size: "sm",
							"aria-label": `${ABILITY_LABELS[key]} base score`,
							value: base === null ? "" : String(base),
							onchange: (e) => {
								const v = e.currentTarget.value;
								setScore(key, v === "" ? null : Number(v));
							},
							children: ($$renderer) => {
								$$renderer.option({ value: "" }, ($$renderer) => {
									$$renderer.push(`Choose…`);
								});
								$$renderer.push(` <!--[-->`);
								const each_array_4 = ensure_array_like(availableValues(pool(), draft().baseScores, key));
								for (let i = 0, $$length = each_array_4.length; i < $$length; i++) {
									let v = each_array_4[i];
									$$renderer.option({ value: String(v) }, ($$renderer) => {
										$$renderer.push(`${escape_html(v)}`);
									});
								}
								$$renderer.push(`<!--]-->`);
							},
							$$slots: { default: true }
						});
					}
					$$renderer.push(`<!--]--></td><td class="py-2 pr-2 text-muted"${attr("data-testid", `racial-${key}`)}>${escape_html(bonus ? signed(bonus) : "—")}</td><td class="py-2 font-medium text-text"${attr("data-testid", `score-${key}`)}>${escape_html(total ?? "—")} `);
					if (base !== null && base + bonus > 20) $$renderer.push(`<!--[0--><span class="font-normal text-muted">(capped at ${escape_html(20)})</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></td></tr>`);
				}
				$$renderer.push(`<!--]--></tbody></table>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <!--[-->`);
			const each_array_5 = ensure_array_like(bonusGroups());
			for (let $$index_6 = 0, $$length = each_array_5.length; $$index_6 < $$length; $$index_6++) {
				let group = each_array_5[$$index_6];
				const picks = draft().picks[group.key] ?? [];
				$$renderer.push(`<fieldset class="space-y-2"><legend class="text-sm font-medium text-text">Racial bonus: choose ${escape_html(group.choose)} abilities for +1 each</legend> <div class="flex flex-wrap gap-4"><!--[-->`);
				const each_array_6 = ensure_array_like(group.options);
				for (let $$index_5 = 0, $$length = each_array_6.length; $$index_5 < $$length; $$index_5++) {
					let option = each_array_6[$$index_5];
					const checked = picks.includes(option.slug);
					$$renderer.push(`<label class="flex items-center gap-2 text-sm text-text">`);
					Checkbox($$renderer, {
						checked,
						disabled: option.disabled !== null || !checked && picks.length >= group.choose,
						onchange: (e) => togglePick(group.key, option.slug, e.currentTarget.checked, picks)
					});
					$$renderer.push(`<!----> ${escape_html(ABILITY_LABELS[option.slug] ?? option.name)}</label>`);
				}
				$$renderer.push(`<!--]--></div></fieldset>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/character/ConceptStep.svelte
function ConceptStep($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { wizard } = $$props;
		const draft = derived(() => wizard.draft);
		const rules = derived(() => wizard.rules);
		const subraces = derived(() => rules().subraces.filter((s) => s.race === draft().race));
		const subclassGroup = derived(() => wizard.resolved.groups.find((g) => g.kind === "subclass"));
		const single = derived(() => subclassGroup()?.options.length === 1);
		const text = [
			{
				key: "appearance",
				label: "Appearance",
				rows: 2
			},
			{
				key: "personality",
				label: "Personality traits",
				rows: 2
			},
			{
				key: "ideal",
				label: "Ideal",
				rows: 2
			},
			{
				key: "bond",
				label: "Bond",
				rows: 2
			},
			{
				key: "flaw",
				label: "Flaw",
				rows: 2
			},
			{
				key: "backstory",
				label: "Backstory",
				rows: 5
			}
		];
		const dm = (field) => wizard.dmFields.includes(field);
		const choose = {
			value: "",
			label: "Choose…"
		};
		const opts = (list, first = choose) => [first, ...list.map((e) => ({
			value: e.slug,
			label: e.name
		}))];
		function select($$renderer, field, label, options, value, set) {
			{
				function children($$renderer, id, describedby) {
					var bind_get = () => value;
					var bind_set = set;
					Select($$renderer, {
						id,
						"aria-describedby": describedby,
						get value() {
							return bind_get();
						},
						set value($$value) {
							bind_set($$value);
						},
						children: ($$renderer) => {
							$$renderer.push(`<!--[-->`);
							const each_array = ensure_array_like(options);
							for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
								let option = each_array[$$index];
								$$renderer.option({ value: option.value }, ($$renderer) => {
									$$renderer.push(`${escape_html(option.label)}`);
								});
							}
							$$renderer.push(`<!--]-->`);
						},
						$$slots: { default: true }
					});
				}
				Field($$renderer, {
					label,
					dm: dm(field),
					children,
					$$slots: { default: true }
				});
			}
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="space-y-4"><div>`);
			{
				function children($$renderer, id, describedby) {
					var bind_get_1 = () => draft().name;
					var bind_set_1 = (v) => wizard.update({ name: v });
					TextInput($$renderer, {
						id,
						"aria-describedby": describedby,
						get value() {
							return bind_get_1();
						},
						set value($$value) {
							bind_set_1($$value);
						}
					});
				}
				Field($$renderer, {
					label: "Name",
					dm: dm("name"),
					children,
					$$slots: { default: true }
				});
			}
			$$renderer.push(`<!----> <p class="mt-1 text-sm text-muted">Required. Names need not be unique. `);
			if (draft().name.length > LIMITS.name) $$renderer.push(`<!--[0--><span class="text-danger">Over the ${escape_html(LIMITS.name)} character limit.</span>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></p></div> <div class="grid gap-3 sm:grid-cols-2">`);
			select($$renderer, "race", "Race", opts(rules().races), draft().race ?? "", (v) => wizard.update({ race: v || null }));
			$$renderer.push(`<!----> `);
			if (subraces().length > 0) {
				$$renderer.push("<!--[0-->");
				select($$renderer, "subrace", "Subrace", opts(subraces()), draft().subrace ?? "", (v) => wizard.update({ subrace: v || null }));
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			select($$renderer, "class", "Class", opts(rules().classes), draft().class ?? "", (v) => wizard.update({ class: v || null }));
			$$renderer.push(`<!----> `);
			if (subclassGroup()) {
				$$renderer.push("<!--[0-->");
				select($$renderer, "subclass", "Subclass", opts(subclassGroup().options), draft().subclass ?? "", (v) => wizard.update({ subclass: v || null }));
				$$renderer.push(`<!----> `);
				if (single()) $$renderer.push(`<!--[0--><p class="text-sm text-muted">The SRD offers only one, so it is selected for you.</p>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			select($$renderer, "background", "Background", opts(rules().backgrounds), draft().background ?? "", (v) => wizard.update({ background: v || null }));
			$$renderer.push(`<!----> `);
			select($$renderer, "alignment", "Alignment", opts(rules().alignments, {
				value: "",
				label: "Unspecified"
			}), draft().alignment ?? "", (v) => wizard.update({ alignment: v || null }));
			$$renderer.push(`<!----></div> <h3 class="font-display text-lg">Details <span class="text-sm text-muted">(optional)</span></h3> <!--[-->`);
			const each_array_1 = ensure_array_like(text);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let field = each_array_1[$$index_1];
				$$renderer.push(`<div>`);
				{
					function children($$renderer, id, describedby) {
						var bind_get_2 = () => draft()[field.key];
						var bind_set_2 = (v) => wizard.update({ [field.key]: v });
						Textarea($$renderer, {
							id,
							rows: field.rows,
							"aria-describedby": describedby,
							get value() {
								return bind_get_2();
							},
							set value($$value) {
								bind_set_2($$value);
							}
						});
					}
					Field($$renderer, {
						label: field.label,
						dm: dm(field.key),
						children,
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!----> `);
				if (draft()[field.key].length > LIMITS[field.key]) $$renderer.push(`<!--[0--><p class="mt-1 text-sm text-danger" role="alert">Over the ${escape_html(LIMITS[field.key])} character limit.</p>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/character/EquipmentStep.svelte
function EquipmentStep($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { wizard } = $$props;
		const rules = derived(() => wizard.rules);
		const groups = derived(() => equipmentGroups(rules(), wizard.draft, wizard.resolved));
		const fixed = derived(() => fixedEquipment(rules(), wizard.draft));
		const setPick = (key, pick) => wizard.update({ equipment: {
			...wizard.draft.equipment,
			[key]: pick
		} });
		$$renderer.push(`<div class="space-y-6"><p class="text-muted">Choose your starting equipment. Wildcards such as "any martial weapon" need a specific item.</p> <!--[-->`);
		const each_array = ensure_array_like(groups());
		for (let $$index_3 = 0, $$length = each_array.length; $$index_3 < $$length; $$index_3++) {
			let group = each_array[$$index_3];
			const selected = group.pick ? group.options[group.pick.option] : void 0;
			$$renderer.push(`<fieldset class="space-y-2"${attr("data-testid", `equipment-group-${group.key}`)}><legend class="font-medium text-text">${escape_html(group.ownerName)}: ${escape_html(group.label)}</legend> <!--[-->`);
			const each_array_1 = ensure_array_like(group.options);
			for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
				let option = each_array_1[$$index_2];
				$$renderer.push(`<div class="space-y-2"><label${attr_class(clsx(["flex items-start gap-2", option.disabled ? "text-muted" : "text-text"]))}><input type="radio" class="mt-1"${attr("name", group.key)}${attr("checked", group.pick?.option === option.index, true)}${attr("disabled", option.disabled !== null, true)}/> <span>${escape_html(option.label)} `);
				if (option.disabled) $$renderer.push(`<!--[0--><span class="block text-sm">${escape_html(option.disabled)}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></span></label> `);
				if (selected === option && option.slots.length > 0 && group.pick) {
					$$renderer.push("<!--[0-->");
					const pick = group.pick;
					$$renderer.push(`<div class="ml-6 grid gap-2 sm:grid-cols-2"><!--[-->`);
					const each_array_2 = ensure_array_like(option.slots);
					for (let slot = 0, $$length = each_array_2.length; slot < $$length; slot++) {
						let category = each_array_2[slot];
						const name = rules().equipmentCategories.find((c) => c.slug === category)?.name;
						Select($$renderer, {
							"aria-label": `${name ?? category} item ${slot + 1}`,
							value: pick.wild[slot] ?? "",
							onchange: (e) => {
								const wild = [...pick.wild];
								wild[slot] = e.currentTarget.value || null;
								setPick(group.key, {
									option: pick.option,
									wild
								});
							},
							children: ($$renderer) => {
								$$renderer.option({ value: "" }, ($$renderer) => {
									$$renderer.push(`Choose from ${escape_html(name ?? category)}…`);
								});
								$$renderer.push(` <!--[-->`);
								const each_array_3 = ensure_array_like(categoryItems(rules(), category));
								for (let $$index = 0, $$length = each_array_3.length; $$index < $$length; $$index++) {
									let item = each_array_3[$$index];
									$$renderer.option({ value: item.slug }, ($$renderer) => {
										$$renderer.push(`${escape_html(item.name)}`);
									});
								}
								$$renderer.push(`<!--]-->`);
							},
							$$slots: { default: true }
						});
					}
					$$renderer.push(`<!--]--></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div>`);
			}
			$$renderer.push(`<!--]--></fieldset>`);
		}
		$$renderer.push(`<!--]--> <!--[-->`);
		const each_array_4 = ensure_array_like(fixed());
		for (let $$index_5 = 0, $$length = each_array_4.length; $$index_5 < $$length; $$index_5++) {
			let source = each_array_4[$$index_5];
			$$renderer.push(`<section class="space-y-1"${attr("data-testid", `equipment-fixed-${source.source}`)}><h3 class="font-medium text-text">${escape_html(source.source === "class" ? `${source.ownerName} gear` : `${source.ownerName} package`)}</h3> <ul class="list-disc pl-6 text-muted"><!--[-->`);
			const each_array_5 = ensure_array_like(source.items);
			for (let $$index_4 = 0, $$length = each_array_5.length; $$index_4 < $$length; $$index_4++) {
				let item = each_array_5[$$index_4];
				$$renderer.push(`<li>${escape_html(item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name)}</li>`);
			}
			$$renderer.push(`<!--]--></ul></section>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
// src/lib/character/SkillsStep.svelte
function SkillsStep($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { wizard } = $$props;
		const draft = derived(() => wizard.draft);
		const rules = derived(() => wizard.rules);
		const background = derived(() => rules().backgrounds.find((b) => b.slug === draft().background));
		const groups = derived(() => skillsStepGroups(wizard.resolved));
		const sections = derived(() => [
			["race", `Race${draft().race ? `: ${name(rules().races, draft().race)}` : ""}`],
			["class", `Class${draft().class ? `: ${name(rules().classes, draft().class)}` : ""}`],
			["background", `Background${background() ? `: ${background().name}` : ""}`]
		].map(([source, title]) => ({
			source,
			title,
			groups: groups().filter((g) => g.source === source)
		})));
		function name(list, slug) {
			return list.find((e) => e.slug === slug)?.name ?? slug;
		}
		/** Toggles an option. A one-pick group swaps; a bigger group stops at its count. */
		function toggle(g, slug) {
			const picks = g.picks.includes(slug) ? g.picks.filter((p) => p !== slug) : g.choose === 1 ? [slug] : [...g.picks, slug];
			const next = { ...draft().picks };
			if (picks.length) next[g.key] = picks;
			else delete next[g.key];
			wizard.update({ picks: next });
		}
		/** Why an option cannot be ticked now; a pick already made stays untickable-off, never stuck. */
		function blocked(g, slug) {
			if (g.picks.includes(slug)) return null;
			const o = g.options.find((x) => x.slug === slug);
			if (o?.disabled === "granted") return "already granted";
			if (o?.disabled === "chosen-elsewhere") return "chosen elsewhere";
			if (g.choose > 1 && new Set(g.picks).size >= g.choose) return "limit reached";
			return null;
		}
		const tables = [
			{
				kind: "personalityTrait",
				field: "personality",
				label: "Personality traits"
			},
			{
				kind: "ideal",
				field: "ideal",
				label: "Ideal"
			},
			{
				kind: "bond",
				field: "bond",
				label: "Bond"
			},
			{
				kind: "flaw",
				field: "flaw",
				label: "Flaw"
			}
		];
		const entries = (kind) => background()?.options.filter((o) => o.kind === kind) ?? [];
		const showTables = derived(() => !!background() && background().slug !== "custom");
		function roll(kind, field) {
			const list = entries(kind);
			if (!list.length) return;
			wizard.update({ [field]: list[Math.floor(Math.random() * list.length)].text });
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="space-y-6">`);
			if (draft().background === "custom") {
				$$renderer.push(`<!--[0--><section class="space-y-3" aria-label="Custom background"><h3 class="font-display text-lg">Custom background</h3> `);
				{
					function children($$renderer, id, describedby) {
						var bind_get = () => draft().customBackgroundName;
						var bind_set = (v) => wizard.update({ customBackgroundName: v });
						TextInput($$renderer, {
							id,
							"aria-describedby": describedby,
							get value() {
								return bind_get();
							},
							set value($$value) {
								bind_set($$value);
							}
						});
					}
					Field($$renderer, {
						label: "Background name",
						children,
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!----> `);
				if (draft().customBackgroundName.length > LIMITS.customBackgroundName) $$renderer.push(`<!--[0--><p class="text-sm font-medium text-danger" role="alert">Over the ${escape_html(LIMITS.customBackgroundName)} character limit.</p>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				{
					function children($$renderer, id, describedby) {
						var bind_get_1 = () => draft().customBackgroundFeature;
						var bind_set_1 = (v) => wizard.update({ customBackgroundFeature: v });
						Textarea($$renderer, {
							id,
							rows: 3,
							"aria-describedby": describedby,
							get value() {
								return bind_get_1();
							},
							set value($$value) {
								bind_set_1($$value);
							}
						});
					}
					Field($$renderer, {
						label: "Background feature",
						children,
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!----> <p class="text-sm text-muted">Both required. The feature is free text; it has no game mechanics.</p> `);
				if (draft().customBackgroundFeature.length > LIMITS.customBackgroundFeature) $$renderer.push(`<!--[0--><p class="text-sm font-medium text-danger" role="alert">Over the ${escape_html(LIMITS.customBackgroundFeature)} character limit.</p>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <p class="text-sm text-muted">A custom background grants two skills and two tool or language proficiencies (below), plus a
        fixed package: common clothes and a pouch with 15 gp.</p></section>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <!--[-->`);
			const each_array = ensure_array_like(sections());
			for (let $$index_3 = 0, $$length = each_array.length; $$index_3 < $$length; $$index_3++) {
				let section = each_array[$$index_3];
				if (section.groups.length) {
					$$renderer.push(`<!--[0--><section class="space-y-3"${attr("aria-label", section.title)}><h3 class="font-display text-lg">${escape_html(section.title)}</h3> <!--[-->`);
					const each_array_1 = ensure_array_like(section.groups);
					for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
						let g = each_array_1[$$index_2];
						const issues = groupIssues(g);
						$$renderer.push(`<fieldset class="space-y-2 rounded-panel border border-border p-3"${attr("data-choice-key", g.key)}><legend class="px-1 font-medium">${escape_html(groupLabel(g))} <span class="text-sm text-muted">(${escape_html(new Set(g.picks).size)} of ${escape_html(g.choose)})</span></legend> <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2"><!--[-->`);
						const each_array_2 = ensure_array_like(g.options);
						for (let $$index = 0, $$length = each_array_2.length; $$index < $$length; $$index++) {
							let o = each_array_2[$$index];
							const why = blocked(g, o.slug);
							$$renderer.push(`<label${attr_class(clsx(["flex items-center gap-2", why && "text-muted"]))}>`);
							Checkbox($$renderer, {
								checked: g.picks.includes(o.slug),
								disabled: !!why,
								onchange: () => toggle(g, o.slug)
							});
							$$renderer.push(`<!----> <span>${escape_html(o.name.replace(/^Skill: /, ""))}`);
							if (why && why !== "limit reached") $$renderer.push(`<!--[0--><span class="text-sm">(${escape_html(why)})</span>`);
							else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></span></label>`);
						}
						$$renderer.push(`<!--]--></div> `);
						if (g.status === "attention") {
							$$renderer.push("<!--[0-->");
							Alert($$renderer, {
								variant: "danger",
								children: ($$renderer) => {
									$$renderer.push(`<!--[-->`);
									const each_array_3 = ensure_array_like(issues);
									for (let $$index_1 = 0, $$length = each_array_3.length; $$index_1 < $$length; $$index_1++) {
										let issue = each_array_3[$$index_1];
										$$renderer.push(`<p>${escape_html(issue)}</p>`);
									}
									$$renderer.push(`<!--]-->`);
								},
								$$slots: { default: true }
							});
						} else if (g.status === "incomplete") $$renderer.push(`<!--[1--><p class="text-sm font-medium text-warning" data-testid="group-incomplete">Choose ${escape_html(g.choose - new Set(g.picks).size)} more to finish this step.</p>`);
						else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></fieldset>`);
					}
					$$renderer.push(`<!--]--></section>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--> `);
			if (showTables()) {
				$$renderer.push(`<!--[0--><section class="space-y-3" aria-label="Personality"><h3 class="font-display text-lg">Personality <span class="text-sm text-muted">(optional)</span></h3> <p class="text-sm text-muted">Pick or roll from the ${escape_html(background()?.name)} tables, or write your own. Only the final text is saved.</p> <!--[-->`);
				const each_array_4 = ensure_array_like(tables);
				for (let $$index_5 = 0, $$length = each_array_4.length; $$index_5 < $$length; $$index_5++) {
					let t = each_array_4[$$index_5];
					{
						function children($$renderer, id, describedby) {
							$$renderer.push(`<div class="space-y-2"><div class="flex gap-2">`);
							Select($$renderer, {
								"aria-label": `${t.label} table`,
								value: entries(t.kind).some((o) => o.text === draft()[t.field]) ? draft()[t.field] : "",
								onchange: (e) => {
									const v = e.currentTarget.value;
									if (v) wizard.update({ [t.field]: v });
								},
								children: ($$renderer) => {
									$$renderer.option({ value: "" }, ($$renderer) => {
										$$renderer.push(`From the table…`);
									});
									$$renderer.push(` <!--[-->`);
									const each_array_5 = ensure_array_like(entries(t.kind));
									for (let $$index_4 = 0, $$length = each_array_5.length; $$index_4 < $$length; $$index_4++) {
										let o = each_array_5[$$index_4];
										$$renderer.option({ value: o.text }, ($$renderer) => {
											$$renderer.push(`${escape_html(o.text)}`);
										});
									}
									$$renderer.push(`<!--]-->`);
								},
								$$slots: { default: true }
							});
							$$renderer.push(`<!----> `);
							Button($$renderer, {
								type: "button",
								variant: "secondary",
								onclick: () => roll(t.kind, t.field),
								"aria-label": `Roll ${t.label}`,
								children: ($$renderer) => {
									$$renderer.push(`<!---->Roll`);
								},
								$$slots: { default: true }
							});
							$$renderer.push(`<!----></div> `);
							Textarea($$renderer, {
								id,
								"aria-describedby": describedby,
								rows: 2,
								value: draft()[t.field],
								oninput: (e) => wizard.update({ [t.field]: e.currentTarget.value })
							});
							$$renderer.push(`<!----></div>`);
						}
						Field($$renderer, {
							label: t.label,
							error: draft()[t.field].length > LIMITS[t.field] ? `Over the ${LIMITS[t.field]} character limit.` : void 0,
							children,
							$$slots: { default: true }
						});
					}
				}
				$$renderer.push(`<!--]--></section>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (groups().length === 0 && draft().background !== "custom" && !showTables()) $$renderer.push(`<!--[0--><p class="text-muted">Nothing to choose here for this Character.</p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/character/spell-text.ts
/** A spell's level as lowercase text: `cantrip` or `level 3`. Capitalise at the call site if needed. */
function spellLevelLabel(level) {
	return level === 0 ? "cantrip" : `level ${level}`;
}
// src/lib/character/SpellDisclosure.svelte
function SpellDisclosure($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const uid = props_id($$renderer);
		let { spell, row } = $$props;
		const panelId = `spell-details-${uid}`;
		let open = false;
		$$renderer.push(`<div><div class="flex flex-wrap items-center gap-2">`);
		row($$renderer);
		$$renderer.push(`<!----> `);
		if (spell) $$renderer.push(`<!--[0--><button type="button" class="shrink-0 rounded-control border border-control-border px-2 py-0.5 text-sm hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"${attr("aria-expanded", open)}${attr("aria-controls", panelId)}${attr("aria-label", `Details for ${spell.name}`)}>Details</button>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
// src/lib/character/CharacterSummary.svelte
function CharacterSummary($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The read-only Character summary, shared by the Review step and /characters/[id]. A pure view
		* of a `SummaryModel`: every number comes from `deriveStats`, nothing is computed here. AC is
		* unarmored only (armor and shield AC wait for the later sheet effort), and labelled so.
		*/
		let { model } = $$props;
		const data = derived(() => model.data), names = derived(() => model.names), stats = derived(() => model.stats), resolved = derived(() => model.resolved);
		const signed = (n) => n >= 0 ? `+${n}` : `${n}`;
		const show = (s, format) => s.status === "ok" ? format(s.value) : "—";
		const why = (s) => s.status === "pending" ? `Needs ${s.missing.join(", ")}` : void 0;
		const title = (slug) => slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
		const headline = derived(() => [names().subrace ?? names().race, names().class].filter(Boolean).join(" ") + (names().background ? ` · ${names().background}` : ""));
		const narrative = derived(() => [
			["Appearance", data().appearance],
			["Personality", data().personality],
			["Ideal", data().ideal],
			["Bond", data().bond],
			["Flaw", data().flaw],
			["Backstory", data().backstory]
		].filter(([, text]) => text.trim()));
		const skills = derived(() => Object.entries(stats().skills));
		const proficiencyGroups = derived(() => Object.entries(Object.groupBy(resolved().proficiencies.filter((p) => p.type !== "Skills" && p.type !== "Saving Throws"), (p) => p.type)));
		const tiles = derived(() => [
			{
				label: "Hit points",
				stat: stats().hitPoints,
				text: show(stats().hitPoints, String)
			},
			{
				label: "Armor class (unarmored)",
				stat: stats().unarmoredAc,
				text: show(stats().unarmoredAc, (a) => `${a.value}`),
				note: stats().unarmoredAc.status === "ok" ? stats().unarmoredAc.value.formula : void 0
			},
			{
				label: "Speed",
				stat: stats().speed,
				text: show(stats().speed, (v) => `${v} ft`)
			},
			{
				label: "Initiative",
				stat: stats().initiative,
				text: show(stats().initiative, signed)
			},
			{
				label: "Proficiency bonus",
				stat: stats().proficiencyBonus,
				text: show(stats().proficiencyBonus, signed)
			},
			{
				label: "Passive Perception",
				stat: stats().passivePerception,
				text: show(stats().passivePerception, String)
			}
		]);
		const casting = derived(() => stats().spellcasting.status === "ok" ? stats().spellcasting.value : null);
		const slots = derived(() => stats().spellSlots.status === "ok" ? stats().spellSlots.value.map((n, i) => ({
			level: i + 1,
			n
		})).filter((s) => s.n > 0) : []);
		const attacks = derived(() => stats().attacks.status === "ok" ? stats().attacks.value : []);
		$$renderer.push(`<article aria-label="Character summary" class="space-y-6"><header><h2 class="font-display text-2xl">${escape_html(data().name || "Unnamed Character")}</h2> <p class="text-muted">Level ${escape_html(data().level)}
      ${escape_html(headline())}${escape_html(names().subclass ? ` (${names().subclass})` : "")}${escape_html(names().alignment ? ` · ${names().alignment}` : "")}</p></header> <section aria-label="Ability scores" class="grid grid-cols-3 gap-2 text-center sm:grid-cols-6"><!--[-->`);
		const each_array = ensure_array_like(ABILITY_KEYS);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let key = each_array[$$index];
			const a = stats().abilities[key];
			$$renderer.push(`<div role="group"${attr("aria-label", key.toUpperCase())}${attr("title", why(a))} class="rounded-control border border-border bg-raised p-2"><div class="text-xs text-muted uppercase">${escape_html(key)}</div> <div class="text-xl font-semibold">${escape_html(show(a, (v) => String(v.score)))}</div> <div>${escape_html(show(a, (v) => signed(v.modifier)))}</div> `);
			if (a.status === "ok" && a.value.racialBonus !== 0) $$renderer.push(`<!--[0--><div class="text-xs text-muted">${escape_html(a.value.base)}
            ${escape_html(signed(a.value.racialBonus))} racial</div>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></section> <section aria-label="Combat" class="grid grid-cols-2 gap-2 sm:grid-cols-3"><!--[-->`);
		const each_array_1 = ensure_array_like(tiles());
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let tile = each_array_1[$$index_1];
			$$renderer.push(`<div role="group"${attr("aria-label", tile.label)}${attr("title", why(tile.stat))} class="rounded-control border border-border bg-raised p-2"><div class="text-xs text-muted">${escape_html(tile.label)}</div> <div class="text-lg font-semibold">${escape_html(tile.text)}</div> `);
			if (tile.note) $$renderer.push(`<!--[0--><div class="text-xs text-muted">${escape_html(tile.note)}</div>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></section> <div class="grid gap-6 md:grid-cols-2"><section aria-label="Saving throws" class="space-y-1"><h3 class="font-display text-lg">Saving throws</h3> <ul class="text-sm"><!--[-->`);
		const each_array_2 = ensure_array_like(ABILITY_KEYS);
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let key = each_array_2[$$index_2];
			const s = stats().savingThrows[key];
			$$renderer.push(`<li><span aria-hidden="true">${escape_html(s.status === "ok" && s.value.proficient ? "●" : "○")}</span> ${escape_html(show(s, (v) => signed(v.modifier)))}
            ${escape_html(key.toUpperCase())}${escape_html(s.status === "ok" && s.value.proficient ? " (proficient)" : "")}</li>`);
		}
		$$renderer.push(`<!--]--></ul></section> <section aria-label="Skills" class="space-y-1"><h3 class="font-display text-lg">Skills</h3> <ul class="text-sm"><!--[-->`);
		const each_array_3 = ensure_array_like(skills());
		for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
			let [slug, s] = each_array_3[$$index_3];
			$$renderer.push(`<li><span aria-hidden="true">${escape_html(s.status === "ok" && s.value.expertise ? "◆" : s.status === "ok" && s.value.proficient ? "●" : "○")}</span> ${escape_html(show(s, (v) => signed(v.modifier)))}
            ${escape_html(title(slug))} `);
			if (s.status === "ok") $$renderer.push(`<!--[0--><span class="text-muted">(${escape_html(s.value.ability.toUpperCase())}${escape_html(s.value.expertise ? ", expertise" : s.value.proficient ? ", proficient" : "")})</span>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></li>`);
		}
		$$renderer.push(`<!--]--></ul></section></div> `);
		if (casting()) {
			$$renderer.push(`<!--[0--><section aria-label="Spellcasting" class="space-y-1"><h3 class="font-display text-lg">Spellcasting</h3> <p class="text-sm">Ability ${escape_html(casting().ability.toUpperCase())} · Save DC ${escape_html(casting().saveDc)} · Spell attack ${escape_html(signed(casting().attackBonus))}${escape_html(casting().preparedCount !== null ? ` · Prepares ${casting().preparedCount}` : "")}</p> `);
			if (slots().length > 0) $$renderer.push(`<!--[0--><p class="text-sm text-muted">Slots: ${escape_html(slots().map((s) => `level ${s.level} × ${s.n}`).join(", "))}</p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (model.spells.length > 0) {
			$$renderer.push(`<!--[0--><section aria-label="Spells" class="space-y-1"><h3 class="font-display text-lg">Spells</h3> <ul class="text-sm"><!--[-->`);
			const each_array_4 = ensure_array_like(model.spells);
			for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
				let s = each_array_4[$$index_4];
				$$renderer.push(`<li>`);
				{
					function row($$renderer) {
						$$renderer.push(`<span>${escape_html(s.name)} <span class="text-muted">(${escape_html(spellLevelLabel(s.level))})</span></span>`);
					}
					SpellDisclosure($$renderer, {
						spell: s,
						row,
						$$slots: { row: true }
					});
				}
				$$renderer.push(`<!----></li>`);
			}
			$$renderer.push(`<!--]--></ul></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (attacks().length > 0) {
			$$renderer.push(`<!--[0--><section aria-label="Attacks" class="space-y-1"><h3 class="font-display text-lg">Attacks</h3> <ul class="text-sm"><!--[-->`);
			const each_array_5 = ensure_array_like(attacks());
			for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
				let a = each_array_5[$$index_5];
				$$renderer.push(`<li>${escape_html(a.name)}: ${escape_html(signed(a.attackBonus))} to hit${escape_html(a.damage ? `, ${a.damage.dice}${a.damage.modifier ? signed(a.damage.modifier) : ""} ${a.damage.type}` : "")}</li>`);
			}
			$$renderer.push(`<!--]--></ul></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <section aria-label="Proficiencies and languages" class="space-y-1"><h3 class="font-display text-lg">Proficiencies and languages</h3> <dl class="space-y-1 text-sm"><!--[-->`);
		const each_array_6 = ensure_array_like(proficiencyGroups());
		for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
			let [type, list] = each_array_6[$$index_6];
			$$renderer.push(`<div><dt class="inline font-medium">${escape_html(type)}:</dt> <dd class="inline">${escape_html(list?.map((p) => p.name).join(", "))}</dd></div>`);
		}
		$$renderer.push(`<!--]--> `);
		if (resolved().languages.length > 0) $$renderer.push(`<!--[0--><div><dt class="inline font-medium">Languages:</dt> <dd class="inline">${escape_html(resolved().languages.map((l) => l.name).join(", "))}</dd></div>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></dl></section> `);
		if (resolved().features.length > 0 || data().customBackgroundFeature) {
			$$renderer.push(`<!--[0--><section aria-label="Features" class="space-y-1"><h3 class="font-display text-lg">Features and traits</h3> <ul class="list-disc pl-5 text-sm"><!--[-->`);
			const each_array_7 = ensure_array_like(resolved().features);
			for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
				let f = each_array_7[$$index_7];
				$$renderer.push(`<li>${escape_html(f.name)}</li>`);
			}
			$$renderer.push(`<!--]--> `);
			if (data().customBackgroundFeature) $$renderer.push(`<!--[0--><li>${escape_html(data().customBackgroundFeature)}</li>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></ul></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (model.equipment.length > 0) {
			$$renderer.push(`<!--[0--><section aria-label="Equipment" class="space-y-1"><h3 class="font-display text-lg">Equipment</h3> <ul class="list-disc pl-5 text-sm"><!--[-->`);
			const each_array_8 = ensure_array_like(model.equipment);
			for (let i = 0, $$length = each_array_8.length; i < $$length; i++) {
				let e = each_array_8[i];
				$$renderer.push(`<li>${escape_html(e.name)}${escape_html(e.quantity > 1 ? ` × ${e.quantity}` : "")}</li>`);
			}
			$$renderer.push(`<!--]--></ul></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (narrative().length > 0) {
			$$renderer.push(`<!--[0--><section aria-label="Details" class="space-y-2"><!--[-->`);
			const each_array_9 = ensure_array_like(narrative());
			for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
				let [label, text] = each_array_9[$$index_9];
				$$renderer.push(`<div><h3 class="font-display text-lg">${escape_html(label)}</h3> <p class="text-sm whitespace-pre-wrap">${escape_html(text)}</p></div>`);
			}
			$$renderer.push(`<!--]--></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></article>`);
	});
}
// src/lib/character/ReviewStep.svelte
function ReviewStep($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { wizard } = $$props;
		const model = derived(() => buildSummary(wizard.rules, draftToSummaryData(wizard.rules, wizard.draft)));
		$$renderer.push(`<div class="space-y-4">`);
		CharacterSummary($$renderer, { model: model() });
		$$renderer.push(`<!----> `);
		if (wizard.saveError) {
			$$renderer.push("<!--[0-->");
			Alert($$renderer, {
				variant: "danger",
				children: ($$renderer) => {
					$$renderer.push(`<!---->${escape_html(wizard.saveError)} Your draft is kept; fix it and save again.`);
				},
				$$slots: { default: true }
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
// src/lib/character/SpellsStep.svelte
function SpellsStep($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { wizard } = $$props;
		const ctx = derived(() => ({
			rules: wizard.rules,
			draft: wizard.draft,
			resolved: wizard.resolved,
			stats: wizard.stats
		}));
		const view = derived(() => spellsView(ctx()));
		const flags = derived(() => spellPickFlags(ctx()));
		const className = derived(() => wizard.rules.classes.find((c) => c.slug === wizard.draft.class)?.name);
		const levels = derived(() => [{
			id: "cantrips",
			title: "Cantrips",
			...view().cantrips
		}, {
			id: "spells",
			title: "Level 1 spells",
			...view().spells
		}]);
		const spellOf = (slug) => wizard.rules.spells.find((s) => s.slug === slug);
		const nameOf = (slug) => spellOf(slug)?.name ?? slug;
		/** Spells that cannot be ticked again: granted, or the racial cantrip. */
		const taken = derived(() => /* @__PURE__ */ new Set([...view().granted.map((g) => g.spell), ...view().groups.flatMap((g) => g.picks)]));
		function toggle(slug) {
			const has = wizard.draft.classSpells.includes(slug);
			wizard.update({ classSpells: has ? wizard.draft.classSpells.filter((s) => s !== slug) : [...wizard.draft.classSpells, slug] });
		}
		function remove(slug) {
			wizard.update({ classSpells: wizard.draft.classSpells.filter((s) => s !== slug) });
		}
		/** One-pick racial group (the High Elf cantrip): ticking swaps the pick. */
		function toggleGroup(g, slug) {
			const next = { ...wizard.draft.picks };
			if (g.picks.includes(slug)) delete next[g.key];
			else next[g.key] = [slug];
			wizard.update({ picks: next });
		}
		$$renderer.push(`<div class="space-y-6">`);
		if (view().cantrips.max + view().spells.max === 0 && view().groups.length === 0) $$renderer.push(`<!--[0--><p class="text-muted">Nothing to pick here.</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (view().granted.length) {
			$$renderer.push(`<!--[0--><section class="space-y-1" aria-label="Granted spells" data-testid="granted-spells"><h3 class="font-display text-lg">Granted spells</h3> <p class="text-sm text-muted">These come with your race or subclass. They do not count against your picks.</p> <ul class="list-disc pl-6"><!--[-->`);
			const each_array = ensure_array_like(view().granted);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let g = each_array[$$index];
				$$renderer.push(`<li>`);
				{
					function row($$renderer) {
						$$renderer.push(`<span>${escape_html(g.name)} <span class="text-sm text-muted">(${escape_html(spellLevelLabel(g.level))})</span></span>`);
					}
					SpellDisclosure($$renderer, {
						spell: spellOf(g.spell),
						row,
						$$slots: { row: true }
					});
				}
				$$renderer.push(`<!----></li>`);
			}
			$$renderer.push(`<!--]--></ul></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <!--[-->`);
		const each_array_1 = ensure_array_like(view().groups);
		for (let $$index_3 = 0, $$length = each_array_1.length; $$index_3 < $$length; $$index_3++) {
			let g = each_array_1[$$index_3];
			$$renderer.push(`<fieldset class="space-y-2 rounded-panel border border-border p-3"${attr("data-choice-key", g.key)}><legend class="px-1 font-medium">${escape_html(groupLabel(g))} <span class="text-sm text-muted">(${escape_html(new Set(g.picks).size)} of ${escape_html(g.choose)})</span></legend> <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2"><!--[-->`);
			const each_array_2 = ensure_array_like(g.options);
			for (let $$index_1 = 0, $$length = each_array_2.length; $$index_1 < $$length; $$index_1++) {
				let o = each_array_2[$$index_1];
				const mine = g.picks.includes(o.slug);
				const dup = !mine && wizard.draft.classSpells.includes(o.slug);
				{
					function row($$renderer) {
						$$renderer.push(`<label${attr_class(clsx(["flex items-center gap-2", dup && "text-muted"]))}>`);
						Checkbox($$renderer, {
							checked: mine,
							disabled: dup,
							onchange: () => toggleGroup(g, o.slug)
						});
						$$renderer.push(`<!----> <span>${escape_html(o.name)}${escape_html(dup ? " (picked as a class cantrip)" : "")}</span></label>`);
					}
					SpellDisclosure($$renderer, {
						spell: spellOf(o.slug),
						row,
						$$slots: { row: true }
					});
				}
			}
			$$renderer.push(`<!--]--></div> <!--[-->`);
			const each_array_3 = ensure_array_like(groupIssues(g));
			for (let $$index_2 = 0, $$length = each_array_3.length; $$index_2 < $$length; $$index_2++) {
				let issue = each_array_3[$$index_2];
				$$renderer.push(`<p class="text-sm text-muted">${escape_html(issue)}</p>`);
			}
			$$renderer.push(`<!--]--></fieldset>`);
		}
		$$renderer.push(`<!--]--> `);
		if (flags().length) {
			$$renderer.push("<!--[0-->");
			Alert($$renderer, {
				variant: "warning",
				children: ($$renderer) => {
					$$renderer.push(`<p class="mb-1 font-medium">These picks need attention</p> <ul class="space-y-1" data-testid="spell-flags"><!--[-->`);
					const each_array_4 = ensure_array_like(flags());
					for (let i = 0, $$length = each_array_4.length; i < $$length; i++) {
						let f = each_array_4[i];
						$$renderer.push(`<li class="flex items-center justify-between gap-2"><span>${escape_html(f.reason)}</span> `);
						Button($$renderer, {
							size: "sm",
							variant: "ghost",
							onclick: () => remove(f.slug),
							children: ($$renderer) => {
								$$renderer.push(`<!---->Remove ${escape_html(nameOf(f.slug))}`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----></li>`);
					}
					$$renderer.push(`<!--]--></ul>`);
				},
				$$slots: { default: true }
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (view().cantrips.max + view().spells.max > 0) $$renderer.push(`<!--[0--><p class="text-muted">${escape_html(className())} picks ${escape_html(view().cantrips.max)} cantrip${escape_html(view().cantrips.max === 1 ? "" : "s")}${escape_html(view().spells.max ? ` and ${view().spells.max} level 1 spells${className() === "Wizard" ? " for the spellbook" : ""}` : "")}.</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (view().prepares !== null) {
			$$renderer.push(`<!--[0--><p data-testid="prepares-hint">You prepare <strong>${escape_html(view().prepares)}</strong> spell${escape_html(view().prepares === 1 ? "" : "s")} each day `);
			if (className() === "Wizard") $$renderer.push(`<!--[0-->from your spellbook`);
			else $$renderer.push(`<!--[-1-->from the ${escape_html(className())} list`);
			$$renderer.push(`<!--]-->. This is
      worked out for you; you do not choose them now.</p>`);
		} else if (view().preparesPending) $$renderer.push(`<!--[1--><p data-testid="prepares-hint" class="text-muted">You prepare spells each day (your casting modifier + level, at least 1). Set your ability
      scores to see the number.</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <!--[-->`);
		const each_array_5 = ensure_array_like(levels());
		for (let $$index_6 = 0, $$length = each_array_5.length; $$index_6 < $$length; $$index_6++) {
			let level = each_array_5[$$index_6];
			if (level.max > 0) {
				$$renderer.push(`<!--[0--><fieldset class="space-y-2 rounded-panel border border-border p-3"${attr("data-testid", `spell-picks-${level.id}`)}><legend class="px-1 font-medium">${escape_html(level.title)} <span class="text-sm text-muted">(${escape_html(level.picked.length)} of ${escape_html(level.max)})</span></legend> <div class="grid gap-x-4 gap-y-1 sm:grid-cols-2"><!--[-->`);
				const each_array_6 = ensure_array_like(level.options);
				for (let $$index_5 = 0, $$length = each_array_6.length; $$index_5 < $$length; $$index_5++) {
					let o = each_array_6[$$index_5];
					const on = level.picked.includes(o.slug);
					const why = on ? null : taken().has(o.slug) ? "already granted or chosen" : level.picked.length >= level.max ? "limit reached" : null;
					{
						function row($$renderer) {
							$$renderer.push(`<label${attr_class(clsx(["flex items-center gap-2", why && "text-muted"]))}>`);
							Checkbox($$renderer, {
								checked: on,
								disabled: !!why,
								onchange: () => toggle(o.slug)
							});
							$$renderer.push(`<!----> <span>${escape_html(o.name)}${escape_html(why ? ` (${why})` : "")}</span></label>`);
						}
						SpellDisclosure($$renderer, {
							spell: spellOf(o.slug),
							row,
							$$slots: { row: true }
						});
					}
				}
				$$renderer.push(`<!--]--></div></fieldset>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
// src/lib/character/step-views.ts
/**
* The component rendered in the centre column for each step. A step's component is mapped here, next to its `STEPS` entry in
* `steps.ts`. A step component takes one prop, the shared `wizard`, and reads and writes the
* draft through `wizard.update`.
*/
var STEP_VIEWS = {
	concept: ConceptStep,
	abilities: AbilitiesStep,
	skills: SkillsStep,
	equipment: EquipmentStep,
	spells: SpellsStep,
	review: ReviewStep
};
// src/lib/character/submit.ts
/** The request that saves the draft: into the Party for a stored draft, over a saved Character. */
function saveRequest(target, wizard) {
	const headers = { "content-type": "application/json" };
	if ("character" in target) return {
		url: resolve("/api/campaigns/[id]/characters/[character]", {
			id: target.campaign,
			character: target.character
		}),
		init: {
			method: "PUT",
			headers,
			body: JSON.stringify(wizard.draft)
		}
	};
	return {
		url: resolve("/api/campaigns/[id]/drafts/[draft]/save", {
			id: target.campaign,
			draft: target.draft
		}),
		init: {
			method: "POST",
			headers,
			body: JSON.stringify({
				draft: wizard.draft,
				step: wizard.current
			})
		}
	};
}
/**
* Saves the draft. Success goes to `returnHref`, an already-resolved path; failure keeps the
* draft and sets `wizard.saveError`.
*/
async function submitDraft(wizard, returnHref) {
	if (!wizard.characterInput || !wizard.target) return;
	wizard.saving = true;
	wizard.saveError = null;
	try {
		const { url, init } = saveRequest(wizard.target, wizard);
		const response = await fetch(url, init);
		const result = await response.json();
		if (response.ok && result.id) {
			wizard.dirty = false;
			await goto(returnHref, { invalidateAll: true });
			return;
		}
		wizard.saveError = result.error ?? "The Character could not be saved.";
	} catch {
		wizard.saveError = "The Character could not be saved.";
	} finally {
		wizard.saving = false;
	}
}
// src/lib/character/WizardShell.svelte
function WizardShell($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Where the dialog's close link goes without JavaScript. */
		/** Called after the player confirms abandoning the draft. */
		let { wizard, backHref, onabandon } = $$props;
		let confirming = false;
		/** Where an in-app navigation was headed when it was held back to ask about the draft. */
		let leavingTo = null;
		let discarding = false;
		beforeNavigate(({ to, type, cancel }) => {
			if (!wizard.dirty || !to || type === "leave") return;
			cancel();
			leavingTo = to.url;
			discarding = true;
		});
		const active = derived(() => wizard.step(wizard.current));
		const View = derived(() => STEP_VIEWS[wizard.current]);
		/** The steps keeping Review locked, so the player sees why Next cannot get there. */
		const blockingReview = derived(() => wizard.steps.some((s) => s.id === "review" && s.status === "locked") ? wizard.steps.filter((s) => s.id !== "review" && s.status !== "valid").map((s) => s.label) : []);
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<section aria-label="Character wizard" class="grid gap-4 lg:grid-cols-[13rem_1fr]"><div class="lg:sticky lg:top-4 lg:self-start">`);
			StepRail($$renderer, {
				steps: wizard.steps,
				current: wizard.current,
				onselect: (id) => wizard.go(id),
				onabandon: () => confirming = true
			});
			$$renderer.push(`<!----></div> <section class="min-w-0 space-y-4"><!--[-->`);
			const each_array = ensure_array_like(wizard.notices);
			for (let i = 0, $$length = each_array.length; i < $$length; i++) {
				let notice = each_array[i];
				Alert($$renderer, {
					variant: "info",
					class: "flex items-center justify-between gap-2",
					children: ($$renderer) => {
						$$renderer.push(`<span>${escape_html(notice)}</span> `);
						Button($$renderer, {
							type: "button",
							variant: "ghost",
							size: "sm",
							onclick: () => wizard.dismissNotice(i),
							children: ($$renderer) => {
								$$renderer.push(`<!---->Dismiss`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!---->`);
					},
					$$slots: { default: true }
				});
			}
			$$renderer.push(`<!--]--> `);
			StatsStrip($$renderer, { stats: wizard.stats });
			$$renderer.push(`<!----> <div class="space-y-4 rounded-panel border border-border bg-surface p-4"><h2 class="font-display text-xl">${escape_html(active()?.label)}</h2> `);
			if (active() && active().issues.length > 0 && active().status !== "locked") {
				$$renderer.push(`<!--[0--><ul class="list-disc pl-5 text-sm text-muted" aria-label="What is left in this step"><!--[-->`);
				const each_array_1 = ensure_array_like(active().issues);
				for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
					let issue = each_array_1[$$index_1];
					$$renderer.push(`<li>${escape_html(issue)}</li>`);
				}
				$$renderer.push(`<!--]--></ul>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (View()) {
				$$renderer.push("<!--[-->");
				View()($$renderer, { wizard });
				$$renderer.push("<!--]-->");
			} else {
				$$renderer.push("<!--[!-->");
				$$renderer.push("<!--]-->");
			}
			$$renderer.push(`</div> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (blockingReview().length > 0) $$renderer.push(`<!--[0--><p class="text-sm text-muted" data-testid="review-blockers">Review unlocks when every step is done. Still open: ${escape_html(blockingReview().join(", "))}.</p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="flex justify-between">`);
			Button($$renderer, {
				variant: "secondary",
				disabled: !wizard.previous || wizard.saving,
				onclick: () => wizard.previous && wizard.go(wizard.previous),
				children: ($$renderer) => {
					$$renderer.push(`<!---->Back`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> `);
			if (wizard.next) {
				$$renderer.push("<!--[0-->");
				const target = wizard.next;
				Button($$renderer, {
					disabled: wizard.step(target)?.status === "locked",
					onclick: () => wizard.go(target),
					children: ($$renderer) => {
						$$renderer.push(`<!---->Next`);
					},
					$$slots: { default: true }
				});
			} else {
				$$renderer.push("<!--[-1-->");
				Button($$renderer, {
					disabled: !wizard.characterInput || wizard.saving,
					onclick: () => submitDraft(wizard, backHref),
					children: ($$renderer) => {
						$$renderer.push(`<!---->${escape_html(wizard.saving ? "Saving…" : wizard.characterId ? "Save changes" : "Save Character")}`);
					},
					$$slots: { default: true }
				});
			}
			$$renderer.push(`<!--]--></div></section></section> `);
			Dialog($$renderer, {
				title: "Discard this Character?",
				closeHref: backHref,
				class: "!w-[min(28rem,calc(100vw-2rem))]",
				get open() {
					return discarding;
				},
				set open($$value) {
					discarding = $$value;
					$$settled = false;
				},
				children: ($$renderer) => {
					$$renderer.push(`<p class="mb-4 text-sm">You have unsaved changes. They will be lost if you leave.</p> <div class="flex justify-end gap-2">`);
					Button($$renderer, {
						variant: "secondary",
						onclick: () => discarding = false,
						children: ($$renderer) => {
							$$renderer.push(`<!---->Keep editing`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----> `);
					Button($$renderer, {
						variant: "danger",
						onclick: () => {
							discarding = false;
							wizard.dirty = false;
							if (leavingTo) goto(leavingTo);
						},
						children: ($$renderer) => {
							$$renderer.push(`<!---->Discard`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----></div>`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> `);
			Dialog($$renderer, {
				title: "Abandon this Character?",
				closeHref: backHref,
				class: "!w-[min(28rem,calc(100vw-2rem))]",
				get open() {
					return confirming;
				},
				set open($$value) {
					confirming = $$value;
					$$settled = false;
				},
				children: ($$renderer) => {
					$$renderer.push(`<p class="mb-4 text-sm">This Character has not been saved. Abandoning it discards the draft and everything you have
    entered.</p> <div class="flex justify-end gap-2">`);
					Button($$renderer, {
						variant: "secondary",
						onclick: () => confirming = false,
						children: ($$renderer) => {
							$$renderer.push(`<!---->Keep editing`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----> `);
					Button($$renderer, {
						variant: "danger",
						onclick: () => {
							confirming = false;
							wizard.dirty = false;
							onabandon();
						},
						children: ($$renderer) => {
							$$renderer.push(`<!---->Abandon`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----></div>`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!---->`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/character/wizard.svelte.ts
var CharacterWizard = class {
	#resolved;
	get resolved() {
		return this.#resolved();
	}
	set resolved($$value) {
		return this.#resolved($$value);
	}
	#stats;
	get stats() {
		return this.#stats();
	}
	set stats($$value) {
		return this.#stats($$value);
	}
	#characterInput;
	get characterInput() {
		return this.#characterInput();
	}
	set characterInput($$value) {
		return this.#characterInput($$value);
	}
	#steps;
	get steps() {
		return this.#steps();
	}
	set steps($$value) {
		return this.#steps($$value);
	}
	rules;
	#defs;
	target;
	draft = emptyDraft();
	notices = [];
	current = "concept";
	dirty = false;
	saving = false;
	saveError = null;
	dmFields = [];
	#stored = null;
	constructor(rules, defs = STEPS, initial, target = null, step = "concept") {
		this.rules = rules;
		this.target = target;
		if (initial) this.draft = initial;
		this.current = step;
		this.#defs = defs;
		this.#resolved = derived(() => resolveFeatures(rules, resolverDraft(this.draft)));
		this.#stats = derived(() => deriveStats(rules, this.resolved, {
			class: this.draft.class,
			level: this.draft.level,
			baseScores: this.draft.baseScores,
			equipment: ownedEquipment(rules, this.draft, this.resolved)
		}));
		this.#characterInput = derived(() => tryDraftToCharacterInput(rules, this.draft));
		this.#steps = derived(() => computeSteps({
			rules,
			draft: this.draft,
			resolved: this.resolved,
			stats: this.stats
		}, this.#defs));
	}
	/** The saved Character being edited, or null for a new one. */
	get characterId() {
		return this.target && "character" in this.target ? this.target.character : null;
	}
	/** Applies a change to the draft, then the keep/clear rules; cleared choices become notices. */
	update(patch) {
		const { draft, notices } = reconcile(this.rules, {
			...this.draft,
			...patch
		});
		this.draft = draft;
		this.notices.push(...notices);
		this.dirty = true;
		this.dmFields = this.dmFields.filter((f) => !(f in patch));
	}
	/**
	* Takes in the stored draft after the DM wrote to it: the fields the DM changed land in the
	* open draft without marking it unsaved, and its "✎ DM" marks show. The Player's other unsaved
	* changes stay.
	*/
	adopt(stored) {
		const previous = this.#stored;
		this.#stored = stored.draft;
		if (previous) {
			const changed = stored.dmFields.filter((f) => JSON.stringify(stored.draft[f]) !== JSON.stringify(previous[f]));
			if (changed.length > 0) {
				const patch = Object.fromEntries(changed.map((f) => [f, stored.draft[f]]));
				const { draft, notices } = reconcile(this.rules, {
					...this.draft,
					...patch
				});
				this.draft = draft;
				this.notices.push(...notices);
			}
		}
		this.dmFields = stored.dmFields.filter((f) => JSON.stringify(this.draft[f]) === JSON.stringify(stored.draft[f]));
	}
	/** Rolls a new ability set in code; a reroll replaces the whole set, so assignments reset. */
	rollAbilities() {
		this.update({
			abilityRolls: rollAbilityScores(),
			baseScores: {
				str: null,
				dex: null,
				con: null,
				int: null,
				wis: null,
				cha: null
			}
		});
	}
	dismissNotice(index) {
		this.notices.splice(index, 1);
	}
	step(id) {
		return this.steps.find((s) => s.id === id);
	}
	/** Moves to a step unless it is locked, skipped, or a save is in flight. Returns whether it moved. */
	go(id) {
		const target = this.step(id);
		if (!target || target.status === "locked" || this.saving) return false;
		this.current = id;
		this.saveError = null;
		return true;
	}
	/** Neighbouring applicable steps in rail order (null at the ends). */
	get previous() {
		return this.#neighbour(-1);
	}
	get next() {
		return this.#neighbour(1);
	}
	#neighbour(offset) {
		const i = this.steps.findIndex((s) => s.id === this.current);
		return this.steps[i + offset]?.id ?? null;
	}
};
// src/lib/character/PartyWizard.svelte
function PartyWizard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The Party step, already resolved: where saving and abandoning return to. */
		/** A stored draft's version and the fields the DM set ("✎ DM"). */
		let { rules, draft, step, target, backHref, stored } = $$props;
		const wizard = new CharacterWizard(rules, void 0, draft, target, step);
		if ("draft" in target && stored) createDraftQuery(() => target.campaign, () => target.draft, () => ({
			draft,
			...stored
		}));
		/** Abandoning a stored draft discards it; leaving an edit just drops the changes. */
		async function abandon() {
			if ("draft" in target) await fetch(resolve("/api/campaigns/[id]/drafts/[draft]", {
				id: target.campaign,
				draft: target.draft
			}), { method: "DELETE" });
			await goto(backHref, { invalidateAll: true });
		}
		WizardShell($$renderer, {
			wizard,
			backHref,
			onabandon: abandon
		});
	});
}
// src/routes/campaigns/[id]/party/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data, form } = $$props;
		const sessions = createSessionsQuery(() => data.attached);
		const attached = derived(() => sessions.data.includes(data.campaign.id));
		const seedHref = derived(() => resolve("/campaigns/[id]", { id: data.campaign.id }));
		const partyHref = derived(() => resolve("/campaigns/[id]/party", { id: data.campaign.id }));
		const archived = derived(() => data.campaign.status === "archived");
		const openId = derived(() => data.open ? "draft" in data.open.target ? data.open.target.draft : data.open.target.character : null);
		head("1ojp0lh", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>Party · ${escape_html(data.campaign.name)}</title>`);
			});
		});
		CreationPage($$renderer, {
			pane: data.campaign.status === "missing" ? null : {
				campaign: data.campaign.id,
				folder: data.campaign.path,
				attached: attached(),
				messages: data.conversation,
				disabled: archived()
			},
			children: ($$renderer) => {
				if (data.isHost) {
					$$renderer.push("<!--[0-->");
					Link($$renderer, {
						href: resolve("/campaigns"),
						class: "text-sm",
						children: ($$renderer) => {
							$$renderer.push(`<!---->All Campaigns`);
						},
						$$slots: { default: true }
					});
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <header class="space-y-1"><div class="flex items-center gap-3"><h1 class="font-display text-2xl">${escape_html(data.campaign.name)}</h1> `);
				if (data.campaign.status !== "missing") {
					$$renderer.push("<!--[0-->");
					DmBadge($$renderer, { attached: attached() });
					$$renderer.push(`<!----> `);
					Link($$renderer, {
						href: resolve("/campaigns/[id]/play", { id: data.campaign.id }),
						class: "ml-auto text-sm",
						children: ($$renderer) => {
							$$renderer.push(`<!---->Play console`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!---->`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div> <p class="text-xs text-muted">${escape_html(data.campaign.path)}</p></header> `);
				if (data.campaign.status === "missing") {
					$$renderer.push("<!--[0-->");
					Alert($$renderer, {
						variant: "warning",
						children: ($$renderer) => {
							$$renderer.push(`<!---->This Campaign's folder is missing. Re-add it from the Campaign library to open it.`);
						},
						$$slots: { default: true }
					});
				} else {
					$$renderer.push("<!--[-1-->");
					CreationStepper($$renderer, {
						current: "Party",
						hrefs: {
							Seed: seedHref(),
							Party: partyHref(),
							Begin: resolve("/campaigns/[id]/begin", { id: data.campaign.id })
						}
					});
					$$renderer.push(`<!----> `);
					if (archived()) {
						$$renderer.push("<!--[0-->");
						Alert($$renderer, {
							variant: "warning",
							children: ($$renderer) => {
								$$renderer.push(`<!---->This Campaign is archived. Restore it to change it.`);
							},
							$$slots: { default: true }
						});
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					Panel($$renderer, {
						title: "Party",
						children: ($$renderer) => {
							$$renderer.push(`<div class="space-y-3">`);
							PartyList($$renderer, {
								campaignId: data.campaign.id,
								members: data.members,
								selected: openId()
							});
							$$renderer.push(`<!----> `);
							if (form?.error) {
								$$renderer.push("<!--[0-->");
								Alert($$renderer, {
									variant: "danger",
									children: ($$renderer) => {
										$$renderer.push(`<!---->${escape_html(form.error)}`);
									},
									$$slots: { default: true }
								});
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> `);
							if (!archived()) {
								$$renderer.push(`<!--[0--><form method="POST" action="?/newDraft">`);
								Button($$renderer, {
									type: "submit",
									children: ($$renderer) => {
										$$renderer.push(`<!---->New Character`);
									},
									$$slots: { default: true }
								});
								$$renderer.push(`<!----></form>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></div>`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----> `);
					if (data.open && !archived()) {
						$$renderer.push(`<!--[0--><!---->`);
						PartyWizard($$renderer, {
							rules: data.open.rules,
							draft: data.open.draft,
							step: data.open.step,
							target: data.open.target,
							backHref: partyHref(),
							stored: "stored" in data.open ? data.open.stored : void 0
						});
						$$renderer.push(`<!---->`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			},
			$$slots: { default: true }
		});
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map