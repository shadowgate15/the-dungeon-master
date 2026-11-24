import { ft as resolve } from "../../../../../chunks/internal.js";
import { l as head, x as escape_html } from "../../../../../chunks/server2.js";
import "../../../../../chunks/paths.js";
import { o as Journal, r as createJournalQuery } from "../../../../../chunks/floor-client.js";
import { t as Link } from "../../../../../chunks/Link.js";
// src/routes/campaigns/[id]/journal/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const journal = createJournalQuery(() => data.campaign.id, () => data.journal);
		head("cqkstg", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>${escape_html(data.campaign.name)} · Journal</title>`);
			});
		});
		$$renderer.push(`<div class="mx-auto flex max-w-2xl flex-col gap-4 p-4"><header class="flex items-center gap-3"><h1 class="text-xl font-semibold">Journal</h1> `);
		Link($$renderer, {
			href: resolve("/campaigns/[id]/play", { id: data.campaign.id }),
			class: "ml-auto text-sm",
			children: ($$renderer) => {
				$$renderer.push(`<!---->Back to the play console`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></header> <p class="text-sm text-muted">What your Characters believe, as they learned it.</p> `);
		Journal($$renderer, { entries: journal.data.entries });
		$$renderer.push(`<!----></div>`);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map