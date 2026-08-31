# ai-chat

The "Ask anything…" prompt composer for the editor.

- `PromptComposer.tsx` — the input itself: auto-growing textarea (Enter sends,
  Shift+Enter adds a line), character counter, and the controls below it.
- `SendButton.tsx` — send, which becomes stop-generation while a turn runs.
- `AttachmentButton.tsx` — Attach, owning its hidden file input.
- `VoiceButton.tsx` — Voice / Chat / Script / Model mode menu.
- `AICommandBar.tsx` — small AI command controls.
- `ai-chat.css` — styles for the composer.

The conversation the composer feeds lives in `../ai-conversation`.
