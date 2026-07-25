export const DRAG_TYPES = Object.freeze(["media", "clip", "transition", "effect", "text", "audio"]);

export function normalizeDragPayload(input = {}) {
  const type = DRAG_TYPES.includes(input.type) ? input.type : "media";
  const items = Array.isArray(input.items) ? input.items : [];
  return {
    type,
    items,
    clipIds: [...(input.clipIds ?? [])],
    clipType: input.clipType ?? (type === "audio" ? "audio" : type === "text" ? "text" : items[0]?.type),
    label: input.label ?? type,
    effectAllowed: input.effectAllowed ?? (type === "clip" ? "move" : "copyMove"),
    name: input.name ?? null,
    duration: Number(input.duration ?? 0.6),
    effectType: input.effectType ?? null,
    text: input.text ?? null,
    direction: input.direction ?? "out",
    startedAt: input.startedAt ?? null,
  };
}

export function canDropPayloadOnTrack(payload, track) {
  if (!payload || !track || track.locked) return false;
  if (payload.type === "transition" || payload.type === "effect") return track.type !== "audio";
  const clipType = payload.clipType ?? payload.items?.[0]?.type;
  if (!clipType) return true;
  if (track.type === "audio") return clipType === "audio";
  return clipType !== "audio";
}

export function createDragSession(payload, now = Date.now()) {
  return { ...normalizeDragPayload(payload), startedAt: now };
}
