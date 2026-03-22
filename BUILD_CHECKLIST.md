# Finney MCP Server - Full Release Checklist

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Server Built | DONE | 69 tools, Express + MCP SDK |
| 2 | Deployed to Railway | DONE | finneymcp.agenticledger.ai |
| 3 | GitHub Repo | DONE | agenticledger/finney-mcp-http |
| 4 | Documentation (docs/index.html) | DONE | Interactive dark-themed docs with sidebar, search, tool cards |
| 5 | Testing (test/test-tools.ts) | DONE | Live API tests against finneymcp.agenticledger.ai |
| 6 | README + TEST-RESULTS | DONE | README.md, docs/TEST-RESULTS.md |
| 7 | Reference Comparison | DONE | Compared against existing MCP servers in financestackmcps |
| 8 | MCPLive Demo Page | DONE | Added to SERVERS + PAGE_CODES, built, public/finney/ generated |
| 8.5 | AgentHub Integration | DONE | mcp-servers/finney/, index.ts, capabilityService.ts, ChatPage.tsx |
| 8.7 | Claude Code Registration | DONE | Added to ~/.mcp.json as HTTP type |
| 9 | PlatformAuth Catalog | DONE | Registered via admin API |
| 10 | Summary | DONE | All phases complete |

## Server Details

- **URL:** https://finneymcp.agenticledger.ai
- **MCP Endpoint:** POST /mcp (Authorization: Bearer fin_live_xxx)
- **Tools:** 69
- **Transport:** Streamable HTTP
- **GitHub:** https://github.com/agenticledger/finney-mcp-http
- **MCPLive:** https://financemcps.agenticledger.ai/finney/
- **Category:** AI App Builder

## Tool Categories (69 tools)

- Guide (1): finney_readme
- Apps (3): list_apps, delete_app, update_env_vars
- Tools (2): get_tool, delete_tool
- Builds (5): build, trigger_build, get_build_status, list_builds, build_upload, build_stream
- Deploy & Preview (5): deploy, trigger_deploy, regenerate_preview, preview_health, test_routes
- Auth (5): signup, convert_account, complete_oauth, platform_login, setup_anonymous
- Marketplace (11): list_categories, list_marketplace, create_listing, get_listing, update_listing, delete_listing, publish_listing, get_reviews, submit_review, update_review, delete_review
- Admin (3): admin_listings, admin_moderate, install_listing
- Organizations (8): list_orgs, create_org, search_orgs, get_org, update_org, delete_org, list_members, invite_member, update_member, remove_member
- Users (2): get_profile, update_profile
- API Keys (5): list_api_keys, create_api_key, get_api_key, update_api_key, delete_api_key
- Sharing (3): list_shares, create_share, manage_share
- Logs & Monitoring (2): get_railway_logs, dashboard_stats
- Chat (1): finney_chat
- Skills (1): finney_list_skills
- Platform Settings (3): get_settings, update_settings, register_tool
- Health & Debug (5): health, debug_app, test_e2b, test_github, test_email
- Notifications (1): get_notifications
