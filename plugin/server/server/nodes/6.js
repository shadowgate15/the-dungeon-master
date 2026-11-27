import * as server from '../entries/pages/campaigns/_id_/journal/_page.server.ts.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/journal/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/journal/+page.server.ts";
export const imports = ["_app/immutable/nodes/6.CHMUDO0C.js","_app/immutable/chunks/B5n0xp8a.js","_app/immutable/chunks/BbEeTu8O.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/D-bUF9F7.js","_app/immutable/chunks/BPCZAY45.js"];
export const stylesheets = [];
export const fonts = [];
