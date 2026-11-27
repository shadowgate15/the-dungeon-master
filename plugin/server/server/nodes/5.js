import * as server from '../entries/pages/campaigns/_id_/begin/_page.server.ts.js';

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/begin/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/begin/+page.server.ts";
export const imports = ["_app/immutable/nodes/5.DdDyyCBB.js","_app/immutable/chunks/CfxiCzHY.js","_app/immutable/chunks/BnrtsmMN.js","_app/immutable/chunks/BZzsgcU7.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/BORwyWYY.js","_app/immutable/chunks/Cyt8LZpN.js","_app/immutable/chunks/BOlvj0Bu.js","_app/immutable/chunks/iNkIFAuT.js","_app/immutable/chunks/TH4MmD5S.js","_app/immutable/chunks/DJf0wfcS.js","_app/immutable/chunks/DCsxPYuP.js","_app/immutable/chunks/DYk3qrg6.js","_app/immutable/chunks/Cbrhs-fo.js","_app/immutable/chunks/ayDzHqnP.js","_app/immutable/chunks/4n-se-go.js","_app/immutable/chunks/CXxjHblZ.js"];
export const stylesheets = [];
export const fonts = [];
