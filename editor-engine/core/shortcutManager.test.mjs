import assert from "node:assert/strict";
import { DEFAULT_SHORTCUTS, actionForShortcut, createShortcutState, normalizeShortcut } from "../utils/shortcutManager.js";

assert.equal(normalizeShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: "c" }), "Ctrl+C");
assert.equal(normalizeShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: "z" }), "Ctrl+Shift+Z");
assert.equal(normalizeShortcut({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: " " }), "Space");
assert.equal(normalizeShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: "+" }), "Ctrl+=");
assert.equal(normalizeShortcut(" Ctrl + Alt + K "), "Ctrl+Alt+K");

const shortcuts = createShortcutState({ split: "Ctrl+K", fullscreen: "Ctrl+Shift+F" });
assert.equal(shortcuts.copy, DEFAULT_SHORTCUTS.copy);
assert.equal(shortcuts.duplicate, "Ctrl+D");
assert.equal(actionForShortcut(shortcuts, "Ctrl+K"), "split");
assert.equal(actionForShortcut(shortcuts, "Ctrl+Shift+F"), "fullscreen");
assert.equal(actionForShortcut(shortcuts, "F"), null);

console.log("shortcutManager tests passed");
