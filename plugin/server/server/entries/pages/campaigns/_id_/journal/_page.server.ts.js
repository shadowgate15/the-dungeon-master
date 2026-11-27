import { t as error } from "../../../../../chunks/exports.js";
import { n as library } from "../../../../../chunks/campaign.js";
// src/routes/campaigns/[id]/journal/+page.server.ts
/** The Player's Journal (what their Characters believe) and the read-only Session history. */
var load = ({ params, locals }) => {
	const entry = library.get(params.id);
	if (!entry) error(404, "Campaign not found");
	if (entry.status === "missing") error(404, "This Campaign's folder is missing");
	return {
		campaign: {
			id: entry.id,
			name: entry.name
		},
		journal: library.record(entry.id).journal(locals.browser),
		sessions: library.record(entry.id).sessionHistory(locals.browser)
	};
};
export { load };

//# sourceMappingURL=_page.server.ts.js.map