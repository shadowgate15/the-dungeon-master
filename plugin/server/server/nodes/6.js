import * as server from '../entries/pages/campaigns/_id_/play/_page.server.ts.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/play/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/play/+page.server.ts";
export const imports = ["_app/immutable/nodes/6.BE7UJbwY.js","_app/immutable/chunks/BH4ECt33.js","_app/immutable/chunks/DrM3ikSl.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/D76vwCMP.js","_app/immutable/chunks/DxyXPA_x.js","_app/immutable/chunks/CqiwbGJC.js","_app/immutable/chunks/C-lBtDqM.js","_app/immutable/chunks/DrauhW0_.js"];
export const stylesheets = [];
export const fonts = [];
