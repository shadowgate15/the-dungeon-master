import { i as json } from "../../../../../../chunks/exports.js";
import { c as DmAwayError, o as play } from "../../../../../../chunks/bridge.js";
import { c as CampaignNotFoundError, n as library, s as CampaignMissingError } from "../../../../../../chunks/campaign.js";
import { n as readJson } from "../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/conversation/+server.ts
function notFound(e) {
	if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) return json({ error: e.message }, { status: 404 });
	throw e;
}
/** The creation conversation, oldest first: `{ messages }`, or 404 `{ error }`. */
var GET = ({ params }) => {
	try {
		return json({ messages: library.conversation(params.id).list() });
	} catch (e) {
		return notFound(e);
	}
};
/** The Player writes to the DM: 201 with the message, 400 when empty, 409 while the DM is away. */
var POST = async ({ params, request }) => {
	const body = await readJson(request);
	const text = typeof body?.text === "string" ? body.text.trim() : "";
	if (!text) return json({ error: "Write a message first" }, { status: 400 });
	try {
		return json(play.converse(params.id, text), { status: 201 });
	} catch (e) {
		if (e instanceof DmAwayError) return json({ error: e.message }, { status: 409 });
		return notFound(e);
	}
};
export { GET, POST };

//# sourceMappingURL=_server.ts.js.map