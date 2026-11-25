import { ft as resolve } from "../../../../../chunks/internal.js";
import { _ as attr, c as ensure_array_like, l as head, p as stringify, x as escape_html } from "../../../../../chunks/server2.js";
import "../../../../../chunks/paths.js";
import { f as Journal, i as createJournalQuery, o as createSessionHistoryQuery } from "../../../../../chunks/floor-client.js";
import { t as Link } from "../../../../../chunks/Link.js";
// src/lib/play/SessionHistory.svelte
function SessionHistory($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The Player's read-only Session history, newest first. Summaries are never editable. */
		let { sessions } = $$props;
		/** An in-fiction clock minute: minute 0 is day 1, 08:00. */
		function clock(minute) {
			const total = minute + 480;
			const day = Math.floor(total / 1440) + 1;
			const time = total % 1440;
			const pad = (n) => String(n).padStart(2, "0");
			return `day ${day}, ${pad(Math.floor(time / 60))}:${pad(time % 60)}`;
		}
		function span({ from, to }) {
			return from === to ? clock(from) : `${clock(from)} – ${clock(to)}`;
		}
		const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
		if (sessions.length === 0) $$renderer.push(`<!--[0--><p class="text-sm text-muted">No Session has closed yet.</p>`);
		else {
			$$renderer.push(`<!--[-1--><div class="flex flex-col gap-3"><!--[-->`);
			const each_array = ensure_array_like(sessions);
			for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
				let s = each_array[$$index_1];
				$$renderer.push(`<article${attr("aria-labelledby", `session-${stringify(s.number)}`)} class="rounded-panel border border-border bg-surface p-3 text-sm"><header class="mb-1 flex flex-wrap items-baseline gap-x-3"><h3${attr("id", `session-${stringify(s.number)}`)} class="font-semibold">Session ${escape_html(s.number)}</h3> <span class="text-xs text-muted">${escape_html(date.format(s.startedAt))}</span> `);
				if (s.span) $$renderer.push(`<!--[0--><span class="text-xs text-muted">${escape_html(span(s.span))}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></header> <p class="whitespace-pre-wrap">${escape_html(s.summary)}</p> `);
				if (s.threads.length) {
					$$renderer.push(`<!--[0--><h4 class="mt-2 text-xs font-semibold text-muted uppercase">Open threads</h4> <ul class="list-disc pl-5"><!--[-->`);
					const each_array_1 = ensure_array_like(s.threads);
					for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
						let thread = each_array_1[i];
						$$renderer.push(`<li>${escape_html(thread)}</li>`);
					}
					$$renderer.push(`<!--]--></ul>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></article>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]-->`);
	});
}
// src/routes/campaigns/[id]/journal/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const journal = createJournalQuery(() => data.campaign.id, () => data.journal);
		const history = createSessionHistoryQuery(() => data.campaign.id, () => data.sessions);
		head("cqkstg", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>${escape_html(data.campaign.name)} · Journal</title>`);
			});
		});
		$$renderer.push(`<div class="mx-auto flex max-w-5xl flex-col gap-4 p-4"><header class="flex items-center gap-3"><h1 class="text-xl font-semibold">Journal</h1> `);
		Link($$renderer, {
			href: resolve("/campaigns/[id]/play", { id: data.campaign.id }),
			class: "ml-auto text-sm",
			children: ($$renderer) => {
				$$renderer.push(`<!---->Back to the play console`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></header> <div class="grid gap-6 lg:grid-cols-2"><section aria-label="Journal" class="flex flex-col gap-3"><p class="text-sm text-muted">What your Characters believe, as they learned it.</p> `);
		Journal($$renderer, { entries: journal.data.entries });
		$$renderer.push(`<!----></section> <section aria-labelledby="history-heading" class="flex flex-col gap-3"><h2 id="history-heading" class="text-lg font-semibold">Session history</h2> `);
		SessionHistory($$renderer, { sessions: history.data.sessions });
		$$renderer.push(`<!----></section></div></div>`);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map