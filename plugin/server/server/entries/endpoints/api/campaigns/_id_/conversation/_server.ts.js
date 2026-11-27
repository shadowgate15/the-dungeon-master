import { i as json } from "../../../../../../chunks/exports.js";
import { s as play, u as DmAwayError } from "../../../../../../chunks/bridge.js";
import { n as library } from "../../../../../../chunks/campaign.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
import { n as readJson } from "../../../../../../chunks/respond.js";
// src/routes/api/campaigns/[id]/conversation/+server.ts
/** The creation conversation, oldest first: `{ messages }`, or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => json({ messages: library.conversation(params.id).list() }));
/** The Player writes to the DM: 201 with the message, 400 when empty, 409 while the DM is away. */
var POST = async ({ params, request }) => {
	const body = await readJson(request);
	const text = typeof body?.text === "string" ? body.text.trim() : "";
	if (!text) return json({ error: "Write a message first" }, { status: 400 });
	return withCampaign(() => json(play.converse(params.id, text), { status: 201 }), [[DmAwayError, 409]]);
};
export { GET, POST };

//# sourceMappingURL=_server.ts.js.map