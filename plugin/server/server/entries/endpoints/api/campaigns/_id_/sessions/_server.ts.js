import { i as json } from "../../../../../../chunks/exports.js";
import { s as play } from "../../../../../../chunks/bridge.js";
import { n as withCampaign } from "../../../../../../chunks/http.js";
// src/routes/api/campaigns/[id]/sessions/+server.ts
/**
* The Player's Session history: each closed Session's summary and threads, newest first. Read-only:
* there is no route to edit a summary. 404 `{ error }` for an unknown Campaign.
*/
var GET = ({ params, locals }) => withCampaign(() => json(play.sessionHistory(params.id, locals.browser)));
export { GET };

//# sourceMappingURL=_server.ts.js.map