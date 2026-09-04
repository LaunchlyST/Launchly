import { createEngineModule } from "../utils/createEngineModule.js";

const STRATEGIES = new Set(["keep-local", "keep-remote", "duplicate", "manual"]);

function conflictId() {
  return `conflict-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createConflictResolver(input = {}) {
  const module = createEngineModule({
    name: "conflictResolver",
    domain: "sync",
    responsibilities: ["detect local sync conflicts", "store resolution decisions", "preserve recoverable conflict history"],
    state: {
      conflicts: Array.isArray(input.conflicts) ? input.conflicts : [],
      defaultStrategy: input.defaultStrategy ?? "manual",
    },
  });

  return {
    ...module,
    createConflict(payload = {}) {
      const conflict = {
        id: payload.id ?? conflictId(),
        projectId: payload.projectId ?? null,
        label: payload.label ?? "Project changed in two places",
        localRevision: Number(payload.localRevision ?? 1),
        remoteRevision: Number(payload.remoteRevision ?? 1),
        status: payload.status ?? "open",
        strategy: payload.strategy ?? this.state.defaultStrategy,
        createdAt: payload.createdAt ?? new Date().toISOString(),
        resolvedAt: payload.resolvedAt ?? null,
        localSummary: payload.localSummary ?? "Local browser project has newer edits.",
        remoteSummary: payload.remoteSummary ?? "Future cloud copy has different edits.",
      };
      this.state.conflicts.push(conflict);
      this.emit("conflict:create", conflict);
      return conflict;
    },
    resolve(conflictIdValue, strategy = this.state.defaultStrategy) {
      if (!STRATEGIES.has(strategy)) throw new Error(`Unsupported conflict strategy: ${strategy}`);
      const conflict = this.state.conflicts.find((item) => item.id === conflictIdValue);
      if (!conflict) return null;
      conflict.status = "resolved";
      conflict.strategy = strategy;
      conflict.resolvedAt = new Date().toISOString();
      this.emit("conflict:resolve", conflict);
      return conflict;
    },
    openConflicts() {
      return this.state.conflicts.filter((conflict) => conflict.status === "open");
    },
  };
}
