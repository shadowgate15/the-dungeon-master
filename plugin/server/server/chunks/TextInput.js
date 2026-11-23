import { g as clsx, i as bind_props, n as attributes } from "./server2.js";
import { a as NEUTRAL_CLASSES, s as STATUS_CLASSES_BORDERLESS } from "./Field.js";
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
export { Badge as n, TextInput as t };

//# sourceMappingURL=TextInput.js.map