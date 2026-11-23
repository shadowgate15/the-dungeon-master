import * as server from '../entries/pages/campaigns/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/campaigns/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/campaigns/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.NN8qYw7B.js","_app/immutable/chunks/BH4ECt33.js","_app/immutable/chunks/BeSO2yj4.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/DR_YIMv-.js","_app/immutable/chunks/pd6cx8RH.js","_app/immutable/chunks/DrM3ikSl.js","_app/immutable/chunks/DxyXPA_x.js","_app/immutable/chunks/CqiwbGJC.js","_app/immutable/chunks/D76vwCMP.js","_app/immutable/chunks/nGuF_Vjb.js","_app/immutable/chunks/CK9uqTRp.js","_app/immutable/chunks/DD2nTQfi.js","_app/immutable/chunks/DI2kEDOv.js","_app/immutable/chunks/DoeXtmmj.js"];
export const stylesheets = [];
export const fonts = [];
