import { i as json } from "../../../../../../chunks/exports.js";
import { O as playSheets, n as library } from "../../../../../../chunks/campaign.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/sheets/+server.ts
/** The Party's play sheets, as the play console shows them, or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => json(playSheets(library.party(params.id))));
export { GET };

//# sourceMappingURL=_server.ts.js.map