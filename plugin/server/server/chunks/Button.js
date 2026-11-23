import { _ as clsx, o as derived, r as attributes } from "./server2.js";
// src/lib/ui/status.ts
/** Status colour classes shared by Alert, Toast and Badge. */
var STATUS_CLASSES = {
	info: "bg-info-bg text-info border-info",
	success: "bg-success-bg text-success border-success",
	warning: "bg-warning-bg text-warning border-warning",
	danger: "bg-danger-bg text-danger border-danger"
};
/** Same colours with the border dropped, for compact pills. */
var STATUS_CLASSES_BORDERLESS = {
	info: "bg-info-bg text-info border-transparent",
	success: "bg-success-bg text-success border-transparent",
	warning: "bg-warning-bg text-warning border-transparent",
	danger: "bg-danger-bg text-danger border-transparent"
};
var NEUTRAL_CLASSES = "bg-raised text-text border-border";
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
// src/lib/ui/Alert.svelte
function Alert($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { variant = "info", class: className, children, $$slots, $$events, ...rest } = $$props;
		const role = derived(() => variant === "danger" || variant === "warning" ? "alert" : "status");
		$$renderer.push(`<div${attributes({
			role: role(),
			class: clsx([
				"rounded-control border px-3 py-2 text-sm",
				STATUS_CLASSES[variant],
				className
			]),
			...rest
		})}>`);
		children?.($$renderer);
		$$renderer.push(`<!----></div>`);
	});
}
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
export { STATUS_CLASSES as a, NEUTRAL_CLASSES as i, Alert as n, STATUS_CLASSES_BORDERLESS as o, Link as r, Button as t };

//# sourceMappingURL=Button.js.map