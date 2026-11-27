import * as server from '../entries/pages/campaigns/_id_/play/_page.server.ts.js';

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/play/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/play/+page.server.ts";
export const imports = ["_app/immutable/nodes/8.DZxu2iH7.js","_app/immutable/chunks/B5n0xp8a.js","_app/immutable/chunks/B12WvBhZ.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/vJW4mVRM.js","_app/immutable/chunks/Cnscab98.js","_app/immutable/chunks/EQlZalNO.js","_app/immutable/chunks/DSFYbdYg.js","_app/immutable/chunks/YglnKquM.js","_app/immutable/chunks/CoKD3-QB.js","_app/immutable/chunks/DCCMkWLr.js","_app/immutable/chunks/BLAu4F-C.js","_app/immutable/chunks/BPCZAY45.js"];
export const stylesheets = [];
export const fonts = [];
