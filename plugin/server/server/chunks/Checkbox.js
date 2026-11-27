import { a as bind_props, r as attributes, y as clsx } from "./server2.js";
// src/lib/ui/Checkbox.svelte
function Checkbox($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { checked = false, class: className, $$slots, $$events, ...rest } = $$props;
		$$renderer.push(`<input${attributes({
			type: "checkbox",
			checked,
			class: clsx([
				"size-4 rounded-sm border border-control-border bg-raised text-primary",
				"focus:ring-0 focus:ring-offset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className
			]),
			...rest
		}, void 0, void 0, void 0, 4)}/>`);
		bind_props($$props, { checked });
	});
}
export { Checkbox as t };

//# sourceMappingURL=Checkbox.js.map