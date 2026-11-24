import { _ as clsx, r as attributes } from "./server2.js";
import { a as STATUS_CLASSES_BORDERLESS, r as NEUTRAL_CLASSES } from "./Button.js";
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
export { Badge as t };

//# sourceMappingURL=Badge.js.map