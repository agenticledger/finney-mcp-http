# Finney MCP Server - Test Results

## Test Run: 2026-03-22

**Target:** https://finneymcp.agenticledger.ai
**Pass Rate:** 10/10 (100%)
**Average Latency:** 109ms

## Results

| # | Test | Status | Latency | Notes |
|---|------|--------|---------|-------|
| 1 | GET /health | PASS | 210ms | Returns status:"ok", tools:69 |
| 2 | GET / (landing) | PASS | 147ms | HTML page with "Finney MCP Server" |
| 3 | OAuth Discovery | PASS | 47ms | .well-known/oauth-authorization-server |
| 4 | tools/list (MCP) | PASS | 136ms | Returns 69 tools via Streamable HTTP |
| 5 | finney_readme | PASS | 75ms | Guide tool returns workflow steps |
| 6 | finney_health | PASS | 103ms | API health check via tool |
| 7 | finney_list_categories | PASS | 89ms | Marketplace categories |
| 8 | finney_list_skills | PASS | 96ms | Platform skills list |
| 9 | finney_get_settings | PASS | 91ms | Platform settings |
| 10 | finney_dashboard_stats | PASS | 95ms | Dashboard statistics |

## Test Categories

- **HTTP Endpoints (3):** Health, landing page, OAuth discovery
- **MCP Protocol (1):** tools/list returns all 69 tools
- **Tool Execution (6):** Representative tools from Guide, Health, Marketplace, Skills, Settings, Logs

## How to Run

```bash
cd finney-mcp-http
npx tsx test/test-tools.ts
```
