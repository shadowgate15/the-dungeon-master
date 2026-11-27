import * as server from '../entries/pages/campaigns/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.C4FZiwEU.js","_app/immutable/chunks/B5n0xp8a.js","_app/immutable/chunks/BnCPhKr5.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/CgyG7vNq.js","_app/immutable/chunks/BpXE3IPt.js","_app/immutable/chunks/B12WvBhZ.js","_app/immutable/chunks/vJW4mVRM.js","_app/immutable/chunks/Cnscab98.js","_app/immutable/chunks/BPCZAY45.js","_app/immutable/chunks/DMOhBfyM.js","_app/immutable/chunks/EQlZalNO.js","_app/immutable/chunks/s7Zo2I-G.js","_app/immutable/chunks/YglnKquM.js","_app/immutable/chunks/CmLHX8_u.js"];
export const stylesheets = [];
export const fonts = [];
