import { ft as resolve } from "../../../chunks/internal.js";
import { _ as attr, a as bind_props, c as ensure_array_like, o as derived, p as stringify, r as attributes, t as attr_class, v as clsx, x as escape_html } from "../../../chunks/server2.js";
import { t as page } from "../../../chunks/state.js";
import { i as replaceState } from "../../../chunks/navigation.js";
import "../../../chunks/paths.js";
import { n as Badge, r as createSessionsQuery, t as DmBadge } from "../../../chunks/DmBadge.js";
import { t as Link } from "../../../chunks/Link.js";
import "../../../chunks/forms.js";
import { i as STATUS_CLASSES, n as Alert, r as NEUTRAL_CLASSES, t as Button } from "../../../chunks/Button.js";
import { t as Dialog } from "../../../chunks/Dialog.js";
import { t as Field } from "../../../chunks/Field.js";
import { t as TextInput } from "../../../chunks/TextInput.js";
// src/lib/ui/SegmentedNav.svelte
function SegmentedNav($$renderer, $$props) {
	/** Accessible name of the navigation. */
	let { label, items, class: className, $$slots, $$events, ...rest } = $$props;
	$$renderer.push(`<nav${attributes({
		"aria-label": label,
		class: clsx(["inline-flex rounded-control border border-control-border", className]),
		...rest
	})}><!--[-->`);
	const each_array = ensure_array_like(items);
	for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
		let item = each_array[$$index];
		$$renderer.push(`<a${attr("href", item.href)}${attr("aria-current", item.current ? "page" : void 0)}${attr_class(clsx([
			"px-3 py-1.5 text-sm font-medium no-underline first:rounded-l-[calc(var(--radius-control)-1px)] last:rounded-r-[calc(var(--radius-control)-1px)]",
			"focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
			item.current ? "bg-primary text-on-primary" : "bg-raised text-text hover:bg-surface"
		]))}>${escape_html(item.label)}</a>`);
	}
	$$renderer.push(`<!--]--></nav>`);
}
// src/lib/ui/Table.svelte
function Table($$renderer, $$props) {
	/** Shown below the table; pass it only when there are no rows. */
	let { class: className, children, empty, $$slots, $$events, ...rest } = $$props;
	$$renderer.push(`<div class="overflow-x-auto rounded-panel border border-border bg-surface shadow-raised"><table${attributes({
		class: clsx(["w-full border-collapse text-left text-sm text-text", className]),
		...rest
	})}>`);
	children?.($$renderer);
	$$renderer.push(`<!----></table> `);
	if (empty) {
		$$renderer.push(`<!--[0--><div class="p-6 text-center text-muted">`);
		empty($$renderer);
		$$renderer.push(`<!----></div>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></div>`);
}
// src/lib/campaign/CampaignTable.svelte
function CampaignTable($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The ids of the Campaigns with a DM at the table. */
		/** Per-row controls for the Actions column. */
		let { campaigns, view, activeCount, archivedCount, attached = [], actions } = $$props;
		const day = (ms) => new Date(ms).toISOString().slice(0, 10);
		$$renderer.push(`<div class="space-y-4">`);
		SegmentedNav($$renderer, {
			label: "Campaign view",
			items: [{
				href: resolve("/campaigns"),
				label: `Active ${activeCount}`,
				current: view === "active"
			}, {
				href: `${resolve("/campaigns")}?view=archived`,
				label: `Archived ${archivedCount}`,
				current: view === "archived"
			}]
		});
		$$renderer.push(`<!----> `);
		Table($$renderer, {
			children: ($$renderer) => {
				$$renderer.push(`<thead class="border-b border-border text-xs text-muted uppercase"><tr><th class="p-2">Name</th><th class="p-2">Tone</th><th class="p-2">Length</th><th class="p-2">Updated</th><th class="p-2"><span class="sr-only">Actions</span></th></tr></thead> <tbody>`);
				const each_array = ensure_array_like(campaigns);
				if (each_array.length !== 0) {
					$$renderer.push("<!--[-->");
					for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
						let campaign = each_array[$$index];
						$$renderer.push(`<tr class="border-b border-border align-top"><td class="max-w-xs p-2">`);
						if (campaign.status === "missing") {
							$$renderer.push(`<!--[0--><span class="font-medium">${escape_html(campaign.name)}</span> `);
							Badge($$renderer, {
								variant: "warning",
								size: "sm",
								children: ($$renderer) => {
									$$renderer.push(`<!---->Missing`);
								},
								$$slots: { default: true }
							});
							$$renderer.push(`<!----> <p class="truncate text-xs text-muted"${attr("title", campaign.path)}>Not found at ${escape_html(campaign.path)}</p>`);
						} else {
							$$renderer.push("<!--[-1-->");
							Link($$renderer, {
								href: resolve("/campaigns/[id]", { id: campaign.id }),
								class: "font-medium text-text",
								children: ($$renderer) => {
									$$renderer.push(`<!---->${escape_html(campaign.name)}`);
								},
								$$slots: { default: true }
							});
							$$renderer.push(`<!----> `);
							DmBadge($$renderer, {
								attached: attached.includes(campaign.id),
								size: "sm"
							});
							$$renderer.push(`<!----> <p class="truncate text-xs text-muted"${attr("title", campaign.premise ?? void 0)}>${escape_html(campaign.premise ?? "")}</p>`);
						}
						$$renderer.push(`<!--]--></td><td class="p-2">${escape_html(campaign.tone ?? "")}</td><td class="p-2">${escape_html(campaign.length ?? "")}</td><td class="p-2 whitespace-nowrap text-muted">${escape_html(campaign.updatedAt === null ? "" : day(campaign.updatedAt))}</td><td class="p-2 text-right">`);
						actions?.($$renderer, campaign);
						$$renderer.push(`<!----></td></tr>`);
					}
				} else $$renderer.push(`<!--[!--><tr><td colspan="5" class="p-8 text-center text-muted">${escape_html(view === "archived" ? "No archived Campaigns." : "No Campaigns yet.")}</td></tr>`);
				$$renderer.push(`<!--]--></tbody>`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></div>`);
	});
}
// src/lib/campaign/NewCampaignDialog.svelte
function NewCampaignDialog($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The default root new Campaign folders go under. */
		/** Values to show on open: a failed no-JS submit. */
		/** Error from the last create attempt, shown inline. */
		/** Render open (server render of `?new`, or a failed create). */
		/** Called after the dialog closes. */
		let { root, initial = {}, error, open = false, onclose } = $$props;
		let name = initial.name ?? "";
		let customFolder = initial.folder;
		let isOpen = open;
		/** A folder name from the Campaign name: lowercase words joined by dashes. */
		const slug = (text) => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
		const separator = derived(() => root.includes("\\") && !root.includes("/") ? "\\" : "/");
		const suggested = derived(() => `${root.replace(/[\\/]+$/, "")}${separator()}${slug(name)}`);
		const folder = derived(() => customFolder ?? suggested());
		/** Opens the modal with a fresh form. */
		function show() {
			name = "";
			customFolder = void 0;
			isOpen = true;
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			Dialog($$renderer, {
				title: "New Campaign",
				closeHref: resolve("/campaigns"),
				onclose,
				get open() {
					return isOpen;
				},
				set open($$value) {
					isOpen = $$value;
					$$settled = false;
				},
				children: ($$renderer) => {
					$$renderer.push(`<form method="POST" action="?/createCampaign" class="space-y-3">`);
					{
						function children($$renderer, id, describedby) {
							TextInput($$renderer, {
								id,
								name: "name",
								"aria-describedby": describedby,
								get value() {
									return name;
								},
								set value($$value) {
									name = $$value;
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
							TextInput($$renderer, {
								id,
								name: "folder",
								"aria-describedby": describedby,
								value: folder(),
								oninput: (e) => customFolder = e.currentTarget.value
							});
						}
						Field($$renderer, {
							label: "Folder",
							hint: "The Campaign lives in this folder. You can commit it with git.",
							children,
							$$slots: { default: true }
						});
					}
					$$renderer.push(`<!----> `);
					if (error) {
						$$renderer.push("<!--[0-->");
						Alert($$renderer, {
							variant: "danger",
							children: ($$renderer) => {
								$$renderer.push(`<!---->${escape_html(error)}`);
							},
							$$slots: { default: true }
						});
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					Button($$renderer, {
						type: "submit",
						disabled: name.trim() === "" || folder().trim() === "",
						children: ($$renderer) => {
							$$renderer.push(`<!---->Create Campaign`);
						},
						$$slots: { default: true }
					});
					$$renderer.push(`<!----></form>`);
				},
				$$slots: { default: true }
			});
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
		bind_props($$props, { show });
	});
}
// src/lib/ui/Toast.svelte
function Toast($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Shows a dismiss button when given. */
		let { tone = "neutral", onclose, class: className, children, $$slots, $$events, ...rest } = $$props;
		const tones = {
			neutral: NEUTRAL_CLASSES,
			...STATUS_CLASSES
		};
		$$renderer.push(`<div${attributes({
			role: "status",
			class: clsx([
				"fixed right-4 bottom-4 z-40 flex items-center gap-3 rounded-control border px-4 py-2 text-sm shadow-overlay",
				tones[tone],
				className
			]),
			...rest
		})}>`);
		children?.($$renderer);
		$$renderer.push(`<!----> `);
		if (onclose) {
			$$renderer.push("<!--[0-->");
			Button($$renderer, {
				variant: "ghost",
				size: "sm",
				type: "button",
				"aria-label": "Dismiss",
				onclick: () => onclose(),
				children: ($$renderer) => {
					$$renderer.push(`<!---->✕`);
				},
				$$slots: { default: true }
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
// src/lib/campaign/ActionToast.svelte
function ActionToast($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { notice, view = "active" } = $$props;
		let dismissed = void 0;
		if (notice && notice !== dismissed) {
			$$renderer.push("<!--[0-->");
			Toast($$renderer, {
				onclose: () => dismissed = notice,
				children: ($$renderer) => {
					$$renderer.push(`<span>${escape_html(notice.message)}</span> `);
					if (notice.undo) {
						$$renderer.push(`<!--[0--><form method="POST"${attr("action", `?/${stringify(notice.undo.action)}${view === "archived" ? "&view=archived" : ""}`)}><!--[-->`);
						const each_array = ensure_array_like(notice.undo.ids);
						for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
							let id = each_array[$$index];
							$$renderer.push(`<input type="hidden" name="id"${attr("value", id)}/>`);
						}
						$$renderer.push(`<!--]--> `);
						Button($$renderer, {
							type: "submit",
							variant: "secondary",
							size: "sm",
							children: ($$renderer) => {
								$$renderer.push(`<!---->Undo`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----></form>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				},
				$$slots: { default: true }
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
// src/routes/campaigns/+page.svelte
function idField($$renderer, campaign) {
	$$renderer.push(`<input type="hidden" name="id"${attr("value", campaign.id)}/>`);
}
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data, form } = $$props;
		const sessions = createSessionsQuery(() => data.attached);
		/** The row whose Delete or Re-add is open, if any. */
		let confirming = null;
		const actionUrl = (name) => `?/${name}${data.view === "archived" ? "&view=archived" : ""}`;
		const createFailed = derived(() => form !== null && form !== void 0 && "error" in form);
		const serverOpen = derived(() => page.url.searchParams.has("new") || createFailed());
		const failedValues = derived(() => createFailed() && form && "name" in form ? {
			name: String(form.name ?? ""),
			folder: String(form.folder ?? "")
		} : {});
		function removeButton($$renderer, campaign) {
			$$renderer.push(`<form method="POST"${attr("action", actionUrl("unregister"))} class="inline">`);
			idField($$renderer, campaign);
			$$renderer.push(`<!----> `);
			Button($$renderer, {
				type: "submit",
				variant: "ghost",
				size: "sm",
				children: ($$renderer) => {
					$$renderer.push(`<!---->Remove from library`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----></form>`);
		}
		function rowActions($$renderer, campaign) {
			if (confirming?.id === campaign.id && confirming.what === "delete") {
				$$renderer.push(`<!--[0--><form method="POST"${attr("action", actionUrl("delete"))} class="inline">`);
				idField($$renderer, campaign);
				$$renderer.push(`<!----> <span class="text-xs">Delete forever?</span> `);
				Button($$renderer, {
					type: "submit",
					variant: "danger",
					size: "sm",
					children: ($$renderer) => {
						$$renderer.push(`<!---->Confirm delete`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> `);
				Button($$renderer, {
					type: "button",
					variant: "ghost",
					size: "sm",
					onclick: () => confirming = null,
					children: ($$renderer) => {
						$$renderer.push(`<!---->Cancel`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----></form>`);
			} else if (campaign.status === "missing" && confirming?.id === campaign.id && confirming.what === "readd") {
				$$renderer.push(`<!--[1--><form method="POST"${attr("action", actionUrl("register"))} class="flex items-center justify-end gap-2">`);
				TextInput($$renderer, {
					name: "folder",
					size: "sm",
					"aria-label": "Campaign folder",
					value: campaign.path,
					class: "min-w-64"
				});
				$$renderer.push(`<!----> `);
				Button($$renderer, {
					type: "submit",
					variant: "secondary",
					size: "sm",
					children: ($$renderer) => {
						$$renderer.push(`<!---->Add`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> `);
				Button($$renderer, {
					type: "button",
					variant: "ghost",
					size: "sm",
					onclick: () => confirming = null,
					children: ($$renderer) => {
						$$renderer.push(`<!---->Cancel`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----></form>`);
			} else if (campaign.status === "missing") {
				$$renderer.push("<!--[2-->");
				Button($$renderer, {
					type: "button",
					variant: "ghost",
					size: "sm",
					onclick: () => confirming = {
						id: campaign.id,
						what: "readd"
					},
					children: ($$renderer) => {
						$$renderer.push(`<!---->Re-add`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----> `);
				removeButton($$renderer, campaign);
				$$renderer.push(`<!---->`);
			} else {
				$$renderer.push(`<!--[-1--><form method="POST"${attr("action", actionUrl(campaign.status === "active" ? "archive" : "restore"))} class="inline">`);
				idField($$renderer, campaign);
				$$renderer.push(`<!----> `);
				Button($$renderer, {
					type: "submit",
					variant: "ghost",
					size: "sm",
					children: ($$renderer) => {
						$$renderer.push(`<!---->${escape_html(campaign.status === "active" ? "Archive" : "Restore")}`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!----></form> `);
				removeButton($$renderer, campaign);
				$$renderer.push(`<!----> `);
				Button($$renderer, {
					type: "button",
					variant: "ghost",
					size: "sm",
					class: "text-danger",
					onclick: () => confirming = {
						id: campaign.id,
						what: "delete"
					},
					children: ($$renderer) => {
						$$renderer.push(`<!---->Delete`);
					},
					$$slots: { default: true }
				});
				$$renderer.push(`<!---->`);
			}
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<main class="mx-auto max-w-6xl space-y-4 p-6"><div class="flex items-center justify-between"><h1 class="font-display text-2xl">Campaigns</h1> `);
		Button($$renderer, {
			href: `${stringify(resolve("/campaigns"))}?new`,
			onclick: (e) => {
				e.preventDefault();
			},
			children: ($$renderer) => {
				$$renderer.push(`<!---->New Campaign`);
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----></div> `);
		CampaignTable($$renderer, {
			campaigns: data.campaigns,
			view: data.view,
			activeCount: data.activeCount,
			archivedCount: data.archivedCount,
			attached: sessions.data,
			actions: rowActions
		});
		$$renderer.push(`<!----></main> `);
		ActionToast($$renderer, {
			notice: form && "notice" in form ? form.notice : void 0,
			view: data.view
		});
		$$renderer.push(`<!----> `);
		NewCampaignDialog($$renderer, {
			root: data.campaignRoot,
			initial: failedValues(),
			error: createFailed() && form && "error" in form ? form.error : void 0,
			open: serverOpen(),
			onclose: () => {
				if (page.url.searchParams.has("new")) replaceState(resolve("/campaigns"), {});
			}
		});
		$$renderer.push(`<!---->`);
	});
}
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map