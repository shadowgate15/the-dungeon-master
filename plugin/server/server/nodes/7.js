import * as server from '../entries/pages/campaigns/_id_/play/_page.server.ts.js';

export const index = 7;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/play/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/play/+page.server.ts";
export const imports = ["_app/immutable/nodes/7.DDkH9LcE.js","_app/immutable/chunks/BH4ECt33.js","_app/immutable/chunks/DrM3ikSl.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/CaO8LR9y.js","_app/immutable/chunks/lY4Y5J5M.js","_app/immutable/chunks/wqvWdEVX.js","_app/immutable/chunks/DC35n-i4.js","_app/immutable/chunks/BAIuK2kj.js","_app/immutable/chunks/DrauhW0_.js","_app/immutable/chunks/DuW-390E.js","_app/immutable/chunks/Th4CoioE.js"];
export const stylesheets = [];
export const fonts = [];
