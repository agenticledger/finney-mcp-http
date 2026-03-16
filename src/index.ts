#!/usr/bin/env node

/**
 * Finney MCP Server — Streamable HTTP Transport
 *
 * Exposes the Finney MCP tools over HTTP so any MCP client can connect
 * without needing a local stdio process.
 *
 * Auth: Clients pass their Finney API key as a Bearer token.
 *   Authorization: Bearer fin_live_...
 *
 * Environment variables:
 *   PORT             - HTTP port (default: 3100)
 *   FINNEY_BASE_URL  - Base URL of the Finney API (default: https://finney.finance)
 */

import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { FinneyClient } from "./api-client.js";
import { tools, createToolHandler } from "./tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3100;

// ─── Helpers ─────────────────────────────────────────────────────

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

// ─── Session store ───────────────────────────────────────────────

const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();

function createSession(token: string): { transport: StreamableHTTPServerTransport; server: Server; sessionId: string } {
  const sessionId = randomUUID();
  const client = new FinneyClient(token);
  const handleToolCall = createToolHandler(client);

  const server = new Server(
    { name: "finney-mcp-http", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const result = await handleToolCall(name, args);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }],
        isError: true,
      };
    }
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    onsessioninitialized: (id) => {
      sessions.set(id, { transport, server });
    },
  });

  // Clean up on close
  transport.onclose = () => {
    sessions.delete(sessionId);
  };

  return { transport, server, sessionId };
}

// ─── Express app ─────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Serve static files (logo, etc.)
app.use("/public", express.static(path.join(__dirname, "public")));

// ─── MCP endpoint ────────────────────────────────────────────────

app.all("/mcp", async (req: Request, res: Response) => {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing Authorization header. Use: Bearer <your-finney-api-key>" });
    return;
  }

  // Check for existing session
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // For non-POST without valid session, reject
  if (req.method !== "POST") {
    res.status(400).json({ error: "No valid session. Start with a POST to /mcp." });
    return;
  }

  // New session
  const session = createSession(token);
  await session.server.connect(session.transport);
  await session.transport.handleRequest(req, res, req.body);
});

// ─── Health endpoint ─────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    server: "finney-mcp-http",
    version: "1.0.0",
    tools: tools.length,
    activeSessions: sessions.size,
    uptime: process.uptime(),
  });
});

// ─── Landing page ────────────────────────────────────────────────

app.get("/", (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Finney MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(100, 116, 139, 0.3);
      border-radius: 16px;
      padding: 3rem;
      max-width: 640px;
      width: 100%;
      backdrop-filter: blur(10px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo { width: 64px; height: 64px; margin-bottom: 1.5rem; border-radius: 12px; }
    h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; color: #f1f5f9; }
    .subtitle { color: #94a3b8; font-size: 1.125rem; margin-bottom: 2rem; }
    .badge {
      display: inline-block;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 9999px;
      padding: 0.25rem 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 2rem;
    }
    .section { margin-bottom: 1.5rem; }
    .section h2 { font-size: 1rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.5rem; }
    code {
      display: block;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(100, 116, 139, 0.2);
      border-radius: 8px;
      padding: 1rem;
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      color: #a5b4fc;
      overflow-x: auto;
      white-space: pre;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat {
      text-align: center;
      padding: 1rem;
      background: rgba(15, 23, 42, 0.4);
      border-radius: 8px;
      border: 1px solid rgba(100, 116, 139, 0.15);
    }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #60a5fa; }
    .stat-label { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 2rem; font-size: 0.75rem; color: #475569; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/public/logo.png" alt="Finney" class="logo" onerror="this.style.display='none'" />
    <h1>Finney MCP Server</h1>
    <p class="subtitle">AI Finance Tool Builder Platform</p>
    <span class="badge">Streamable HTTP Transport</span>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${tools.length}</div>
        <div class="stat-label">Tools</div>
      </div>
      <div class="stat">
        <div class="stat-value">HTTP</div>
        <div class="stat-label">Transport</div>
      </div>
      <div class="stat">
        <div class="stat-value">v1.0</div>
        <div class="stat-label">Version</div>
      </div>
    </div>

    <div class="section">
      <h2>MCP Endpoint</h2>
      <code>POST /mcp
Authorization: Bearer &lt;your-finney-api-key&gt;</code>
    </div>

    <div class="section">
      <h2>Claude Desktop Config</h2>
      <code>{
  "mcpServers": {
    "finney": {
      "type": "streamable-http",
      "url": "http://localhost:${PORT}/mcp",
      "headers": {
        "Authorization": "Bearer &lt;your-finney-api-key&gt;"
      }
    }
  }
}</code>
    </div>

    <div class="section">
      <h2>Quick Links</h2>
      <p><a href="/health">/health</a> &mdash; Server health check</p>
      <p><a href="https://finney.finance" target="_blank">finney.finance</a> &mdash; Finney Platform</p>
    </div>
  </div>
  <div class="footer">Finney MCP Server &copy; 2026</div>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// ─── Start ───────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Finney MCP HTTP server listening on port ${PORT}`);
  console.log(`  Landing page: http://localhost:${PORT}/`);
  console.log(`  MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  Tools: ${tools.length}`);
});
