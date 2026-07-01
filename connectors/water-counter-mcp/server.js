const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/tmp/water-counter-data';
const DATA_FILE = path.join(DATA_DIR, 'water-data.json');
const DAILY_GOAL = 8;

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[water-counter] load error:', e.message);
  }
  return {};
}

function saveData(data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[water-counter] save error:', e.message);
  }
}

function getActor(req) {
  return (
    req.params?._meta?.headers?.['x-adas-actor'] ||
    req.params?._meta?.['x-adas-actor'] ||
    'default'
  );
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
  const actor = getActor(req);
  const today = getToday();
  const data = loadData();

  if (!data[actor]) data[actor] = {};

  switch (name) {
    case 'water.log': {
      const glasses = Math.max(1, Math.round(Number(args.count) || 1));
      data[actor][today] = (data[actor][today] || 0) + glasses;
      saveData(data);
      const total = data[actor][today];
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
      const count = data[actor][today] || 0;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count, date: today, goal: DAILY_GOAL })
        }]
      };
    }

    case 'water.reset_today': {
      data[actor][today] = 0;
      saveData(data);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: 0, date: today, message: "Today's water count has been reset to zero." })
        }]
      };
    }

    case 'ui.listPlugins':
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

    case 'ui.getPlugin':
      return {
        content: [{ type: 'text', text: JSON.stringify(PLUGIN_MANIFEST) }]
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('[water-counter-mcp] running on stdio');
});
