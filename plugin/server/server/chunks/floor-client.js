import { _ as attr, c as ensure_array_like, o as derived, x as escape_html } from "./server2.js";
import { a as journalQueryKey, d as SvelteMap, i as floorQueryKey, l as timelineQueryKey, s as sceneQueryKey, u as createQuery } from "./messages.js";
import { t as useQueryClient } from "./useQueryClient.js";
// src/lib/play/Journal.svelte
function Journal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* What the Player's Characters believe, grouped by who or what it is about, each entry marked
		* with the Characters who hold it. Only Beliefs, as learned: never the World layer.
		*/
		let { entries, holders = true } = $$props;
		const typeLabel = {
			npc: "Person",
			place: "Place",
			faction: "Faction",
			topic: "Topic"
		};
		/** Entries grouped by what they are about, in the order first learned. */
		const groups = derived(() => {
			const byAbout = new SvelteMap();
			for (const e of entries) {
				const key = `${e.about.type}:${e.about.name}`;
				const group = byAbout.get(key) ?? {
					...e.about,
					entries: []
				};
				group.entries.push(e);
				byAbout.set(key, group);
			}
			return [...byAbout.values()];
		});
		if (groups().length === 0) $$renderer.push(`<!--[0--><p class="text-sm text-muted">Nothing learned yet.</p>`);
		else {
			$$renderer.push(`<!--[-1--><div class="flex flex-col gap-3"><!--[-->`);
			const each_array = ensure_array_like(groups());
			for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
				let group = each_array[$$index_1];
				$$renderer.push(`<section${attr("aria-label", group.name)}><h3 class="flex items-baseline gap-2 text-sm font-semibold">${escape_html(group.name)} <span class="text-xs font-normal text-muted">${escape_html(typeLabel[group.type])}</span></h3> <ul class="mt-1 flex flex-col gap-1 text-sm"><!--[-->`);
				const each_array_1 = ensure_array_like(group.entries);
				for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
					let entry = each_array_1[$$index];
					$$renderer.push(`<li><span>${escape_html(entry.text === group.name ? "Heard of" : entry.text)}</span> `);
					if (entry.source) $$renderer.push(`<!--[0--><span class="text-muted">(from ${escape_html(entry.source)})</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					if (holders) $$renderer.push(`<!--[0--><span class="block text-xs text-muted">${escape_html(entry.holders.map((h) => h.name).join(", "))}</span>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></li>`);
				}
				$$renderer.push(`<!--]--></ul></section>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]-->`);
	});
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
/** The Campaign's timeline and awaiting Narration, starting from the server-rendered one. */
function createTimelineQuery(campaign, initial) {
	return createQuery(() => ({
		queryKey: timelineQueryKey(campaign()),
		queryFn: async () => {
			const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/timeline`);
			if (!res.ok) throw new FloorChangeError("The timeline could not be loaded");
			return await res.json();
		},
		initialData: initial()
	}));
}
/** The Campaign's Scene for the rail, starting from the server-rendered one. */
function createSceneQuery(campaign, initial) {
	return createQuery(() => ({
		queryKey: sceneQueryKey(campaign()),
		queryFn: async () => {
			const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/scene`);
			if (!res.ok) throw new FloorChangeError("The Scene could not be loaded");
			return await res.json();
		},
		initialData: initial()
	}));
}
/** The Player's Journal, starting from the server-rendered one; live updates keep it fresh. */
function createJournalQuery(campaign, initial) {
	return createQuery(() => ({
		queryKey: journalQueryKey(campaign()),
		queryFn: async () => {
			const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/journal`);
			if (!res.ok) throw new Error("The Journal could not be loaded");
			return await res.json();
		},
		initialData: initial()
	}));
}
/** Send, edit, withdraw and Done on the Campaign's open Floor; each refreshes the Floor and timeline. */
function floorActions(campaign) {
	const queryClient = useQueryClient();
	const base = () => `/api/campaigns/${encodeURIComponent(campaign())}/floor/declarations`;
	async function call(url, init) {
		const res = await fetch(url, {
			...init,
			headers: init.body ? { "content-type": "application/json" } : void 0
		});
		await Promise.all([queryClient.invalidateQueries({ queryKey: floorQueryKey(campaign()) }), queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) })]);
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
		},
		/** The composer loaded drafts a cut sent back; the server stops holding them. */
		async clearReturned(ids) {
			for (const id of ids) await call(`/api/campaigns/${encodeURIComponent(campaign())}/floor/returned/${encodeURIComponent(id)}`, { method: "DELETE" });
		},
		/** "Cut to <Name>": a spotlight request to the DM. Doesn't make the DM answer a turn. */
		async cut(character) {
			await call(`/api/campaigns/${encodeURIComponent(campaign())}/spotlight`, {
				method: "POST",
				body: JSON.stringify({ character })
			});
		},
		/** Done: closes the Floor (once every Player has pressed it) and wakes the DM. */
		async done() {
			await call(`/api/campaigns/${encodeURIComponent(campaign())}/floor/done`, { method: "POST" });
		}
	};
}
/** Rolling and answering the open Call; each refreshes the timeline, which holds the Call. */
function callActions(campaign) {
	const queryClient = useQueryClient();
	async function post(call, part, body) {
		const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/calls/${encodeURIComponent(call)}/parts/${encodeURIComponent(part)}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		});
		await queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) });
		if (!res.ok) throw new FloorChangeError((await res.json().catch(() => ({}))).error ?? "The Call could not be answered");
	}
	return {
		/** Rolls one Check of the Call; the server rolls the dice. */
		roll: (call, part) => post(call, part, { roll: true }),
		/** Answers a question Call. */
		answer: (call, part, answer) => post(call, part, { answer })
	};
}
export { createSceneQuery as a, Journal as c, createJournalQuery as i, callActions as n, createTimelineQuery as o, createFloorQuery as r, floorActions as s, FloorChangeError as t };

//# sourceMappingURL=floor-client.js.map