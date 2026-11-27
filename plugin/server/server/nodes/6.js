import * as server from '../entries/pages/campaigns/_id_/journal/_page.server.ts.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/journal/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/journal/+page.server.ts";
export const imports = ["_app/immutable/nodes/6.Bwd2d7zm.js","_app/immutable/chunks/CfxiCzHY.js","_app/immutable/chunks/BOlvj0Bu.js","_app/immutable/chunks/Cyt8LZpN.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/ayDzHqnP.js","_app/immutable/chunks/4n-se-go.js"];
export const stylesheets = [];
export const fonts = [];
