import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";
import { createProjectRecord, createRecoveryRecord, duplicateProjectRecord, parseProjectPackage, serializeProjectPackage } from "../project/projectManager.js";

const editor = new EditorCore({ fps: 30, duration: 90 });
const project = createProjectRecord({ name: "Launch Campaign", state: editor.serialize(), settings: { fps: 60, colorSpace: "Display P3" } });

assert.equal(project.name, "Launch Campaign");
assert.equal(project.settings.fps, 60);
assert.equal(project.settings.colorSpace, "Display P3");
assert.ok(project.thumbnail.label);

const copy = duplicateProjectRecord(project, "Launch Campaign Copy");
assert.notEqual(copy.id, project.id);
assert.equal(copy.name, "Launch Campaign Copy");
assert.equal(copy.deletedAt, null);

const packageText = serializeProjectPackage(project);
const imported = parseProjectPackage(packageText);
assert.equal(imported.name, "Launch Campaign");
assert.equal(imported.state.duration, 90);

const recovery = createRecoveryRecord(project.id, editor.serialize(), "autosave");
assert.equal(recovery.projectId, project.id);
assert.equal(recovery.reason, "autosave");

editor.setProjectMetadata({ id: project.id, name: project.name, settings: project.settings, thumbnail: project.thumbnail });
assert.equal(editor.state.project.name, "Launch Campaign");
assert.equal(editor.state.project.settings.fps, 60);
