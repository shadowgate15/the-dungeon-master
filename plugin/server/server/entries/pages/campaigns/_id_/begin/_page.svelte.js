import { ft as resolve } from "../../../../../chunks/internal.js";
import { l as head, o as derived, x as escape_html } from "../../../../../chunks/server2.js";
import "../../../../../chunks/forms.js";
import "../../../../../chunks/paths.js";
import { a as CreationStepper, i as Panel, t as CreationPage } from "../../../../../chunks/CreationPage.js";
import { r as createSessionsQuery, t as DmBadge } from "../../../../../chunks/DmBadge.js";
import { h as Journal, o as createJournalQuery, u as createTimelineQuery } from "../../../../../chunks/floor-client.js";
import { t as Alert } from "../../../../../chunks/Alert.js";
import { t as Button } from "../../../../../chunks/Button.js";
import { t as Link } from "../../../../../chunks/Link.js";
// src/routes/campaigns/[id]/begin/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data, form } = $$props;
		const sessions = createSessionsQuery(() => data.attached);
		const journal = createJournalQuery(() => data.campaign.id, () => data.journal);
		const timeline = createTimelineQuery(() => data.campaign.id, () => data.timeline);
		const archived = derived(() => data.campaign.status === "archived");
		const attached = derived(() => sessions.data.includes(data.campaign.id));
		const state = derived(() => data.creation.state);
		const begun = derived(() => state() === "begun");
		const playing = derived(() => timeline.data.entries.some((e) => e.type === "narration"));
		const seedHref = derived(() => resolve("/campaigns/[id]", { id: data.campaign.id }));
		const partyHref = derived(() => resolve("/campaigns/[id]/party", { id: data.campaign.id }));
		const playHref = derived(() => resolve("/campaigns/[id]/play", { id: data.campaign.id }));
		const beginHref = derived(() => resolve("/campaigns/[id]/begin", { id: data.campaign.id }));
		head("19s1zi6", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>${escape_html(data.campaign.name)} · Begin</title>`);
			});
		});
		CreationPage($$renderer, {
			width: "narrow",
			pane: {
				campaign: data.campaign.id,
				folder: data.campaign.path,
				attached: attached(),
				messages: data.conversation,
				disabled: archived()
			},
			children: ($$renderer) => {
				Link($$renderer, {
					href: resolve("/campaigns"),
					class: "text-sm",
					children: ($$renderer) => {
						$$renderer.push(`<!---->All Campaigns`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> <header class="space-y-1"><div class="flex items-center gap-3"><h1 class="font-display text-2xl">${escape_html(data.campaign.name)}</h1> `);
				DmBadge($$renderer, { attached: attached() });
				$$renderer.push(`<!----> `);
				Link($$renderer, {
					href: playHref(),
					class: "ml-auto text-sm",
					children: ($$renderer) => {
						$$renderer.push(`<!---->Play console`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----></div> <p class="text-xs text-muted">${escape_html(data.campaign.path)}</p></header> `);
				CreationStepper($$renderer, {
					current: "Begin",
					hrefs: {
						Seed: seedHref(),
						Party: partyHref(),
						Begin: beginHref()
					}
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
					title: "Begin",
					children: ($$renderer) => {
						$$renderer.push(`<div class="space-y-3 text-sm"><p>Begin starts the story. The DM builds the World and the story's plan from your Seed and your
        Characters' backstories. You see only a short, spoiler-free pitch: what your Characters know
        as the story opens. Then play opens.</p> <p>Once you Begin, the Seed is locked, so the World stays true to it. If you don't like the
        pitch, Start over throws the World and the plan away and unlocks the Seed. You can Start
        over until the DM's first Narration of play.</p></div>`);
					},
					$$slots: { default: true }
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
				if (!begun()) {
					$$renderer.push(`<!--[0--><div class="space-y-2">`);
					if (state() === "seed_incomplete") {
						$$renderer.push(`<!--[0--><p class="text-sm text-muted">Complete the `);
						Link($$renderer, {
							href: seedHref(),
							children: ($$renderer) => {
								$$renderer.push(`<!---->Seed`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----> first: ${escape_html(data.creation.missing.join(", "))}.</p>`);
					} else if (state() === "party_empty") {
						$$renderer.push(`<!--[1--><p class="text-sm text-muted">Save at least one Character to the `);
						Link($$renderer, {
							href: partyHref(),
							children: ($$renderer) => {
								$$renderer.push(`<!---->Party`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----> first.</p>`);
					} else if (!attached()) $$renderer.push(`<!--[2--><p class="text-sm text-muted">The DM is away. Run <code>dm</code> in ${escape_html(data.campaign.path)} to Begin.</p>`);
					else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <form method="POST" action="?/begin">`);
					Button($$renderer, {
						type: "submit",
						disabled: state() !== "ready" || !attached() || archived(),
						children: ($$renderer) => {
							$$renderer.push(`<!---->Begin`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----></form></div>`);
				} else {
					$$renderer.push("<!--[-1-->");
					Panel($$renderer, {
						title: "The pitch",
						children: ($$renderer) => {
							if (journal.data.entries.length === 0) $$renderer.push(`<!--[0--><p class="text-sm text-muted" role="status">The DM is building the World…</p>`);
							else {
								$$renderer.push("<!--[-1-->");
								Journal($$renderer, { entries: journal.data.entries });
							}
							$$renderer.push(`<!--]-->`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----> <div class="flex items-center gap-3">`);
					if (playing()) {
						$$renderer.push("<!--[0-->");
						Link($$renderer, {
							href: playHref(),
							children: ($$renderer) => {
								$$renderer.push(`<!---->Play has opened: go to the play console`);
							},
							$$slots: { default: true }
						});
					} else if (!archived()) {
						$$renderer.push(`<!--[1--><form method="POST" action="?/startOver">`);
						Button($$renderer, {
							type: "submit",
							variant: "secondary",
							children: ($$renderer) => {
								$$renderer.push(`<!---->Start over`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----></form>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></div>`);
				}
				$$renderer.push(`<!--]-->`);
			},
			$$slots: { default: true }
		});
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map