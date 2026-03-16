/**
 * Finney API Client — Per-session version for HTTP transport
 * Each session gets its own client instance with the user's API key.
 */

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class FinneyClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || process.env.FINNEY_BASE_URL || "https://finney.finance";
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    const url = new URL(path, this.baseUrl);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      let data: T | undefined;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = (await res.json()) as T;
      } else {
        const text = await res.text();
        data = text as unknown as T;
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: typeof data === "object" && data !== null && "message" in data
            ? String((data as Record<string, unknown>).message)
            : `HTTP ${res.status}: ${typeof data === "string" ? data : res.statusText}`,
        };
      }

      return { ok: true, status: res.status, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `Request failed: ${message}` };
    }
  }

  /**
   * Consume an SSE stream and return collected events.
   */
  private async consumeSSE(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<{ events: Array<{ event: string; data: unknown }>; finalResult: unknown }>> {
    const url = new URL(path, this.baseUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          status: res.status,
          error: `HTTP ${res.status}: ${text || res.statusText}`,
        };
      }

      if (!res.body) {
        return { ok: false, status: res.status, error: "No response body for SSE stream" };
      }

      const events: Array<{ event: string; data: unknown }> = [];
      let finalResult: unknown = null;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const rawData = line.slice(5).trim();
            let parsed: unknown;
            try {
              parsed = JSON.parse(rawData);
            } catch {
              parsed = rawData;
            }

            events.push({ event: currentEvent, data: parsed });

            if (currentEvent === "complete" || currentEvent === "done") {
              finalResult = parsed;
              done = true;
              break;
            }
            if (currentEvent === "error") {
              reader.cancel();
              return {
                ok: false,
                status: res.status,
                error: typeof parsed === "object" && parsed !== null && "message" in parsed
                  ? String((parsed as Record<string, unknown>).message)
                  : String(parsed),
                data: { events, finalResult: parsed },
              };
            }

            currentEvent = "message";
          }
        }
      }

      return { ok: true, status: res.status, data: { events, finalResult } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: `SSE request failed: ${message}` };
    }
  }

  // ─── App Management ──────────────────────────────────────────────

  async listApps(params: { status?: string; limit?: number; offset?: number }) {
    return this.request("GET", "/api/apps", undefined, {
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    });
  }

  async deleteApp(appId: string) {
    return this.request("DELETE", `/api/apps/${appId}`);
  }

  async updateEnvVars(appId: string, envVars: Record<string, string>) {
    return this.request("PATCH", `/api/apps/${appId}/env-vars`, { env_vars: envVars });
  }

  // ─── Tools ───────────────────────────────────────────────────────

  async getTool(id: string) {
    return this.request("GET", `/api/tools/${id}`);
  }

  async deleteTool(id: string) {
    return this.request("DELETE", `/api/tools/${id}`);
  }

  // ─── Build Lifecycle ─────────────────────────────────────────────

  async build(params: { prompt: string; appName?: string; description?: string }) {
    return this.request("POST", "/api/build", {
      prompt: params.prompt,
      appName: params.appName,
      description: params.description,
    });
  }

  async triggerBuild(params: {
    appId: string;
    prompt: string;
    mode?: "build" | "modify" | "fix";
    envVars?: Record<string, string>;
    needsDatabase?: boolean;
  }) {
    return this.request("POST", `/api/builds/${params.appId}/trigger`, {
      prompt: params.prompt,
      mode: params.mode,
      envVars: params.envVars,
      needsDatabase: params.needsDatabase,
    });
  }

  async getBuildStatus(buildId: string) {
    return this.request("GET", `/api/builds/status/${buildId}`);
  }

  async listBuilds(appId: string, limit?: number) {
    return this.request("GET", `/api/builds/${appId}`, undefined, { limit });
  }

  async buildUpload() {
    return {
      ok: false,
      status: 0,
      error: "File upload (multipart/form-data) is not supported via MCP. Use the Finney web UI or a direct HTTP client.",
    };
  }

  async buildStream(params: { prompt: string; appId?: string; mode?: string }) {
    return this.consumeSSE("POST", "/api/build/stream", {
      prompt: params.prompt,
      appId: params.appId,
      mode: params.mode,
    });
  }

  // ─── Deploy & Preview ────────────────────────────────────────────

  async deploy(appId: string, sandboxId: string) {
    return this.consumeSSE("POST", "/api/deploy/stream", { appId, sandboxId });
  }

  async regeneratePreview(appId: string) {
    return this.request("POST", "/api/rerun", { appId });
  }

  async previewHealth(appId: string) {
    return this.request("GET", `/api/preview-health/${appId}`);
  }

  async testRoutes(appId: string, routes?: string) {
    return this.request("GET", `/api/routes-test/${appId}`, undefined, { routes });
  }

  // ─── Auth ────────────────────────────────────────────────────────

  async signup(params: { email: string; password: string; orgName?: string }) {
    return this.request("POST", "/api/auth/signup", params);
  }

  async convertAccount(params: { email: string; password: string; orgName?: string }) {
    return this.request("POST", "/api/auth/convert", params);
  }

  async completeOauth(params: { orgName?: string }) {
    return this.request("POST", "/api/auth/complete-oauth", params);
  }

  async platformLogin(params: { code: string; state?: string }) {
    return this.request("GET", "/api/auth/platform-login", undefined, {
      code: params.code,
      state: params.state,
    });
  }

  async setupAnonymous() {
    return this.request("POST", "/api/auth/setup-anonymous");
  }

  // ─── Marketplace ─────────────────────────────────────────────────

  async listCategories() {
    return this.request("GET", "/api/marketplace/categories");
  }

  async listMarketplace(params: {
    search?: string;
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.request("GET", "/api/marketplace/listings", undefined, {
      search: params.search,
      category: params.category,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    });
  }

  async createListing(params: {
    name: string;
    description: string;
    category: string;
    repoUrl?: string;
    tags?: string[];
  }) {
    return this.request("POST", "/api/marketplace/listings", params);
  }

  async getListing(slug: string) {
    return this.request("GET", `/api/marketplace/listings/${slug}`);
  }

  async updateListing(slug: string, params: {
    name?: string;
    description?: string;
    category?: string;
    status?: string;
    tags?: string[];
  }) {
    return this.request("PUT", `/api/marketplace/listings/${slug}`, params);
  }

  async deleteListing(slug: string) {
    return this.request("DELETE", `/api/marketplace/listings/${slug}`);
  }

  async publishListing(slug: string) {
    return this.request("POST", `/api/marketplace/listings/${slug}/publish`);
  }

  async getReviews(slug: string, params?: { limit?: number; offset?: number }) {
    return this.request("GET", `/api/marketplace/listings/${slug}/reviews`, undefined, {
      limit: params?.limit,
      offset: params?.offset,
    });
  }

  async submitReview(slug: string, params: { rating: number; comment?: string }) {
    return this.request("POST", `/api/marketplace/listings/${slug}/reviews`, params);
  }

  async updateReview(slug: string, reviewId: string, params: { rating?: number; comment?: string }) {
    return this.request("PUT", `/api/marketplace/listings/${slug}/reviews/${reviewId}`, params);
  }

  async deleteReview(slug: string, reviewId: string) {
    return this.request("DELETE", `/api/marketplace/listings/${slug}/reviews/${reviewId}`);
  }

  async adminListings() {
    return this.request("GET", "/api/marketplace/admin");
  }

  async adminModerate(params: { listingId: string; status: string; rejectionReason?: string }) {
    return this.request("PUT", "/api/marketplace/admin", params);
  }

  async installListing(listingId: string) {
    return this.request("POST", "/api/marketplace/install", { listingId });
  }

  async getNotifications() {
    return this.request("GET", "/api/marketplace/notifications");
  }

  // ─── Organizations ───────────────────────────────────────────────

  async listOrgs() {
    return this.request("GET", "/api/organizations");
  }

  async createOrg(params: { name: string; slug?: string }) {
    return this.request("POST", "/api/organizations", params);
  }

  async searchOrgs(q: string) {
    return this.request("GET", "/api/organizations/search", undefined, { q });
  }

  async getOrg(id: string) {
    return this.request("GET", `/api/organizations/${id}`);
  }

  async updateOrg(id: string, params: { name?: string; slug?: string }) {
    return this.request("PUT", `/api/organizations/${id}`, params);
  }

  async deleteOrg(id: string) {
    return this.request("DELETE", `/api/organizations/${id}`);
  }

  async listMembers(orgId: string) {
    return this.request("GET", `/api/organizations/${orgId}/members`);
  }

  async inviteMember(orgId: string, email: string, role: string) {
    return this.request("POST", `/api/organizations/${orgId}/members`, { email, role });
  }

  async updateMember(orgId: string, memberId: string, role: string) {
    return this.request("PUT", `/api/organizations/${orgId}/members/${memberId}`, { role });
  }

  async removeMember(orgId: string, memberId: string) {
    return this.request("DELETE", `/api/organizations/${orgId}/members/${memberId}`);
  }

  // ─── Users ───────────────────────────────────────────────────────

  async getProfile() {
    return this.request("GET", "/api/user/profile");
  }

  async updateProfile(params: { name?: string; email?: string }) {
    return this.request("PATCH", "/api/user/profile", params);
  }

  // ─── API Keys ────────────────────────────────────────────────────

  async listApiKeys() {
    return this.request("GET", "/api/api-keys");
  }

  async createApiKey(params: { name: string; scopes?: string[] }) {
    return this.request("POST", "/api/api-keys", params);
  }

  async getApiKey(id: string) {
    return this.request("GET", `/api/api-keys/${id}`);
  }

  async updateApiKey(id: string, params: { status?: string; name?: string }) {
    return this.request("PUT", `/api/api-keys/${id}`, params);
  }

  async deleteApiKey(id: string) {
    return this.request("DELETE", `/api/api-keys/${id}`);
  }

  // ─── Sharing ─────────────────────────────────────────────────────

  async listShares(params?: { type?: string; appId?: string }) {
    return this.request("GET", "/api/app-shares", undefined, {
      type: params?.type,
      appId: params?.appId,
    });
  }

  async createShare(params: {
    appId: string;
    sharedWith: string;
    sharedWithType: string;
    permission: string;
  }) {
    return this.request("POST", "/api/app-shares", params);
  }

  async manageShare(params: { shareId: string; action: string }) {
    return this.request("PATCH", "/api/app-shares", params);
  }

  // ─── Monitoring & Logs ───────────────────────────────────────────

  async getRailwayLogs(params: {
    appId: string;
    type?: "build" | "deploy" | "http";
    limit?: number;
    since?: string;
  }) {
    return this.request("GET", `/api/logs/${params.appId}`, undefined, {
      type: params.type,
      limit: params.limit,
      since: params.since,
    });
  }

  async dashboardStats() {
    return this.request("GET", "/api/dashboard/stats");
  }

  // ─── Chat ────────────────────────────────────────────────────────

  async chat(messages: Array<{ role: string; content: string }>) {
    return this.request("POST", "/api/chat", { messages });
  }

  // ─── Skills ──────────────────────────────────────────────────────

  async listSkills() {
    return this.request("GET", "/api/skills");
  }

  // ─── Platform Settings ───────────────────────────────────────────

  async getSettings() {
    return this.request("GET", "/api/platform-settings");
  }

  async updateSettings(params: { setting_name: string; setting_value: unknown }) {
    return this.request("PUT", "/api/platform-settings", params);
  }

  async registerTool(params: { name: string; description: string; url: string; type: string }) {
    return this.request("POST", "/api/register", params);
  }

  // ─── Health & Debug ──────────────────────────────────────────────

  async health() {
    return this.request("GET", "/api/health");
  }

  async debugApp(appId: string) {
    return this.request("GET", `/api/debug/${appId}`);
  }

  async testE2b() {
    return this.request("GET", "/api/test/e2b");
  }

  async testGithub() {
    return this.request("GET", "/api/test/github");
  }

  async testEmail(params: { to: string; subject: string; body: string }) {
    return this.request("POST", "/api/test-email", params);
  }
}
