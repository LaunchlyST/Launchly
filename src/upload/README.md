# upload

The media library at the top of the left sidebar, and media import.

- `MediaPanel.tsx` — the sidebar itself. Composes the media library, the AI
  conversation and the composer into one flex column, and owns the filter /
  view / search / drag state.
- `MediaHeader.tsx` — section label and item counter.
- `MediaToolbar.tsx` — Upload, search, and the grid/list toggle.
- `MediaFilters.tsx` — the All / Video / Images / Audio / Generated strip,
  including its sideways scrolling and drag-to-pan.
- `MediaLibrary.tsx` — the scrolling list/grid of items, and the
  filtered-empty state.
- `UploadDropzone.tsx` — the empty-library drop target, plus its uploading
  and failed states.
- `MediaItem.tsx` — one library item card.
- `MediaPreview.tsx` — media preview helper.
- `mediaImport.ts` — reads dropped/selected files into clips.
- `upload.css` — styles for the sidebar layout and the media UI.
