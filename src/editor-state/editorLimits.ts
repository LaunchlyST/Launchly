/**
 * Central tuning values for editor interaction systems (preview drag,
 * boundary error states, notifications, …). Change a behaviour here rather
 * than hunting for a magic number scattered across component files.
 */
export const EDITOR_LIMITS = {
  /** How long an error/warning toast stays up before auto-dismissing, ms. */
  errorToastDuration: 3000,

  /** How long a boundary error visual lingers after the pointer is released, ms. */
  boundaryErrorLingerMs: 600,

  /**
   * Maximum visual overshoot allowed when dragging past a boundary, in
   * canvas px. Kept tiny and hard-capped — see PreviewBounds.ts — so the
   * interaction reads as "give" rather than an unbounded rubber-band.
   */
  boundaryResistancePx: 3,

  /** How much of an overshoot actually translates to visible movement (0..1). */
  boundaryResistanceFactor: 0.15,

  /** Inset applied to the canvas edge before computing drag bounds, px. */
  previewPadding: 0,

  /** Min / max scale for the whole-preview corner-resize zoom. */
  previewZoomMin: 0.6,
  previewZoomMax: 1.6,

  /** Min / max scale for an individual media object dragged inside the canvas. */
  objectScaleMin: 0.4,
  objectScaleMax: 3,

  /** Minimum ms between duplicate boundary notifications while held against a wall. */
  boundaryNotifyCooldownMs: 1200,
} as const;
