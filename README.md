# Finney MCP Server (HTTP)

Exposes the **Finney** AI app builder platform as a Model Context Protocol (MCP) server over Streamable HTTP transport. 69 tools covering app building, deployment, marketplace, organizations, sharing, and monitoring.

## Live Server

| | |
|---|---|
| **URL** | `https://finneymcp.agenticledger.ai` |
| **MCP Endpoint** | `POST /mcp` |
| **Health** | `GET /health` |
| **Tools** | 69 |
| **Transport** | Streamable HTTP |
| **Auth** | Bearer token (Finney API key) |

## Quick Start

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "finney": {
      "type": "url",
      "url": "https://finneymcp.agenticledger.ai/mcp",
      "headers": {
        "Authorization": "Bearer <your-finney-api-key>"
      }
    }
  }
}
```

### cURL

```bash
curl -X POST https://finneymcp.agenticledger.ai/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fin_live_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

## Tool Categories (69 tools)

| Category | Count | Key Tools |
|----------|-------|-----------|
| Guide | 1 | `finney_readme` |
| Apps | 3 | `list_apps`, `delete_app`, `update_env_vars` |
| Tools | 2 | `get_tool`, `delete_tool` |
| Builds | 6 | `trigger_build`, `get_build_status`, `list_builds` |
| Deploy | 5 | `trigger_deploy`, `preview_health`, `test_routes` |
| Auth | 5 | `signup`, `convert_account`, `setup_anonymous` |
| Marketplace | 16 | `list_marketplace`, `create_listing`, `publish_listing`, reviews |
| Organizations | 10 | CRUD, members, invites |
| Users | 2 | `get_profile`, `update_profile` |
| API Keys | 5 | CRUD for API keys |
| Sharing | 3 | `create_share`, `manage_share` |
| Logs | 2 | `get_railway_logs`, `dashboard_stats` |
| Chat | 1 | `finney_chat` |
| Skills | 1 | `finney_list_skills` |
| Settings | 3 | `get_settings`, `update_settings`, `register_tool` |
| Health | 5 | `health`, `debug_app`, `test_e2b`, `test_github` |

## Recommended Workflow

1. **Build**: `finney_trigger_build` (appId="new", prompt="...") - returns immediately
2. **Poll**: `finney_get_build_status` every 15-30s until "success"
3. **Inspect**: `finney_get_tool` to get preview_url and sandbox_id
4. **Deploy**: `finney_trigger_deploy` with appId + sandboxId
5. **List**: `finney_create_listing` to publish on marketplace

## Development

```bash
npm install
npm run dev          # Start with tsx (hot reload)
npm run build        # TypeScript compile
npm start            # Run compiled version
```

## Testing

```bash
npx tsx test/test-tools.ts
```

See [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md) for latest test results.

## Architecture

- **Express** + `@modelcontextprotocol/sdk` Streamable HTTP transport
- Per-session MCP server instances with separate API clients
- OAuth 2.0 + PKCE support for browser-based clients
- Bearer token passthrough for CLI/agent usage
- Deployed on Railway at `finneymcp.agenticledger.ai`

## Links

- [API Documentation](https://financemcps.agenticledger.ai/finney/)
- [Finney Platform](https://finney.finance)
- [AgenticLedger](https://agenticledger.ai)
