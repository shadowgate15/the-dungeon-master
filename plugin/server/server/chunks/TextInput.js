import { a as bind_props, r as attributes, v as clsx } from "./server2.js";
// src/lib/ui/TextInput.svelte
function TextInput($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { value = void 0, size = "md", class: className, $$slots, $$events, ...rest } = $$props;
		$$renderer.push(`<input${attributes({
			value,
			class: clsx([
				"block w-full rounded-control border border-control-border bg-raised text-text placeholder:text-muted",
				"focus:border-control-border focus:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
				"disabled:cursor-not-allowed disabled:opacity-50",
				size === "sm" ? "px-2 py-1 text-sm" : "px-3 py-2 text-base",
				className
			]),
			...rest
		}, void 0, void 0, void 0, 4)}/>`);
		bind_props($$props, { value });
	});
}
export { TextInput as t };

//# sourceMappingURL=TextInput.js.map