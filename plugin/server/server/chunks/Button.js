import { o as derived, r as attributes, v as clsx } from "./server2.js";
// src/lib/ui/Button.svelte
function Button($$renderer, $$props) {
	let { variant = "primary", size = "md", href, class: className, children, $$slots, $$events, ...rest } = $$props;
	const variants = {
		primary: "bg-primary text-on-primary border-transparent hover:opacity-90",
		secondary: "bg-raised text-text border-control-border hover:bg-surface",
		danger: "bg-danger text-danger-bg border-transparent hover:opacity-90",
		ghost: "bg-transparent text-text border-transparent hover:bg-raised"
	};
	const sizes = {
		sm: "px-2.5 py-1 text-sm",
		md: "px-4 py-2 text-base"
	};
	const classes = derived(() => [
		"inline-flex items-center justify-center gap-2 rounded-control border font-medium no-underline",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
		"disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
		variants[variant],
		sizes[size],
		className
	]);
	if (href !== void 0) {
		$$renderer.push(`<!--[0--><a${attributes({
			href,
			class: clsx(classes()),
			...rest
		})}>`);
		children?.($$renderer);
		$$renderer.push(`<!----></a>`);
	} else {
		$$renderer.push(`<!--[-1--><button${attributes({
			class: clsx(classes()),
			...rest
		})}>`);
		children?.($$renderer);
		$$renderer.push(`<!----></button>`);
	}
	$$renderer.push(`<!--]-->`);
}
export { Button as t };

//# sourceMappingURL=Button.js.map