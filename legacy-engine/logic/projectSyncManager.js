import { createEngineModule } from "../utils/createEngineModule.js";

function projectRecord(input = {}) {
  const now = new Date().toISOString();
  return {
    projectId: input.projectId,
    name: input.name ?? "Untitled Project",
    status: input.status ?? "local-only",
    localRevision: Number(input.localRevision ?? 1),
    remoteRevision: Number(input.remoteRevision ?? 0),
    pendingChanges: Number(input.pendingChanges ?? 0),
    lastLocalChangeAt: input.lastLocalChangeAt ?? now,
    lastSyncAt: input.lastSyncAt ?? null,
    offlineReady: Boolean(input.offlineReady ?? true),
  };
}

export function createProjectSyncManager(input = {}) {
  const module = createEngineModule({
    name: "projectSyncManager",
    domain: "sync",
    responsibilities: ["track project sync revisions", "mark local changes", "prepare future sync manifests"],
    state: {
      projects: Array.isArray(input.projects) ? input.projects : [],
      activeProjectId: input.activeProjectId ?? null,
      enabled: Boolean(input.enabled ?? true),
    },
  });

  return {
    ...module,
    upsertProject(project = {}) {
      const existing = this.state.projects.find((item) => item.projectId === project.projectId);
      if (existing) Object.assign(existing, projectRecord({ ...existing, ...project }));
      else this.state.projects.push(projectRecord(project));
      this.state.activeProjectId = project.projectId ?? this.state.activeProjectId;
      const record = this.getProject(project.projectId);
      this.emit("projectSync:upsert", record);
      return record;
    },
    getProject(projectId = this.state.activeProjectId) {
      return this.state.projects.find((item) => item.projectId === projectId) ?? null;
    },
    markLocalChange(project = {}) {
      const record = this.upsertProject(project);
      record.localRevision += 1;
      record.pendingChanges += 1;
      record.status = "pending";
      record.lastLocalChangeAt = new Date().toISOString();
      this.emit("projectSync:localChange", record);
      return record;
    },
    markQueued(projectId = this.state.activeProjectId) {
      const record = this.getProject(projectId);
      if (!record) return null;
      record.status = "queued";
      this.emit("projectSync:queued", record);
      return record;
    },
    markSynced(projectId = this.state.activeProjectId) {
      const record = this.getProject(projectId);
      if (!record) return null;
      record.status = "synced";
      record.pendingChanges = 0;
      record.remoteRevision = Math.max(record.remoteRevision, record.localRevision);
      record.lastSyncAt = new Date().toISOString();
      this.emit("projectSync:synced", record);
      return record;
    },
    createManifest(projectId = this.state.activeProjectId) {
      const record = this.getProject(projectId);
      if (!record) return null;
      return {
        projectId: record.projectId,
        name: record.name,
        localRevision: record.localRevision,
        remoteRevision: record.remoteRevision,
        pendingChanges: record.pendingChanges,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}
