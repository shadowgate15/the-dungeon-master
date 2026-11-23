import { y as escape_html } from "./server2.js";
import { n as Alert, r as Link, t as Button } from "./Button.js";
import { t as Dialog } from "./Dialog.js";
import { t as Field } from "./Field.js";
import { t as Textarea } from "./Textarea.js";
// src/lib/dev/ReportIssue.svelte
function ReportIssue($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** The page the report is filed from. */
		/** Injected so the dialog can be driven without a server. */
		let { url, route, params, fetcher = fetch } = $$props;
		let open = false;
		let description = "";
		let descriptionError = void 0;
		let sending = false;
		let error = void 0;
		let issueUrl = void 0;
		const openDialog = () => {
			if (issueUrl) {
				description = "";
				issueUrl = void 0;
			}
			error = void 0;
			open = true;
		};
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			Button($$renderer, {
				variant: "secondary",
				size: "sm",
				class: "fixed bottom-4 left-4 z-50 shadow-overlay",
				onclick: openDialog,
				children: ($$renderer) => {
					$$renderer.push(`<!---->Report an issue`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!----> `);
			Dialog($$renderer, {
				title: "Report an issue",
				closeHref: url,
				class: "max-w-xl",
				get open() {
					return open;
				},
				set open($$value) {
					open = $$value;
					$$settled = false;
				},
				children: ($$renderer) => {
					if (issueUrl) {
						$$renderer.push("<!--[0-->");
						Alert($$renderer, {
							variant: "success",
							children: ($$renderer) => {
								$$renderer.push(`<!---->Reported: `);
								Link($$renderer, {
									href: issueUrl,
									target: "_blank",
									rel: "noreferrer",
									children: ($$renderer) => {
										$$renderer.push(`<!---->${escape_html(issueUrl)}`);
									},
									$$slots: { default: true }
								});
								$$renderer.push(`<!---->`);
							},
							$$slots: { default: true }
						});
					} else {
						$$renderer.push(`<!--[-1--><form class="space-y-4" novalidate="">`);
						{
							function children($$renderer, id, describedby) {
								Textarea($$renderer, {
									id,
									rows: 5,
									"aria-describedby": describedby,
									get value() {
										return description;
									},
									set value($$value) {
										description = $$value;
										$$settled = false;
									}
								});
							}
							Field($$renderer, {
								label: "What happened?",
								hint: "The page, viewport and commit are attached for you. The title is written for you.",
								error: descriptionError,
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
							disabled: sending,
							children: ($$renderer) => {
								$$renderer.push(`<!---->${escape_html("Send report")}`);
							},
							$$slots: { default: true }
						});
						$$renderer.push(`<!----></form>`);
					}
					$$renderer.push(`<!--]-->`);
				},
				$$slots: { default: true }
			});
			$$renderer.push(`<!---->`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
export { ReportIssue as default };

//# sourceMappingURL=ReportIssue.js.map