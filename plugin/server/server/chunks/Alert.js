import { o as derived, r as attributes, y as clsx } from "./server2.js";
import { r as STATUS_CLASSES } from "./Button.js";
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
export { Alert as t };

//# sourceMappingURL=Alert.js.map