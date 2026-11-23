import * as server from '../entries/pages/campaigns/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.B0Pq6NuT.js","_app/immutable/chunks/oE_7pxdZ.js","_app/immutable/chunks/xrp05j8D.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/CuKygiR1.js","_app/immutable/chunks/C2Ror5sl.js","_app/immutable/chunks/DhsfRNK_.js","_app/immutable/chunks/jhSjUXBX.js","_app/immutable/chunks/BumdDV8p.js","_app/immutable/chunks/CqbTrlTp.js","_app/immutable/chunks/BJRZgcgn.js","_app/immutable/chunks/DoiUyGqk.js"];
export const stylesheets = [];
export const fonts = [];
