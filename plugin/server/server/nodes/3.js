import * as server from '../entries/pages/campaigns/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.B1-6oD1o.js","_app/immutable/chunks/DB8eBxmA.js","_app/immutable/chunks/BBi5l2B_.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/DCf_vjwf.js","_app/immutable/chunks/E1B1Uz5f.js","_app/immutable/chunks/B-vHK_DZ.js","_app/immutable/chunks/D601daQ_.js","_app/immutable/chunks/Bw-u2Pio.js","_app/immutable/chunks/DFoFozM1.js","_app/immutable/chunks/CZJ6AtNH.js","_app/immutable/chunks/BqbsX98E.js","_app/immutable/chunks/BgzdO0Xh.js","_app/immutable/chunks/DYlwT8kw.js","_app/immutable/chunks/CsXk6rQs.js"];
export const stylesheets = [];
export const fonts = [];
