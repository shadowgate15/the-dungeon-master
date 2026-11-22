// PROTOTYPE — throwaway spike for "Spike: the play loop through server, bridge and channel" (#298).
// Stands in for the user-level SvelteKit server from the topology decision (#294).
// Plain node:http instead of SvelteKit, state in memory instead of SQLite: the spike is about the loop, not the stack.
import http from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { PAGE } from './page.ts';

const PORT = Number(process.env.DM_SPIKE_PORT ?? 4777);
const RUNTIME_DIR = join(homedir(), '.dm-spike');
const RUNTIME_FILE = join(RUNTIME_DIR, 'runtime.json');
const TOKEN = randomBytes(16).toString('hex');

type Res = http.ServerResponse;
type Character = { name: string; hp: number; maxHp: number };
type Campaign = {
	path: string;
	name: string;
	party: Character[];
	log: { t: number; kind: string; text: string }[];
	bridge: Res | null;
	browsers: Set<Res>;
	pendingInput: { id: string; t0: number; firstTool?: number } | null;
};

const campaigns = new Map<string, Campaign>();

function log(...a: unknown[]) {
	console.log(new Date().toISOString(), ...a);
}

function getCampaign(path: string): Campaign {
	let c = campaigns.get(path);
	if (!c) {
		c = {
			path,
			name: basename(path),
			party: [
				{ name: 'Brakka', hp: 12, maxHp: 12 },
				{ name: 'Wren', hp: 8, maxHp: 8 }
			],
			log: [],
			bridge: null,
			browsers: new Set(),
			pendingInput: null
		};
		campaigns.set(path, c);
	}
	return c;
}

function sse(res: Res, event: string, data: unknown) {
	res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function toBrowsers(c: Campaign, event: string, data: unknown) {
	for (const b of c.browsers) sse(b, event, data);
}

function snapshot(c: Campaign) {
	return { name: c.name, path: c.path, party: c.party, log: c.log, session: !!c.bridge };
}

function addLog(c: Campaign, kind: string, text: string) {
	const entry = { t: Date.now(), kind, text };
	c.log.push(entry);
	toBrowsers(c, 'log', entry);
}

function pushState(c: Campaign) {
	toBrowsers(c, 'state', snapshot(c));
}

function since(c: Campaign) {
	return c.pendingInput ? ((Date.now() - c.pendingInput.t0) / 1000).toFixed(1) + 's' : '–';
}

// ---- tools: the server owns their list and their effects; the bridge just proxies ----
const TOOLS = [
	{
		name: 'reply',
		description:
			'Send narration to the player. This is the ONLY way the player sees anything you say; transcript text never reaches them.',
		inputSchema: {
			type: 'object',
			properties: { chat_id: { type: 'string' }, text: { type: 'string', description: 'Narration (markdown ok)' } },
			required: ['text']
		}
	},
	{
		name: 'roll',
		description: 'Roll dice with the game server (never invent numbers). Expression like "1d20+3" or "2d6".',
		inputSchema: {
			type: 'object',
			properties: { expression: { type: 'string' }, reason: { type: 'string' } },
			required: ['expression', 'reason']
		}
	},
	{
		name: 'apply_damage',
		description: 'Reduce a party member\'s HP (negative amount heals). Changes game state.',
		inputSchema: {
			type: 'object',
			properties: { character: { type: 'string' }, amount: { type: 'integer' } },
			required: ['character', 'amount']
		}
	},
	{
		name: 'get_state',
		description: 'Read the current party state.',
		inputSchema: { type: 'object', properties: {} }
	}
];

function callTool(c: Campaign, name: string, args: Record<string, unknown>): { text: string; isError?: boolean } {
	if (c.pendingInput && !c.pendingInput.firstTool) c.pendingInput.firstTool = Date.now();
	switch (name) {
		case 'reply': {
			const text = String(args.text ?? '');
			addLog(c, 'narration', text);
			if (c.pendingInput) {
				const p = c.pendingInput;
				const first = p.firstTool ? ((p.firstTool - p.t0) / 1000).toFixed(1) : '–';
				addLog(c, 'timing', `input → first tool call ${first}s · input → reply ${since(c)}`);
				c.pendingInput = null;
			}
			toBrowsers(c, 'thinking', { on: false });
			return { text: 'sent' };
		}
		case 'roll': {
			const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(args.expression ?? '').replace(/\s/g, ''));
			if (!m) return { text: `bad expression: ${args.expression}`, isError: true };
			const n = Number(m[1] || 1), sides = Number(m[2]), mod = Number(m[3] ?? 0);
			const dice = Array.from({ length: n }, () => randomInt(1, sides + 1));
			const total = dice.reduce((a, b) => a + b, 0) + mod;
			const text = `${args.expression} (${args.reason}) → [${dice.join(', ')}]${mod ? (mod > 0 ? '+' : '') + mod : ''} = ${total}`;
			addLog(c, 'roll', `${text}  (at ${since(c)})`);
			return { text };
		}
		case 'apply_damage': {
			const who = c.party.find((p) => p.name.toLowerCase() === String(args.character).toLowerCase());
			if (!who) return { text: `no such character: ${args.character}. Party: ${c.party.map((p) => p.name).join(', ')}`, isError: true };
			const amt = Number(args.amount);
			who.hp = Math.max(0, Math.min(who.maxHp, who.hp - amt));
			addLog(c, 'state', `${who.name} ${amt >= 0 ? 'takes ' + amt + ' damage' : 'heals ' + -amt} → ${who.hp}/${who.maxHp}  (at ${since(c)})`);
			pushState(c);
			return { text: JSON.stringify(c.party) };
		}
		case 'get_state':
			return { text: JSON.stringify(c.party) };
		default:
			return { text: `unknown tool ${name}`, isError: true };
	}
}

async function body(req: http.IncomingMessage): Promise<any> {
	let s = '';
	for await (const chunk of req) s += chunk;
	return s ? JSON.parse(s) : {};
}

function json(res: Res, status: number, data: unknown) {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(data));
}

function openSse(res: Res) {
	res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
	res.write(': open\n\n');
	const ka = setInterval(() => res.write(': ka\n\n'), 15000);
	res.on('close', () => clearInterval(ka));
}

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
	const token = url.searchParams.get('token') ?? req.headers['x-dm-token'];
	if (url.pathname === '/' && req.method === 'GET') {
		res.writeHead(200, { 'content-type': 'text/html' });
		return res.end(PAGE);
	}
	if (token !== TOKEN) return json(res, 401, { error: 'bad token' });
	const campaignPath = url.searchParams.get('campaign') ?? '';

	try {
		// ---- launcher ----
		if (url.pathname === '/api/health') return json(res, 200, { ok: true, pid: process.pid });
		if (url.pathname === '/api/register' && req.method === 'POST') {
			const { path } = await body(req);
			const c = getCampaign(path);
			log('registered', path);
			return json(res, 200, { ok: true, session: !!c.bridge });
		}
		if (url.pathname === '/api/stop' && req.method === 'POST') {
			json(res, 200, { ok: true });
			return shutdown();
		}

		// ---- browser ----
		if (url.pathname === '/api/campaigns')
			return json(res, 200, [...campaigns.values()].map((c) => ({ name: c.name, path: c.path, session: !!c.bridge })));
		if (url.pathname === '/api/stream') {
			const c = getCampaign(campaignPath);
			openSse(res);
			c.browsers.add(res);
			sse(res, 'state', snapshot(c));
			req.on('close', () => c.browsers.delete(res));
			return;
		}
		if (url.pathname === '/api/input' && req.method === 'POST') {
			const c = getCampaign(campaignPath);
			const { text, character } = await body(req);
			if (!c.bridge) return json(res, 409, { error: 'No DM session is connected to this Campaign. Run the launcher in its folder.' });
			const id = randomBytes(4).toString('hex');
			c.pendingInput = { id, t0: Date.now() };
			addLog(c, 'player', `${character ?? 'Player'}: ${text}`);
			toBrowsers(c, 'thinking', { on: true });
			sse(c.bridge, 'channel', { content: text, meta: { chat_id: 'table', character: character ?? 'Player', input_id: id } });
			return json(res, 200, { ok: true, id });
		}
		if (url.pathname === '/api/permission' && req.method === 'POST') {
			const c = getCampaign(campaignPath);
			const { request_id, behavior } = await body(req);
			if (!c.bridge) return json(res, 409, { error: 'no session' });
			sse(c.bridge, 'permission', { request_id, behavior });
			addLog(c, 'system', `permission ${request_id}: ${behavior} (from browser)`);
			toBrowsers(c, 'permission_done', { request_id });
			return json(res, 200, { ok: true });
		}

		// ---- bridge ----
		if (url.pathname === '/bridge/stream') {
			const c = getCampaign(campaignPath);
			if (c.bridge) {
				log('refused second bridge for', campaignPath);
				return json(res, 409, { error: `Campaign "${c.name}" already has a live DM session. Close it first.` });
			}
			openSse(res);
			c.bridge = res;
			log('bridge connected', campaignPath);
			addLog(c, 'system', 'DM session connected');
			pushState(c);
			req.on('close', () => {
				if (c.bridge === res) c.bridge = null;
				log('bridge disconnected', campaignPath);
				addLog(c, 'system', 'DM session disconnected');
				toBrowsers(c, 'thinking', { on: false });
				pushState(c);
			});
			return;
		}
		if (url.pathname === '/bridge/tools') return json(res, 200, { tools: TOOLS });
		if (url.pathname === '/bridge/call' && req.method === 'POST') {
			const c = getCampaign(campaignPath);
			const { name, arguments: args } = await body(req);
			log('tool', name, JSON.stringify(args));
			return json(res, 200, callTool(c, name, args ?? {}));
		}
		if (url.pathname === '/bridge/permission_request' && req.method === 'POST') {
			const c = getCampaign(campaignPath);
			const p = await body(req);
			addLog(c, 'system', `permission requested: ${p.tool_name} — ${p.description ?? ''}  (at ${since(c)})`);
			toBrowsers(c, 'permission_request', p);
			return json(res, 200, { ok: true });
		}
		if (url.pathname === '/bridge/log' && req.method === 'POST') {
			const c = getCampaign(campaignPath);
			const { text } = await body(req);
			addLog(c, 'system', `bridge: ${text}`);
			return json(res, 200, { ok: true });
		}
		json(res, 404, { error: 'not found' });
	} catch (e) {
		log('error', e);
		json(res, 500, { error: String(e) });
	}
});

function shutdown() {
	try {
		rmSync(RUNTIME_FILE);
	} catch {}
	log('stopping');
	setTimeout(() => process.exit(0), 50);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, '127.0.0.1', () => {
	mkdirSync(RUNTIME_DIR, { recursive: true });
	writeFileSync(RUNTIME_FILE, JSON.stringify({ port: PORT, token: TOKEN, pid: process.pid }));
	log(`dm-spike server on http://127.0.0.1:${PORT}/?token=${TOKEN}`);
});
