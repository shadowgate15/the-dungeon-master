import { i as json } from "../../../../../../chunks/exports.js";
import { s as play } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/journal/+server.ts
/** The Player's Journal (their Characters' Beliefs, truth stripped), or 404 `{ error }`. */
var GET = ({ params, locals }) => withCampaign(() => json(play.journal(params.id, locals.browser)));
export { GET };

//# sourceMappingURL=_server.ts.js.map