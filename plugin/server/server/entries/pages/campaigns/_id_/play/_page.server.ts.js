import { t as error } from "../../../../../chunks/exports.js";
import { C as playSheets, i as sessions, n as library } from "../../../../../chunks/campaign.js";
import { a as play } from "../../../../../chunks/bridge.js";
// src/routes/campaigns/[id]/play/+page.server.ts
/** The play console: the Party's sheets, the open Floor and the timeline, begun or not. */
var load = ({ params }) => {
	const entry = library.get(params.id);
	if (!entry) error(404, "Campaign not found");
	if (entry.status === "missing") error(404, "This Campaign's folder is missing");
	return {
		campaign: {
			id: entry.id,
			name: entry.name,
			path: entry.path,
			status: entry.status
		},
		sheets: playSheets(library.party(entry.id)),
		floor: library.floor(entry.id).current(),
		timeline: play.timeline(entry.id),
		attached: sessions.list()
	};
};
export { load };

//# sourceMappingURL=_page.server.ts.js.map