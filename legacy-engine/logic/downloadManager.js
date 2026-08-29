import { createEngineModule } from "../utils/createEngineModule.js";

function intentId(prefix = "download-intent") {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createDownloadManager(input = {}) {
  const module = createEngineModule({
    name: "downloadManager",
    domain: "sync",
    responsibilities: ["prepare local download intents", "track future remote asset hydration", "support offline-first restores"],
    state: {
      intents: Array.isArray(input.intents) ? input.intents : [],
      policy: input.policy ?? "manual",
    },
  });

  return {
    ...module,
    prepareDownload(payload = {}) {
      const now = new Date().toISOString();
      const intent = {
        id: payload.id ?? intentId(),
        projectId: payload.projectId ?? null,
        assetId: payload.assetId ?? null,
        type: payload.type ?? "project-manifest",
        label: payload.label ?? "Prepared download",
        status: payload.status ?? "prepared",
        progress: Number(payload.progress ?? 0),
        bytesExpected: Number(payload.bytesExpected ?? 0),
        bytesCached: Number(payload.bytesCached ?? 0),
        createdAt: payload.createdAt ?? now,
        updatedAt: now,
        metadata: payload.metadata ?? {},
      };
      this.state.intents.push(intent);
      this.emit("download:prepare", intent);
      return intent;
    },
    updateIntent(intentIdValue, patch = {}) {
      const intent = this.state.intents.find((item) => item.id === intentIdValue);
      if (!intent) return null;
      Object.assign(intent, patch, { updatedAt: new Date().toISOString() });
      intent.progress = Math.min(100, Math.max(0, Number(intent.progress ?? 0)));
      this.emit("download:update", intent);
      return intent;
    },
    completeIntent(intentIdValue) {
      return this.updateIntent(intentIdValue, { status: "cached", progress: 100 });
    },
  };
}
