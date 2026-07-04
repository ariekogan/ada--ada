import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { platform } from '@ateam-ai/sdk';

// Persistence — the RIGHT way: the platform actorStore.
// Every (tenant, actor, skill) gets its OWN private SQLite db. We run raw SQL;
// Core injects the actor, so the SQL physically cannot reach another user's
// data. No actor_id column, no WHERE filter to forget, no '|| default' bucket.
// Water intake is inherently per-user, so we use the default (per-actor) scope.
const DAILY_GOAL = 8;

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// actorStore keys each store by (tenant, actor, skill). We forward:
//   _adas_actor — the real user Core injects onto every tool call (missing → throw).
//   _adas_skill — a STABLE namespace of OUR choosing, so the store is per-actor
//                 per-connector regardless of which skill invoked us. (Core does
//                 not inject _adas_skill into stdio args, and we don't want the
//                 store to fragment across calling skills anyway.)
const STORE_NS = 'water-counter';
function scopeArgs(args) {
  const actor = args?._adas_actor;
  if (!actor) throw new Error('water-counter: no actor context — _adas_actor missing. Refusing to pool user data.');
  return { _adas_actor: actor, _adas_skill: STORE_NS };
}

// One round-trip helper to actorStore via the platform gateway (Bearer PAT).
async function storeExec(scope, sql, params = []) {
  const res = await platform.mcpCall('actorStore.exec', { ...scope, sql, params });
  return parseStore(res);
}
async function storeQuery(scope, sql, params = []) {
  const res = await platform.mcpCall('actorStore.query', { ...scope, sql, params });
  return parseStore(res);
}
// actorStore returns { content:[{type:'text', text:'{"ok":...}'}] }.
function parseStore(res) {
  const text = res?.content?.[0]?.text ?? res?.structuredContent;
  const parsed = typeof text === 'string' ? JSON.parse(text) : (text || res);
  if (parsed && parsed.ok === false) throw new Error(`actorStore: ${parsed.error || 'unknown error'}`);
  return parsed;
}

// Create the table once per (actor,skill) db. Cheap IF NOT EXISTS; we track
// which actors we've initialized in-process to skip the round-trip after that.
const _inited = new Set();
async function ensureTable(scope) {
  if (_inited.has(scope._adas_actor)) return;
  await storeExec(scope, 'CREATE TABLE IF NOT EXISTS water(date TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)');
  _inited.add(scope._adas_actor);
}

async function getCount(scope, date) {
  const r = await storeQuery(scope, 'SELECT count FROM water WHERE date = ?', [date]);
  const rows = r?.rows || [];
  return rows.length ? Number(rows[0].count) : 0;
}

const PLUGIN_MANIFEST = {
  id: 'water-counter',
  name: 'Water Counter',
  version: '1.0.0',
  description: 'Track your daily water glasses with one tap',
  render: {
    mode: 'adaptive',
    iframeUrl: '/ui/water-counter/index.html'
  },
  channels: ['command'],
  capabilities: {
    haptics: true,
    commands: [
      {
        name: 'open',
        description: 'Open the water counter widget',
        input_schema: { type: 'object', properties: {} }
      }
    ]
  },
  surface: {
    type: 'drawer',
    visibility: 'user',
    icon: '💧',
    title: 'Water Counter',
    subtitle: 'Daily hydration tracker'
  }
};

const server = new Server(
  { name: 'water-counter-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'water.log',
      description: 'Log one or more glasses of water drunk today. Increments the daily count.',
      inputSchema: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number of glasses to log (default: 1)'
          }
        }
      }
    },
    {
      name: 'water.get_today',
      description: "Get today's water intake count and daily goal.",
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'water.reset_today',
      description: "Reset today's water glass count back to zero.",
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'ui.listPlugins',
      description: 'List available UI plugins for this connector.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'ui.getPlugin',
      description: 'Get the full manifest for a specific UI plugin.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Plugin ID' }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  // UI manifest tools are static + actor-independent — answer them before
  // touching the store (they must work even outside a user context).
  if (name === 'ui.listPlugins') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          plugins: [{
            id: PLUGIN_MANIFEST.id,
            name: PLUGIN_MANIFEST.name,
            version: PLUGIN_MANIFEST.version,
            description: PLUGIN_MANIFEST.description
          }]
        })
      }]
    };
  }
  if (name === 'ui.getPlugin') {
    return { content: [{ type: 'text', text: JSON.stringify(PLUGIN_MANIFEST) }] };
  }

  const scope = scopeArgs(args);
  const today = getToday();
  await ensureTable(scope);

  switch (name) {
    case 'water.log': {
      const glasses = Math.max(1, Math.round(Number(args.count) || 1));
      await storeExec(
        scope,
        'INSERT INTO water(date, count) VALUES(?, ?) ON CONFLICT(date) DO UPDATE SET count = count + ?',
        [today, glasses, glasses]
      );
      const total = await getCount(scope, today);
      const pct = Math.round((total / DAILY_GOAL) * 100);
      const msg =
        total >= DAILY_GOAL
          ? `🎉 Daily goal reached! ${total} glasses today — great job!`
          : `💧 ${total}/${DAILY_GOAL} glasses today (${pct}% of goal).`;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: total, date: today, logged: glasses, goal: DAILY_GOAL, message: msg })
        }]
      };
    }

    case 'water.get_today': {
      const count = await getCount(scope, today);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count, date: today, goal: DAILY_GOAL })
        }]
      };
    }

    case 'water.reset_today': {
      await storeExec(
        scope,
        'INSERT INTO water(date, count) VALUES(?, 0) ON CONFLICT(date) DO UPDATE SET count = 0',
        [today]
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: 0, date: today, message: "Today's water count has been reset to zero." })
        }]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('[water-counter-mcp] running on stdio (actorStore persistence)');
});
