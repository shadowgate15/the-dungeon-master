import { S as escape_html, c as ensure_array_like, l as head, v as attr } from "../../../chunks/server2.js";
// src/routes/credits/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		head("l7qr1t", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>Credits</title>`);
			});
		});
		$$renderer.push(`<main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8"><h1 class="text-2xl font-semibold">Credits</h1> <section class="flex flex-col gap-2"><h2 class="text-lg font-semibold">D&amp;D 5e System Reference Document</h2> <p data-testid="srd-attribution">${escape_html(data.attribution)}</p></section> <section class="flex flex-col gap-2"><h2 class="text-lg font-semibold">Rules data</h2> `);
		if (data.dataset) {
			$$renderer.push(`<!--[0--><p data-testid="dataset-version">Rules data version ${escape_html(data.dataset.version)} (SRD ${escape_html(data.dataset.srdVersion)}), from <a class="underline"${attr("href", data.dataset.repository)}>${escape_html(data.dataset.repository)}</a> at tag ${escape_html(data.dataset.tag)}.</p> <p>It includes these SRD ${escape_html(data.dataset.srdVersion)} materials:</p> <ul class="list-inside list-disc" data-testid="dataset-contents"><!--[-->`);
			const each_array = ensure_array_like(data.dataset.contents);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let kind = each_array[$$index];
				$$renderer.push(`<li>${escape_html(kind.name)} (${escape_html(kind.count)})</li>`);
			}
			$$renderer.push(`<!--]--></ul>`);
		} else $$renderer.push(`<!--[-1--><p>The rules data has not been loaded.</p>`);
		$$renderer.push(`<!--]--> <details><summary class="cursor-pointer">MIT licence of the rules data</summary> <pre class="mt-2 text-sm whitespace-pre-wrap">${escape_html(data.mitNotice)}</pre></details></section></main>`);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map