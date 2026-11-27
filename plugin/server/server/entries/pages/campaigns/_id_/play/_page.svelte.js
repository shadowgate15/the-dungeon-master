import { ft as resolve } from "../../../../../chunks/internal.js";
import { _ as attr, a as bind_props, c as ensure_array_like, l as head, n as attr_style, o as derived, p as stringify, r as attributes, t as attr_class, v as clsx, x as escape_html } from "../../../../../chunks/server2.js";
import "../../../../../chunks/paths.js";
import { n as Badge, r as createSessionsQuery, t as DmBadge } from "../../../../../chunks/DmBadge.js";
import { t as Button } from "../../../../../chunks/Button.js";
import { t as Checkbox } from "../../../../../chunks/Checkbox.js";
import { t as Field } from "../../../../../chunks/Field.js";
import { t as Textarea } from "../../../../../chunks/Textarea.js";
import { a as createFloorQuery, d as endSession, f as floorActions, g as knownBy, h as Journal, i as createClaimsQuery, l as createSheetsQuery, m as saveDetails, n as callActions, o as createJournalQuery, p as levelUp, r as claimActions, s as createSceneQuery, t as PlayRequestError, u as createTimelineQuery } from "../../../../../chunks/floor-client.js";
import { t as Alert } from "../../../../../chunks/Alert.js";
import { t as Dialog } from "../../../../../chunks/Dialog.js";
import "../../../../../chunks/follow.svelte.js";
import { p as createQuery, s as permissionQueryKey } from "../../../../../chunks/messages.js";
import { t as useQueryClient } from "../../../../../chunks/useQueryClient.js";
import { t as Link } from "../../../../../chunks/Link.js";
// src/lib/play/CallCard.svelte
function CallCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The open Call at the foot of the timeline: one button group per Character for a Check (the
		* skill or save and the reason, never the DC; advantage marked), or for a roll sequence such as
		* an attack (its next roll: to hit, then damage; never the AC), or a question with its choices
		* as buttons (free text without), or a short rest's Hit Dice (how many to spend, as buttons up
		* to what is left), or a reaction (take it or pass; once taken, its attack rolls like any).
		* Clicking rolls on the server; nothing is rolled here.
		*/
		let { call, onroll, onanswer, disabled = false } = $$props;
		let drafts = {};
		$$renderer.push(`<section aria-label="Call" class="flex shrink-0 flex-col gap-2 rounded-panel border-2 border-primary bg-raised p-3 text-sm">`);
		if (call.kind === "question" || call.kind === "hit_dice" || call.kind === "reaction") $$renderer.push(`<!--[0--><p class="font-medium">${escape_html(call.text)}</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <!--[-->`);
		const each_array = ensure_array_like(call.parts);
		for (let $$index_3 = 0, $$length = each_array.length; $$index_3 < $$length; $$index_3++) {
			let part = each_array[$$index_3];
			$$renderer.push(`<div role="group"${attr("aria-label", part.character ?? part.player)} class="flex flex-wrap items-center gap-2">`);
			if (call.kind !== "question" && call.kind !== "hit_dice") {
				$$renderer.push(`<!--[0--><span class="font-medium">${escape_html(part.character)}</span> <span>${escape_html(part.label)}</span> `);
				if (part.mode !== "normal") $$renderer.push(`<!--[0--><span class="text-xs font-semibold text-accent uppercase">${escape_html(part.mode === "advantage" ? "Advantage" : "Disadvantage")}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (part.reason) $$renderer.push(`<!--[0--><span class="text-muted">${escape_html(part.reason)}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (part.answered) $$renderer.push(`<!--[0--><span class="ml-auto text-xs text-muted">${escape_html(call.kind === "reaction" ? "Answered" : "Rolled")}</span>`);
				else if (part.offer) {
					$$renderer.push(`<!--[1--><span class="ml-auto flex gap-1"><!--[-->`);
					const each_array_1 = ensure_array_like(part.offer);
					for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
						let choice = each_array_1[$$index];
						Button($$renderer, {
							size: "sm",
							variant: "secondary",
							disabled,
							onclick: () => onanswer(part.id, choice),
							children: ($$renderer) => {
								$$renderer.push(`<!---->${escape_html(choice)}`);
							},
							$$slots: { default: true }
						});
					}
					$$renderer.push(`<!--]--></span>`);
				} else {
					$$renderer.push("<!--[-1-->");
					Button($$renderer, {
						size: "sm",
						class: "ml-auto",
						"aria-label": `Roll ${stringify(part.next ?? part.label)} for ${stringify(part.character)}`,
						disabled,
						onclick: () => onroll(part.id),
						children: ($$renderer) => {
							$$renderer.push(`<!---->🎲 Roll${escape_html(part.next ? ` ${part.next}` : "")}`);
						},
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!--]-->`);
			} else if (part.answered) $$renderer.push(`<!--[1--><span class="text-xs text-muted">Answered</span>`);
			else if (part.hitDice) {
				$$renderer.push("<!--[2-->");
				const { die, available } = part.hitDice;
				$$renderer.push(`<span class="font-medium">${escape_html(part.character)}</span> <span class="text-muted">${escape_html(available)} d${escape_html(die)} left</span> <span class="ml-auto flex gap-1"><!--[-->`);
				const each_array_2 = ensure_array_like(Array.from({ length: available + 1 }, (_, n) => n));
				for (let $$index_1 = 0, $$length = each_array_2.length; $$index_1 < $$length; $$index_1++) {
					let n = each_array_2[$$index_1];
					Button($$renderer, {
						size: "sm",
						variant: "secondary",
						"aria-label": n === 0 ? "Spend none" : `Spend ${n}`,
						disabled,
						onclick: () => onanswer(part.id, String(n)),
						children: ($$renderer) => {
							$$renderer.push(`<!---->${escape_html(n === 0 ? "None" : n)}`);
						},
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!--]--></span>`);
			} else if (call.choices.length) {
				$$renderer.push(`<!--[3--><!--[-->`);
				const each_array_3 = ensure_array_like(call.choices);
				for (let $$index_2 = 0, $$length = each_array_3.length; $$index_2 < $$length; $$index_2++) {
					let choice = each_array_3[$$index_2];
					Button($$renderer, {
						size: "sm",
						variant: "secondary",
						disabled,
						onclick: () => onanswer(part.id, choice),
						children: ($$renderer) => {
							$$renderer.push(`<!---->${escape_html(choice)}`);
						},
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!--]-->`);
			} else {
				$$renderer.push(`<!--[-1--><form class="flex flex-1 gap-2"><input aria-label="Your answer" class="flex-1 rounded-control border border-control-border bg-surface px-2 py-1"${attr("value", drafts[part.id])}/> `);
				Button($$renderer, {
					size: "sm",
					type: "submit",
					disabled,
					children: ($$renderer) => {
						$$renderer.push(`<!---->Answer`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----></form>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></section>`);
	});
}
// src/lib/ui/Meter.svelte
function Meter($$renderer, $$props) {
	/** Accessible name of the meter. */
	/** Caller decides when the meter turns to the warning colour. */
	let { label, used, limit, warn = false, class: className, $$slots, $$events, ...rest } = $$props;
	const value = derived(() => Math.min(Math.max(used, 0), Math.max(limit, 0)));
	const percent = derived(() => limit > 0 ? value() / limit * 100 : 0);
	$$renderer.push(`<div${attributes({
		role: "meter",
		"aria-label": label,
		"aria-valuemin": "0",
		"aria-valuemax": limit,
		"aria-valuenow": value(),
		class: clsx(["h-2 overflow-hidden rounded-full bg-border", className]),
		...rest
	})}><div${attr_class(clsx(["h-full", warn ? "bg-warning" : "bg-primary"]))}${attr_style("", { width: `${stringify(percent())}%` })}></div></div>`);
}
// src/lib/play/LevelUp.svelte
function LevelUp($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The level the DM awarded, taken by the Player: a "Level up" button that opens the new spells to
		* pick (exactly the offer's counts), then sends them. HP, slots and features follow on the server.
		*/
		let { offer, disabled = false, onlevelup } = $$props;
		let open = false;
		let picked = {
			cantrips: [],
			spells: []
		};
		const kinds = [{
			key: "cantrips",
			label: "Cantrips"
		}, {
			key: "spells",
			label: "Spells"
		}];
		const ready = derived(() => picked.cantrips.length === offer.cantrips.count && picked.spells.length === offer.spells.count);
		function toggle(kind, slug, on) {
			const rest = picked[kind].filter((s) => s !== slug);
			picked[kind] = on ? [...rest, slug] : rest;
		}
		$$renderer.push(`<section aria-label="Level up" class="rounded-control border border-primary p-2">`);
		if (!open) {
			$$renderer.push("<!--[0-->");
			Button($$renderer, {
				size: "sm",
				disabled,
				onclick: () => open = true,
				children: ($$renderer) => {
					$$renderer.push(`<!---->Level up to ${escape_html(offer.level)}`);
				},
				$$slots: { default: true }
			});
		} else {
			$$renderer.push(`<!--[-1--><h3 class="text-xs font-semibold text-muted uppercase">Level ${escape_html(offer.level)}</h3> <!--[-->`);
			const each_array = ensure_array_like(kinds);
			for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
				let { key, label } = each_array[$$index_1];
				if (offer[key].count > 0) {
					$$renderer.push(`<!--[0--><fieldset class="mt-2"><legend class="text-xs">${escape_html(label)}: pick ${escape_html(offer[key].count)} (${escape_html(picked[key].length)} picked)</legend> <ul class="max-h-48 overflow-y-auto"><!--[-->`);
					const each_array_1 = ensure_array_like(offer[key].options);
					for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
						let o = each_array_1[$$index];
						const on = picked[key].includes(o.slug);
						$$renderer.push(`<li><label class="flex items-center gap-2">`);
						Checkbox($$renderer, {
							checked: on,
							disabled: !on && picked[key].length >= offer[key].count,
							onchange: (e) => toggle(key, o.slug, e.currentTarget.checked)
						});
						$$renderer.push(`<!---->${escape_html(o.name)}</label></li>`);
					}
					$$renderer.push(`<!--]--></ul></fieldset>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--> <div class="mt-2 flex gap-2">`);
			Button($$renderer, {
				size: "sm",
				disabled: !ready() || disabled,
				onclick: () => onlevelup({
					cantrips: [...picked.cantrips].sort(),
					spells: [...picked.spells].sort()
				}),
				children: ($$renderer) => {
					$$renderer.push(`<!---->Take level ${escape_html(offer.level)}`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> `);
			Button($$renderer, {
				size: "sm",
				variant: "ghost",
				onclick: () => open = false,
				children: ($$renderer) => {
					$$renderer.push(`<!---->Cancel`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----></div>`);
		}
		$$renderer.push(`<!--]--></section>`);
	});
}
// src/lib/play/CharacterDetails.svelte
function CharacterDetails($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The details the Player may edit in play, the DM at the table or away. */
		/**
		* What the Player writes about a Character, on its play sheet. Notes, personality and appearance
		* are editable in play (with the DM away too) when `onsave` is given; the backstory is read-only
		* once play has begun. `onsave` throws the server's refusal.
		*/
		let { details, onsave } = $$props;
		let notes = details.notes ?? "";
		let personality = details.personality ?? "";
		let appearance = details.appearance ?? "";
		let saving = false;
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<section aria-labelledby="details-heading" class="flex flex-col gap-2"><h3 id="details-heading" class="text-xs font-semibold text-muted uppercase">Details</h3> `);
			if (onsave) {
				$$renderer.push(`<!--[0--><form class="flex flex-col gap-2">`);
				{
					function children($$renderer, id, describedby) {
						Textarea($$renderer, {
							id,
							"aria-describedby": describedby,
							size: "sm",
							rows: 3,
							get value() {
								return notes;
							},
							set value($$value) {
								notes = $$value;
								$$settled = false;
							}
						});
					}
					Field($$renderer, {
						label: "Notes",
						children,
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!----> `);
				{
					function children($$renderer, id, describedby) {
						Textarea($$renderer, {
							id,
							"aria-describedby": describedby,
							size: "sm",
							rows: 2,
							get value() {
								return personality;
							},
							set value($$value) {
								personality = $$value;
								$$settled = false;
							}
						});
					}
					Field($$renderer, {
						label: "Personality",
						children,
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!----> `);
				{
					function children($$renderer, id, describedby) {
						Textarea($$renderer, {
							id,
							"aria-describedby": describedby,
							size: "sm",
							rows: 2,
							get value() {
								return appearance;
							},
							set value($$value) {
								appearance = $$value;
								$$settled = false;
							}
						});
					}
					Field($$renderer, {
						label: "Appearance",
						children,
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!----> <div class="flex items-center gap-2">`);
				Button($$renderer, {
					type: "submit",
					variant: "secondary",
					size: "sm",
					disabled: saving,
					children: ($$renderer) => {
						$$renderer.push(`<!---->Save details`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> `);
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div></form>`);
			} else {
				$$renderer.push(`<!--[-1--><!--[-->`);
				const each_array = ensure_array_like([
					["Notes", details.notes],
					["Personality", details.personality],
					["Appearance", details.appearance]
				]);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let [label, text] = each_array[$$index];
					if (text) $$renderer.push(`<!--[0--><p><span class="text-muted">${escape_html(label)}:</span> ${escape_html(text)}</p>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--> `);
			if (details.backstory) $$renderer.push(`<!--[0--><div><p class="text-xs text-muted">Backstory</p> <p class="whitespace-pre-line">${escape_html(details.backstory)}</p></div>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></section>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/play/CharacterSheet.svelte
function CharacterSheet($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The console's left column: one tab per Character, and the selected tab's full sheet. The
		* selected tab is the acting Character; only Characters who can act are selectable. A pure view
		* of the server's `PlaySheet`s. A level the DM awarded shows a Level up control when `onlevelup`
		* is given. With `onsavedetails`, the Player edits the Character's notes, personality and
		* appearance (with the DM away too); the backstory stays read-only.
		*/
		let { sheets, acting, onselect = () => {}, onlevelup, onsavedetails } = $$props;
		const shown = derived(() => sheets.find((s) => s.id === acting) ?? sheets[0]);
		const signed = (n) => n >= 0 ? `+${n}` : `${n}`;
		const DENOMINATIONS = [
			"pp",
			"gp",
			"ep",
			"sp",
			"cp"
		];
		const coinText = (coin) => DENOMINATIONS.filter((d) => coin[d] > 0).map((d) => `${coin[d]} ${d}`).join(", ") || "None";
		const title = (slug) => slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
		$$renderer.push(`<aside aria-label="Character sheet" class="flex min-h-0 flex-col overflow-y-auto rounded-panel border border-border bg-surface"><div role="tablist" aria-label="Acting Character" class="flex border-b border-border"><!--[-->`);
		const each_array = ensure_array_like(sheets);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let s = each_array[$$index];
			$$renderer.push(`<button role="tab"${attr("id", `sheet-tab-${stringify(s.id)}`)}${attr("aria-selected", s.id === shown()?.id)}${attr("aria-controls", `sheet-${stringify(s.id)}`)}${attr("disabled", !s.canAct, true)}${attr_class(clsx([
				"flex-1 px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50",
				s.id === shown()?.id && "bg-raised font-semibold",
				s.whereabouts && "text-muted"
			]))}>${escape_html(s.name)}`);
			if (s.whereabouts) $$renderer.push(`<!--[0--><span class="block text-[10px]">${escape_html(s.whereabouts)}</span>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></button>`);
		}
		$$renderer.push(`<!--]--></div> `);
		if (shown()) {
			$$renderer.push(`<!--[0--><div role="tabpanel"${attr("id", `sheet-${stringify(shown().id)}`)}${attr("aria-labelledby", `sheet-tab-${stringify(shown().id)}`)}${attr("aria-label", shown().name)} class="flex flex-col gap-3 p-3 text-sm"><div><h2 class="font-display text-xl">${escape_html(shown().name)}</h2> <p class="text-muted">${escape_html(shown().headline)}</p></div> `);
			if (shown().levelUp && onlevelup) {
				$$renderer.push(`<!--[0--><!---->`);
				LevelUp($$renderer, {
					offer: shown().levelUp,
					onlevelup: (picks) => onlevelup(shown().id, picks)
				});
				$$renderer.push(`<!---->`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="grid grid-cols-[1fr_auto] items-end gap-3"><div role="group" aria-label="HP"><div class="flex justify-between text-xs"><span>HP</span> <span>${escape_html(shown().hp.current)} / ${escape_html(shown().hp.max ?? "—")}`);
			if (shown().hp.temp) $$renderer.push(`<!--[0--><span class="text-muted">+${escape_html(shown().hp.temp)} temp</span>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></span></div> `);
			if (shown().hp.max) {
				$$renderer.push("<!--[0-->");
				Meter($$renderer, {
					label: "HP",
					used: shown().hp.current,
					limit: shown().hp.max,
					warn: shown().hp.current / shown().hp.max < .5
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div role="group" aria-label="AC"${attr("title", shown().ac ? `AC (${shown().ac.note})` : "AC pending")} class="rounded-control border border-border bg-raised px-2 py-1 text-center"><div class="text-[10px] text-muted">AC</div> <div class="text-lg font-semibold">${escape_html(shown().ac?.value ?? "—")}</div></div></div> `);
			if (shown().hitDice) $$renderer.push(`<!--[0--><p role="group" aria-label="Hit Dice" class="flex justify-between"><span>Hit Dice</span><span>${escape_html(shown().hitDice.total - shown().hitDice.spent)} / ${escape_html(shown().hitDice.total)} d${escape_html(shown().hitDice.die)}</span></p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (shown().deathSaves) {
				$$renderer.push("<!--[0-->");
				const { successes, failures, stable } = shown().deathSaves;
				$$renderer.push(`<div role="group" aria-label="Death saves" class="flex justify-between text-xs"><span class="font-medium">Death saves</span> `);
				if (stable) $$renderer.push(`<!--[0--><span>Stable</span>`);
				else $$renderer.push(`<!--[-1--><span>Successes ${escape_html(successes)} / 3</span> <span class="text-danger">Failures ${escape_html(failures)} / 3</span>`);
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (shown().conditions.length || shown().concentration) {
				$$renderer.push(`<!--[0--><div class="flex flex-wrap gap-1"><!--[-->`);
				const each_array_1 = ensure_array_like(shown().conditions);
				for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
					let c = each_array_1[$$index_1];
					Badge($$renderer, {
						variant: "danger",
						size: "sm",
						children: ($$renderer) => {
							$$renderer.push(`<!---->${escape_html(title(c))}`);
						},
						$$slots: { default: true }
					});
				}
				$$renderer.push(`<!--]--> `);
				if (shown().concentration) {
					$$renderer.push("<!--[0-->");
					Badge($$renderer, {
						variant: "info",
						size: "sm",
						children: ($$renderer) => {
							$$renderer.push(`<!---->Concentrating: ${escape_html(title(shown().concentration))}`);
						},
						$$slots: { default: true }
					});
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="grid grid-cols-3 gap-1 text-center"><!--[-->`);
			const each_array_2 = ensure_array_like(shown().abilities);
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let a = each_array_2[$$index_2];
				$$renderer.push(`<div role="group"${attr("aria-label", a.key.toUpperCase())} class="rounded-control border border-border py-1"><div class="text-[10px] text-muted uppercase">${escape_html(a.key)}</div> <div class="text-lg">${escape_html(signed(a.modifier))}</div> <div class="text-[10px] text-muted">${escape_html(a.score)}</div></div>`);
			}
			$$renderer.push(`<!--]--></div> <section><h3 class="text-xs font-semibold text-muted uppercase">Attacks</h3> `);
			const each_array_3 = ensure_array_like(shown().attacks);
			if (each_array_3.length !== 0) {
				$$renderer.push("<!--[-->");
				for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
					let a = each_array_3[$$index_3];
					$$renderer.push(`<p class="flex justify-between gap-2"><span>${escape_html(a.name)}</span><span class="font-mono">${escape_html(signed(a.attackBonus))}${escape_html(a.damage ? ` · ${a.damage}` : "")}</span></p>`);
				}
			} else $$renderer.push(`<!--[!--><p class="text-muted">None</p>`);
			$$renderer.push(`<!--]--></section> `);
			if (shown().spellSlots.length) {
				$$renderer.push(`<!--[0--><section><h3 class="text-xs font-semibold text-muted uppercase">Spell slots</h3> <!--[-->`);
				const each_array_4 = ensure_array_like(shown().spellSlots);
				for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
					let s = each_array_4[$$index_4];
					$$renderer.push(`<p role="group"${attr("aria-label", `Level ${stringify(s.level)} slots`)} class="flex justify-between"><span>Level ${escape_html(s.level)}</span><span>${escape_html(s.max - s.spent)} / ${escape_html(s.max)}</span></p>`);
				}
				$$renderer.push(`<!--]--></section>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (shown().features.length) {
				$$renderer.push(`<!--[0--><section><h3 class="text-xs font-semibold text-muted uppercase">Features</h3> <ul><!--[-->`);
				const each_array_5 = ensure_array_like(shown().features);
				for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
					let f = each_array_5[$$index_5];
					$$renderer.push(`<li>${escape_html(f.name)}${escape_html(f.spent ? ` · ${f.spent} used` : "")}</li>`);
				}
				$$renderer.push(`<!--]--></ul></section>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <section><h3 class="text-xs font-semibold text-muted uppercase">Inventory</h3> <ul>`);
			const each_array_6 = ensure_array_like(shown().inventory);
			if (each_array_6.length !== 0) {
				$$renderer.push("<!--[-->");
				for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
					let i = each_array_6[$$index_6];
					$$renderer.push(`<li>${escape_html(i.name)}${escape_html(i.quantity > 1 ? ` × ${i.quantity}` : "")}${escape_html(i.equipped ? " (equipped)" : "")}</li>`);
				}
			} else $$renderer.push(`<!--[!--><li class="text-muted">Nothing carried</li>`);
			$$renderer.push(`<!--]--></ul> <p role="group" aria-label="Coin" class="mt-1 flex justify-between"><span class="text-muted">Coin</span><span>${escape_html(coinText(shown().coin))}</span></p></section> <!---->`);
			CharacterDetails($$renderer, {
				details: shown().details,
				onsave: onsavedetails && ((details) => onsavedetails(shown().id, details))
			});
			$$renderer.push(`<!----></div>`);
		} else $$renderer.push(`<!--[-1--><p class="p-3 text-sm text-muted">No Characters in the Party yet.</p>`);
		$$renderer.push(`<!--]--></aside>`);
	});
}
// src/lib/play/FloorComposer.svelte
function FloorComposer($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The pinned composer: the open Floor's pending tray above a box that adds a Declaration for the
		* acting Character. Every tray entry can be edited or withdrawn until the Floor closes. Done
		* closes the Floor (empty or not); Ctrl+Enter is Send & Done. While the DM is answering, drafting
		* stays open but Done waits. While the DM is away, a "DM away" bar with the command that brings
		* the DM back replaces the send controls; drafting stays open. A pure view; the console wires the
		* callbacks to the server.
		*/
		let { acting, declarations, onsend, ondone, onedit, onwithdraw, awaiting = false, disabled = false, elsewhere = [], oncut = () => {}, returned = [], onreturned = () => {}, away = null, turn = null } = $$props;
		/** The folder, quoted for a POSIX shell when it needs it. */
		const quoted = (folder) => /^[\w@%+=:,./-]+$/.test(folder) ? folder : `'${folder.replaceAll("'", `'\\''`)}'`;
		const relaunch = derived(() => away ? `cd ${quoted(away.folder)} && dm` : "");
		let copied = false;
		async function copy() {
			await navigator.clipboard.writeText(relaunch());
			copied = true;
			setTimeout(() => copied = false, 2e3);
		}
		let draft = "";
		let editing = null;
		const blocked = derived(() => disabled || acting === null);
		const prompt = derived(() => acting ? `What does ${acting} do?` : turn ? `It is ${turn}'s turn` : "No Character can act");
		const label = (d) => `${d.characterName}: ${d.text}`;
		function send() {
			const text = draft.trim();
			if (!text || blocked() || away) return;
			onsend(text);
			draft = "";
		}
		function done() {
			if (disabled || awaiting || away) return;
			const text = draft.trim();
			ondone(text && !blocked() ? text : null);
			if (text && !blocked()) draft = "";
		}
		function onkeydown(e) {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.isComposing) {
				e.preventDefault();
				done();
			} else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				send();
			}
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="flex flex-col gap-2 rounded-panel border border-border bg-raised p-2">`);
			if (declarations.length) {
				$$renderer.push(`<!--[0--><ul class="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm" aria-label="Pending Declarations"><!--[-->`);
				const each_array = ensure_array_like(declarations);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let d = each_array[$$index];
					$$renderer.push(`<li class="flex items-start gap-2 rounded-control bg-surface px-2 py-1"><span class="font-medium">${escape_html(d.characterName)}</span> `);
					if (editing?.id === d.id) {
						$$renderer.push(`<!--[0--><form class="flex flex-1 flex-col gap-1">`);
						Textarea($$renderer, {
							size: "sm",
							rows: 2,
							"aria-label": "Edit Declaration",
							get value() {
								return editing.text;
							},
							set value($$value) {
								editing.text = $$value;
								$$settled = false;
							}
						});
						$$renderer.push(`<!----> <div class="flex justify-end gap-2">`);
						Button($$renderer, {
							size: "sm",
							variant: "ghost",
							type: "button",
							onclick: () => editing = null,
							children: ($$renderer) => {
								$$renderer.push(`<!---->Cancel`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----> `);
						Button($$renderer, {
							size: "sm",
							type: "submit",
							children: ($$renderer) => {
								$$renderer.push(`<!---->Save`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----></div></form>`);
					} else if (away) $$renderer.push(`<!--[1--><span class="flex-1 whitespace-pre-wrap">${escape_html(d.text)}</span>`);
					else $$renderer.push(`<!--[-1--><span class="flex-1 whitespace-pre-wrap">${escape_html(d.text)}</span> <button class="text-xs text-muted underline"${attr("aria-label", `Edit ${stringify(label(d))}`)}>edit</button> <button class="text-xs text-muted underline"${attr("aria-label", `Withdraw ${stringify(label(d))}`)}>withdraw</button>`);
					$$renderer.push(`<!--]--></li>`);
				}
				$$renderer.push(`<!--]--></ul>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (turn) $$renderer.push(`<!--[0--><p class="text-xs font-medium">${escape_html(turn)}'s turn</p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			Textarea($$renderer, {
				size: "sm",
				rows: 2,
				onkeydown,
				disabled: blocked(),
				"aria-label": prompt(),
				placeholder: prompt(),
				get value() {
					return draft;
				},
				set value($$value) {
					draft = $$value;
					$$settled = false;
				}
			});
			$$renderer.push(`<!----> `);
			if (elsewhere.length) {
				$$renderer.push(`<!--[0--><ul class="flex flex-wrap gap-2 text-xs" aria-label="Elsewhere"><!--[-->`);
				const each_array_1 = ensure_array_like(elsewhere);
				for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
					let c = each_array_1[$$index_1];
					$$renderer.push(`<li class="flex items-center gap-1 rounded-control bg-surface px-2 py-1 text-muted"><span>${escape_html(c.name)} · elsewhere${escape_html(c.whereabouts ? `: ${c.whereabouts}` : "")}</span> `);
					if (!away) $$renderer.push(`<!--[0--><button class="underline">Cut to ${escape_html(c.name)}</button>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></li>`);
				}
				$$renderer.push(`<!--]--></ul>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (away) {
				$$renderer.push(`<!--[0--><div role="status" aria-label="DM away" class="flex flex-wrap items-center gap-2 rounded-control bg-surface px-2 py-1 text-sm"><span class="font-medium">The DM is away.</span> <span class="text-muted">Start a Session to play on; your drafts wait here.</span> <code class="ml-auto rounded-control bg-raised px-1.5 py-0.5 font-mono text-xs">${escape_html(relaunch())}</code> `);
				Button($$renderer, {
					size: "sm",
					variant: "secondary",
					onclick: copy,
					children: ($$renderer) => {
						$$renderer.push(`<!---->${escape_html(copied ? "Copied" : "Copy")}`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----></div>`);
			} else {
				$$renderer.push(`<!--[-1--><div class="flex items-center justify-end gap-2"><span class="mr-auto text-xs text-muted">Enter adds to the tray · Ctrl+Enter sends and closes · Shift+Enter for a new line</span> `);
				Button($$renderer, {
					size: "sm",
					variant: "secondary",
					onclick: send,
					disabled: blocked() || !draft.trim(),
					children: ($$renderer) => {
						$$renderer.push(`<!---->Send`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> `);
				Button($$renderer, {
					size: "sm",
					onclick: done,
					disabled: disabled || awaiting,
					children: ($$renderer) => {
						$$renderer.push(`<!---->Done`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----></div>`);
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
// src/lib/play/RailCard.svelte
function RailCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* A card in the play console's right rail: a pinned header over a body that, on a wide screen,
		* scrolls inside the card. It shrinks to share the rail's height but not below 8rem, or its
		* content height when that is less. (`calc-size` is Chromium-only; elsewhere the floor is 0.)
		*/
		let { id, label, heading, headingClass, body = void 0, children } = $$props;
		$$renderer.push(`<section${attr("aria-label", label)}${attr("aria-labelledby", label ? void 0 : id)} class="flex flex-col overflow-hidden rounded-panel border border-border bg-surface lg:[min-height:calc-size(max-content,min(size,8rem))]"><h2${attr("id", id)}${attr_class(clsx(["shrink-0 px-3 pt-3 pb-1", headingClass]))}>`);
		heading($$renderer);
		$$renderer.push(`<!----></h2>  <div role="group"${attr("aria-labelledby", id)} tabindex="0" data-testid="rail-card-body" class="min-h-0 px-3 pb-3 lg:overflow-y-auto">`);
		children($$renderer);
		$$renderer.push(`<!----></div></section>`);
		bind_props($$props, { body });
	});
}
// src/lib/play/SceneRail.svelte
function SceneRail($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The rail's top panel: the clock (time large, day below), the Scene's Place and the Characters
		* present, and in a Combat the initiative order under a pinned round header. A view of the
		* Player-safe `SceneView`.
		*/
		let { scene } = $$props;
		let body = void 0;
		derived(() => scene.combat?.order.find((c) => c.current)?.key);
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<section aria-label="Clock and Scene" class="shrink-0 rounded-panel border border-border bg-surface p-3"><p class="font-display text-3xl">${escape_html(scene.clock.time)}</p> <p class="text-muted">day ${escape_html(scene.clock.day)}</p> `);
			if (scene.place) {
				$$renderer.push(`<!--[0--><p class="mt-2 font-medium">${escape_html(scene.place.name)}</p> <ul aria-label="Present" class="mt-1 flex flex-wrap gap-1 text-xs"><!--[-->`);
				const each_array = ensure_array_like(scene.present);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let c = each_array[$$index];
					$$renderer.push(`<li class="rounded-control bg-raised px-2 py-0.5">${escape_html(c.name)}</li>`);
				}
				$$renderer.push(`<!--]--></ul>`);
			} else $$renderer.push(`<!--[-1--><p class="mt-2 text-muted">The Scene is set once play begins.</p>`);
			$$renderer.push(`<!--]--></section> `);
			if (scene.combat) {
				$$renderer.push("<!--[0-->");
				{
					function heading($$renderer) {
						$$renderer.push(`<!---->${escape_html(scene.combat?.round ? `Round ${scene.combat.round}` : "Combat starts")}`);
					}
					RailCard($$renderer, {
						id: "initiative-heading",
						label: "Initiative",
						headingClass: "font-medium",
						get body() {
							return body;
						},
						set body($$value) {
							body = $$value;
							$$settled = false;
						},
						heading,
						children: ($$renderer) => {
							if (scene.combat.order.length) {
								$$renderer.push(`<!--[0--><ol aria-label="Initiative order" class="flex flex-col gap-1 text-sm"><!--[-->`);
								const each_array_1 = ensure_array_like(scene.combat.order);
								for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
									let c = each_array_1[$$index_1];
									$$renderer.push(`<li${attr("aria-current", c.current || void 0)}${attr_class(clsx(["flex items-center gap-2 rounded-control px-2 py-0.5", c.current ? "bg-raised font-medium" : "text-muted"]))}><span class="w-6 text-right tabular-nums">${escape_html(c.initiative)}</span> <span class="flex-1">${escape_html(c.name)}</span> `);
									if (c.state) $$renderer.push(`<!--[0--><span class="text-xs">${escape_html(c.state)}</span>`);
									else $$renderer.push("<!--[-1-->");
									$$renderer.push(`<!--]--></li>`);
								}
								$$renderer.push(`<!--]--></ol>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> `);
							if (scene.combat.waiting.length) $$renderer.push(`<!--[0--><p class="mt-1 text-xs text-muted">Rolling initiative: ${escape_html(scene.combat.waiting.join(", "))}</p>`);
							else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]-->`);
						},
						$$slots: {
							heading: true,
							default: true
						}
					});
				}
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]-->`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/play/Rail.svelte
function Rail($$renderer, $$props) {
	/**
	* The play console's right rail: the clock and Scene, the initiative order in a Combat, and
	* the Journal of what the acting Character believes. On a wide screen it is held to its
	* column's height: the Scene card keeps its size, and the initiative and Journal cards share
	* the rest, each scrolling its own body under a pinned header.
	*/
	let { scene, believer, entries, actor } = $$props;
	$$renderer.push(`<aside aria-label="Scene" class="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm lg:overflow-hidden">`);
	SceneRail($$renderer, { scene });
	$$renderer.push(`<!----> `);
	{
		function heading($$renderer) {
			$$renderer.push(`<!---->What ${escape_html(believer)} knows`);
		}
		RailCard($$renderer, {
			id: "knows-heading",
			headingClass: "text-xs font-semibold text-muted uppercase",
			heading,
			children: ($$renderer) => {
				Journal($$renderer, {
					entries,
					actor
				});
			},
			$$slots: {
				heading: true,
				default: true
			}
		});
	}
	$$renderer.push(`<!----></aside>`);
}
// src/lib/play/combat.ts
/** Whose turn it is in the Combat, or null outside Combat or while it waits on initiative. */
function turnOf(combat) {
	return combat?.order.find((e) => e.current) ?? null;
}
/**
* The acting Character. In a running Combat the composer is locked to the Character whose turn it
* is (none on an NPC's or Creature's turn) and the Player's pick waits; otherwise it is the pick, or
* the first Character in the Scene who can act.
*/
function actingCharacter(actors, picked, combat) {
	const turn = turnOf(combat);
	if (turn) return actors.find((a) => a.id === turn.characterId) ?? null;
	return actors.find((a) => a.id === picked) ?? actors[0] ?? null;
}
// src/lib/play/PermissionCard.svelte
function PermissionCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The permission prompt the DM's session is waiting on, inline above the composer (never a modal
		* or toast). The terminal's dialog stays open too; the first answer wins.
		*/
		let { request, onanswer } = $$props;
		$$renderer.push(`<div role="group" aria-label="Permission request" class="flex shrink-0 flex-col gap-2 rounded-panel border-2 border-warning bg-warning-bg p-3 text-warning"><p class="text-sm font-semibold">Behind the screen: the DM asks permission</p> `);
		if (request.description) $$renderer.push(`<!--[0--><p class="text-sm">${escape_html(request.description)}</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <code class="rounded bg-black/10 px-2 py-1 text-xs break-all">${escape_html(request.toolName)}`);
		if (request.inputPreview) $$renderer.push(`<!--[0-->: ${escape_html(request.inputPreview)}`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></code> <div class="flex gap-2">`);
		Button($$renderer, {
			size: "sm",
			onclick: () => onanswer("allow"),
			children: ($$renderer) => {
				$$renderer.push(`<!---->Allow`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----> `);
		Button($$renderer, {
			size: "sm",
			variant: "secondary",
			onclick: () => onanswer("deny"),
			children: ($$renderer) => {
				$$renderer.push(`<!---->Deny`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></div></div>`);
	});
}
// src/lib/play/TakeASeat.svelte
function TakeASeat($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Where "Create a Character" goes: the Party wizard. */
		let { open = void 0, rows, createHref, closeHref, problem = null, onclaim, onletgo } = $$props;
		const seated = derived(() => rows.some((r) => r.claim === "yours"));
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			Dialog($$renderer, {
				title: "Take a seat",
				closeHref,
				class: "max-w-lg",
				oncancel: (e) => !seated() && e.preventDefault(),
				get open() {
					return open;
				},
				set open($$value) {
					open = $$value;
					$$settled = false;
				},
				children: ($$renderer) => {
					$$renderer.push(`<p class="text-text-muted mb-3 text-sm">Claim the Characters you play, then sit down.</p> <ul class="mb-4 flex flex-col gap-2" aria-label="Party">`);
					const each_array = ensure_array_like(rows);
					if (each_array.length !== 0) {
						$$renderer.push("<!--[-->");
						for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
							let row = each_array[$$index];
							$$renderer.push(`<li class="flex items-center justify-between gap-3 rounded-panel border border-border p-2"><span>${escape_html(row.name)}</span> `);
							if (row.claim === "yours") {
								$$renderer.push("<!--[0-->");
								Button($$renderer, {
									size: "sm",
									variant: "secondary",
									onclick: () => onletgo(row.id),
									children: ($$renderer) => {
										$$renderer.push(`<!---->Let go`);
									},
									$$slots: { default: true }
								});
							} else if (row.claim === "free") {
								$$renderer.push("<!--[1-->");
								Button($$renderer, {
									size: "sm",
									onclick: () => onclaim(row.id),
									children: ($$renderer) => {
										$$renderer.push(`<!---->Claim`);
									},
									$$slots: { default: true }
								});
							} else $$renderer.push(`<!--[-1--><span class="text-text-muted text-sm">taken</span>`);
							$$renderer.push(`<!--]--></li>`);
						}
					} else $$renderer.push(`<!--[!--><li class="text-text-muted text-sm">The Party has no Characters yet.</li>`);
					$$renderer.push(`<!--]--></ul> `);
					if (problem) {
						$$renderer.push("<!--[0-->");
						Alert($$renderer, {
							variant: "danger",
							children: ($$renderer) => {
								$$renderer.push(`<!---->${escape_html(problem)}`);
							},
							$$slots: { default: true }
						});
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <div class="flex items-center justify-between gap-3">`);
					Button($$renderer, {
						variant: "secondary",
						href: createHref,
						children: ($$renderer) => {
							$$renderer.push(`<!---->Create a Character`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----> `);
					Button($$renderer, {
						disabled: !seated(),
						onclick: () => open = false,
						children: ($$renderer) => {
							$$renderer.push(`<!---->Sit down`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----></div>`);
				},
				$$slots: { default: true }
			});
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
		bind_props($$props, { open });
	});
}
// src/lib/play/Timeline.svelte
function Timeline($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The console's centre: the Show filters above one timeline, DM on the left and the Player on
		* the right. Narrations (with the NPC voicing them), Declarations from closed Floors, one-line rolls,
		* question answers and muted
		* `⚙ DM …` activity lines; while the DM works on a turn, a `Ns / ~20s` progress bar. A turn
		* still awaiting Narration with the DM away ends the bar with "The DM left mid-turn".
		*/
		let { entries, awaitingSince, away = false } = $$props;
		let show = {
			story: true,
			rolls: true,
			dm: true
		};
		const filters = [
			["story", "Story"],
			["rolls", "Rolls"],
			["dm", "DM activity"]
		];
		const shown = derived(() => entries.filter((e) => e.type === "activity" ? show.dm : e.type === "roll" ? show.rolls : show.story));
		const signed = (n) => n < 0 ? `− ${-n}` : `+ ${n}`;
		let now = Date.now();
		const elapsed = derived(() => awaitingSince === null ? 0 : Math.max(0, Math.floor((now - awaitingSince) / 1e3)));
		$$renderer.push(`<div role="group" aria-label="Show" class="flex items-center gap-3 text-xs"><span class="text-muted">Show</span> <!--[-->`);
		const each_array = ensure_array_like(filters);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let [key, label] = each_array[$$index];
			$$renderer.push(`<label class="flex items-center gap-1"><input type="checkbox"${attr("checked", show[key], true)} class="rounded"/> ${escape_html(label)}</label>`);
		}
		$$renderer.push(`<!--]--></div> <ol aria-label="Timeline" class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-panel border border-border bg-surface p-3">`);
		const each_array_1 = ensure_array_like(shown());
		if (each_array_1.length !== 0) {
			$$renderer.push("<!--[-->");
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let entry = each_array_1[$$index_1];
				if (entry.type === "narration") {
					$$renderer.push(`<!--[0--><li class="max-w-[85%] self-start rounded-panel bg-raised px-3 py-2 text-sm">`);
					if (entry.recap) $$renderer.push(`<!--[0--><span class="block text-xs font-semibold text-muted uppercase">Previously</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					if (entry.voice) $$renderer.push(`<!--[0--><span class="block text-xs font-semibold text-primary">${escape_html(entry.voice)}</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <span class="whitespace-pre-wrap">${escape_html(entry.text)}</span></li>`);
				} else if (entry.type === "declaration") $$renderer.push(`<!--[1--><li class="max-w-[85%] self-end rounded-panel border border-border bg-surface px-3 py-2 text-sm"><span class="block text-xs font-semibold text-muted">${escape_html(entry.character)}</span> <span class="whitespace-pre-wrap">${escape_html(entry.text)}</span></li>`);
				else if (entry.type === "error") {
					$$renderer.push(`<!--[2--><li class="self-stretch">`);
					Alert($$renderer, {
						variant: "danger",
						children: ($$renderer) => {
							$$renderer.push(`<!---->${escape_html(entry.text)}`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----></li>`);
				} else if (entry.type === "roll") {
					$$renderer.push(`<!--[3--><li class="flex flex-wrap items-baseline gap-x-2 self-end text-sm"><span class="font-medium">${escape_html(entry.character)}</span> <span class="text-muted">${escape_html(entry.what)}</span> <span class="font-mono text-xs text-muted">🎲 ${escape_html(entry.dice.join(" | "))} ${escape_html(signed(entry.modifier))}</span> <span class="font-mono font-semibold">= ${escape_html(entry.total)}</span> `);
					if (entry.outcome) $$renderer.push(`<!--[0--><span${attr_class(clsx([
						"success",
						"hit",
						"critical hit"
					].includes(entry.outcome) ? "text-accent" : "text-danger"))}>${escape_html(entry.outcome)}</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					if (entry.target) $$renderer.push(`<!--[0--><span class="text-muted">${escape_html(entry.target.name)} is ${escape_html(entry.target.state)}</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					if (entry.mode !== "normal") $$renderer.push(`<!--[0--><span class="text-xs text-muted italic">(${escape_html(entry.mode)}: ${escape_html(entry.reason)})</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></li>`);
				} else if (entry.type === "answer") $$renderer.push(`<!--[4--><li class="max-w-[85%] self-end rounded-panel border border-border bg-surface px-3 py-2 text-sm"><span class="block text-xs text-muted">${escape_html(entry.question)}</span> <span class="whitespace-pre-wrap">${escape_html(entry.text)}</span></li>`);
				else $$renderer.push(`<!--[-1--><li class="self-start text-xs text-muted">⚙ ${escape_html(entry.text)}</li>`);
				$$renderer.push(`<!--]-->`);
			}
		} else {
			$$renderer.push("<!--[!-->");
			if (entries.length === 0) $$renderer.push(`<!--[0--><li class="m-auto text-sm text-muted">Nothing has happened yet.</li>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<!--]--></ol> `);
		if (awaitingSince !== null && away) {
			$$renderer.push("<!--[0-->");
			Alert($$renderer, {
				variant: "warning",
				children: ($$renderer) => {
					$$renderer.push(`<!---->The DM left mid-turn. What was done stays done; the next Session answers this turn after the
    recap.`);
				},
				$$slots: { default: true }
			});
		} else if (awaitingSince !== null) $$renderer.push(`<!--[1--><div class="flex items-center gap-2 text-xs text-muted"><div role="progressbar" aria-label="The DM is working" aria-valuemin="0"${attr("aria-valuemax", 20)}${attr("aria-valuenow", Math.min(elapsed(), 20))} class="h-1.5 flex-1 overflow-hidden rounded-full bg-border"><div class="h-full bg-primary transition-[width]"${attr_style("", { width: `${stringify(Math.min(100, elapsed() / 20 * 100))}%` })}></div></div> <span>${escape_html(elapsed())}s / ~${escape_html(20)}s</span></div>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
// src/lib/play/permission-client.ts
var url = (campaign) => `/api/campaigns/${encodeURIComponent(campaign)}/permission`;
/** The permission prompt the Campaign's session is waiting on, starting from the server-rendered one. */
function createPermissionQuery(campaign, initial) {
	return createQuery(() => ({
		queryKey: permissionQueryKey(campaign()),
		queryFn: async () => {
			const res = await fetch(url(campaign()));
			if (!res.ok) return null;
			return (await res.json()).request;
		},
		initialData: initial()
	}));
}
/**
* Answers the prompt. When the terminal answered first the server refuses it, and the card clears
* either way.
*/
function permissionActions(campaign) {
	const queryClient = useQueryClient();
	return { async answer(requestId, behavior) {
		await fetch(url(campaign()), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				request_id: requestId,
				behavior
			})
		});
		await queryClient.invalidateQueries({ queryKey: permissionQueryKey(campaign()) });
	} };
}
// src/routes/campaigns/[id]/play/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const sessions = createSessionsQuery(() => data.attached);
		const floor = createFloorQuery(() => data.campaign.id, () => data.floor);
		const timeline = createTimelineQuery(() => data.campaign.id, () => data.timeline);
		const scene = createSceneQuery(() => data.campaign.id, () => data.scene);
		const party = createSheetsQuery(() => data.campaign.id, () => data.sheets);
		const journal = createJournalQuery(() => data.campaign.id, () => data.journal);
		const claims = createClaimsQuery(() => data.campaign.id, () => data.claims);
		const seats = claimActions(() => data.campaign.id);
		const seated = derived(() => claims.data.some((r) => r.claim === "yours"));
		let seatOpen = false;
		const actions = floorActions(() => data.campaign.id);
		const calls = callActions(() => data.campaign.id);
		let rolling = false;
		/** Rolls or answers one part of the open Call, one click at a time. */
		function answerCall(change) {
			rolling = true;
			attempt(change).finally(() => rolling = false);
		}
		const permission = createPermissionQuery(() => data.campaign.id, () => data.permission);
		const answers = permissionActions(() => data.campaign.id);
		/** Done, sending the composer's text first for Send & Done. */
		function done(text) {
			attempt(async () => {
				if (text && acting()) await actions.send(acting().id, text);
				await actions.done();
			});
		}
		let picked = null;
		const inScene = derived(() => new Set(scene.data.present.map((c) => c.id)));
		const sheets = derived(() => party.data.map((s) => {
			const away = scene.data.elsewhere.find((c) => c.id === s.id);
			return {
				...s,
				whereabouts: away ? away.whereabouts ?? "elsewhere" : null
			};
		}));
		const actors = derived(() => sheets().filter((s) => s.canAct && inScene().has(s.id)));
		const acting = derived(() => actingCharacter(actors(), picked, scene.data.combat));
		const turn = derived(() => turnOf(scene.data.combat));
		const archived = derived(() => data.campaign.status === "archived");
		const attached = derived(() => sessions.data.includes(data.campaign.id));
		let ending = false;
		function end() {
			attempt(async () => {
				await endSession(data.campaign.id);
				ending = true;
			});
		}
		let problem = null;
		async function attempt(change) {
			problem = null;
			try {
				await change();
			} catch (e) {
				if (e instanceof PlayRequestError) problem = e.message;
				else throw e;
			}
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			head("1vf78z9", $$renderer, ($$renderer) => {
				$$renderer.title(($$renderer) => {
					$$renderer.push(`<title>${escape_html(data.campaign.name)} · Play</title>`);
				});
			});
			$$renderer.push(`<div class="flex h-[calc(100dvh-3rem)] flex-col gap-2 overflow-hidden p-3"><header class="flex shrink-0 items-center gap-3">`);
			Link($$renderer, {
				href: resolve("/campaigns/[id]", { id: data.campaign.id }),
				class: "text-sm",
				children: ($$renderer) => {
					$$renderer.push(`<!---->${escape_html(data.campaign.name)}`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> `);
			DmBadge($$renderer, {
				size: "sm",
				attached: attached()
			});
			$$renderer.push(`<!----> `);
			Link($$renderer, {
				href: resolve("/campaigns/[id]/journal", { id: data.campaign.id }),
				class: "ml-auto text-sm",
				children: ($$renderer) => {
					$$renderer.push(`<!---->Journal and Session history`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> `);
			Button($$renderer, {
				size: "sm",
				variant: "secondary",
				onclick: () => seatOpen = true,
				children: ($$renderer) => {
					$$renderer.push(`<!---->Your Characters`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> `);
			Button($$renderer, {
				size: "sm",
				variant: "secondary",
				disabled: !attached() || archived() || ending,
				onclick: end,
				children: ($$renderer) => {
					$$renderer.push(`<!---->${escape_html(ending ? "Ending the session…" : "End Session")}`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----></header> <main${attr_class(clsx(["grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)_15rem]", !seated() && "pointer-events-none opacity-40"]))} aria-label="Play console"${attr("inert", !seated(), true)}>`);
			CharacterSheet($$renderer, {
				sheets: sheets(),
				acting: acting()?.id ?? null,
				onselect: (id) => picked = id,
				onlevelup: archived() ? void 0 : (id, picks) => attempt(() => levelUp(data.campaign.id, id, picks)),
				onsavedetails: archived() ? void 0 : (id, details) => saveDetails(data.campaign.id, id, details)
			});
			$$renderer.push(`<!----> <section aria-label="Story" class="flex min-h-0 flex-col gap-2">`);
			Timeline($$renderer, {
				entries: seated() ? timeline.data.entries : [],
				awaitingSince: timeline.data.awaitingSince,
				away: !attached()
			});
			$$renderer.push(`<!----> `);
			if (seated() && timeline.data.call && !archived()) {
				$$renderer.push("<!--[0-->");
				const open = timeline.data.call;
				CallCard($$renderer, {
					call: open,
					disabled: rolling || !attached(),
					onroll: (part) => answerCall(() => calls.roll(open.id, part)),
					onanswer: (part, answer) => answerCall(() => calls.answer(open.id, part, answer))
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (problem) {
				$$renderer.push("<!--[0-->");
				Alert($$renderer, {
					variant: "danger",
					children: ($$renderer) => {
						$$renderer.push(`<!---->${escape_html(problem)}`);
					},
					$$slots: { default: true }
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (permission.data) {
				$$renderer.push("<!--[0-->");
				const request = permission.data;
				PermissionCard($$renderer, {
					request,
					onanswer: (behavior) => answers.answer(request.requestId, behavior)
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (archived()) {
				$$renderer.push("<!--[0-->");
				Alert($$renderer, {
					variant: "warning",
					children: ($$renderer) => {
						$$renderer.push(`<!---->This Campaign is archived. Restore it to play.`);
					},
					$$slots: { default: true }
				});
			} else {
				$$renderer.push("<!--[-1-->");
				FloorComposer($$renderer, {
					acting: acting()?.name ?? null,
					turn: turn()?.name ?? null,
					declarations: seated() ? floor.data.declarations : [],
					awaiting: timeline.data.awaitingSince !== null,
					onsend: (text) => acting() && attempt(() => actions.send(acting().id, text)),
					ondone: done,
					onedit: (id, text) => attempt(() => actions.edit(id, text)),
					onwithdraw: (id) => attempt(() => actions.withdraw(id)),
					elsewhere: scene.data.elsewhere,
					oncut: (id) => attempt(() => actions.cut(id)),
					returned: seated() ? floor.data.returned : [],
					onreturned: (ids) => attempt(() => actions.clearReturned(ids)),
					away: attached() ? null : { folder: data.campaign.path }
				});
			}
			$$renderer.push(`<!--]--></section> `);
			Rail($$renderer, {
				scene: scene.data,
				believer: acting()?.name ?? "the Party",
				entries: acting() ? knownBy(journal.data, acting().id) : journal.data.entries,
				actor: acting()?.id
			});
			$$renderer.push(`<!----></main> `);
			TakeASeat($$renderer, {
				rows: claims.data,
				createHref: resolve("/campaigns/[id]/party", { id: data.campaign.id }),
				closeHref: resolve("/campaigns/[id]", { id: data.campaign.id }),
				problem,
				onclaim: (id) => attempt(() => seats.claim(id)),
				onletgo: (id) => attempt(() => seats.letGo(id)),
				get open() {
					return seatOpen;
				},
				set open($$value) {
					seatOpen = $$value;
					$$settled = false;
				}
			});
			$$renderer.push(`<!----></div>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map