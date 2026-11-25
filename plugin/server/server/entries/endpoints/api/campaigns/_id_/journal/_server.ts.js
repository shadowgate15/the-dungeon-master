import { i as json } from "../../../../../../chunks/exports.js";
import { n as library } from "../../../../../../chunks/campaign.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/journal/+server.ts
/** The Player's Journal (their Characters' Beliefs, truth stripped), or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => json(library.record(params.id).journal()));
export { GET };

//# sourceMappingURL=_server.ts.js.map