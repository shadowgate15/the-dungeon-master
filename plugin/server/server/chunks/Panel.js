import { g as clsx, h as attr, i as bind_props, n as attributes, o as element, s as ensure_array_like, t as attr_class, v as escape_html } from "./server2.js";
// src/lib/ui/Select.svelte
function Select($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Native `<option>` elements. */
		let { value = void 0, size = "md", class: className, children, $$slots, $$events, ...rest } = $$props;
		$$renderer.select({
			value,
			class: [
				"block w-full rounded-control border border-control-border bg-raised text-text",
				"focus:border-control-border focus:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
				"disabled:cursor-not-allowed disabled:opacity-50",
				size === "sm" ? "py-1 pr-8 pl-2 text-sm" : "py-2 pr-10 pl-3 text-base",
				className
			],
			...rest
		}, ($$renderer) => {
			children?.($$renderer);
			$$renderer.push(`<!---->`);
		}, void 0, void 0, void 0, void 0, true);
		bind_props($$props, { value });
	});
}
// src/lib/campaign/CreationStepper.svelte
var CREATION_STEPS = [
	"Seed",
	"Party",
	"Begin"
];
function CreationStepper($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Already-resolved paths of the steps that can be opened. */
		/** Steps that cannot be opened yet. */
		let { current, hrefs = {}, unavailable = [] } = $$props;
		const linked = (step) => !unavailable.includes(step) ? hrefs[step] : void 0;
		$$renderer.push(`<nav aria-label="Campaign creation"><ol class="flex gap-2"><!--[-->`);
		const each_array = ensure_array_like(CREATION_STEPS);
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			let step = each_array[i];
			const href = linked(step);
			const classes = [
				"flex items-center gap-2 rounded-control border px-3 py-1.5 text-sm",
				current === step ? "border-primary bg-raised font-semibold" : "border-border text-muted",
				unavailable.includes(step) && "opacity-50",
				href && "hover:border-primary"
			];
			$$renderer.push(`<li>`);
			if (href) $$renderer.push(`<!--[0--><a${attr("href", href)}${attr_class(clsx(classes))}${attr("aria-current", current === step ? "step" : void 0)}><span aria-hidden="true">${escape_html(i + 1)}.</span> ${escape_html(step)}</a>`);
			else {
				$$renderer.push(`<!--[-1--><span${attr_class(clsx(classes))}${attr("aria-current", current === step ? "step" : void 0)}><span aria-hidden="true">${escape_html(i + 1)}.</span> ${escape_html(step)} `);
				if (unavailable.includes(step)) $$renderer.push(`<!--[0--><span class="sr-only">(not available yet)</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></span>`);
			}
			$$renderer.push(`<!--]--></li>`);
		}
		$$renderer.push(`<!--]--></ol></nav>`);
	});
}
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
export { CreationStepper as n, Select as r, Panel as t };

//# sourceMappingURL=Panel.js.map