import { _ as attr, a as bind_props, c as ensure_array_like, f as spread_props, r as attributes, s as element, t as attr_class, v as clsx, x as escape_html } from "./server2.js";
import { c as seedQueryKey, d as createQuery, n as conversationQueryKey, r as draftQueryKey } from "./messages.js";
import { t as useQueryClient } from "./useQueryClient.js";
import { t as Button } from "./Button.js";
import { t as Textarea } from "./Textarea.js";
// src/lib/ui/Select.svelte
function Select($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Native `<option>` elements. */
		let { value = void 0, size = "md", class: className, children, $$slots, $$events, ...rest } = $$props;
		$$renderer.select({
			value,
			class: [
				"block w-full rounded-control border border-control-border bg-raised text-text",
				"focus:border-control-border focus:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
				"disabled:cursor-not-allowed disabled:opacity-50",
				size === "sm" ? "py-1 pr-8 pl-2 text-sm" : "py-2 pr-10 pl-3 text-base",
				className
			],
			...rest
		}, ($$renderer) => {
			children?.($$renderer);
			$$renderer.push(`<!---->`);
		}, void 0, void 0, void 0, void 0, true);
		bind_props($$props, { value });
	});
}
// src/lib/campaign/CreationStepper.svelte
var CREATION_STEPS = [
	"Seed",
	"Party",
	"Begin"
];
function CreationStepper($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Already-resolved paths of the steps that can be opened. */
		/** Steps that cannot be opened yet. */
		let { current, hrefs = {}, unavailable = [] } = $$props;
		const linked = (step) => !unavailable.includes(step) ? hrefs[step] : void 0;
		$$renderer.push(`<nav aria-label="Campaign creation"><ol class="flex gap-2"><!--[-->`);
		const each_array = ensure_array_like(CREATION_STEPS);
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			let step = each_array[i];
			const href = linked(step);
			const classes = [
				"flex items-center gap-2 rounded-control border px-3 py-1.5 text-sm",
				current === step ? "border-primary bg-raised font-semibold" : "border-border text-muted",
				unavailable.includes(step) && "opacity-50",
				href && "hover:border-primary"
			];
			$$renderer.push(`<li>`);
			if (href) $$renderer.push(`<!--[0--><a${attr("href", href)}${attr_class(clsx(classes))}${attr("aria-current", current === step ? "step" : void 0)}><span aria-hidden="true">${escape_html(i + 1)}.</span> ${escape_html(step)}</a>`);
			else {
				$$renderer.push(`<!--[-1--><span${attr_class(clsx(classes))}${attr("aria-current", current === step ? "step" : void 0)}><span aria-hidden="true">${escape_html(i + 1)}.</span> ${escape_html(step)} `);
				if (unavailable.includes(step)) $$renderer.push(`<!--[0--><span class="sr-only">(not available yet)</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></span>`);
			}
			$$renderer.push(`<!--]--></li>`);
		}
		$$renderer.push(`<!--]--></ol></nav>`);
	});
}
// src/lib/ui/Panel.svelte
function Panel($$renderer, $$props) {
	/** Region name and visible heading. */
	/** Heading level; pick the one that fits the page outline. */
	let { title, level = 2, class: className, children, $$slots, $$events, ...rest } = $$props;
	$$renderer.push(`<section${attributes({
		"aria-label": title,
		class: clsx(["space-y-2 rounded-panel border border-border bg-surface p-4 text-text shadow-raised", className]),
		...rest
	})}>`);
	element($$renderer, `h${level}`, () => {
		$$renderer.push(` class="font-display text-lg"`);
	}, () => {
		$$renderer.push(`${escape_html(title)}`);
	});
	$$renderer.push(` `);
	children?.($$renderer);
	$$renderer.push(`<!----></section>`);
}
// src/lib/creation/client.ts
var api = (campaign) => `/api/campaigns/${encodeURIComponent(campaign)}`;
/** A message the server refused to pass to the DM, with its reason for the Player. */
var ConversationError = class extends Error {};
/** The creation conversation, oldest first; live updates add the DM's replies and writes. */
function createConversationQuery(campaign, initial) {
	return createQuery(() => ({
		queryKey: conversationQueryKey(campaign()),
		queryFn: async () => {
			const res = await fetch(`${api(campaign())}/conversation`);
			if (!res.ok) throw new ConversationError("The conversation could not be loaded");
			return (await res.json()).messages;
		},
		initialData: initial()
	}));
}
/** Sends the Player's message to the DM, then refreshes the conversation. */
function conversationActions(campaign) {
	const queryClient = useQueryClient();
	return { async send(text) {
		const res = await fetch(`${api(campaign())}/conversation`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text })
		});
		await queryClient.invalidateQueries({ queryKey: conversationQueryKey(campaign()) });
		if (!res.ok) throw new ConversationError((await res.json().catch(() => ({}))).error ?? "The message could not be sent");
	} };
}
/** The stored Seed and its "✎ DM" fields; a DM write refreshes it. */
function createSeedQuery(campaign, initial) {
	return createQuery(() => ({
		queryKey: seedQueryKey(campaign()),
		queryFn: async () => {
			const res = await fetch(`${api(campaign())}/seed`);
			if (!res.ok) throw new ConversationError("The Seed could not be loaded");
			return await res.json();
		},
		initialData: initial()
	}));
}
/** One stored Character draft and its "✎ DM" fields; a DM write refreshes it. */
function createDraftQuery(campaign, draft, initial) {
	return createQuery(() => ({
		queryKey: draftQueryKey(campaign(), draft()),
		queryFn: async () => {
			const res = await fetch(`${api(campaign())}/drafts/${encodeURIComponent(draft())}`);
			if (!res.ok) throw new ConversationError("The draft could not be loaded");
			return await res.json();
		},
		initialData: initial()
	}));
}
// src/lib/creation/DmConversation.svelte
function DmConversation($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The Campaign folder, shown in the `dm` command while the DM is away. */
		/** Whether a DM session is attached to the Campaign. */
		/** Read-only: an archived Campaign takes no messages. */
		let { campaign, folder, attached, messages, disabled = false } = $$props;
		const conversation = createConversationQuery(() => campaign, () => messages);
		conversationActions(() => campaign);
		let text = "";
		let sending = false;
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<section aria-label="Ask the DM" class="flex h-full min-h-80 flex-col rounded-lg border border-border bg-surface lg:rounded-none lg:border-0"><header class="flex items-center gap-2 border-b border-border px-4 py-3"><h2 class="font-display text-lg">Ask the DM</h2></header> <ol aria-label="Conversation" class="flex-1 space-y-2 overflow-y-auto px-4 py-3">`);
			const each_array = ensure_array_like(conversation.data);
			if (each_array.length !== 0) {
				$$renderer.push("<!--[-->");
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let line = each_array[$$index];
					if (line.author === "dm_write") $$renderer.push(`<!--[0--><li class="text-center text-xs text-muted italic">✎ ${escape_html(line.text)}</li>`);
					else $$renderer.push(`<!--[-1--><li${attr_class(clsx(["max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap", line.author === "player" ? "ml-auto bg-raised text-text" : "mr-auto border border-border text-text"]))}><span class="sr-only">${escape_html(line.author === "player" ? "You" : "DM")}:</span> ${escape_html(line.text)}</li>`);
					$$renderer.push(`<!--]-->`);
				}
			} else $$renderer.push(`<!--[!--><li class="text-sm text-muted">Ask for ideas, a premise, a backstory or help with a choice. The DM can fill in fields for
        you, marked ✎ DM.</li>`);
			$$renderer.push(`<!--]--></ol> <div class="space-y-2 border-t border-border px-4 py-3">`);
			if (!attached) $$renderer.push(`<!--[0--><p class="text-sm text-muted" role="status">The forms work without the DM. To ask the DM for help, run <code class="rounded bg-raised px-1 break-all">cd ${escape_html(folder)} &amp;&amp; dm</code> in a terminal.</p>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <form class="space-y-2">`);
			Textarea($$renderer, {
				"aria-label": "Message to the DM",
				rows: 3,
				disabled: disabled || !attached || sending,
				onkeydown: (e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						e.currentTarget.form?.requestSubmit();
					}
				},
				get value() {
					return text;
				},
				set value($$value) {
					text = $$value;
					$$settled = false;
				}
			});
			$$renderer.push(`<!----> `);
			Button($$renderer, {
				type: "submit",
				disabled: disabled || !attached || !text.trim(),
				children: ($$renderer) => {
					$$renderer.push(`<!---->Send`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----></form></div></section>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
// src/lib/creation/CreationPage.svelte
function CreationPage($$renderer, $$props) {
	/** The DM pane's Campaign; null (a missing folder) shows no pane. */
	/** The Seed form reads best narrow; the wizard needs the room. */
	let { pane, width = "wide", children } = $$props;
	$$renderer.push(`<div${attr_class(clsx(pane ? "lg:pr-96" : void 0))}><main${attr_class(clsx(["mx-auto space-y-6 p-6", width === "narrow" ? "max-w-3xl" : "max-w-7xl"]))}>`);
	children($$renderer);
	$$renderer.push(`<!----></main> `);
	if (pane) {
		$$renderer.push(`<!--[0--><aside class="p-6 pt-0 lg:fixed lg:top-12 lg:right-0 lg:bottom-0 lg:w-96 lg:border-l lg:border-border lg:p-0" data-testid="dm-pane">`);
		DmConversation($$renderer, spread_props([pane]));
		$$renderer.push(`<!----></aside>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></div>`);
}
export { CreationStepper as a, Panel as i, createDraftQuery as n, Select as o, createSeedQuery as r, CreationPage as t };

//# sourceMappingURL=CreationPage.js.map