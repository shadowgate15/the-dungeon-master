import * as server from '../entries/pages/campaigns/_id_/begin/_page.server.ts.js';

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/begin/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/begin/+page.server.ts";
export const imports = ["_app/immutable/nodes/5.PDr9kGUj.js","_app/immutable/chunks/DB8eBxmA.js","_app/immutable/chunks/CZJ6AtNH.js","_app/immutable/chunks/E1B1Uz5f.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/BBi5l2B_.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/chunks/BS6I-i2z.js","_app/immutable/chunks/Dd83DQaH.js","_app/immutable/chunks/Bw-u2Pio.js","_app/immutable/chunks/BsK3fwXA.js","_app/immutable/chunks/D601daQ_.js","_app/immutable/chunks/DWkQsUkq.js","_app/immutable/chunks/DpUhUmkp.js","_app/immutable/chunks/DFoFozM1.js"];
export const stylesheets = [];
export const fonts = [];
