import assert from "node:assert/strict";
import {
  createBackgroundQueue,
  createConflictResolver,
  createDownloadManager,
  createOfflineMode,
  createProjectSyncManager,
  createUploadManager,
} from "../index.js";

const queue = createBackgroundQueue();
const projectSync = createProjectSyncManager();
const uploads = createUploadManager();
const downloads = createDownloadManager();
const conflicts = createConflictResolver();
const offline = createOfflineMode();

const project = projectSync.markLocalChange({ projectId: "project-1", name: "Cloud Ready Campaign" });
assert.equal(project.status, "pending");
assert.equal(project.pendingChanges, 1);
assert.equal(project.localRevision, 2);

const job = queue.enqueue({ type: "project-sync", label: "Sync project", projectId: project.projectId });
assert.equal(queue.pending().length, 1);
assert.equal(job.status, "queued");

offline.setOffline("test offline");
queue.pause("offline mode");
assert.equal(offline.state.offline, true);
assert.equal(queue.state.paused, true);
assert.equal(queue.pending()[0].status, "paused");

offline.setOnline();
queue.resume();
assert.equal(queue.pending()[0].status, "queued");

const upload = uploads.prepareUpload({ projectId: project.projectId, label: "Project package", bytesTotal: 4096 });
const download = downloads.prepareDownload({ projectId: project.projectId, label: "Project manifest", bytesExpected: 2048 });
assert.equal(upload.status, "prepared");
assert.equal(download.status, "prepared");

const conflict = conflicts.createConflict({ projectId: project.projectId, localRevision: 3, remoteRevision: 4 });
assert.equal(conflicts.openConflicts().length, 1);
const resolved = conflicts.resolve(conflict.id, "duplicate");
assert.equal(resolved.status, "resolved");
assert.equal(conflicts.openConflicts().length, 0);

queue.complete(job.id);
assert.equal(queue.state.jobs[0].status, "completed");
queue.clearCompleted();
assert.equal(queue.state.jobs.length, 0);

const manifest = projectSync.createManifest(project.projectId);
assert.equal(manifest.projectId, project.projectId);
assert.equal(manifest.pendingChanges, 1);

console.log("syncArchitecture tests passed");
