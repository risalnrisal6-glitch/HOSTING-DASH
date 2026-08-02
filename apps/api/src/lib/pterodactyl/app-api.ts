import { ApiError } from "../errors";
import { settings } from "../../services/settings";

// ============================================================
// Pterodactyl Application API client
// Used for: nests, eggs, nodes, locations, allocations, users,
// server creation/build/suspend/delete, backups & databases CRUD.
// ============================================================

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function appRequest(method: Method, path: string, body?: unknown): Promise<any> {
  const { url, appKey } = await settings.panelConfig();
  if (!url || !appKey) throw ApiError.badRequest("Pterodactyl panel is not configured");
  const res = await fetch(`${url}/api/application${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${appKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.errors?.map((e: any) => e.detail).join(", ") || `Pterodactyl API ${res.status}`;
    throw new ApiError(502, "PTERODACTYL_ERROR", msg);
  }
  return data;
}

function unwrap<T>(data: any): T {
  // Application API returns {object, attributes} or {data: [...]}
  if (data && typeof data === "object") {
    if ("attributes" in data && "object" in data) return data.attributes as T;
    if (Array.isArray(data.data)) return (data.data.map((d: any) => d.attributes ?? d) as unknown) as T;
    if (data.data && typeof data.data === "object" && "attributes" in data.data) return data.data.attributes as T;
  }
  return data as T;
}

export const appApi = {
  request: appRequest,
  unwrap,

  // ---- Panel basics ----
  async getNests(): Promise<any[]> {
    const data = await appRequest("GET", "/nests");
    return unwrap<any[]>(data);
  },
  async getEggs(nestId: string | number): Promise<any[]> {
    const data = await appRequest("GET", `/nests/${nestId}/eggs`);
    return unwrap<any[]>(data);
  },
  async getEgg(nestId: string | number, eggId: string | number): Promise<any> {
    const data = await appRequest("GET", `/nests/${nestId}/eggs/${eggId}`);
    return unwrap<any>(data);
  },
  async getNodes(): Promise<any[]> {
    const data = await appRequest("GET", "/nodes");
    return unwrap<any[]>(data);
  },
  async getNode(nodeId: string | number): Promise<any> {
    const data = await appRequest("GET", `/nodes/${nodeId}`);
    return unwrap<any>(data);
  },
  async getLocations(): Promise<any[]> {
    const data = await appRequest("GET", "/locations");
    return unwrap<any[]>(data);
  },
  async getNodeAllocations(nodeId: string | number, params = ""): Promise<any[]> {
    const data = await appRequest("GET", `/nodes/${nodeId}/allocations?${params}`);
    return unwrap<any[]>(data);
  },
  async createAllocation(nodeId: string | number, body: { ip: string; ports: string[] }): Promise<any> {
    const data = await appRequest("POST", `/nodes/${nodeId}/allocations`, body);
    return unwrap<any>(data);
  },
  async deleteAllocation(nodeId: string | number, allocationId: string | number): Promise<void> {
    await appRequest("DELETE", `/nodes/${nodeId}/allocations/${allocationId}`);
  },

  // ---- Users ----
  async findUserByEmail(email: string): Promise<any | null> {
    const data = await appRequest("GET", `/users?filter[email]=${encodeURIComponent(email)}`);
    const users = unwrap<any[]>(data);
    return users?.[0] ?? null;
  },
  async createUser(body: { email: string; username: string; first_name: string; last_name: string }): Promise<any> {
    const data = await appRequest("POST", "/users", body);
    return unwrap<any>(data);
  },
  async updateUser(userId: string | number, body: Record<string, unknown>): Promise<any> {
    const data = await appRequest("PATCH", `/users/${userId}`, body);
    return unwrap<any>(data);
  },

  // ---- Servers ----
  async createServer(body: Record<string, unknown>): Promise<any> {
    const data = await appRequest("POST", "/servers", body);
    return unwrap<any>(data);
  },
  async getServers(): Promise<any[]> {
    const data = await appRequest("GET", "/servers");
    return unwrap<any[]>(data);
  },
  async getServer(serverId: string | number): Promise<any> {
    const data = await appRequest("GET", `/servers/${serverId}`);
    return unwrap<any>(data);
  },
  async updateServer(serverId: string | number, body: Record<string, unknown>): Promise<any> {
    const data = await appRequest("PATCH", `/servers/${serverId}`, body);
    return unwrap<any>(data);
  },
  async updateBuild(serverId: string | number, body: Record<string, unknown>): Promise<any> {
    const data = await appRequest("PATCH", `/servers/${serverId}/build`, body);
    return unwrap<any>(data);
  },
  async suspendServer(serverId: string | number): Promise<void> {
    await appRequest("POST", `/servers/${serverId}/suspend`);
  },
  async unsuspendServer(serverId: string | number): Promise<void> {
    await appRequest("POST", `/servers/${serverId}/unsuspend`);
  },
  async deleteServer(serverId: string | number, force = false): Promise<void> {
    await appRequest("DELETE", `/servers/${serverId}${force ? "?force=true" : ""}`);
  },

  // ---- Server databases (app API) ----
  async getServerDatabases(serverId: string | number): Promise<any[]> {
    const data = await appRequest("GET", `/servers/${serverId}/databases`);
    return unwrap<any[]>(data);
  },
  async createServerDatabase(serverId: string | number, body: { database: string; remote: string }): Promise<any> {
    const data = await appRequest("POST", `/servers/${serverId}/databases`, body);
    return unwrap<any>(data);
  },
  async deleteServerDatabase(serverId: string | number, dbId: string | number): Promise<void> {
    await appRequest("DELETE", `/servers/${serverId}/databases/${dbId}`);
  },
  async resetDatabasePassword(serverId: string | number, dbId: string | number): Promise<void> {
    await appRequest("POST", `/servers/${serverId}/databases/${dbId}/reset-password`);
  },

  // ---- Server allocations (app API) ----
  async getServerAllocations(serverId: string | number): Promise<any[]> {
    const data = await appRequest("GET", `/servers/${serverId}/allocations`);
    return unwrap<any[]>(data);
  },
  async addAllocation(serverId: string | number, body: { ip: string; port: number }): Promise<any> {
    const data = await appRequest("POST", `/servers/${serverId}/allocations`, body);
    return unwrap<any>(data);
  },
  async deleteServerAllocation(serverId: string | number, allocId: string | number): Promise<void> {
    await appRequest("DELETE", `/servers/${serverId}/allocations/${allocId}`);
  },
  async setPrimaryAllocation(serverId: string | number, allocId: string | number): Promise<void> {
    await appRequest("POST", `/servers/${serverId}/allocations/${allocId}/primary`);
  },

  // ---- Test ----
  async testConnection(): Promise<{ nodes: number; users: number; servers: number }> {
    const nodes = await appRequest("GET", "/nodes");
    const users = await appRequest("GET", "/users");
    const servers = await appRequest("GET", "/servers");
    const count = (d: any) => (d?.meta?.pagination?.total ?? (Array.isArray(d?.data) ? d.data.length : 0)) as number;
    return { nodes: count(nodes), users: count(users), servers: count(servers) };
  },
};
