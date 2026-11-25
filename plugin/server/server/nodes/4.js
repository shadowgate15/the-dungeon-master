import * as server from '../entries/pages/campaigns/_id_/_page.server.ts.js';

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/+page.server.ts";
export const imports = ["_app/immutable/nodes/4.CnPlPG87.js","_app/immutable/chunks/DB8eBxmA.js","_app/immutable/chunks/CZJ6AtNH.js","_app/immutable/chunks/E1B1Uz5f.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/BBi5l2B_.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/chunks/B-vHK_DZ.js","_app/immutable/chunks/jxasB4Rv.js","_app/immutable/chunks/BgzdO0Xh.js","_app/immutable/chunks/PKz39_IA.js","_app/immutable/chunks/BsK3fwXA.js","_app/immutable/chunks/DYlwT8kw.js","_app/immutable/chunks/DyzqAbt5.js","_app/immutable/chunks/f62L30wT.js","_app/immutable/chunks/DFoFozM1.js","_app/immutable/chunks/D_ESw50U.js"];
export const stylesheets = [];
export const fonts = [];
