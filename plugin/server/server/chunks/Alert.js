import { o as derived, r as attributes, v as clsx } from "./server2.js";
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
export { STATUS_CLASSES_BORDERLESS as i, NEUTRAL_CLASSES as n, STATUS_CLASSES as r, Alert as t };

//# sourceMappingURL=Alert.js.map