import { S as escape_html, r as attributes, s as element, y as clsx } from "./server2.js";
// src/lib/ui/Panel.svelte
function Panel($$renderer, $$props) {
	/** Region name and visible heading. */
	/** Heading level; pick the one that fits the page outline. */
	let { title, level = 2, class: className, children, $$slots, $$events, ...rest } = $$props;
	$$renderer.push(`<section${attributes({
		"aria-label": title,
		class: clsx(["space-y-2 rounded-panel border border-border bg-surface p-4 text-text shadow-raised", className]),
		...rest
	})}>`);
	element($$renderer, `h${level}`, () => {
		$$renderer.push(` class="font-display text-lg"`);
	}, () => {
		$$renderer.push(`${escape_html(title)}`);
	});
	$$renderer.push(` `);
	children?.($$renderer);
	$$renderer.push(`<!----></section>`);
}
export { Panel as t };

//# sourceMappingURL=Panel.js.map