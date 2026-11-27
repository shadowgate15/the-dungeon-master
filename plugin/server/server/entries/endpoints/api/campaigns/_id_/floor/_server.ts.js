import { i as json } from "../../../../../../chunks/exports.js";
import { c as play } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/floor/+server.ts
/** The open Floor: its pending Declarations in send order, or 404 `{ error }`. */
var GET = ({ params, locals }) => withCampaign(() => json(play.openFloor(params.id, locals.browser)));
export { GET };

//# sourceMappingURL=_server.ts.js.map