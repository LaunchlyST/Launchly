# timeline

The timeline (bottom strip):
- `Timeline.tsx` — timeline container: ruler, playhead, tracks, zoom bar.
- `TimelineTrack.tsx` — one track row: V1 label, eye/lock/mute controls, the lane.
- `TimelineClip.tsx` — a single clip bar on a lane.
- `CurvedZoomSlider.tsx` — the zoom/visible-range slider.
- `timelineZoom.ts` — zoom math.
- `timeline.css` — styles.