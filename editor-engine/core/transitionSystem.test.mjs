import { EditorCore } from "./editorCore.js";
import { TRANSITION_TYPES } from "../effects/transitions.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const editor = new EditorCore({ fps: 30, duration: 30 });
editor.addTrack({ id: "v1", name: "Video", type: "video", order: 0 });
editor.addClip({ id: "a", name: "A", type: "video", trackId: "v1", timelineStart: 0, duration: 5, originalDuration: 5 });
editor.addClip({ id: "b", name: "B", type: "video", trackId: "v1", timelineStart: 5, duration: 5, originalDuration: 5 });

for (const name of TRANSITION_TYPES) {
  editor.selectClip("a");
  editor.addTransition("video", 1, name, "out");
  const transition = editor.state.clips.find((clip) => clip.id === "a").transitions.at(-1);
  assert(transition.name === name, `${name} transition was not created`);
  editor.updateTransition(transition.id, { duration: 1.5 });
  assert(editor.state.clips.find((clip) => clip.id === "a").transitions.find((item) => item.id === transition.id).duration === 1.5, "transition duration did not update");
  const frame = editor.renderFrame(4.4);
  const layer = frame.layers.find((item) => item.clipId === "a");
  assert(layer.activeTransitions.length > 0, `${name} did not evaluate during playback`);
  editor.duplicateTransition(transition.id);
  assert(editor.state.clips.find((clip) => clip.id === "a").transitions.length >= 2, "transition did not duplicate");
  editor.removeTransition(transition.id);
  assert(!editor.state.clips.find((clip) => clip.id === "a").transitions.some((item) => item.id === transition.id), "transition did not remove");
}

assert(editor.state.history.length > 0, "transition actions were not undoable");
