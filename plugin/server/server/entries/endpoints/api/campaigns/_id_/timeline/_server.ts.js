import { i as json } from "../../../../../../chunks/exports.js";
import { o as play } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/timeline/+server.ts
/** The Player's timeline (Player-safe entries only) and awaiting Narration, or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => json(play.timeline(params.id)));
export { GET };

//# sourceMappingURL=_server.ts.js.map