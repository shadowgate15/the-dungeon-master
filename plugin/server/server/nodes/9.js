import * as server from '../entries/pages/credits/_page.server.ts.js';

export const index = 9;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/credits/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/credits/+page.server.ts";
export const imports = ["_app/immutable/nodes/9.CGqBOuk1.js","_app/immutable/chunks/B5n0xp8a.js"];
export const stylesheets = [];
export const fonts = [];
