import * as server from '../entries/pages/campaigns/_id_/begin/_page.server.ts.js';

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/begin/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/begin/+page.server.ts";
export const imports = ["_app/immutable/nodes/5.yam1LoBF.js","_app/immutable/chunks/B5n0xp8a.js","_app/immutable/chunks/DMOhBfyM.js","_app/immutable/chunks/BpXE3IPt.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/BnCPhKr5.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/chunks/BbEeTu8O.js","_app/immutable/chunks/CsFBtkDa.js","_app/immutable/chunks/CGLw_RUW.js","_app/immutable/chunks/Cnscab98.js","_app/immutable/chunks/CoKD3-QB.js","_app/immutable/chunks/BLAu4F-C.js","_app/immutable/chunks/vJW4mVRM.js","_app/immutable/chunks/D-bUF9F7.js","_app/immutable/chunks/BPCZAY45.js"];
export const stylesheets = [];
export const fonts = [];
