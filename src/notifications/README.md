# notifications

App-wide toast system. Top-right, glass, auto-dismiss, deduplicated.

- **notification.types.ts** — `NotificationType`, `NotificationInput`, `EditorNotification`.
- **NotificationProvider.tsx** — context + `notify()` / `dismiss()`. Owns dedup (same type+title while one is showing just refreshes its timer instead of stacking) and auto-dismiss timers.
- **NotificationToast.tsx** — one toast's markup (icon by type, title, message, close button).
- **NotificationContainer.tsx** — renders the top-right stack from context. Mount once near the app root.

## Usage

```tsx
// once, near the root:
<NotificationProvider>
  <App />
  <NotificationContainer />
</NotificationProvider>

// anywhere inside:
const notify = useNotify();
notify({ type: 'error', title: 'Movement limit reached', message: 'This element cannot be moved farther.' });
```

Timing knobs (duration, etc.) live in `editor/constants/editorLimits.ts`, not here.
