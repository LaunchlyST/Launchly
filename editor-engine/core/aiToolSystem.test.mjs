import assert from "node:assert/strict";
import { EditorCore } from "./editorCore.js";
import { AI_TOOL_REGISTRY } from "../ai/aiToolSystem.js";

const editor = new EditorCore({ fps: 30, duration: 60 });

assert.equal(editor.state.aiTools.length, AI_TOOL_REGISTRY.length);
assert.ok(editor.state.aiTools.find((tool) => tool.name === "Eye Contact"));
assert.ok(editor.state.aiTools.find((tool) => tool.name === "Thumbnail Suggestions"));

editor.setAiCommand("Make a sharp campaign cut.");
assert.equal(editor.state.aiCommand, "Make a sharp campaign cut.");

editor.updateAiTool("auto-cut", { settings: { pace: "Premium fast" } });
assert.equal(editor.state.aiTools.find((tool) => tool.id === "auto-cut").settings.pace, "Premium fast");

editor.setAiToolProcessing("auto-cut", 54);
assert.equal(editor.state.aiTools.find((tool) => tool.id === "auto-cut").status, "Processing");
assert.equal(editor.state.aiTools.find((tool) => tool.id === "auto-cut").progress, 54);

editor.runAiTool("auto-cut");
const autoCut = editor.state.aiTools.find((tool) => tool.id === "auto-cut");
assert.equal(autoCut.status, "Done");
assert.equal(autoCut.progress, 100);
assert.match(autoCut.result.summary, /local edit recommendation/);
assert.equal(editor.state.aiQueue.length, 1);

editor.clearAiQueue();
assert.equal(editor.state.aiQueue.length, 0);
