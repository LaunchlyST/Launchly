import { createEngineModule } from "../utils/createEngineModule.js";

function intentId(prefix = "upload-intent") {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createUploadManager(input = {}) {
  const module = createEngineModule({
    name: "uploadManager",
    domain: "sync",
    responsibilities: ["prepare local upload intents", "track asset package upload state", "avoid direct server coupling"],
    state: {
      intents: Array.isArray(input.intents) ? input.intents : [],
      policy: input.policy ?? "manual",
    },
  });

  return {
    ...module,
    prepareUpload(payload = {}) {
      const now = new Date().toISOString();
      const intent = {
        id: payload.id ?? intentId(),
        projectId: payload.projectId ?? null,
        assetId: payload.assetId ?? null,
        type: payload.type ?? "project-package",
        label: payload.label ?? "Prepared upload",
        status: payload.status ?? "prepared",
        progress: Number(payload.progress ?? 0),
        bytesTotal: Number(payload.bytesTotal ?? 0),
        bytesPrepared: Number(payload.bytesPrepared ?? 0),
        createdAt: payload.createdAt ?? now,
        updatedAt: now,
        metadata: payload.metadata ?? {},
      };
      this.state.intents.push(intent);
      this.emit("upload:prepare", intent);
      return intent;
    },
    updateIntent(intentIdValue, patch = {}) {
      const intent = this.state.intents.find((item) => item.id === intentIdValue);
      if (!intent) return null;
      Object.assign(intent, patch, { updatedAt: new Date().toISOString() });
      intent.progress = Math.min(100, Math.max(0, Number(intent.progress ?? 0)));
      this.emit("upload:update", intent);
      return intent;
    },
    completeIntent(intentIdValue) {
      return this.updateIntent(intentIdValue, { status: "prepared-complete", progress: 100 });
    },
  };
}
