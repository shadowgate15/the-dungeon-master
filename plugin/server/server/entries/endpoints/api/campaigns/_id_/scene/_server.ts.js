import { i as json } from "../../../../../../chunks/exports.js";
import { o as play } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/scene/+server.ts
/** The Scene as the Player's rail shows it (clock, Place, present, elsewhere), or 404 `{ error }`. */
var GET = ({ params }) => withCampaign(() => json(play.scene(params.id)));
export { GET };

//# sourceMappingURL=_server.ts.js.map