import { createEngineModule } from "../utils/createEngineModule.js";

const ACTIVE_STATUSES = new Set(["queued", "running", "paused"]);

function queueId(prefix = "sync-job") {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createBackgroundQueue(input = {}) {
  const module = createEngineModule({
    name: "backgroundQueue",
    domain: "sync",
    responsibilities: ["store local cloud-sync work", "prioritize background jobs", "pause work while offline"],
    state: {
      jobs: Array.isArray(input.jobs) ? input.jobs : [],
      paused: Boolean(input.paused),
      pauseReason: input.pauseReason ?? "",
      concurrency: Number(input.concurrency ?? 2),
    },
  });

  return {
    ...module,
    enqueue(job = {}) {
      const now = new Date().toISOString();
      const item = {
        id: job.id ?? queueId(),
        type: job.type ?? "sync",
        label: job.label ?? "Background sync task",
        status: this.state.paused ? "paused" : "queued",
        priority: job.priority ?? "normal",
        progress: Number(job.progress ?? 0),
        projectId: job.projectId ?? null,
        assetId: job.assetId ?? null,
        createdAt: job.createdAt ?? now,
        updatedAt: now,
        metadata: job.metadata ?? {},
      };
      this.state.jobs.push(item);
      this.emit("queue:enqueue", item);
      return item;
    },
    update(jobId, patch = {}) {
      const job = this.state.jobs.find((item) => item.id === jobId);
      if (!job) return null;
      Object.assign(job, patch, { updatedAt: new Date().toISOString() });
      job.progress = Math.min(100, Math.max(0, Number(job.progress ?? 0)));
      this.emit("queue:update", job);
      return job;
    },
    pause(reason = "offline") {
      this.state.paused = true;
      this.state.pauseReason = reason;
      this.state.jobs.forEach((job) => {
        if (ACTIVE_STATUSES.has(job.status)) {
          job.status = "paused";
          job.updatedAt = new Date().toISOString();
        }
      });
      this.emit("queue:pause", { reason });
      return this.state;
    },
    resume() {
      this.state.paused = false;
      this.state.pauseReason = "";
      this.state.jobs.forEach((job) => {
        if (job.status === "paused") {
          job.status = "queued";
          job.updatedAt = new Date().toISOString();
        }
      });
      this.emit("queue:resume", this.state);
      return this.state;
    },
    complete(jobId) {
      return this.update(jobId, { status: "completed", progress: 100 });
    },
    fail(jobId, error = "Task failed locally") {
      return this.update(jobId, { status: "error", error });
    },
    clearCompleted() {
      const before = this.state.jobs.length;
      this.state.jobs = this.state.jobs.filter((job) => job.status !== "completed");
      this.emit("queue:clear", { removed: before - this.state.jobs.length });
      return this.state.jobs;
    },
    pending() {
      return this.state.jobs.filter((job) => ACTIVE_STATUSES.has(job.status));
    },
  };
}
