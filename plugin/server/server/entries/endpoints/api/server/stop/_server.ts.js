import { l as stop } from "../../../../../chunks/bridge.js";
// src/routes/api/server/stop/+server.ts
/**
* The UI's stop control: stops the game server, as `dm stop` does. 202; the server exits just
* after. Like every browser route, only a page served from this machine may call it.
*/
var POST = () => {
	stop();
	return new Response(null, { status: 202 });
};
export { POST };

//# sourceMappingURL=_server.ts.js.map