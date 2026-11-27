import * as server from '../entries/pages/campaigns/_id_/play/_page.server.ts.js';

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_id_/play/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/[id]/play/+page.server.ts";
export const imports = ["_app/immutable/nodes/8.C9aLc1Xx.js","_app/immutable/chunks/CfxiCzHY.js","_app/immutable/chunks/BOlvj0Bu.js","_app/immutable/chunks/Cyt8LZpN.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/Cbrhs-fo.js","_app/immutable/chunks/TH4MmD5S.js","_app/immutable/chunks/Da42fRwZ.js","_app/immutable/chunks/Ck1bIUfm.js","_app/immutable/chunks/DCsxPYuP.js","_app/immutable/chunks/ayDzHqnP.js","_app/immutable/chunks/DJf0wfcS.js","_app/immutable/chunks/CEFjh8NS.js","_app/immutable/chunks/DYk3qrg6.js","_app/immutable/chunks/4n-se-go.js"];
export const stylesheets = [];
export const fonts = [];
