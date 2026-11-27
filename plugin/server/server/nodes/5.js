import * as server from '../entries/pages/campaigns/_id_/begin/_page.server.ts.js';

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/begin/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/begin/+page.server.ts";
export const imports = ["_app/immutable/nodes/5.Bv8MxGDU.js","_app/immutable/chunks/CfxiCzHY.js","_app/immutable/chunks/Cs00L69m.js","_app/immutable/chunks/C7UOAgKY.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/DC0gxCG2.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/chunks/BjAeVB3t.js","_app/immutable/chunks/_ygR-bDL.js","_app/immutable/chunks/D0-Pi6_J.js","_app/immutable/chunks/CdDRVu4t.js","_app/immutable/chunks/DCsxPYuP.js","_app/immutable/chunks/DYk3qrg6.js","_app/immutable/chunks/mFSMYSvU.js","_app/immutable/chunks/CuzhNlbF.js","_app/immutable/chunks/4n-se-go.js","_app/immutable/chunks/CXxjHblZ.js"];
export const stylesheets = [];
export const fonts = [];
