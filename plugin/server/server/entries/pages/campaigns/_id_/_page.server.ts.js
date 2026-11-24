import { n as fail, t as error } from "../../../../chunks/exports.js";
import { n as CampaignSeedError, t as CAMPAIGN_SEED_FIELDS } from "../../../../chunks/seed2.js";
import { a as CampaignArchivedError, i as sessions, n as library, s as CampaignMissingError } from "../../../../chunks/campaign.js";
// src/routes/campaigns/[id]/+page.server.ts
var load = ({ params }) => {
	const entry = library.get(params.id);
	if (!entry) error(404, "Campaign not found");
	return {
		campaign: {
			id: entry.id,
			name: entry.name,
			path: entry.path,
			status: entry.status
		},
		seed: entry.status === "missing" ? null : library.seed(entry.id),
		dmFields: entry.status === "missing" ? [] : library.dmSeedFields(entry.id),
		conversation: entry.status === "missing" ? [] : library.conversation(entry.id).list(),
		attached: sessions.list()
	};
};
var actions = { saveSeed: async ({ request, params }) => {
	const data = await request.formData();
	const card = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, String(data.get(f) ?? "")]));
	try {
		library.saveSeed(params.id, card);
	} catch (e) {
		if (e instanceof CampaignSeedError || e instanceof CampaignArchivedError || e instanceof CampaignMissingError) return fail(400, {
			seed: card,
			error: e.message
		});
		throw e;
	}
	return { saved: true };
} };
export { actions, load };

//# sourceMappingURL=_page.server.ts.js.map