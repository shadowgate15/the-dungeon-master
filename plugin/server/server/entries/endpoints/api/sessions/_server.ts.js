import { i as json } from "../../../../chunks/exports.js";
import { i as sessions } from "../../../../chunks/campaign.js";
// src/routes/api/sessions/+server.ts
/** The ids of the Campaigns with a DM at the table. */
var GET = () => json({ attached: sessions.list() });
export { GET };

//# sourceMappingURL=_server.ts.js.map