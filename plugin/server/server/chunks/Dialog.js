import { g as clsx, i as bind_props, n as attributes, v as escape_html } from "./server2.js";
import "./index-server.js";
import { n as Button } from "./Field.js";
// src/lib/ui/Dialog.svelte
function Dialog($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Accessible name and visible heading. */
		/** Where the close link goes when JavaScript is unavailable. */
		/** Sits beside the Close link, e.g. a status chip. */
		let { open = false, title, closeHref, onclose, headerExtra, class: className, children, $$slots, $$events, ...rest } = $$props;
		const serverOpen = open;
		$$renderer.push(`<dialog${attributes({
			open: serverOpen,
			"aria-label": title,
			class: clsx(["m-auto w-[min(72rem,calc(100vw-2rem))] rounded-panel border border-border bg-surface p-6 text-text shadow-overlay backdrop:bg-black/50", className]),
			...rest
		})}><div class="mb-4 flex items-center justify-between"><h2 class="font-display text-xl">${escape_html(title)}</h2> <div class="flex items-center gap-3">`);
		headerExtra?.($$renderer);
		$$renderer.push(`<!----> `);
		Button($$renderer, {
			variant: "ghost",
			size: "sm",
			href: closeHref,
			class: "underline",
			onclick: (e) => {
				e.preventDefault();
			},
			children: ($$renderer) => {
				$$renderer.push(`<!---->Close`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></div></div> `);
		children?.($$renderer);
		$$renderer.push(`<!----></dialog>`);
		bind_props($$props, { open });
	});
}
export { Dialog as t };

//# sourceMappingURL=Dialog.js.map