import { r as attributes, v as clsx, x as escape_html } from "./server2.js";
import { d as createQuery, t as SESSIONS_QUERY_KEY } from "./messages.js";
import { a as STATUS_CLASSES_BORDERLESS, r as NEUTRAL_CLASSES } from "./Button.js";
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
// src/lib/ui/Badge.svelte
function Badge($$renderer, $$props) {
	let { variant = "neutral", size = "md", class: className, children, $$slots, $$events, ...rest } = $$props;
	const variants = {
		neutral: NEUTRAL_CLASSES,
		...STATUS_CLASSES_BORDERLESS
	};
	$$renderer.push(`<span${attributes({
		class: clsx([
			"inline-flex items-center rounded-full border font-medium",
			size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-sm",
			variants[variant],
			className
		]),
		...rest
	})}>`);
	children?.($$renderer);
	$$renderer.push(`<!----></span>`);
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
export { Badge as n, createSessionsQuery as r, DmBadge as t };

//# sourceMappingURL=DmBadge.js.map