import { r as attributes, y as clsx } from "./server2.js";
// src/lib/ui/Link.svelte
function Link($$renderer, $$props) {
	let { class: className, children, $$slots, $$events, ...rest } = $$props;
	$$renderer.push(`<a${attributes({
		class: clsx([
			"rounded-sm text-accent underline underline-offset-2 hover:no-underline",
			"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
			className
		]),
		...rest
	})}>`);
	children?.($$renderer);
	$$renderer.push(`<!----></a>`);
}
export { Link as t };

//# sourceMappingURL=Link.js.map