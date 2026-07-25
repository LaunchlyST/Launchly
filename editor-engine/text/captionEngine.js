import { clamp } from "../utils/math.js";

export const CAPTION_MODES = Object.freeze(["word", "sentence"]);
export const CAPTION_ANIMATIONS = Object.freeze(["none", "fade", "rise", "karaoke", "pop"]);
export const CAPTION_TEMPLATES = Object.freeze({
  glass: {
    name: "Glass Lower",
    style: { fontSize: 28, fontWeight: 800, shadow: 42, glow: 8, backgroundEnabled: true, backgroundOpacity: 44, align: "center" },
    animation: "karaoke",
  },
  editorial: {
    name: "Editorial Clean",
    style: { fontSize: 30, fontWeight: 700, shadow: 34, glow: 0, backgroundEnabled: false, backgroundOpacity: 0, align: "center" },
    animation: "fade",
  },
  speaker: {
    name: "Speaker Badge",
    style: { fontSize: 25, fontWeight: 800, shadow: 38, glow: 5, backgroundEnabled: true, backgroundOpacity: 36, align: "left" },
    animation: "rise",
  },
});

export const CAPTION_SAFE_POSITIONS = Object.freeze({
  horizontal: Object.freeze({ bottom: "8%", left: "50%", transform: "translateX(-50%)", maxWidth: "80%" }),
  vertical: Object.freeze({ bottom: "12%", left: "50%", transform: "translateX(-50%)", maxWidth: "90%" }),
  square: Object.freeze({ bottom: "6%", left: "50%", transform: "translateX(-50%)", maxWidth: "85%" }),
});

export function wordsFromText(text = "", duration = 1) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const slice = Math.max(0.08, duration / words.length);
  return words.map((word, index) => ({
    id: `word_${index + 1}`,
    text: word,
    start: Number((index * slice).toFixed(3)),
    end: Number(((index + 1) * slice).toFixed(3)),
  }));
}

export function normalizeCaptionLayer(layer = {}, clip = {}) {
  const text = String(layer.text ?? clip.textLayer?.text ?? clip.name ?? "Caption");
  const duration = Math.max(0.1, Number(clip.duration ?? 1));
  const words = (layer.words?.length ? layer.words : wordsFromText(text, duration)).map((word, index) => ({
    id: word.id ?? `word_${index + 1}`,
    text: String(word.text ?? ""),
    start: clamp(Number(word.start ?? 0), 0, duration),
    end: clamp(Number(word.end ?? duration), Number(word.start ?? 0) + 0.03, duration),
  }));
  return {
    mode: CAPTION_MODES.includes(layer.mode) ? layer.mode : "sentence",
    text,
    words,
    speaker: layer.speaker ?? "Narrator",
    speakerColor: layer.speakerColor ?? "#bfeeff",
    trackName: layer.trackName ?? "Captions",
    safeZone: Boolean(layer.safeZone ?? true),
    animation: CAPTION_ANIMATIONS.includes(layer.animation) ? layer.animation : "karaoke",
    templateId: layer.templateId ?? "glass",
    exportFormat: layer.exportFormat ?? "srt",
  };
}

export function activeCaptionWords(captionLayer, localTime) {
  const layer = normalizeCaptionLayer(captionLayer);
  if (layer.mode === "sentence") return layer.words.map((word) => ({ ...word, active: true }));
  return layer.words.map((word) => ({ ...word, active: localTime >= word.start && localTime <= word.end }));
}

export function captionSafePosition(aspectRatio) {
  if (!aspectRatio) return CAPTION_SAFE_POSITIONS.horizontal;
  const [w, h] = aspectRatio.split(":").map(Number);
  if (w && h) {
    if (h > w) return CAPTION_SAFE_POSITIONS.vertical;
    if (w === h) return CAPTION_SAFE_POSITIONS.square;
  }
  return CAPTION_SAFE_POSITIONS.horizontal;
}

export function parseSRT(content) {
  const blocks = content.trim().replace(/\r\n/g, "\n").split(/\n\n+/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    let timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine && lines.length >= 3) timeLine = lines[1];
    if (!timeLine || !timeLine.includes("-->")) continue;
    const match = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;
    const start = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    const end = Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000;
    const textLines = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l.trim()));
    const text = textLines.join(" ").trim();
    if (text) segments.push({ start, end, text });
  }
  return segments;
}

export function parseVTT(content) {
  const cleaned = content.trim().replace(/\r\n/g, "\n");
  const lines = cleaned.split("\n");
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].includes("-->")) {
      const match = lines[i].match(/(\d{2}):(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.](\d{3})/);
      if (!match) { i++; continue; }
      const start = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
      const end = Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000;
      i++;
      const textLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim());
        i++;
      }
      const text = textLines.join(" ").trim();
      if (text) segments.push({ start, end, text });
    } else {
      i++;
    }
  }
  return segments;
}

export function captionExport(clips = [], format = "srt") {
  const captionClips = clips
    .filter((clip) => clip.type === "caption")
    .sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));
  if (format === "json") return JSON.stringify(captionClips.map((clip) => ({ start: clip.timelineStart ?? clip.start, end: (clip.timelineStart ?? clip.start) + clip.duration, text: clip.captionLayer?.text ?? clip.name, speaker: clip.captionLayer?.speaker })), null, 2);
  if (format === "vtt") {
    const header = "WEBVTT\n\n";
    const body = captionClips.map((clip, index) => {
      const start = vttTime(clip.timelineStart ?? clip.start);
      const end = vttTime((clip.timelineStart ?? clip.start) + clip.duration);
      return `${index + 1}\n${start} --> ${end}\n${clip.captionLayer?.text ?? clip.name}`;
    }).join("\n\n");
    return header + body;
  }
  return captionClips.map((clip, index) => {
    const start = srtTime(clip.timelineStart ?? clip.start);
    const end = srtTime((clip.timelineStart ?? clip.start) + clip.duration);
    return `${index + 1}\n${start} --> ${end}\n${clip.captionLayer?.text ?? clip.name}`;
  }).join("\n\n");
}

function srtTime(seconds) {
  const ms = Math.round((seconds % 1) * 1000).toString().padStart(3, "0");
  const total = Math.floor(seconds);
  const s = String(total % 60).padStart(2, "0");
  const m = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  return `${h}:${m}:${s},${ms}`;
}

function vttTime(seconds) {
  const ms = Math.round((seconds % 1) * 1000).toString().padStart(3, "0");
  const total = Math.floor(seconds);
  const s = String(total % 60).padStart(2, "0");
  const m = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  return `${h}:${m}:${s}.${ms}`;
}
