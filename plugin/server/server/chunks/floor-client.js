import { S as escape_html, c as ensure_array_like, o as derived, v as attr } from "./server2.js";
import { a as floorQueryKey, c as sceneQueryKey, d as sheetsQueryKey, f as timelineQueryKey, m as SvelteMap, n as claimsQueryKey, o as journalQueryKey, p as createQuery, u as sessionHistoryQueryKey } from "./messages.js";
import { t as useQueryClient } from "./useQueryClient.js";
// src/lib/play/journal.ts
/** Whether a Character holds an entry themselves. */
var holds = (entry, character) => entry.holders.some((h) => h.id === character);
/**
* "What <Character> knows": the entries they hold, then the rest of the Party's, which the
* Character can be told about at the table.
*/
var knownBy = (journal, character) => [...journal.entries.filter((e) => holds(e, character)), ...journal.entries.filter((e) => !holds(e, character))];
// src/lib/play/Journal.svelte
function Journal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* What the Player's Characters believe, grouped by who or what it is about, each entry marked
		* with the Characters who hold it. Only Beliefs, as learned: never the World layer.
		*/
		let { entries, actor } = $$props;
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
					if (actor === void 0 || !holds(entry, actor)) $$renderer.push(`<!--[0--><span class="block text-xs text-muted">${escape_html(entry.holders.map((h) => h.name).join(", "))}</span>`);
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
/** A play request the server refused or failed, with its message for the Player. */
var PlayRequestError = class extends Error {};
/** The server's refusal of a request as a `PlayRequestError`: its `{ error }`, else `fallback`. */
async function refusal(res, fallback) {
	return new PlayRequestError((await res.json().catch(() => ({}))).error ?? fallback);
}
var campaignPath = (campaign, path) => `/api/campaigns/${encodeURIComponent(campaign)}/${path}`;
/**
* A query of one Campaign read the play console shows, starting from the server-rendered value;
* live updates invalidate its key to keep it fresh.
*/
function campaignQuery(key, path, failure, campaign, initial) {
	return createQuery(() => ({
		queryKey: key(campaign()),
		queryFn: async () => {
			const res = await fetch(campaignPath(campaign(), path));
			if (!res.ok) throw await refusal(res, failure);
			return await res.json();
		},
		initialData: initial()
	}));
}
/** The Campaign's open Floor. */
var createFloorQuery = (campaign, initial) => campaignQuery(floorQueryKey, "floor", "The Floor could not be loaded", campaign, initial);
/** The Campaign's timeline and awaiting Narration. */
var createTimelineQuery = (campaign, initial) => campaignQuery(timelineQueryKey, "timeline", "The timeline could not be loaded", campaign, initial);
/** The Party's play sheets; every DM write refreshes them. */
var createSheetsQuery = (campaign, initial) => campaignQuery(sheetsQueryKey, "sheets", "The sheets could not be loaded", campaign, initial);
/** The Campaign's Scene for the rail. */
var createSceneQuery = (campaign, initial) => campaignQuery(sceneQueryKey, "scene", "The Scene could not be loaded", campaign, initial);
/** The Player's Journal. */
var createJournalQuery = (campaign, initial) => campaignQuery(journalQueryKey, "journal", "The Journal could not be loaded", campaign, initial);
/** The Player's read-only Session history. */
var createSessionHistoryQuery = (campaign, initial) => campaignQuery(sessionHistoryQueryKey, "sessions", "The Session history could not be loaded", campaign, initial);
/** Takes the level the DM awarded with the picked spells; throws the server's refusal. */
async function levelUp(campaign, character, picks) {
	const res = await fetch(campaignPath(campaign, `characters/${encodeURIComponent(character)}/level-up`), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(picks)
	});
	if (!res.ok) throw await refusal(res, "The level-up was refused");
}
/**
* Saves a Character's notes, personality and appearance; works with the DM away. Throws the
* server's refusal.
*/
async function saveDetails(campaign, character, details) {
	const res = await fetch(campaignPath(campaign, `characters/${encodeURIComponent(character)}`), {
		method: "PATCH",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(details)
	});
	if (!res.ok) throw await refusal(res, "The details could not be saved");
}
/** End Session: asks the DM to close the Session. */
async function endSession(campaign) {
	const res = await fetch(campaignPath(campaign, "end-session"), { method: "POST" });
	if (!res.ok) throw await refusal(res, "The session could not be ended");
}
/** Send, edit, withdraw and Done on the Campaign's open Floor; each refreshes the Floor and timeline. */
function floorActions(campaign) {
	const queryClient = useQueryClient();
	const base = () => campaignPath(campaign(), "floor/declarations");
	async function call(url, init) {
		const res = await fetch(url, {
			...init,
			headers: init.body ? { "content-type": "application/json" } : void 0
		});
		await Promise.all([queryClient.invalidateQueries({ queryKey: floorQueryKey(campaign()) }), queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) })]);
		if (!res.ok) throw await refusal(res, "The Floor could not be changed");
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
			for (const id of ids) await call(campaignPath(campaign(), `floor/returned/${encodeURIComponent(id)}`), { method: "DELETE" });
		},
		/** "Cut to <Name>": a spotlight request to the DM. Doesn't make the DM answer a turn. */
		async cut(character) {
			await call(campaignPath(campaign(), "spotlight"), {
				method: "POST",
				body: JSON.stringify({ character })
			});
		},
		/** Done: closes the Floor (once every Player has pressed it) and wakes the DM. */
		async done() {
			await call(campaignPath(campaign(), "floor/done"), { method: "POST" });
		},
		/** Not done yet: takes Done back until the Floor closes. */
		async undone() {
			await call(campaignPath(campaign(), "floor/done"), { method: "DELETE" });
		}
	};
}
/** Rolling and answering the open Call; each refreshes the timeline, which holds the Call. */
function callActions(campaign) {
	const queryClient = useQueryClient();
	async function post(call, part, body) {
		const res = await fetch(campaignPath(campaign(), `calls/${encodeURIComponent(call)}/parts/${encodeURIComponent(part)}`), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		});
		await queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) });
		if (!res.ok) throw await refusal(res, "The Call could not be answered");
	}
	return {
		/** Rolls one Check of the Call; the server rolls the dice. */
		roll: (call, part) => post(call, part, { roll: true }),
		/** Answers a question Call. */
		answer: (call, part, answer) => post(call, part, { answer })
	};
}
/** The Party's Claims as this browser sees them; a `claims` live message refreshes them. */
var createClaimsQuery = (campaign, initial) => campaignQuery(claimsQueryKey, "claims", "The Claims could not be loaded", campaign, initial);
/** Claim and Let go from the Take a seat dialog; throws the server's refusal. */
function claimActions(campaign) {
	const queryClient = useQueryClient();
	async function change(url, init) {
		const res = await fetch(url, init);
		await queryClient.invalidateQueries({ queryKey: claimsQueryKey(campaign()) });
		if (!res.ok) throw await refusal(res, "The Claim could not be changed");
	}
	return {
		claim: (character) => change(campaignPath(campaign(), "claims"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ character })
		}),
		letGo: (character) => change(campaignPath(campaign(), `claims/${encodeURIComponent(character)}`), { method: "DELETE" })
	};
}
export { createFloorQuery as a, createSessionHistoryQuery as c, endSession as d, floorActions as f, knownBy as g, Journal as h, createClaimsQuery as i, createSheetsQuery as l, saveDetails as m, callActions as n, createJournalQuery as o, levelUp as p, claimActions as r, createSceneQuery as s, PlayRequestError as t, createTimelineQuery as u };

//# sourceMappingURL=floor-client.js.map