import { a as derived, g as clsx, h as attr, l as props_id, n as attributes, v as escape_html } from "./server2.js";
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
// src/lib/ui/Field.svelte
function Field($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const uid = props_id($$renderer);
		let { label, hint, error, class: className, children, $$slots, $$events, ...rest } = $$props;
		const id = `${uid}-control`;
		const hintId = `${uid}-hint`;
		const errorId = `${uid}-error`;
		const describedby = derived(() => [hint ? hintId : void 0, error ? errorId : void 0].filter(Boolean).join(" ") || void 0);
		$$renderer.push(`<div${attributes({
			class: clsx(["space-y-1", className]),
			...rest
		})}><label${attr("for", id)} class="block text-sm font-medium text-text">${escape_html(label)}</label> `);
		children($$renderer, id, describedby());
		$$renderer.push(`<!----> `);
		if (hint) $$renderer.push(`<!--[0--><p${attr("id", hintId)} class="text-sm text-muted">${escape_html(hint)}</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (error) $$renderer.push(`<!--[0--><p${attr("id", errorId)} role="alert" class="text-sm font-medium text-danger">${escape_html(error)}</p>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
export { NEUTRAL_CLASSES as a, Link as i, Button as n, STATUS_CLASSES as o, Alert as r, STATUS_CLASSES_BORDERLESS as s, Field as t };

//# sourceMappingURL=Field.js.map