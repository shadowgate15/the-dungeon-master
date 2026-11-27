import * as server from '../entries/pages/campaigns/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.CY-53tY2.js","_app/immutable/chunks/CfxiCzHY.js","_app/immutable/chunks/BORwyWYY.js","_app/immutable/chunks/Cyt8LZpN.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/C6x8Iesr.js","_app/immutable/chunks/BZzsgcU7.js","_app/immutable/chunks/D5Qw96Lt.js","_app/immutable/chunks/CAoE5Hja.js","_app/immutable/chunks/DPPTaZ5S.js","_app/immutable/chunks/4n-se-go.js","_app/immutable/chunks/BnrtsmMN.js","_app/immutable/chunks/CZZXYQNr.js","_app/immutable/chunks/oamOZsYA.js","_app/immutable/chunks/Ck1bIUfm.js","_app/immutable/chunks/3KWdG_99.js"];
export const stylesheets = [];
export const fonts = [];
