import { r as live } from "../../../../chunks/campaign.js";
// src/routes/api/events/+server.ts
/** The browser's live updates: one SSE stream of state changes. See `lib/server/live.ts`. */
var GET = () => live.stream();
export { GET };

//# sourceMappingURL=_server.ts.js.map