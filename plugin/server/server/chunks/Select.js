import { a as bind_props } from "./server2.js";
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
export { Select as t };

//# sourceMappingURL=Select.js.map