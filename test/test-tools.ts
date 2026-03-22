/**
 * Finney MCP Server — Live API Tests
 *
 * Tests representative tools against the live deployed server.
 * Run: npx tsx test/test-tools.ts
 */

const BASE_URL = "https://finneymcp.agenticledger.ai";
const API_KEY = process.env.FINNEY_API_KEY || "fin_live_ixXLZjtJoXPD5nN6O1v-W8V272fA2UvU";

interface TestResult {
  tool: string;
  passed: boolean;
  status: number;
  latencyMs: number;
  error?: string;
}

const results: TestResult[] = [];

/** Parse SSE response body to extract JSON-RPC result */
function parseSSE(body: string): any {
  const lines = body.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        return JSON.parse(line.slice(6));
      } catch {}
    }
  }
  // Try parsing as plain JSON
  try { return JSON.parse(body); } catch {}
  return null;
}

async function mcpCall(toolName: string, args: Record<string, unknown> = {}): Promise<{ status: number; data: unknown; latencyMs: number }> {
  const start = Date.now();

  // Initialize session
  const initRes = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    }),
  });

  const sessionId = initRes.headers.get("mcp-session-id");
  // Consume init body
  await initRes.text();

  // Call tool
  const toolRes = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${API_KEY}`,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  const latencyMs = Date.now() - start;
  const rawBody = await toolRes.text();
  const data = parseSSE(rawBody);
  return { status: toolRes.status, data, latencyMs };
}

async function testTool(name: string, args: Record<string, unknown> = {}) {
  try {
    const { status, data, latencyMs } = await mcpCall(name, args);
    const hasResult = data?.result?.content?.length > 0;
    const passed = status === 200 && hasResult;
    results.push({ tool: name, passed, status, latencyMs });
    console.log(`${passed ? "PASS" : "FAIL"} ${name} (${latencyMs}ms, HTTP ${status})`);
    if (!passed) console.log("  Response:", JSON.stringify(data).substring(0, 300));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ tool: name, passed: false, status: 0, latencyMs: 0, error: message });
    console.log(`FAIL ${name} - ${message}`);
  }
}

async function testHealthEndpoint() {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json() as { status: string; tools: number };
    const latencyMs = Date.now() - start;
    const passed = res.status === 200 && data.status === "ok" && data.tools === 69;
    results.push({ tool: "GET /health", passed, status: res.status, latencyMs });
    console.log(`${passed ? "PASS" : "FAIL"} GET /health (${latencyMs}ms) — tools: ${data.tools}`);
  } catch (err) {
    results.push({ tool: "GET /health", passed: false, status: 0, latencyMs: 0, error: String(err) });
    console.log(`FAIL GET /health — ${err}`);
  }
}

async function testLandingPage() {
  const start = Date.now();
  try {
    const res = await fetch(BASE_URL);
    const html = await res.text();
    const latencyMs = Date.now() - start;
    const passed = res.status === 200 && html.includes("Finney MCP Server");
    results.push({ tool: "GET /", passed, status: res.status, latencyMs });
    console.log(`${passed ? "PASS" : "FAIL"} GET / landing page (${latencyMs}ms)`);
  } catch (err) {
    results.push({ tool: "GET /", passed: false, status: 0, latencyMs: 0, error: String(err) });
    console.log(`FAIL GET / — ${err}`);
  }
}

async function testListTools() {
  const start = Date.now();
  try {
    const initRes = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    const sessionId = initRes.headers.get("mcp-session-id");
    await initRes.text();

    const listRes = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${API_KEY}`,
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });

    const rawBody = await listRes.text();
    const data = parseSSE(rawBody);
    const latencyMs = Date.now() - start;
    const toolCount = data?.result?.tools?.length || 0;
    const passed = listRes.status === 200 && toolCount === 69;
    results.push({ tool: "tools/list", passed, status: listRes.status, latencyMs });
    console.log(`${passed ? "PASS" : "FAIL"} tools/list (${latencyMs}ms) — ${toolCount} tools`);
  } catch (err) {
    results.push({ tool: "tools/list", passed: false, status: 0, latencyMs: 0, error: String(err) });
    console.log(`FAIL tools/list — ${err}`);
  }
}

async function testOAuthDiscovery() {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
    const data = await res.json() as Record<string, unknown>;
    const latencyMs = Date.now() - start;
    const passed = res.status === 200 && !!data.token_endpoint && !!data.authorization_endpoint;
    results.push({ tool: "OAuth Discovery", passed, status: res.status, latencyMs });
    console.log(`${passed ? "PASS" : "FAIL"} OAuth Discovery (${latencyMs}ms)`);
  } catch (err) {
    results.push({ tool: "OAuth Discovery", passed: false, status: 0, latencyMs: 0, error: String(err) });
    console.log(`FAIL OAuth Discovery — ${err}`);
  }
}

async function main() {
  console.log("=== Finney MCP Server — Live API Tests ===");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  // HTTP endpoint tests
  console.log("--- HTTP Endpoints ---");
  await testHealthEndpoint();
  await testLandingPage();
  await testOAuthDiscovery();

  // MCP protocol tests
  console.log("\n--- MCP Protocol ---");
  await testListTools();

  // Tool execution tests
  console.log("\n--- Tool Execution ---");
  await testTool("finney_readme");
  await testTool("finney_health");
  await testTool("finney_list_categories");
  await testTool("finney_list_skills");
  await testTool("finney_get_settings");
  await testTool("finney_dashboard_stats");

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const avgLatency = Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / total);

  console.log("\n=== Results ===");
  console.log(`Pass rate: ${passed}/${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Average latency: ${avgLatency}ms`);

  if (passed < total) {
    console.log("\nFailed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.tool}: ${r.error || `HTTP ${r.status}`}`);
    });
  }

  // Exit with error if any failures
  process.exit(passed === total ? 0 : 1);
}

main();
