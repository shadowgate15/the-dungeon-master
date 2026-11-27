import { i as json } from "../../../../../../chunks/exports.js";
import { s as play } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/sheets/+server.ts
/** The Party's play sheets, as the play console shows them, or 404 `{ error }`. */
var GET = ({ params, locals }) => withCampaign(() => json(play.sheets(params.id, locals.browser)));
export { GET };

//# sourceMappingURL=_server.ts.js.map