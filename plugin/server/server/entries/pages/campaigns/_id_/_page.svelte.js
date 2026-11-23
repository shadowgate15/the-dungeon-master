import { ft as resolve } from "../../../../chunks/internal.js";
import { _ as clsx, a as bind_props, c as ensure_array_like, l as head, o as derived, t as attr_class, y as escape_html } from "../../../../chunks/server2.js";
import "../../../../chunks/forms.js";
import "../../../../chunks/paths2.js";
import { a as SCALES, n as LENGTHS, o as TECH_LEVELS, r as MAGIC_LEVELS, s as TONES, t as GENRE_FLAVORS } from "../../../../chunks/enums.js";
import { n as Alert, r as Link, t as Button } from "../../../../chunks/Button.js";
import { t as Field } from "../../../../chunks/Field.js";
import { n as CreationStepper, r as Select, t as Panel } from "../../../../chunks/Panel.js";
import { t as Textarea } from "../../../../chunks/Textarea.js";
import { t as TextInput } from "../../../../chunks/TextInput.js";
import { a as missingSeedFields, i as emptyCampaignSeed } from "../../../../chunks/seed.js";
import { n as createSessionsQuery, t as DmBadge } from "../../../../chunks/DmBadge.js";
// src/lib/campaign/CampaignSeedCard.svelte
function CampaignSeedCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The live card. Inputs are named after the Seed fields for form posts. */
		/** Read-only: every field is disabled. */
		let { seed = void 0, disabled = false } = $$props;
		const required = [{
			name: "tone",
			label: "Tone",
			options: TONES
		}, {
			name: "length",
			label: "Length",
			options: LENGTHS
		}];
		const world = [
			{
				name: "genreFlavor",
				label: "Genre flavor",
				options: GENRE_FLAVORS
			},
			{
				name: "scale",
				label: "Scale",
				options: SCALES
			},
			{
				name: "magicLevel",
				label: "Magic level",
				options: MAGIC_LEVELS
			},
			{
				name: "techLevel",
				label: "Tech level",
				options: TECH_LEVELS
			}
		];
		const LABELS = {
			name: "Name",
			premise: "Premise",
			tone: "Tone",
			length: "Length"
		};
		const missing = derived(() => missingSeedFields(seed).map((f) => LABELS[f]));
		const list = (items) => items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
		function picker($$renderer, p, empty) {
			{
				function children($$renderer, id, describedby) {
					Select($$renderer, {
						id,
						name: p.name,
						disabled,
						"aria-describedby": describedby,
						get value() {
							return seed[p.name];
						},
						set value($$value) {
							seed[p.name] = $$value;
							$$settled = false;
						},
						children: ($$renderer) => {
							$$renderer.option({ value: "" }, ($$renderer) => {
								$$renderer.push(`${escape_html(empty)}`);
							});
							$$renderer.push(` <!--[-->`);
							const each_array = ensure_array_like(p.options);
							for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
								let option = each_array[$$index];
								$$renderer.option({ value: option }, ($$renderer) => {
									$$renderer.push(`${escape_html(option)}`);
								});
							}
							$$renderer.push(`<!--]-->`);
						},
						$$slots: { default: true }
					});
				}
				Field($$renderer, {
					label: p.label,
					children,
					$$slots: { default: true }
				});
			}
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="space-y-3">`);
			{
				function children($$renderer, id, describedby) {
					TextInput($$renderer, {
						id,
						name: "name",
						disabled,
						"aria-describedby": describedby,
						get value() {
							return seed.name;
						},
						set value($$value) {
							seed.name = $$value;
							$$settled = false;
						}
					});
				}
				Field($$renderer, {
					label: "Name",
					children,
					$$slots: { default: true }
				});
			}
			$$renderer.push(`<!----> `);
			{
				function children($$renderer, id, describedby) {
					Textarea($$renderer, {
						id,
						name: "premise",
						rows: 4,
						disabled,
						"aria-describedby": describedby,
						get value() {
							return seed.premise;
						},
						set value($$value) {
							seed.premise = $$value;
							$$settled = false;
						}
					});
				}
				Field($$renderer, {
					label: "Premise",
					children,
					$$slots: { default: true }
				});
			}
			$$renderer.push(`<!----> `);
			if (seed.premise.length > 500) {
				$$renderer.push("<!--[0-->");
				Alert($$renderer, {
					variant: "warning",
					children: ($$renderer) => {
						$$renderer.push(`<!---->Premise is long (${escape_html(seed.premise.length)} of about ${escape_html(500)} characters). You can still save
      it.`);
					},
					$$slots: { default: true }
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="grid grid-cols-2 gap-3"><!--[-->`);
			const each_array_1 = ensure_array_like(required);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let p = each_array_1[$$index_1];
				picker($$renderer, p, "Choose…");
			}
			$$renderer.push(`<!--]--></div> <fieldset class="space-y-3 border-t border-border pt-3"><legend class="pr-2 text-sm text-muted">World (optional)</legend> `);
			{
				function children($$renderer, id, describedby) {
					TextInput($$renderer, {
						id,
						name: "worldName",
						disabled,
						"aria-describedby": describedby,
						get value() {
							return seed.worldName;
						},
						set value($$value) {
							seed.worldName = $$value;
							$$settled = false;
						}
					});
				}
				Field($$renderer, {
					label: "World name",
					children,
					$$slots: { default: true }
				});
			}
			$$renderer.push(`<!----> <div class="grid grid-cols-2 gap-3"><!--[-->`);
			const each_array_2 = ensure_array_like(world);
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let p = each_array_2[$$index_2];
				picker($$renderer, p, "Unspecified");
			}
			$$renderer.push(`<!--]--></div></fieldset> <p role="status"${attr_class(clsx(["text-sm", missing().length === 0 ? "text-success" : "text-muted"]))}>`);
			if (missing().length === 0) $$renderer.push(`<!--[0-->Seed complete`);
			else $$renderer.push(`<!--[-1-->Seed incomplete: still needs ${escape_html(list(missing()))}.`);
			$$renderer.push(`<!--]--></p></div>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
		bind_props($$props, { seed });
	});
}
// src/routes/campaigns/[id]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data, form } = $$props;
		const sessions = createSessionsQuery(() => data.attached);
		let seed = {
			...emptyCampaignSeed(),
			...data.seed ?? {},
			...form && "seed" in form ? form.seed : {}
		};
		const archived = derived(() => data.campaign.status === "archived");
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			head("60de30", $$renderer, ($$renderer) => {
				$$renderer.title(($$renderer) => {
					$$renderer.push(`<title>${escape_html(data.campaign.name)}</title>`);
				});
			});
			$$renderer.push(`<main class="mx-auto max-w-3xl space-y-6 p-6">`);
			Link($$renderer, {
				href: resolve("/campaigns"),
				class: "text-sm",
				children: ($$renderer) => {
					$$renderer.push(`<!---->All Campaigns`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> <header class="space-y-1"><div class="flex items-center gap-3"><h1 class="font-display text-2xl">${escape_html(data.campaign.name)}</h1> `);
			if (data.campaign.status !== "missing") {
				$$renderer.push("<!--[0-->");
				DmBadge($$renderer, { attached: sessions.data.includes(data.campaign.id) });
				$$renderer.push(`<!----> `);
				Link($$renderer, {
					href: resolve("/campaigns/[id]/play", { id: data.campaign.id }),
					class: "ml-auto text-sm",
					children: ($$renderer) => {
						$$renderer.push(`<!---->Play console`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!---->`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <p class="text-xs text-muted">${escape_html(data.campaign.path)}</p></header> `);
			if (data.campaign.status === "missing") {
				$$renderer.push("<!--[0-->");
				Alert($$renderer, {
					variant: "warning",
					children: ($$renderer) => {
						$$renderer.push(`<!---->This Campaign's folder is missing. Re-add it from the Campaign library to open it.`);
					},
					$$slots: { default: true }
				});
			} else {
				$$renderer.push("<!--[-1-->");
				CreationStepper($$renderer, {
					current: "Seed",
					hrefs: {
						Seed: resolve("/campaigns/[id]", { id: data.campaign.id }),
						Party: resolve("/campaigns/[id]/party", { id: data.campaign.id })
					},
					unavailable: ["Begin"]
				});
				$$renderer.push(`<!----> `);
				if (archived()) {
					$$renderer.push("<!--[0-->");
					Alert($$renderer, {
						variant: "warning",
						children: ($$renderer) => {
							$$renderer.push(`<!---->This Campaign is archived. Restore it to change it.`);
						},
						$$slots: { default: true }
					});
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				Panel($$renderer, {
					title: "Seed",
					children: ($$renderer) => {
						$$renderer.push(`<form method="POST" action="?/saveSeed" class="space-y-3">`);
						CampaignSeedCard($$renderer, {
							disabled: archived(),
							get seed() {
								return seed;
							},
							set seed($$value) {
								seed = $$value;
								$$settled = false;
							}
						});
						$$renderer.push(`<!----> `);
						if (form && "error" in form && form.error) {
							$$renderer.push("<!--[0-->");
							Alert($$renderer, {
								variant: "danger",
								children: ($$renderer) => {
									$$renderer.push(`<!---->${escape_html(form.error)}`);
								},
								$$slots: { default: true }
							});
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						if (!archived()) {
							$$renderer.push(`<!--[0--><div class="flex items-center gap-3">`);
							Button($$renderer, {
								type: "submit",
								children: ($$renderer) => {
									$$renderer.push(`<!---->Save Seed`);
								},
								$$slots: { default: true }
							});
							$$renderer.push(`<!----> `);
							$$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></div>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></form>`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!---->`);
			}
			$$renderer.push(`<!--]--></main>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map