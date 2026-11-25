import { n as bridgeApi } from "../../../../../chunks/bridge.js";
// src/routes/api/bridge/[...path]/+server.ts
/** The bridge's token-gated interface: tools, calls and channel events. See `bridge/api.ts`. */
var handle = ({ request }) => bridgeApi(request);
var GET = handle;
var POST = handle;
export { GET, POST };

//# sourceMappingURL=_server.ts.js.map