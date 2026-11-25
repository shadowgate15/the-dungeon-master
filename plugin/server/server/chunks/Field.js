import { _ as attr, o as derived, r as attributes, u as props_id, v as clsx, x as escape_html } from "./server2.js";
// src/lib/ui/Field.svelte
function Field($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const uid = props_id($$renderer);
		let { label, hint, error, dm = false, class: className, children, $$slots, $$events, ...rest } = $$props;
		const id = `${uid}-control`;
		const hintId = `${uid}-hint`;
		const errorId = `${uid}-error`;
		const describedby = derived(() => [hint ? hintId : void 0, error ? errorId : void 0].filter(Boolean).join(" ") || void 0);
		$$renderer.push(`<div${attributes({
			class: clsx(["space-y-1", className]),
			...rest
		})}><div class="flex items-baseline gap-2"><label${attr("for", id)} class="block text-sm font-medium text-text">${escape_html(label)}</label> `);
		if (dm) $$renderer.push(`<!--[0--><span class="text-xs text-accent" title="Set by the DM; edit it to make it yours">✎ DM</span>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
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
export { Field as t };

//# sourceMappingURL=Field.js.map