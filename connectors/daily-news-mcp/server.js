import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "daily-news-mcp", version: "1.0.0" });

// ── Category taxonomy ──────────────────────────────────────────────
// Each item is classified into the FIRST category whose keywords match.
const CATEGORIES = [
  { key: "ai",        name: "AI & Machine Learning", emoji: "🤖",
    kw: ["ai", "a.i", "llm", "gpt", "chatgpt", "openai", "anthropic", "claude", "gemini",
         "mistral", "llama", "machine learning", "deep learning", "neural", "model",
         "agent", "diffusion", "transformer", "inference", "rag", "embedding", "ml ", "genai"] },
  { key: "security",  name: "Security & Privacy", emoji: "🔐",
    kw: ["security", "vulnerab", "breach", "hacked", "hack", "cve", "exploit", "malware",
         "ransomware", "phishing", "encryption", "privacy", "leak", "zero-day", "0-day", "ddos"] },
  { key: "startups",  name: "Startups & Business", emoji: "🚀",
    kw: ["startup", "funding", "raises", "raised", "seed round", "series a", "series b",
         "acquisition", "acquires", "ipo", "valuation", "venture", "yc ", "y combinator",
         "layoff", "revenue", "billion", "million in"] },
  { key: "science",   name: "Science & Hardware", emoji: "🔬",
    kw: ["quantum", "chip", "semiconductor", "gpu", "nvidia", "tsmc", "nasa", "space",
         "rocket", "physics", "battery", "fusion", "energy", "robot", "biotech", "genome",
         "telescope", "satellite", "climate"] },
  { key: "dev",       name: "Software & Dev", emoji: "💻",
    kw: ["rust", "python", "javascript", "typescript", "golang", "kubernetes", "docker",
         "linux", "postgres", "database", "framework", "compiler", "open source", "open-source",
         "github", "api", "webassembly", "release", "v1.", "v2.", "library", "kernel"] },
];
const FALLBACK = { key: "tech", name: "More in Tech", emoji: "📰" };

function classify(title = "") {
  const t = " " + title.toLowerCase() + " ";
  for (const c of CATEGORIES) {
    if (c.kw.some((k) => t.includes(k))) return c.key;
  }
  return FALLBACK.key;
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "daily-news-mcp/1.0" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(to);
  }
}

// Pull from Hacker News (Algolia API — no key required).
//  - front_page  : what's hot right now (broad tech)
//  - recent AI   : last 48h stories matching AI with traction
async function gatherStories() {
  const nowSec = Math.floor(Date.now() / 1000);
  const since = nowSec - 60 * 60 * 48; // 48h
  const urls = [
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40",
    `https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=created_at_i>${since},points>40&hitsPerPage=25`,
    `https://hn.algolia.com/api/v1/search_by_date?query=startup&tags=story&numericFilters=created_at_i>${since},points>30&hitsPerPage=15`,
  ];
  const results = await Promise.allSettled(urls.map((u) => fetchJson(u)));
  const seen = new Set();
  const items = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value?.hits) continue;
    for (const h of r.value.hits) {
      const title = h.title || h.story_title;
      if (!title || seen.has(h.objectID)) continue;
      seen.add(h.objectID);
      const url = h.url || h.story_url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      items.push({
        title: title.trim(),
        url,
        source: domainOf(url) || "news.ycombinator.com",
        points: h.points || 0,
        comments: h.num_comments || 0,
        discuss: `https://news.ycombinator.com/item?id=${h.objectID}`,
        ts: h.created_at_i || 0,
      });
    }
  }
  return items;
}

function buildDigest(items, perCategory) {
  const buckets = {};
  for (const it of items) {
    const key = classify(it.title);
    (buckets[key] = buckets[key] || []).push(it);
  }
  const ordered = [...CATEGORIES, FALLBACK];
  const categories = [];
  for (const c of ordered) {
    const list = (buckets[c.key] || []).sort((a, b) => b.points - a.points).slice(0, perCategory);
    if (list.length) categories.push({ key: c.key, name: c.name, emoji: c.emoji, items: list });
  }
  return categories;
}

server.tool(
  "news.fetch",
  "Fetch today's aggregated technology & AI news, grouped into categories (AI, Security, Startups, Science, Dev). No arguments needed. Returns a structured digest the assistant can format into a visual summary.",
  {
    per_category: z.number().int().min(1).max(8).optional()
      .describe("Max stories per category (default 4)."),
    categories: z.array(z.string()).optional()
      .describe("Optional filter — only return these category keys: ai, security, startups, science, dev, tech."),
  },
  async ({ per_category, categories }) => {
    try {
      const items = await gatherStories();
      if (!items.length) {
        return { content: [{ type: "text", text: JSON.stringify({
          ok: false, error: "No stories returned from upstream news source. Try again shortly.",
        }) }] };
      }
      let cats = buildDigest(items, per_category || 4);
      if (categories && categories.length) {
        const want = new Set(categories.map((c) => c.toLowerCase()));
        cats = cats.filter((c) => want.has(c.key));
      }
      const date = new Date().toISOString().slice(0, 10);
      // Also expose each category as a TOP-LEVEL key (ai/security/startups/science/dev/tech)
      // so live widgets can bind directly to result.<categoryKey> without walking categories[].
      const byKey = {};
      for (const c of cats) byKey[c.key] = c.items;
      return { content: [{ type: "text", text: JSON.stringify({
        ok: true,
        date,
        generated_at: new Date().toISOString(),
        source: "Hacker News",
        total: cats.reduce((n, c) => n + c.items.length, 0),
        categories: cats,
        ...byKey,
      }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: String(e.message || e) }) }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
