import { _ as clsx, a as bind_props, r as attributes, y as escape_html } from "./server2.js";
// src/lib/ui/Textarea.svelte
function Textarea($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { value = void 0, size = "md", class: className, $$slots, $$events, ...rest } = $$props;
		$$renderer.push(`<textarea${attributes({
			class: clsx([
				"block w-full rounded-control border border-control-border bg-raised text-text placeholder:text-muted",
				"focus:border-control-border focus:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
				"disabled:cursor-not-allowed disabled:opacity-50",
				size === "sm" ? "px-2 py-1 text-sm" : "px-3 py-2 text-base",
				className
			]),
			...rest
		})}>`);
		const $$body = escape_html(value);
		if ($$body) $$renderer.push(`${$$body}`);
		$$renderer.push(`</textarea>`);
		bind_props($$props, { value });
	});
}
export { Textarea as t };

//# sourceMappingURL=Textarea.js.map