import { t as error } from "../../../../../chunks/exports.js";
import { i as sessions, n as library } from "../../../../../chunks/campaign.js";
import { c as play, s as permissions } from "../../../../../chunks/bridge.js";
// src/routes/campaigns/[id]/play/+page.server.ts
/** The play console: the Party's sheets, the open Floor, the timeline, the Journal and any permission prompt, begun or not. */
var load = ({ params, locals }) => {
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
		sheets: play.sheets(entry.id, locals.browser),
		floor: play.openFloor(entry.id, locals.browser),
		timeline: play.timeline(entry.id, locals.browser),
		scene: play.scene(entry.id, locals.browser),
		journal: play.journal(entry.id, locals.browser),
		permission: permissions.pending(entry.id),
		attached: sessions.list()
	};
};
export { load };

//# sourceMappingURL=_page.server.ts.js.map