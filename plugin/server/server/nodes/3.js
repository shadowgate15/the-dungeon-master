import * as server from '../entries/pages/campaigns/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.ChBGo1sP.js","_app/immutable/chunks/CfxiCzHY.js","_app/immutable/chunks/DC0gxCG2.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/DBF15rcl.js","_app/immutable/chunks/C7UOAgKY.js","_app/immutable/chunks/DcF3Qn8J.js","_app/immutable/chunks/CXonfh_a.js","_app/immutable/chunks/CxbWmRyD.js","_app/immutable/chunks/4n-se-go.js","_app/immutable/chunks/Cs00L69m.js","_app/immutable/chunks/Cc1ngNT4.js","_app/immutable/chunks/BoHPb5t0.js","_app/immutable/chunks/Ck1bIUfm.js","_app/immutable/chunks/3KWdG_99.js"];
export const stylesheets = [];
export const fonts = [];
