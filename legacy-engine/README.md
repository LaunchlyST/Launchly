# editor/

Shared logic for editor subsystems — hooks, pure calculations, and cross-cutting UI (notifications) that more than one part of the editor uses. One folder per system, each with its own short README.

| Folder | Owns |
|---|---|
| `constants/` | `editorLimits.ts` — every tunable timing/threshold value used by drag, boundary, and notification behaviour. Change a number here, not in a component. |
| `utils/` | Small pure helpers (`clamp.ts`, `coordinates.ts`) with no editor-specific knowledge. |
| `preview/` | Pure bounds math for the preview canvas's editable area — `PreviewBounds.ts`. No React. |
| `interactions/` | React hooks built on `preview/` — `usePreviewBounds.ts`, `useMediaDrag.ts`. |
| `notifications/` | The app-wide toast system — `NotificationProvider`, `NotificationToast`, `NotificationContainer`. |

## Where the rendered components live

This folder holds logic that's reusable across systems. The components that actually render each part of the editor stay where they already were, so existing imports don't break:

- **Preview canvas** — `Editor/components/preview/` (`VideoPreview.tsx` is the canvas container; `PreviewMediaLayer.tsx` is the draggable media it wraps around `editor/interactions/useMediaDrag`). See the README in that folder.
- **Timeline** — `Editor/components/timeline/`.
- **AI model selector** — `Editor/components/ai/` (`ModelCurve.tsx`).
- **Media library / composer** — `Editor/components/media/`, `Editor/components/ai/`.

If you're an AI picking this project up: start with this table, then open the README inside whichever folder you need to change.
