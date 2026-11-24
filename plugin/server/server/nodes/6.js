import * as server from '../entries/pages/campaigns/_id_/journal/_page.server.ts.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/journal/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/journal/+page.server.ts";
export const imports = ["_app/immutable/nodes/6.CZNZ_PA-.js","_app/immutable/chunks/DB8eBxmA.js","_app/immutable/chunks/B-vHK_DZ.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/BXViMlNs.js","_app/immutable/chunks/DFoFozM1.js"];
export const stylesheets = [];
export const fonts = [];
