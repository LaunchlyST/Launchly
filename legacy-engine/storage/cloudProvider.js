export const CLOUD_PROVIDER_IDS = Object.freeze(["local", "s3", "gcs", "azure", "cloudflare", "supabase"]);

export function createCloudProvider(config = {}) {
  return {
    id: config.id ?? "local",
    name: config.name ?? "Local Storage",
    type: config.type ?? "local",
    isConnected: false,
    capabilities: config.capabilities ?? ["read", "write", "delete", "list"],
    config: {},
  };
}

export function createS3Provider() {
  return {
    ...createCloudProvider({ id: "s3", name: "AWS S3", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload() { return { url: "", bytes: 0, status: "stub" }; },
    async download() { return null; },
    async delete() { return true; },
    async list() { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createGCSProvider() {
  return {
    ...createCloudProvider({ id: "gcs", name: "Google Cloud Storage", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload() { return { url: "", bytes: 0, status: "stub" }; },
    async download() { return null; },
    async delete() { return true; },
    async list() { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createAzureProvider() {
  return {
    ...createCloudProvider({ id: "azure", name: "Azure Blob Storage", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload() { return { url: "", bytes: 0, status: "stub" }; },
    async download() { return null; },
    async delete() { return true; },
    async list() { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createCloudflareProvider() {
  return {
    ...createCloudProvider({ id: "cloudflare", name: "Cloudflare R2", type: "cdn" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload() { return { url: "", bytes: 0, status: "stub" }; },
    async download() { return null; },
    async delete() { return true; },
    async list() { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createSupabaseProvider() {
  return {
    ...createCloudProvider({ id: "supabase", name: "Supabase Storage", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload() { return { url: "", bytes: 0, status: "stub" }; },
    async download() { return null; },
    async delete() { return true; },
    async list() { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}
