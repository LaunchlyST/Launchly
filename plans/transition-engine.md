# Transition Engine Implementation Plan

## Context

The Launchly video editor has a foundational transition system in `editor-engine/effects/transitions.js` with 10 transition types defined, basic evaluation logic, and minimal UI. The user wants a professional transition engine with fade, dissolve, slide, push, wipe, zoom, blur, and spin transitions — with adjustable duration and full timeline editing.

**Current gaps:**
- Transitions lack directional control (slide/wipe/push only move in one direction)
- No easing curve selection in the UI
- Timeline handles aren't draggable for duration adjustment
- No visual overlap regions between adjacent clips
- No transition preview thumbnails
- No preset packs
- The wipe transition only outputs a `progress` value but has no CSS `clip-path` implementation
- Cross-clip transitions don't affect the adjacent incoming clip

## Files to Modify

### 1. `editor-engine/effects/transitions.js` — Enhanced Transition Engine
- Add `TRANSITION_PRESETS` (Cinematic, Social, Clean, Vintage) with curated type+easing+duration combos
- Extend `evaluateTransition()` with full directional support:
  - `slide`: direction `left`/`right`/`up`/`down` → x or y offset
  - `push`: direction `left`/`right`/`up`/`down` → x or y offset with scale
  - `wipe`: direction `left`/`right`/`up`/`down` → clip-path polygon points
  - `zoom`: in/out variants
  - `spin`: clockwise/counterclockwise
- Add `TRANSITION_DIRECTIONS` map per transition type
- Add `transitionPreview CSS(type)` returning a preview description/thumbnail CSS
- Add `findOverlappingTransitions(clips)` to detect cross-clip overlap transitions

### 2. `editor-engine/core/editorCore.js` — New Methods
- `addTransitionPreset(presetName)` — applies a preset bundle to selected clips
- `transitionOverlapRegion(clipId)` — returns the overlap window for a clip's transition

### 3. `index.html` — Enhanced Transition Panel
- Add direction selector (grid of 4 arrows) for directional transitions
- Add easing curve dropdown (linear, ease-in, ease-out, ease-in-out, cubic-bezier presets)
- Add preset pack selector with visual thumbnails
- Add transition preview thumbnail area
- Keep existing: type selector, duration slider, add/remove/duplicate, list

### 4. `app.js` — UI Logic & Timeline Editing
- Wire direction selector → `editor.updateTransition(id, { direction })`
- Wire easing selector → `editor.updateTransition(id, { easing })`
- Wire preset selector → `editor.addTransitionPreset(name)`
- Make timeline transition handles **draggable** for duration adjustment (pointer events)
- Render transition preview thumbnails using CSS animations
- Update `renderTransitionPanel()` to show direction/easing per transition row
- Update `applyAnimatedPreviewFrame()` to pass wipe clip-path and directional offsets
- Add `renderTransitionOverlapRegions()` to draw overlap zones between adjacent clips on the timeline

### 5. `styles.css` — Visual Enhancements
- Add `.transition-preview-thumb` with mini-animation previews for each type
- Add `.transition-overlap-region` for timeline overlap visualization (gradient between clips)
- Add `.transition-direction-grid` for the 4-direction picker UI
- Add `.transition-easing-curve` visual for easing curve display
- Enhance `.scene-card` with `clip-path` for wipe transitions via `--transition-wipe-path`
- Add `.transition-handle.draggable` hover/grab cursor states
- Add `.transition-preset-card` styling for preset pack thumbnails

## Implementation Steps

### Step 1: Enhance transitions.js engine
- Add direction maps per type, enhance evaluateTransition with full directional + wipe clip-path output

### Step 2: Add transition presets
- Define preset packs (Cinematic, Social, Clean, Vintage) in transitions.js
- Add addTransitionPreset() to EditorCore

### Step 3: Enhance HTML panel
- Add direction grid, easing dropdown, preset selector, preview thumbnail area

### Step 4: Enhance app.js
- Wire new UI controls, draggable handles, overlap regions, preview rendering

### Step 5: Enhance CSS
- Preview thumbnails, overlap regions, direction grid, wipe clip-path, preset cards

## Verification
- Open index.html in browser
- Select a clip on timeline
- Add transitions of each type → verify they appear on clip and in panel
- Change direction for slide/wipe/push → verify preview updates
- Change easing → verify smooth interpolation
- Drag transition handle on timeline → verify duration changes
- Apply presets → verify correct transition is added
- Verify wipe uses clip-path in preview
- Verify all 8 types render correctly in the preview area
