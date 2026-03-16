/**
 * Finney MCP Tool Definitions and Handlers — HTTP transport version
 */

import { FinneyClient } from "./api-client.js";

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ─── Tool Definitions ────────────────────────────────────────────

export const tools: ToolDef[] = [
  // ── Apps ──────────────────────────────────────────────────────
  {
    name: "finney_list_apps",
    description: "List all apps on the Finney platform. Optionally filter by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by app status (e.g. 'deployed', 'building', 'draft')" },
        limit: { type: "number", description: "Max number of apps to return (default: 20)" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "finney_delete_app",
    description: "Delete an app from the Finney platform.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to delete" },
      },
      required: ["appId"],
    },
  },
  {
    name: "finney_update_env_vars",
    description: "Update environment variables for an app.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID" },
        env_vars: { type: "object", description: "Key-value pairs of environment variables to set", additionalProperties: { type: "string" } },
      },
      required: ["appId", "env_vars"],
    },
  },

  // ── Tools ─────────────────────────────────────────────────────
  {
    name: "finney_get_tool",
    description: "Get detailed information about a specific tool/app by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The tool ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "finney_delete_tool",
    description: "Delete a tool by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The tool ID to delete" },
      },
      required: ["id"],
    },
  },

  // ── Builds ────────────────────────────────────────────────────
  {
    name: "finney_build",
    description: "Start a new app build from a prompt. Creates a new app and begins building it.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Build prompt describing what to create" },
        appName: { type: "string", description: "Optional name for the new app" },
        description: { type: "string", description: "Optional description for the app" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "finney_trigger_build",
    description: "Trigger a new build for an existing app. Provide a prompt describing what to build or change.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to build" },
        prompt: { type: "string", description: "Build prompt describing what to create or modify" },
        mode: { type: "string", enum: ["build", "modify", "fix"], description: "Build mode: 'build' for new, 'modify' to change, 'fix' to repair (default: build)" },
        envVars: { type: "object", description: "Environment variables to pass to the build", additionalProperties: { type: "string" } },
        needsDatabase: { type: "boolean", description: "Whether the app needs a database provisioned" },
      },
      required: ["appId", "prompt"],
    },
  },
  {
    name: "finney_get_build_status",
    description: "Check the current status, phase, and progress of a build.",
    inputSchema: {
      type: "object",
      properties: {
        buildId: { type: "string", description: "The build ID to check" },
      },
      required: ["buildId"],
    },
  },
  {
    name: "finney_list_builds",
    description: "List builds for an app with tracking data.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID" },
        limit: { type: "number", description: "Max number of builds to return" },
      },
      required: ["appId"],
    },
  },
  {
    name: "finney_build_upload",
    description: "Upload a file to build an app (multipart/form-data). NOTE: File upload is not supported via MCP tool calls. Use the Finney web UI or a direct HTTP client instead.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_build_stream",
    description: "Start a streaming build. Consumes the SSE build stream and returns the final result with all events.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Build prompt describing what to create or modify" },
        appId: { type: "string", description: "Optional app ID for modifying an existing app" },
        mode: { type: "string", description: "Build mode (e.g. 'build', 'modify', 'fix')" },
      },
      required: ["prompt"],
    },
  },

  // ── Deploy & Preview ──────────────────────────────────────────
  {
    name: "finney_deploy",
    description: "Deploy an app to production. Consumes the SSE deploy stream and returns the final result.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to deploy" },
        sandboxId: { type: "string", description: "The sandbox ID to deploy from" },
      },
      required: ["appId", "sandboxId"],
    },
  },
  {
    name: "finney_regenerate_preview",
    description: "Regenerate the preview for an app, returning a new preview URL.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID" },
      },
      required: ["appId"],
    },
  },
  {
    name: "finney_preview_health",
    description: "Run a health check on the app's preview environment.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID" },
      },
      required: ["appId"],
    },
  },
  {
    name: "finney_test_routes",
    description: "Test specific routes of an app's preview. Optionally specify routes to test.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID" },
        routes: { type: "string", description: "Comma-separated list of routes to test (e.g. '/,/api/health,/dashboard')" },
      },
      required: ["appId"],
    },
  },

  // ── Auth ──────────────────────────────────────────────────────
  {
    name: "finney_signup",
    description: "Create a new user account on the Finney platform.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email address" },
        password: { type: "string", description: "Password" },
        orgName: { type: "string", description: "Optional organization name to create" },
      },
      required: ["email", "password"],
    },
  },
  {
    name: "finney_convert_account",
    description: "Convert an anonymous account to a full account with email and password.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email address" },
        password: { type: "string", description: "Password" },
        orgName: { type: "string", description: "Optional organization name" },
      },
      required: ["email", "password"],
    },
  },
  {
    name: "finney_complete_oauth",
    description: "Complete an OAuth sign-in flow, optionally creating an organization.",
    inputSchema: {
      type: "object",
      properties: {
        orgName: { type: "string", description: "Optional organization name to create" },
      },
    },
  },
  {
    name: "finney_platform_login",
    description: "Complete platform login via OAuth code exchange.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "OAuth authorization code" },
        state: { type: "string", description: "OAuth state parameter" },
      },
      required: ["code"],
    },
  },
  {
    name: "finney_setup_anonymous",
    description: "Create an anonymous session for quick-start usage without sign-up.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Marketplace ───────────────────────────────────────────────
  {
    name: "finney_list_categories",
    description: "List all available marketplace categories.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_list_marketplace",
    description: "Browse marketplace listings. Search by keyword or filter by category.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search keyword" },
        category: { type: "string", description: "Category filter" },
        status: { type: "string", description: "Status filter (e.g. 'published', 'draft')" },
        limit: { type: "number", description: "Max number of listings to return" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },
  {
    name: "finney_create_listing",
    description: "Create a new marketplace listing for an app.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Listing name" },
        description: { type: "string", description: "Listing description" },
        category: { type: "string", description: "Category for the listing" },
        repoUrl: { type: "string", description: "Repository URL" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for the listing" },
      },
      required: ["name", "description", "category"],
    },
  },
  {
    name: "finney_get_listing",
    description: "Get details of a specific marketplace listing by slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "finney_update_listing",
    description: "Update a marketplace listing.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug" },
        name: { type: "string", description: "Updated name" },
        description: { type: "string", description: "Updated description" },
        category: { type: "string", description: "Updated category" },
        status: { type: "string", description: "Updated status" },
        tags: { type: "array", items: { type: "string" }, description: "Updated tags" },
      },
      required: ["slug"],
    },
  },
  {
    name: "finney_delete_listing",
    description: "Delete a marketplace listing.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug to delete" },
      },
      required: ["slug"],
    },
  },
  {
    name: "finney_publish_listing",
    description: "Publish a marketplace listing, making it visible to all users.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug to publish" },
      },
      required: ["slug"],
    },
  },
  {
    name: "finney_get_reviews",
    description: "Get reviews for a marketplace listing.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug" },
        limit: { type: "number", description: "Max number of reviews to return" },
        offset: { type: "number", description: "Offset for pagination" },
      },
      required: ["slug"],
    },
  },
  {
    name: "finney_submit_review",
    description: "Submit a review for a marketplace listing.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug" },
        rating: { type: "number", description: "Rating (1-5)" },
        comment: { type: "string", description: "Review comment" },
      },
      required: ["slug", "rating"],
    },
  },
  {
    name: "finney_update_review",
    description: "Update an existing review on a marketplace listing.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug" },
        reviewId: { type: "string", description: "The review ID to update" },
        rating: { type: "number", description: "Updated rating (1-5)" },
        comment: { type: "string", description: "Updated comment" },
      },
      required: ["slug", "reviewId"],
    },
  },
  {
    name: "finney_delete_review",
    description: "Delete a review from a marketplace listing.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The listing slug" },
        reviewId: { type: "string", description: "The review ID to delete" },
      },
      required: ["slug", "reviewId"],
    },
  },
  {
    name: "finney_admin_listings",
    description: "Get all marketplace listings for admin moderation (admin only).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_admin_moderate",
    description: "Moderate a marketplace listing — approve, reject, or suspend (admin only).",
    inputSchema: {
      type: "object",
      properties: {
        listingId: { type: "string", description: "The listing ID to moderate" },
        status: { type: "string", description: "New status (e.g. 'approved', 'rejected', 'suspended')" },
        rejectionReason: { type: "string", description: "Reason for rejection (if rejecting)" },
      },
      required: ["listingId", "status"],
    },
  },
  {
    name: "finney_install_listing",
    description: "Install an app from a marketplace listing into your workspace.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: { type: "string", description: "The marketplace listing ID to install" },
      },
      required: ["listingId"],
    },
  },
  {
    name: "finney_get_notifications",
    description: "Get marketplace notifications for the current user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Organizations ─────────────────────────────────────────────
  {
    name: "finney_list_orgs",
    description: "List all organizations the current user belongs to.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_create_org",
    description: "Create a new organization.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Organization name" },
        slug: { type: "string", description: "URL-friendly slug for the organization" },
      },
      required: ["name"],
    },
  },
  {
    name: "finney_search_orgs",
    description: "Search organizations by name.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query" },
      },
      required: ["q"],
    },
  },
  {
    name: "finney_get_org",
    description: "Get details of a specific organization.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The organization ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "finney_update_org",
    description: "Update an organization's name or slug.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The organization ID" },
        name: { type: "string", description: "Updated name" },
        slug: { type: "string", description: "Updated slug" },
      },
      required: ["id"],
    },
  },
  {
    name: "finney_delete_org",
    description: "Delete an organization.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The organization ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "finney_list_members",
    description: "List members of an organization.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "The organization ID" },
      },
      required: ["orgId"],
    },
  },
  {
    name: "finney_invite_member",
    description: "Invite a new member to an organization by email.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "The organization ID" },
        email: { type: "string", description: "Email address to invite" },
        role: { type: "string", description: "Role to assign (e.g. 'admin', 'member', 'viewer')" },
      },
      required: ["orgId", "email", "role"],
    },
  },
  {
    name: "finney_update_member",
    description: "Update a member's role in an organization.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "The organization ID" },
        memberId: { type: "string", description: "The member ID" },
        role: { type: "string", description: "New role to assign" },
      },
      required: ["orgId", "memberId", "role"],
    },
  },
  {
    name: "finney_remove_member",
    description: "Remove a member from an organization.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "The organization ID" },
        memberId: { type: "string", description: "The member ID to remove" },
      },
      required: ["orgId", "memberId"],
    },
  },

  // ── Users ─────────────────────────────────────────────────────
  {
    name: "finney_get_profile",
    description: "Get the current user's profile information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_update_profile",
    description: "Update the current user's profile.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Updated display name" },
        email: { type: "string", description: "Updated email address" },
      },
    },
  },

  // ── API Keys ──────────────────────────────────────────────────
  {
    name: "finney_list_api_keys",
    description: "List all API keys for the current user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_create_api_key",
    description: "Create a new API key.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the API key" },
        scopes: { type: "array", items: { type: "string" }, description: "Permission scopes (e.g. ['read', 'write', 'deploy'])" },
      },
      required: ["name"],
    },
  },
  {
    name: "finney_get_api_key",
    description: "Get details of a specific API key.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The API key ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "finney_update_api_key",
    description: "Update an API key's name or status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The API key ID" },
        status: { type: "string", description: "New status (e.g. 'active', 'revoked')" },
        name: { type: "string", description: "Updated name" },
      },
      required: ["id"],
    },
  },
  {
    name: "finney_delete_api_key",
    description: "Delete an API key.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The API key ID to delete" },
      },
      required: ["id"],
    },
  },

  // ── Sharing ───────────────────────────────────────────────────
  {
    name: "finney_list_shares",
    description: "List app shares. Optionally filter by type or app ID.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by share type" },
        appId: { type: "string", description: "Filter by app ID" },
      },
    },
  },
  {
    name: "finney_create_share",
    description: "Share an app with a user or organization.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to share" },
        sharedWith: { type: "string", description: "User ID or org ID to share with" },
        sharedWithType: { type: "string", description: "Type of recipient: 'user' or 'organization'" },
        permission: { type: "string", description: "Permission level: 'view', 'edit', 'admin'" },
      },
      required: ["appId", "sharedWith", "sharedWithType", "permission"],
    },
  },
  {
    name: "finney_manage_share",
    description: "Manage an existing share — accept, reject, or revoke it.",
    inputSchema: {
      type: "object",
      properties: {
        shareId: { type: "string", description: "The share ID to manage" },
        action: { type: "string", description: "Action to take: 'accept', 'reject', 'revoke'" },
      },
      required: ["shareId", "action"],
    },
  },

  // ── Logs & Monitoring ─────────────────────────────────────────
  {
    name: "finney_get_railway_logs",
    description: "Get Railway deployment logs for an app. Filter by log type and time range.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID" },
        type: { type: "string", enum: ["build", "deploy", "http"], description: "Log type filter" },
        limit: { type: "number", description: "Max number of log entries" },
        since: { type: "string", description: "ISO date string — only return logs after this time" },
      },
      required: ["appId"],
    },
  },
  {
    name: "finney_dashboard_stats",
    description: "Get dashboard statistics: app counts by status across the platform.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Chat ──────────────────────────────────────────────────────
  {
    name: "finney_chat",
    description: "Send a chat message to the Finney AI assistant. Returns the AI response.",
    inputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          description: "Array of chat messages",
          items: {
            type: "object",
            properties: {
              role: { type: "string", description: "Message role: 'user' or 'assistant'" },
              content: { type: "string", description: "Message content" },
            },
            required: ["role", "content"],
          },
        },
      },
      required: ["messages"],
    },
  },

  // ── Skills ────────────────────────────────────────────────────
  {
    name: "finney_list_skills",
    description: "List all available skills/capabilities on the platform.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // ── Platform Settings ─────────────────────────────────────────
  {
    name: "finney_get_settings",
    description: "Get platform settings.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_update_settings",
    description: "Update a platform setting (admin only).",
    inputSchema: {
      type: "object",
      properties: {
        setting_name: { type: "string", description: "The setting name to update" },
        setting_value: { description: "The new value for the setting" },
      },
      required: ["setting_name", "setting_value"],
    },
  },
  {
    name: "finney_register_tool",
    description: "Register an external tool/service with the platform.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool name" },
        description: { type: "string", description: "Tool description" },
        url: { type: "string", description: "Tool endpoint URL" },
        type: { type: "string", description: "Tool type (e.g. 'mcp', 'api', 'webhook')" },
      },
      required: ["name", "description", "url", "type"],
    },
  },

  // ── Health & Debug ────────────────────────────────────────────
  {
    name: "finney_health",
    description: "Check the health of the Finney API.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_debug_app",
    description: "Get debug information for an app — sandbox state, environment, recent errors.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "The app ID to debug" },
      },
      required: ["appId"],
    },
  },
  {
    name: "finney_test_e2b",
    description: "Test the E2B sandbox integration.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_test_github",
    description: "Test the GitHub integration.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finney_test_email",
    description: "Send a test email to verify email delivery.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body" },
      },
      required: ["to", "subject", "body"],
    },
  },
];

// ─── Tool Handler Factory ────────────────────────────────────────

type ToolArgs = Record<string, unknown>;

export function createToolHandler(client: FinneyClient) {
  return async function handleToolCall(name: string, args: ToolArgs): Promise<unknown> {
    switch (name) {
      // Apps
      case "finney_list_apps":
        return client.listApps({
          status: args.status as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        });

      case "finney_delete_app":
        return client.deleteApp(args.appId as string);

      case "finney_update_env_vars":
        return client.updateEnvVars(args.appId as string, args.env_vars as Record<string, string>);

      // Tools
      case "finney_get_tool":
        return client.getTool(args.id as string);

      case "finney_delete_tool":
        return client.deleteTool(args.id as string);

      // Builds
      case "finney_build":
        return client.build({
          prompt: args.prompt as string,
          appName: args.appName as string | undefined,
          description: args.description as string | undefined,
        });

      case "finney_trigger_build":
        return client.triggerBuild({
          appId: args.appId as string,
          prompt: args.prompt as string,
          mode: args.mode as "build" | "modify" | "fix" | undefined,
          envVars: args.envVars as Record<string, string> | undefined,
          needsDatabase: args.needsDatabase as boolean | undefined,
        });

      case "finney_get_build_status":
        return client.getBuildStatus(args.buildId as string);

      case "finney_list_builds":
        return client.listBuilds(args.appId as string, args.limit as number | undefined);

      case "finney_build_upload":
        return client.buildUpload();

      case "finney_build_stream":
        return client.buildStream({
          prompt: args.prompt as string,
          appId: args.appId as string | undefined,
          mode: args.mode as string | undefined,
        });

      // Deploy & Preview
      case "finney_deploy":
        return client.deploy(args.appId as string, args.sandboxId as string);

      case "finney_regenerate_preview":
        return client.regeneratePreview(args.appId as string);

      case "finney_preview_health":
        return client.previewHealth(args.appId as string);

      case "finney_test_routes":
        return client.testRoutes(args.appId as string, args.routes as string | undefined);

      // Auth
      case "finney_signup":
        return client.signup({
          email: args.email as string,
          password: args.password as string,
          orgName: args.orgName as string | undefined,
        });

      case "finney_convert_account":
        return client.convertAccount({
          email: args.email as string,
          password: args.password as string,
          orgName: args.orgName as string | undefined,
        });

      case "finney_complete_oauth":
        return client.completeOauth({ orgName: args.orgName as string | undefined });

      case "finney_platform_login":
        return client.platformLogin({
          code: args.code as string,
          state: args.state as string | undefined,
        });

      case "finney_setup_anonymous":
        return client.setupAnonymous();

      // Marketplace
      case "finney_list_categories":
        return client.listCategories();

      case "finney_list_marketplace":
        return client.listMarketplace({
          search: args.search as string | undefined,
          category: args.category as string | undefined,
          status: args.status as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        });

      case "finney_create_listing":
        return client.createListing({
          name: args.name as string,
          description: args.description as string,
          category: args.category as string,
          repoUrl: args.repoUrl as string | undefined,
          tags: args.tags as string[] | undefined,
        });

      case "finney_get_listing":
        return client.getListing(args.slug as string);

      case "finney_update_listing":
        return client.updateListing(args.slug as string, {
          name: args.name as string | undefined,
          description: args.description as string | undefined,
          category: args.category as string | undefined,
          status: args.status as string | undefined,
          tags: args.tags as string[] | undefined,
        });

      case "finney_delete_listing":
        return client.deleteListing(args.slug as string);

      case "finney_publish_listing":
        return client.publishListing(args.slug as string);

      case "finney_get_reviews":
        return client.getReviews(args.slug as string, {
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        });

      case "finney_submit_review":
        return client.submitReview(args.slug as string, {
          rating: args.rating as number,
          comment: args.comment as string | undefined,
        });

      case "finney_update_review":
        return client.updateReview(args.slug as string, args.reviewId as string, {
          rating: args.rating as number | undefined,
          comment: args.comment as string | undefined,
        });

      case "finney_delete_review":
        return client.deleteReview(args.slug as string, args.reviewId as string);

      case "finney_admin_listings":
        return client.adminListings();

      case "finney_admin_moderate":
        return client.adminModerate({
          listingId: args.listingId as string,
          status: args.status as string,
          rejectionReason: args.rejectionReason as string | undefined,
        });

      case "finney_install_listing":
        return client.installListing(args.listingId as string);

      case "finney_get_notifications":
        return client.getNotifications();

      // Organizations
      case "finney_list_orgs":
        return client.listOrgs();

      case "finney_create_org":
        return client.createOrg({
          name: args.name as string,
          slug: args.slug as string | undefined,
        });

      case "finney_search_orgs":
        return client.searchOrgs(args.q as string);

      case "finney_get_org":
        return client.getOrg(args.id as string);

      case "finney_update_org":
        return client.updateOrg(args.id as string, {
          name: args.name as string | undefined,
          slug: args.slug as string | undefined,
        });

      case "finney_delete_org":
        return client.deleteOrg(args.id as string);

      case "finney_list_members":
        return client.listMembers(args.orgId as string);

      case "finney_invite_member":
        return client.inviteMember(args.orgId as string, args.email as string, args.role as string);

      case "finney_update_member":
        return client.updateMember(args.orgId as string, args.memberId as string, args.role as string);

      case "finney_remove_member":
        return client.removeMember(args.orgId as string, args.memberId as string);

      // Users
      case "finney_get_profile":
        return client.getProfile();

      case "finney_update_profile":
        return client.updateProfile({
          name: args.name as string | undefined,
          email: args.email as string | undefined,
        });

      // API Keys
      case "finney_list_api_keys":
        return client.listApiKeys();

      case "finney_create_api_key":
        return client.createApiKey({
          name: args.name as string,
          scopes: args.scopes as string[] | undefined,
        });

      case "finney_get_api_key":
        return client.getApiKey(args.id as string);

      case "finney_update_api_key":
        return client.updateApiKey(args.id as string, {
          status: args.status as string | undefined,
          name: args.name as string | undefined,
        });

      case "finney_delete_api_key":
        return client.deleteApiKey(args.id as string);

      // Sharing
      case "finney_list_shares":
        return client.listShares({
          type: args.type as string | undefined,
          appId: args.appId as string | undefined,
        });

      case "finney_create_share":
        return client.createShare({
          appId: args.appId as string,
          sharedWith: args.sharedWith as string,
          sharedWithType: args.sharedWithType as string,
          permission: args.permission as string,
        });

      case "finney_manage_share":
        return client.manageShare({
          shareId: args.shareId as string,
          action: args.action as string,
        });

      // Logs & Monitoring
      case "finney_get_railway_logs":
        return client.getRailwayLogs({
          appId: args.appId as string,
          type: args.type as "build" | "deploy" | "http" | undefined,
          limit: args.limit as number | undefined,
          since: args.since as string | undefined,
        });

      case "finney_dashboard_stats":
        return client.dashboardStats();

      // Chat
      case "finney_chat":
        return client.chat(args.messages as Array<{ role: string; content: string }>);

      // Skills
      case "finney_list_skills":
        return client.listSkills();

      // Platform Settings
      case "finney_get_settings":
        return client.getSettings();

      case "finney_update_settings":
        return client.updateSettings({
          setting_name: args.setting_name as string,
          setting_value: args.setting_value,
        });

      case "finney_register_tool":
        return client.registerTool({
          name: args.name as string,
          description: args.description as string,
          url: args.url as string,
          type: args.type as string,
        });

      // Health & Debug
      case "finney_health":
        return client.health();

      case "finney_debug_app":
        return client.debugApp(args.appId as string);

      case "finney_test_e2b":
        return client.testE2b();

      case "finney_test_github":
        return client.testGithub();

      case "finney_test_email":
        return client.testEmail({
          to: args.to as string,
          subject: args.subject as string,
          body: args.body as string,
        });

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };
}
