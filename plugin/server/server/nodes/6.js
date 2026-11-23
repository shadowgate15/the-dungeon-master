import * as server from '../entries/pages/credits/_page.server.ts.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/credits/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/credits/+page.server.ts";
export const imports = ["_app/immutable/nodes/6.BJnOIClO.js","_app/immutable/chunks/oE_7pxdZ.js"];
export const stylesheets = [];
export const fonts = [];
