import { n as fail, t as error } from "../../../../../chunks/exports.js";
import { c as DmAwayError, o as play } from "../../../../../chunks/bridge.js";
import { a as CampaignArchivedError, d as BeginRefusedError, i as sessions, n as library, p as StartOverRefusedError } from "../../../../../chunks/campaign.js";
// src/routes/campaigns/[id]/begin/+page.server.ts
/** The Begin step: whether the story can begin, and after Begin the pitch and Start over. */
var load = ({ params }) => {
	const entry = library.get(params.id);
	if (!entry) error(404, "Campaign not found");
	if (entry.status === "missing") error(404, "This Campaign's folder is missing");
	const record = library.record(entry.id);
	return {
		campaign: {
			id: entry.id,
			name: entry.name,
			path: entry.path,
			status: entry.status
		},
		creation: library.creation(entry.id),
		journal: record.journal(),
		timeline: record.timeline(),
		conversation: library.conversation(entry.id).list(),
		attached: sessions.list()
	};
};
var actions = {
	begin: ({ params }) => {
		try {
			play.begin(params.id);
		} catch (e) {
			if (e instanceof DmAwayError) return fail(409, { error: e.message });
			if (e instanceof BeginRefusedError || e instanceof CampaignArchivedError) return fail(400, { error: e.message });
			throw e;
		}
		return { begun: true };
	},
	startOver: ({ params }) => {
		try {
			play.startOver(params.id);
		} catch (e) {
			if (e instanceof StartOverRefusedError || e instanceof CampaignArchivedError) return fail(400, { error: e.message });
			throw e;
		}
		return { startedOver: true };
	}
};
export { actions, load };

//# sourceMappingURL=_page.server.ts.js.map