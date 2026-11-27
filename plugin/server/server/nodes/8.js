import * as server from '../entries/pages/campaigns/_id_/play/_page.server.ts.js';

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/play/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/play/+page.server.ts";
export const imports = ["_app/immutable/nodes/8.C2JvLGuf.js","_app/immutable/chunks/CfxiCzHY.js","_app/immutable/chunks/BjAeVB3t.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/mFSMYSvU.js","_app/immutable/chunks/D0-Pi6_J.js","_app/immutable/chunks/Da42fRwZ.js","_app/immutable/chunks/Ck1bIUfm.js","_app/immutable/chunks/DCsxPYuP.js","_app/immutable/chunks/CuzhNlbF.js","_app/immutable/chunks/CdDRVu4t.js","_app/immutable/chunks/ieOm0RQw.js","_app/immutable/chunks/DYk3qrg6.js","_app/immutable/chunks/4n-se-go.js"];
export const stylesheets = [];
export const fonts = [];
