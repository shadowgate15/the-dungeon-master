import { i as json } from "../../../../../../chunks/exports.js";
import { s as permissions } from "../../../../../../chunks/bridge.js";
import { n as library } from "../../../../../../chunks/campaign.js";
// src/routes/api/campaigns/[id]/permission/+server.ts
/** The permission prompt the Campaign's session is waiting on: `{ request }`, null when none. */
var GET = ({ params }) => {
	if (!library.get(params.id)) return json({ error: "Campaign not found" }, { status: 404 });
	return json({ request: permissions.pending(params.id) });
};
/**
* The Player answers the prompt with `{ request_id, behavior: 'allow' | 'deny' }`. 409 `{ error }`
* when it is no longer waiting (answered in the terminal first); 400 on a bad body.
*/
var POST = async ({ params, request }) => {
	if (!library.get(params.id)) return json({ error: "Campaign not found" }, { status: 404 });
	const body = await request.json().catch(() => ({}));
	const behavior = body.behavior;
	if (typeof body.request_id !== "string" || behavior !== "allow" && behavior !== "deny") return json({ error: "request_id and behavior ('allow' or 'deny') are required" }, { status: 400 });
	if (!permissions.answer(params.id, body.request_id, behavior)) return json({ error: "That permission request was already answered" }, { status: 409 });
	return json({ answered: true });
};
export { GET, POST };

//# sourceMappingURL=_server.ts.js.map