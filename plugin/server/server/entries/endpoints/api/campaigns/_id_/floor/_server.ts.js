import { i as json } from "../../../../../../chunks/exports.js";
import { n as library } from "../../../../../../chunks/campaign.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/floor/+server.ts
/** The open Floor: its pending Declarations in send order, or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => json(library.floor(params.id).current()));
export { GET };

//# sourceMappingURL=_server.ts.js.map