import { ApiError } from "../errors";
import { settings } from "../../services/settings";

// ============================================================
// Pterodactyl Client API client
// Used for runtime features: power, console, files, backups,
// databases, network, resources/statistics, startup, SFTP.
// Requires a Client API key configured in admin settings.
// ============================================================

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function clientRequest(method: Method, path: string, body?: unknown): Promise<any> {
  const { url, clientKey } = await settings.panelConfig();
  if (!url || !clientKey) throw ApiError.badRequest("Pterodactyl Client API key is not configured");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${clientKey}`,
    Accept: "application/json",
  };
  const res = await fetch(`${url}/api/client${path}`, {
    method,
    headers: body !== undefined ? { ...headers, "Content-Type": "application/json" } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

function attr<T>(data: any): T {
  if (data && typeof data === "object") {
    if ("attributes" in data) return data.attributes as T;
    if (Array.isArray(data.data)) return (data.data.map((d: any) => d.attributes ?? d) as unknown) as T;
  }
  return data as T;
}

export const clientApi = {
  request: clientRequest,
  attr,

  // ---- Server listing / state ----
  async getServers(): Promise<any[]> {
    const data = await clientRequest("GET", "/");
    return attr<any[]>(data);
  },
  async getServer(uuid: string): Promise<any> {
    const data = await clientRequest("GET", `/servers/${uuid}`);
    return attr<any>(data);
  },
  async getResources(uuid: string): Promise<any> {
    const data = await clientRequest("GET", `/servers/${uuid}/resources`);
    return attr<any>(data);
  },
  async power(uuid: string, signal: "start" | "stop" | "restart" | "kill"): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/power`, { signal });
  },
  async sendCommand(uuid: string, command: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/command`, { command });
  },
  async getSftp(uuid: string): Promise<any> {
    const data = await clientRequest("GET", `/servers/${uuid}/sftp`);
    return attr<any>(data);
  },
  async getStartup(uuid: string): Promise<any> {
    const data = await clientRequest("GET", `/servers/${uuid}/startup`);
    return attr<any>(data);
  },
  async updateStartup(uuid: string, body: { startup?: string; environment?: Record<string, string> }): Promise<void> {
    await clientRequest("PATCH", `/servers/${uuid}/startup`, body);
  },
  async getWebsocket(uuid: string): Promise<any> {
    const data = await clientRequest("GET", `/servers/${uuid}/websocket`);
    return attr<any>(data);
  },

  // ---- Files ----
  async listFiles(uuid: string, directory = "/"): Promise<any[]> {
    const data = await clientRequest("GET", `/servers/${uuid}/files/list?directory=${encodeURIComponent(directory)}`);
    return attr<any[]>(data);
  },
  async readFile(uuid: string, file: string): Promise<string> {
    return await clientRequest("GET", `/servers/${uuid}/files/contents?file=${encodeURIComponent(file)}`);
  },
  async writeFile(uuid: string, file: string, content: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/files/write?file=${encodeURIComponent(file)}`, content as unknown as Record<string, unknown>);
  },
  async deleteFiles(uuid: string, root: string, files: string[]): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/files/delete`, { root, files });
  },
  async copyFile(uuid: string, location: string, name: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/files/copy`, { location, name });
  },
  async renameFiles(uuid: string, root: string, files: { from: string; to: string }[]): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/files/rename`, { root, files });
  },
  async compress(uuid: string, root: string, files: string[]): Promise<any> {
    const data = await clientRequest("POST", `/servers/${uuid}/files/compress`, { root, files });
    return attr<any>(data);
  },
  async decompress(uuid: string, root: string, file: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/files/decompress`, { root, file });
  },
  async createDirectory(uuid: string, root: string, name: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/files/create-directory`, { root, name });
  },
  async getUploadUrl(uuid: string, directory = "/"): Promise<string> {
    const data = await clientRequest("GET", `/servers/${uuid}/files/upload?directory=${encodeURIComponent(directory)}`);
    return attr<any>(data).url;
  },
  async getDownloadUrl(uuid: string, file: string): Promise<string> {
    const data = await clientRequest("GET", `/servers/${uuid}/files/download?file=${encodeURIComponent(file)}`);
    return attr<any>(data).url;
  },

  // ---- Backups ----
  async getBackups(uuid: string): Promise<any[]> {
    const data = await clientRequest("GET", `/servers/${uuid}/backups`);
    return attr<any[]>(data);
  },
  async createBackup(uuid: string, name?: string): Promise<any> {
    const data = await clientRequest("POST", `/servers/${uuid}/backups`, name ? { name } : {});
    return attr<any>(data);
  },
  async getBackupDownloadUrl(uuid: string, backupId: string): Promise<string> {
    const data = await clientRequest("GET", `/servers/${uuid}/backups/${backupId}/download`);
    return attr<any>(data).url;
  },
  async restoreBackup(uuid: string, backupId: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/backups/${backupId}/restore`);
  },
  async deleteBackup(uuid: string, backupId: string): Promise<void> {
    await clientRequest("DELETE", `/servers/${uuid}/backups/${backupId}`);
  },
  async lockBackup(uuid: string, backupId: string, locked: boolean): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/backups/${backupId}/lock`, { locked });
  },

  // ---- Databases ----
  async getDatabases(uuid: string): Promise<any[]> {
    const data = await clientRequest("GET", `/servers/${uuid}/databases`);
    return attr<any[]>(data);
  },
  async createDatabase(uuid: string, body: { database: string; remote: string }): Promise<any> {
    const data = await clientRequest("POST", `/servers/${uuid}/databases`, body);
    return attr<any>(data);
  },
  async rotateDatabasePassword(uuid: string, dbId: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/databases/${dbId}/rotate-password`);
  },
  async deleteDatabase(uuid: string, dbId: string): Promise<void> {
    await clientRequest("DELETE", `/servers/${uuid}/databases/${dbId}`);
  },

  // ---- Network ----
  async getNetwork(uuid: string): Promise<any[]> {
    const data = await clientRequest("GET", `/servers/${uuid}/network/allocations`);
    return attr<any[]>(data);
  },
  async setPrimary(uuid: string, allocationId: string): Promise<void> {
    await clientRequest("POST", `/servers/${uuid}/network/allocations/${allocationId}/primary`);
  },
  async deleteAllocation(uuid: string, allocationId: string): Promise<void> {
    await clientRequest("DELETE", `/servers/${uuid}/network/allocations/${allocationId}`);
  },
};
