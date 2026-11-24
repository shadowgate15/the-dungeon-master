import { y as escape_html } from "./server2.js";
import { a as createQuery, t as SESSIONS_QUERY_KEY } from "./messages.js";
import { t as Badge } from "./Badge.js";
// src/lib/live/client.ts
/** The ids of the Campaigns with a DM at the table, starting from the server-rendered list. */
function createSessionsQuery(initial) {
	return createQuery(() => ({
		queryKey: SESSIONS_QUERY_KEY,
		queryFn: async () => {
			return (await (await fetch("/api/sessions")).json()).attached;
		},
		initialData: initial()
	}));
}
// src/lib/campaign/DmBadge.svelte
function DmBadge($$renderer, $$props) {
	/** Whether a Claude Code session is attached to the Campaign. */
	let { attached, size = "md" } = $$props;
	Badge($$renderer, {
		variant: attached ? "success" : "neutral",
		size,
		children: ($$renderer) => {
			$$renderer.push(`<!---->${escape_html(attached ? "DM at the table" : "DM away")}`);
		},
		$$slots: { default: true }
	});
}
export { createSessionsQuery as n, DmBadge as t };

//# sourceMappingURL=DmBadge.js.map