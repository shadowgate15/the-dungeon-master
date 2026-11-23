import { ft as resolve } from "../../../../../chunks/internal.js";
import { _ as clsx, c as ensure_array_like, f as stringify, g as attr, l as head, n as attr_style, o as derived, r as attributes, t as attr_class, y as escape_html } from "../../../../../chunks/server2.js";
import "../../../../../chunks/paths2.js";
import { i as createQuery, n as createSessionsQuery, r as floorQueryKey, t as DmBadge } from "../../../../../chunks/DmBadge.js";
import { t as Badge } from "../../../../../chunks/Badge.js";
import { n as Alert, r as Link, t as Button } from "../../../../../chunks/Button.js";
import { t as Textarea } from "../../../../../chunks/Textarea.js";
import { t as useQueryClient } from "../../../../../chunks/useQueryClient.js";
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
		* acting Character. Every tray entry can be edited or withdrawn until the Floor closes. A pure
		* view; the console wires the callbacks to the server.
		*/
		let { acting, declarations, onsend, onedit, onwithdraw, disabled = false } = $$props;
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
		function onkeydown(e) {
			if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
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
			$$renderer.push(`<!----> <div class="flex items-center justify-end gap-2"><span class="mr-auto text-xs text-muted">Enter adds to the tray · Shift+Enter for a new line</span> `);
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
// src/lib/play/Timeline.svelte
function Timeline($$renderer, $$props) {
	/**
	* The console's centre: the Show filters above one timeline, DM on the left and the Player on
	* the right. Narration, rolls and DM activity join it in later slices; until then it says the
	* story has not started.
	*/
	let { children } = $$props;
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
	$$renderer.push(`<div role="group" aria-label="Show" class="flex items-center gap-3 text-xs"><span class="text-muted">Show</span> <!--[-->`);
	const each_array = ensure_array_like(filters);
	for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
		let [key, label] = each_array[$$index];
		$$renderer.push(`<label class="flex items-center gap-1"><input type="checkbox"${attr("checked", show[key], true)} class="rounded"/> ${escape_html(label)}</label>`);
	}
	$$renderer.push(`<!--]--></div> <ol aria-label="Timeline" class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-panel border border-border bg-surface p-3">`);
	if (children) {
		$$renderer.push("<!--[0-->");
		children($$renderer);
		$$renderer.push(`<!---->`);
	} else $$renderer.push(`<!--[-1--><li class="m-auto text-sm text-muted">Nothing has happened yet.</li>`);
	$$renderer.push(`<!--]--></ol>`);
}
// src/lib/play/floor-client.ts
/** A Floor change the server refused, with its message for the Player. */
var FloorChangeError = class extends Error {};
/** The Campaign's open Floor, starting from the server-rendered one; live updates keep it fresh. */
function createFloorQuery(campaign, initial) {
	return createQuery(() => ({
		queryKey: floorQueryKey(campaign()),
		queryFn: async () => {
			const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/floor`);
			if (!res.ok) throw new FloorChangeError("The Floor could not be loaded");
			return await res.json();
		},
		initialData: initial()
	}));
}
/** Send, edit and withdraw on the Campaign's open Floor; each refreshes the Floor query. */
function floorActions(campaign) {
	const queryClient = useQueryClient();
	const base = () => `/api/campaigns/${encodeURIComponent(campaign())}/floor/declarations`;
	async function call(url, init) {
		const res = await fetch(url, {
			...init,
			headers: init.body ? { "content-type": "application/json" } : void 0
		});
		await queryClient.invalidateQueries({ queryKey: floorQueryKey(campaign()) });
		if (!res.ok) throw new FloorChangeError((await res.json().catch(() => ({}))).error ?? "The Floor could not be changed");
		return res;
	}
	return {
		async send(character, text) {
			return await (await call(base(), {
				method: "POST",
				body: JSON.stringify({
					character,
					text
				})
			})).json();
		},
		async edit(id, text) {
			await call(`${base()}/${encodeURIComponent(id)}`, {
				method: "PATCH",
				body: JSON.stringify({ text })
			});
		},
		async withdraw(id) {
			await call(`${base()}/${encodeURIComponent(id)}`, { method: "DELETE" });
		}
	};
}
// src/routes/campaigns/[id]/play/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const sessions = createSessionsQuery(() => data.attached);
		const floor = createFloorQuery(() => data.campaign.id, () => data.floor);
		const actions = floorActions(() => data.campaign.id);
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
		$$renderer.push(`<!----></header> <main class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)_15rem]" aria-label="Play console">`);
		CharacterSheet($$renderer, {
			sheets: data.sheets,
			acting: acting()?.id ?? null,
			onselect: (id) => picked = id
		});
		$$renderer.push(`<!----> <section aria-label="Story" class="flex min-h-0 flex-col gap-2">`);
		Timeline($$renderer, {});
		$$renderer.push(`<!----> `);
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
				onsend: (text) => acting() && attempt(() => actions.send(acting().id, text)),
				onedit: (id, text) => attempt(() => actions.edit(id, text)),
				onwithdraw: (id) => attempt(() => actions.withdraw(id))
			});
		}
		$$renderer.push(`<!--]--></section> <aside aria-label="Scene" class="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm"><section class="rounded-panel border border-border bg-surface p-3"><h2 class="mb-1 text-xs font-semibold text-muted uppercase">Clock and Scene</h2> <p class="text-muted">The Scene is set once play begins.</p></section> <section class="rounded-panel border border-border bg-surface p-3"><h2 class="mb-1 text-xs font-semibold text-muted uppercase">What ${escape_html(acting()?.name ?? "the Party")} knows</h2> <p class="text-muted">Nothing yet.</p></section></aside></main></div>`);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map