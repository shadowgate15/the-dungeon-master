import { create_server } from './index.js';
const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	app_dir: "_app",
	app_path: "_app",
	assets: new Set(["robots.txt"]),
	mime_types: {".txt":"text/plain"},
	client: {start:"_app/immutable/entry/start.DHP3e-iK.js",app:"_app/immutable/entry/app.DEVxCnN_.js",imports:["_app/immutable/entry/start.DHP3e-iK.js","_app/immutable/entry/payload.DSmR2FwN.js","_app/immutable/chunks/CRzLMJPS.js","_app/immutable/chunks/kFbcn9Ny.js","_app/immutable/chunks/pd6cx8RH.js","_app/immutable/chunks/BH4ECt33.js","_app/immutable/chunks/BeSO2yj4.js","_app/immutable/chunks/9lSbqI6C.js","_app/immutable/entry/app.DEVxCnN_.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
	
	nodes: [
		__memo(() => import('./nodes/0.js')),
		__memo(() => import('./nodes/1.js')),
		__memo(() => import('./nodes/2.js')),
		__memo(() => import('./nodes/3.js')),
		__memo(() => import('./nodes/4.js')),
		__memo(() => import('./nodes/5.js')),
		__memo(() => import('./nodes/6.js')),
		__memo(() => import('./nodes/7.js')),
		__memo(() => import('./nodes/8.js'))
	],
	remotes: {
		
	},
	routes: [
		{
			id: "/",
			pattern: /^\/$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 2 },
			endpoint: null
		},
		{
			id: "/api/bridge/[...path]",
			pattern: /^\/api\/bridge(?:\/([^]*))?\/?$/,
			params: [{"name":"path","optional":false,"rest":true,"chained":true}],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/bridge/_...path_/_server.ts.js'))
		},
		{
			id: "/api/campaigns/[id]/characters/[character]",
			pattern: /^\/api\/campaigns\/([^/]+?)\/characters\/([^/]+?)\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false},{"name":"character","optional":false,"rest":false,"chained":false}],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/campaigns/_id_/characters/_character_/_server.ts.js'))
		},
		{
			id: "/api/campaigns/[id]/drafts/[draft]",
			pattern: /^\/api\/campaigns\/([^/]+?)\/drafts\/([^/]+?)\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false},{"name":"draft","optional":false,"rest":false,"chained":false}],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/campaigns/_id_/drafts/_draft_/_server.ts.js'))
		},
		{
			id: "/api/campaigns/[id]/drafts/[draft]/save",
			pattern: /^\/api\/campaigns\/([^/]+?)\/drafts\/([^/]+?)\/save\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false},{"name":"draft","optional":false,"rest":false,"chained":false}],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/campaigns/_id_/drafts/_draft_/save/_server.ts.js'))
		},
		{
			id: "/api/campaigns/[id]/floor",
			pattern: /^\/api\/campaigns\/([^/]+?)\/floor\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false}],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/campaigns/_id_/floor/_server.ts.js'))
		},
		{
			id: "/api/campaigns/[id]/floor/declarations",
			pattern: /^\/api\/campaigns\/([^/]+?)\/floor\/declarations\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false}],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/campaigns/_id_/floor/declarations/_server.ts.js'))
		},
		{
			id: "/api/campaigns/[id]/floor/declarations/[declaration]",
			pattern: /^\/api\/campaigns\/([^/]+?)\/floor\/declarations\/([^/]+?)\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false},{"name":"declaration","optional":false,"rest":false,"chained":false}],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/campaigns/_id_/floor/declarations/_declaration_/_server.ts.js'))
		},
		{
			id: "/api/dev/report-issue",
			pattern: /^\/api\/dev\/report-issue\/?$/,
			params: [],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/dev/report-issue/_server.ts.js'))
		},
		{
			id: "/api/events",
			pattern: /^\/api\/events\/?$/,
			params: [],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/events/_server.ts.js'))
		},
		{
			id: "/api/sessions",
			pattern: /^\/api\/sessions\/?$/,
			params: [],
			page: null,
			endpoint: __memo(() => import('./entries/endpoints/api/sessions/_server.ts.js'))
		},
		{
			id: "/campaigns",
			pattern: /^\/campaigns\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 3 },
			endpoint: null
		},
		{
			id: "/campaigns/[id]",
			pattern: /^\/campaigns\/([^/]+?)\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false}],
			page: { layouts: [0,], errors: [1,], leaf: 4 },
			endpoint: null
		},
		{
			id: "/campaigns/[id]/party",
			pattern: /^\/campaigns\/([^/]+?)\/party\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false}],
			page: { layouts: [0,], errors: [1,], leaf: 5 },
			endpoint: null
		},
		{
			id: "/campaigns/[id]/play",
			pattern: /^\/campaigns\/([^/]+?)\/play\/?$/,
			params: [{"name":"id","optional":false,"rest":false,"chained":false}],
			page: { layouts: [0,], errors: [1,], leaf: 6 },
			endpoint: null
		},
		{
			id: "/credits",
			pattern: /^\/credits\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 7 },
			endpoint: null
		},
		{
			id: "/theme",
			pattern: /^\/theme\/?$/,
			params: [],
			page: { layouts: [0,], errors: [1,], leaf: 8 },
			endpoint: null
		}
	],
	prerendered_routes: new Set([]),
	matchers: async () => {
		return {};
	},
	server_assets: {}
}
})();
export const server = create_server(manifest);