# src — what each folder is for

| Folder | What it is for |
|---|---|
| `ai-chat` | AI chat panel: the "Ask anything..." prompt box (`FloatingComposer`) and AI command bar. |
| `app-shell` | The app entry point and main editor screen: `main.tsx`, `Editor.tsx`, `EditorLayout.tsx`. |
| `context-menu` | Right-click context menu component + its CSS. |
| `editor-state` | Global app state (Zustand store): tracks, clips, playhead, UI flags. |
| `editor-types` | Shared TypeScript types used across the editor. |
| `export` | Export flow: export settings modal (with 0-100% progress), success box, empty white page. |
| `global-search` | Global search overlay to find anything in the project. |
| `icons` | Reusable icon component. |
| `inspector` | Right-side properties/inspector panel for the selected clip. |
| `model-selector` | AI model picker: choose which model the AI assistant uses. |
| `notifications` | Toast notifications (provider, toast UI, container). |
| `paywall` | Paywall screen shown when a premium feature is blocked. |
| `preview` | Video preview canvas: `VideoPreview`, `CenterStage`, drag/resize logic for media. |
| `projects` | Project manager: open/switch/save projects. |
| `react-hooks` | Shared custom React hooks. |
| `settings` | Settings panel. |
| `sound` | Sound/audio helpers. |
| `subscription` | Subscription: plans and billing state. |
| `theme` | Theme colors and CSS variables. |
| `timeline` | Timeline: tracks, clips, playhead, ruler, zoom slider. |
| `tool-rail` | Left tool rail: tool buttons and their panels (select, trim, etc.). |
| `top-bar` | Top bar: project name, menus, top-level controls. |
| `upload` | Media panel: import/upload media, media items, media preview. |
| `utils` | Small utility helpers. |
| `video-controls` | Transport/playback controls and editor toolbar (play, mute, aspect ratio, Export button). |