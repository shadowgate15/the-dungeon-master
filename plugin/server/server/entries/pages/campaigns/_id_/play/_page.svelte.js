import { ft as resolve } from "../../../../../chunks/internal.js";
import { _ as clsx, c as ensure_array_like, f as stringify, g as attr, l as head, n as attr_style, o as derived, r as attributes, t as attr_class, y as escape_html } from "../../../../../chunks/server2.js";
import "../../../../../chunks/paths.js";
import { n as createSessionsQuery, t as DmBadge } from "../../../../../chunks/DmBadge.js";
import { n as Alert, t as Button } from "../../../../../chunks/Button.js";
import { t as Badge } from "../../../../../chunks/Badge.js";
import { t as Textarea } from "../../../../../chunks/Textarea.js";
import { a as createTimelineQuery, i as createJournalQuery, n as callActions, o as floorActions, r as createFloorQuery, s as Journal, t as FloorChangeError } from "../../../../../chunks/floor-client.js";
import { i as permissionQueryKey, o as createQuery } from "../../../../../chunks/messages.js";
import { t as useQueryClient } from "../../../../../chunks/useQueryClient.js";
import { t as Link } from "../../../../../chunks/Link.js";
// src/lib/play/CallCard.svelte
function CallCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The open Call at the foot of the timeline: one button group per Character for a Check (the
		* skill or save and the reason, never the DC; advantage marked), or for a roll sequence such as
		* an attack (its next roll: to hit, then damage; never the AC), or a question with its choices
		* as buttons (free text without). Clicking rolls on the server; nothing is rolled here.
		*/
		let { call, onroll, onanswer, disabled = false } = $$props;
		let drafts = {};
		$$renderer.push(`<section aria-label="Call" class="flex shrink-0 flex-col gap-2 rounded-panel border-2 border-primary bg-raised p-3 text-sm">`);
		if (call.kind === "question") $$renderer.push(`<!--[0--><p class="font-medium">${escape_html(call.text)}</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <!--[-->`);
		const each_array = ensure_array_like(call.parts);
		for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
			let part = each_array[$$index_1];
			$$renderer.push(`<div role="group"${attr("aria-label", part.character ?? part.player)} class="flex flex-wrap items-center gap-2">`);
			if (call.kind === "check" || call.kind === "roll_sequence") {
				$$renderer.push(`<!--[0--><span class="font-medium">${escape_html(part.character)}</span> <span>${escape_html(part.label)}</span> `);
				if (part.mode !== "normal") $$renderer.push(`<!--[0--><span class="text-xs font-semibold text-accent uppercase">${escape_html(part.mode === "advantage" ? "Advantage" : "Disadvantage")}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (part.reason) $$renderer.push(`<!--[0--><span class="text-muted">${escape_html(part.reason)}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (part.answered) $$renderer.push(`<!--[0--><span class="ml-auto text-xs text-muted">Rolled</span>`);
				else {
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
			else if (call.choices.length) {
				$$renderer.push(`<!--[2--><!--[-->`);
				const each_array_1 = ensure_array_like(call.choices);
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
// src/lib/play/CharacterSheet.svelte
function CharacterSheet($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The console's left column: one tab per Character, and the selected tab's full sheet. The
		* selected tab is the acting Character; only Characters who can act are selectable. A pure view
		* of the server's `PlaySheet`s.
		*/
		let { sheets, acting, onselect = () => {} } = $$props;
		const shown = derived(() => sheets.find((s) => s.id === acting) ?? sheets[0]);
		const signed = (n) => n >= 0 ? `+${n}` : `${n}`;
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
			$$renderer.push(`<!--[0--><div role="tabpanel"${attr("id", `sheet-${stringify(shown().id)}`)}${attr("aria-labelledby", `sheet-tab-${stringify(shown().id)}`)}${attr("aria-label", shown().name)} class="flex flex-col gap-3 p-3 text-sm"><div><h2 class="font-display text-xl">${escape_html(shown().name)}</h2> <p class="text-muted">${escape_html(shown().headline)}</p></div> <div class="grid grid-cols-[1fr_auto] items-end gap-3"><div role="group" aria-label="HP"><div class="flex justify-between text-xs"><span>HP</span> <span>${escape_html(shown().hp.current)} / ${escape_html(shown().hp.max ?? "—")}`);
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
					$$renderer.push(`<li>${escape_html(i.name)}${escape_html(i.quantity > 1 ? ` × ${i.quantity}` : "")}</li>`);
				}
			} else $$renderer.push(`<!--[!--><li class="text-muted">Nothing carried</li>`);
			$$renderer.push(`<!--]--></ul></section></div>`);
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
		* stays open but Done waits. A pure view; the console wires the callbacks to the server.
		*/
		let { acting, declarations, onsend, ondone, onedit, onwithdraw, awaiting = false, disabled = false } = $$props;
		let draft = "";
		let editing = null;
		const blocked = derived(() => disabled || acting === null);
		const label = (d) => `${d.characterName}: ${d.text}`;
		function send() {
			const text = draft.trim();
			if (!text || blocked()) return;
			onsend(text);
			draft = "";
		}
		function done() {
			if (disabled || awaiting) return;
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
					} else $$renderer.push(`<!--[-1--><span class="flex-1 whitespace-pre-wrap">${escape_html(d.text)}</span> <button class="text-xs text-muted underline"${attr("aria-label", `Edit ${stringify(label(d))}`)}>edit</button> <button class="text-xs text-muted underline"${attr("aria-label", `Withdraw ${stringify(label(d))}`)}>withdraw</button>`);
					$$renderer.push(`<!--]--></li>`);
				}
				$$renderer.push(`<!--]--></ul>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			Textarea($$renderer, {
				size: "sm",
				rows: 2,
				onkeydown,
				disabled: blocked(),
				"aria-label": acting ? `What does ${acting} do?` : "No Character can act",
				placeholder: acting ? `What does ${acting} do?` : "No Character can act",
				get value() {
					return draft;
				},
				set value($$value) {
					draft = $$value;
					$$settled = false;
				}
			});
			$$renderer.push(`<!----> <div class="flex items-center justify-end gap-2"><span class="mr-auto text-xs text-muted">Enter adds to the tray · Ctrl+Enter sends and closes · Shift+Enter for a new line</span> `);
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
			$$renderer.push(`<!----></div></div>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/play/journal.ts
/** The entries a Character holds: "What <Character> knows". */
var knownBy = (journal, character) => journal.entries.filter((e) => e.holders.some((h) => h.id === character));
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
// src/lib/play/Timeline.svelte
function Timeline($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* The console's centre: the Show filters above one timeline, DM on the left and the Player on
		* the right. Narrations (with the NPC voicing them), Declarations from closed Floors, one-line rolls,
		* question answers and muted
		* `⚙ DM …` activity lines; while the DM works on a turn, a `Ns / ~20s` progress bar.
		*/
		let { entries, awaitingSince } = $$props;
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
		if (awaitingSince !== null) $$renderer.push(`<!--[0--><div class="flex items-center gap-2 text-xs text-muted"><div role="progressbar" aria-label="The DM is working" aria-valuemin="0"${attr("aria-valuemax", 20)}${attr("aria-valuenow", Math.min(elapsed(), 20))} class="h-1.5 flex-1 overflow-hidden rounded-full bg-border"><div class="h-full bg-primary transition-[width]"${attr_style("", { width: `${stringify(Math.min(100, elapsed() / 20 * 100))}%` })}></div></div> <span>${escape_html(elapsed())}s / ~${escape_html(20)}s</span></div>`);
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
		const journal = createJournalQuery(() => data.campaign.id, () => data.journal);
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
		const actors = derived(() => data.sheets.filter((s) => s.canAct));
		const acting = derived(() => actors().find((s) => s.id === picked) ?? actors()[0] ?? null);
		const archived = derived(() => data.campaign.status === "archived");
		let problem = null;
		async function attempt(change) {
			problem = null;
			try {
				await change();
			} catch (e) {
				if (e instanceof FloorChangeError) problem = e.message;
				else throw e;
			}
		}
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
			attached: sessions.data.includes(data.campaign.id)
		});
		$$renderer.push(`<!----> `);
		Link($$renderer, {
			href: resolve("/campaigns/[id]/journal", { id: data.campaign.id }),
			class: "ml-auto text-sm",
			children: ($$renderer) => {
				$$renderer.push(`<!---->Journal`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></header> <main class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)_15rem]" aria-label="Play console">`);
		CharacterSheet($$renderer, {
			sheets: data.sheets,
			acting: acting()?.id ?? null,
			onselect: (id) => picked = id
		});
		$$renderer.push(`<!----> <section aria-label="Story" class="flex min-h-0 flex-col gap-2">`);
		Timeline($$renderer, {
			entries: timeline.data.entries,
			awaitingSince: timeline.data.awaitingSince
		});
		$$renderer.push(`<!----> `);
		if (timeline.data.call && !archived()) {
			$$renderer.push("<!--[0-->");
			const open = timeline.data.call;
			CallCard($$renderer, {
				call: open,
				disabled: rolling,
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
				declarations: floor.data.declarations,
				awaiting: timeline.data.awaitingSince !== null,
				onsend: (text) => acting() && attempt(() => actions.send(acting().id, text)),
				ondone: done,
				onedit: (id, text) => attempt(() => actions.edit(id, text)),
				onwithdraw: (id) => attempt(() => actions.withdraw(id))
			});
		}
		$$renderer.push(`<!--]--></section> <aside aria-label="Scene" class="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm"><section class="rounded-panel border border-border bg-surface p-3"><h2 class="mb-1 text-xs font-semibold text-muted uppercase">Clock and Scene</h2> <p class="text-muted">The Scene is set once play begins.</p></section> <section aria-labelledby="knows-heading" class="rounded-panel border border-border bg-surface p-3"><h2 id="knows-heading" class="mb-1 text-xs font-semibold text-muted uppercase">What ${escape_html(acting()?.name ?? "the Party")} knows</h2> `);
		Journal($$renderer, {
			entries: acting() ? knownBy(journal.data, acting().id) : journal.data.entries,
			holders: !acting()
		});
		$$renderer.push(`<!----></section></aside></main></div>`);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map