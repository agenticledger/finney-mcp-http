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
import { randomUUID, createHash } from "node:crypto";
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
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${PORT}`;
const SLUG = 'finney';

// ─── OAuth stores (in-memory, ephemeral) ─────────────────────────

const TOKEN_TTL_MS = 60 * 60 * 1000;
interface OAuthToken { apiKey: string; expiresAt: number; }
const oauthTokens = new Map<string, OAuthToken>();
setInterval(() => { const now = Date.now(); for (const [t, d] of oauthTokens) { if (now > d.expiresAt) oauthTokens.delete(t); } }, 10 * 60 * 1000);

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
interface AuthCode { apiKey: string; codeChallenge: string; codeChallengeMethod: string; redirectUri: string; expiresAt: number; }
const authCodes = new Map<string, AuthCode>();
setInterval(() => { const now = Date.now(); for (const [c, d] of authCodes) { if (now > d.expiresAt) authCodes.delete(c); } }, 2 * 60 * 1000);

function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method === 'S256') return createHash('sha256').update(codeVerifier).digest('base64url') === codeChallenge;
  if (method === 'plain') return codeVerifier === codeChallenge;
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────

function resolveApiKey(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (token.startsWith('mcp_')) {
    const entry = oauthTokens.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { oauthTokens.delete(token); return null; }
    return entry.apiKey;
  }
  return token;
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
app.use(express.urlencoded({ extended: false }));

// Serve static files (logo, etc.)
app.use("/public", express.static(path.join(__dirname, "public")));

// ─── MCP endpoint ────────────────────────────────────────────────

app.all("/mcp", async (req: Request, res: Response) => {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header.',
      modes: {
        bearer: 'Authorization: Bearer <your-api-key>',
        oauth: `POST ${SERVER_BASE_URL}/oauth/token with client_id=${SLUG}&client_secret=<your-api-key>&grant_type=client_credentials`,
      },
    });
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
  const session = createSession(apiKey);
  await session.server.connect(session.transport);
  await session.transport.handleRequest(req, res, req.body);
});

// ─── OAuth 2.0 endpoints ────────────────────────────────────────

app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json({
    issuer: SERVER_BASE_URL, authorization_endpoint: `${SERVER_BASE_URL}/authorize`,
    token_endpoint: `${SERVER_BASE_URL}/oauth/token`, revocation_endpoint: `${SERVER_BASE_URL}/oauth/revoke`,
    registration_endpoint: `${SERVER_BASE_URL}/oauth/register`,
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
    service_documentation: `https://financemcps.agenticledger.ai/${SLUG}/`,
  });
});

app.post('/oauth/register', (req, res) => {
  res.status(201).json({ client_id: SLUG, client_name: req.body?.client_name || 'MCP Client',
    redirect_uris: req.body?.redirect_uris || [], grant_types: ['authorization_code'],
    response_types: ['code'], token_endpoint_auth_method: 'none' });
});

app.get('/authorize', (req: Request, res: Response) => {
  const { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state, scope } = req.query as Record<string, string>;
  if (response_type !== 'code') { res.status(400).json({ error: 'unsupported_response_type' }); return; }
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Authorize - Finney MCP</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>:root{--primary:#2563EB;--primary-dark:#1D4ED8;--primary-50:#EFF6FF;--fg:#0F172A;--muted:#64748B;--surface:#F8FAFC;--border:#E2E8F0;--success:#10B981;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:"DM Sans",sans-serif;color:var(--fg);min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--surface);background-image:linear-gradient(135deg,var(--primary-50) 0%,var(--surface) 50%,#F0F9FF 100%);}.card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:40px;max-width:480px;width:100%;margin:20px;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06);}.header{display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border);}.header img{height:36px;}.header span{font-size:18px;font-weight:700;}.consent-msg{font-size:14px;color:var(--muted);margin-bottom:20px;line-height:1.6;}.consent-msg strong{color:var(--fg);}.key-label{font-size:13px;font-weight:600;margin-bottom:8px;display:block;}.key-input{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:10px;font-family:"JetBrains Mono",monospace;font-size:13px;margin-bottom:6px;}.key-input:focus{outline:none;border-color:var(--primary);}.key-hint{font-size:11px;color:var(--muted);margin-bottom:24px;}.btn-authorize{width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-family:"DM Sans",sans-serif;font-size:15px;font-weight:600;cursor:pointer;}.btn-authorize:hover{background:var(--primary-dark);}.btn-authorize:disabled{background:var(--border);cursor:not-allowed;}.trust-row{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);margin-top:16px;}.trust-row svg{width:14px;height:14px;color:var(--success);}.footer{margin-top:20px;padding-top:16px;border-top:1px solid var(--border);text-align:center;font-size:11px;color:var(--muted);}</style></head><body><div class="card"><div class="header"><img src="/public/logo.png" alt="AgenticLedger"><span>Finney MCP</span></div><div class="consent-msg">An application wants to connect to <strong>Finney MCP Server</strong> on your behalf. Enter your API key to authorize access.</div><form method="POST" action="/authorize"><input type="hidden" name="client_id" value="${client_id || ''}"><input type="hidden" name="redirect_uri" value="${redirect_uri || ''}"><input type="hidden" name="code_challenge" value="${code_challenge || ''}"><input type="hidden" name="code_challenge_method" value="${code_challenge_method || 'S256'}"><input type="hidden" name="state" value="${state || ''}"><input type="hidden" name="scope" value="${scope || ''}"><label class="key-label">Your Finney API Key</label><input type="password" class="key-input" name="api_key" id="apiKey" placeholder="fin_live_..." required autofocus oninput="document.getElementById('authBtn').disabled=!this.value"><div class="key-hint">Your key creates a temporary token. It is not stored permanently.</div><button type="submit" class="btn-authorize" id="authBtn" disabled>Authorize</button></form><div class="trust-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>No credentials stored permanently</div><div class="footer">Powered by AgenticLedger</div></div></body></html>`);
});

app.post('/authorize', (req: Request, res: Response) => {
  const { api_key, redirect_uri, code_challenge, code_challenge_method, state } = req.body;
  if (!api_key) { res.status(400).send('API key is required'); return; }
  if (!redirect_uri) { res.status(400).json({ error: 'invalid_request' }); return; }
  const code = `authcode_${randomUUID().replace(/-/g, '')}`;
  authCodes.set(code, { apiKey: api_key, codeChallenge: code_challenge || '', codeChallengeMethod: code_challenge_method || 'S256', redirectUri: redirect_uri, expiresAt: Date.now() + AUTH_CODE_TTL_MS });
  const url = new URL(redirect_uri); url.searchParams.set('code', code); if (state) url.searchParams.set('state', state);
  res.redirect(302, url.toString());
});

app.post('/oauth/token', (req: Request, res: Response) => {
  const { grant_type } = req.body;
  if (grant_type === 'authorization_code') {
    const { code, code_verifier, redirect_uri } = req.body;
    if (!code) { res.status(400).json({ error: 'invalid_request' }); return; }
    const entry = authCodes.get(code); if (!entry) { res.status(400).json({ error: 'invalid_grant' }); return; }
    authCodes.delete(code);
    if (Date.now() > entry.expiresAt) { res.status(400).json({ error: 'invalid_grant' }); return; }
    if (redirect_uri && redirect_uri !== entry.redirectUri) { res.status(400).json({ error: 'invalid_grant' }); return; }
    if (entry.codeChallenge && (!code_verifier || !verifyPKCE(code_verifier, entry.codeChallenge, entry.codeChallengeMethod))) { res.status(400).json({ error: 'invalid_grant' }); return; }
    const accessToken = `mcp_${randomUUID().replace(/-/g, '')}`;
    oauthTokens.set(accessToken, { apiKey: entry.apiKey, expiresAt: Date.now() + TOKEN_TTL_MS });
    res.json({ access_token: accessToken, token_type: 'bearer', expires_in: TOKEN_TTL_MS / 1000 }); return;
  }
  if (grant_type === 'client_credentials') {
    const { client_id, client_secret } = req.body;
    if (client_id !== SLUG) { res.status(400).json({ error: 'invalid_client' }); return; }
    if (!client_secret) { res.status(400).json({ error: 'invalid_request' }); return; }
    const accessToken = `mcp_${randomUUID().replace(/-/g, '')}`;
    oauthTokens.set(accessToken, { apiKey: client_secret, expiresAt: Date.now() + TOKEN_TTL_MS });
    res.json({ access_token: accessToken, token_type: 'bearer', expires_in: TOKEN_TTL_MS / 1000 }); return;
  }
  res.status(400).json({ error: 'unsupported_grant_type' });
});

app.post('/oauth/revoke', (req: Request, res: Response) => {
  const { token } = req.body; if (token) oauthTokens.delete(token);
  res.json({ status: 'revoked' });
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
