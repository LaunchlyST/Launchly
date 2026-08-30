# preview

Video preview area (the canvas in the middle):
- `VideoPreview.tsx` — the preview viewport.
- `CenterStage.tsx` — stage container for media.
- `PreviewMediaLayer.tsx` — renders the selected media on the stage.
- `useMediaDrag.ts` / `useMediaResize.ts` — drag and resize (stretch) logic.
- `usePreviewBounds.ts`, `coordinates.ts`, `clamp.ts`, `PreviewBounds.ts`, `preview.types.ts` — helpers.
- `preview.css` — styles.