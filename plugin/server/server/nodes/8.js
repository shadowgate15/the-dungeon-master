import * as server from '../entries/pages/campaigns/_id_/play/_page.server.ts.js';

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/play/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/play/+page.server.ts";
export const imports = ["_app/immutable/nodes/8.xyHoZMH_.js","_app/immutable/chunks/DB8eBxmA.js","_app/immutable/chunks/B-vHK_DZ.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/D601daQ_.js","_app/immutable/chunks/Bw-u2Pio.js","_app/immutable/chunks/CsXk6rQs.js","_app/immutable/chunks/DfoGV_hR.js","_app/immutable/chunks/BsK3fwXA.js","_app/immutable/chunks/BXViMlNs.js","_app/immutable/chunks/DFoFozM1.js"];
export const stylesheets = [];
export const fonts = [];
