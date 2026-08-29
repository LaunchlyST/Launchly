import { createId } from "../types/editorTypes.js";

export const EXPORT_FORMATS = Object.freeze(["MP4", "MOV", "WEBM"]);
export const EXPORT_CODECS = Object.freeze(["H.264", "HEVC", "ProRes", "AV1", "VP9"]);
export const EXPORT_RESOLUTIONS = Object.freeze({
  720: { width: 1280, height: 720, label: "720p" },
  1080: { width: 1920, height: 1080, label: "1080p" },
  1440: { width: 2560, height: 1440, label: "1440p" },
  2160: { width: 3840, height: 2160, label: "4K" },
});

const CODEC_FACTORS = Object.freeze({ "H.264": 1, HEVC: 0.72, ProRes: 4.4, AV1: 0.62, VP9: 0.7 });
const FORMAT_CODECS = Object.freeze({
  MP4: ["H.264", "HEVC", "AV1"],
  MOV: ["H.264", "HEVC", "ProRes"],
  WEBM: ["VP9", "AV1"],
});

export function normalizeExportSettings(settings = {}) {
  const format = EXPORT_FORMATS.includes(settings.format) ? settings.format : "MP4";
  const supportedCodecs = FORMAT_CODECS[format];
  const codec = supportedCodecs.includes(settings.codec) ? settings.codec : supportedCodecs[0];
  const resolution = EXPORT_RESOLUTIONS[settings.resolution] ? Number(settings.resolution) : 1080;
  return {
    format,
    resolution,
    fps: [24, 25, 30, 50, 60].includes(Number(settings.fps)) ? Number(settings.fps) : 30,
    codec,
    bitrate: Math.max(1, Math.min(240, Number(settings.bitrate ?? 18))),
    duration: Math.max(0.1, Number(settings.duration ?? 1)),
  };
}

export function validateExportSettings(settings = {}) {
  const normalized = normalizeExportSettings(settings);
  const errors = [];
  if (!FORMAT_CODECS[normalized.format].includes(settings.codec ?? normalized.codec)) {
    errors.push(`${settings.codec} is not supported for ${normalized.format}.`);
  }
  if (normalized.format === "WEBM" && normalized.codec === "H.264") errors.push("WEBM exports require VP9 or AV1.");
  if (normalized.bitrate < 2) errors.push("Bitrate is too low for a usable video export.");
  return { valid: errors.length === 0, errors, settings: normalized };
}

export function estimateExportSize(settings = {}) {
  const normalized = normalizeExportSettings(settings);
  const codecFactor = CODEC_FACTORS[normalized.codec] ?? 1;
  const resolutionFactor = normalized.resolution / 1080;
  const fpsFactor = normalized.fps / 30;
  return Math.max(1, Math.round((normalized.bitrate * normalized.duration * codecFactor * Math.sqrt(resolutionFactor) * fpsFactor) / 8));
}

export function createExportJob(settings = {}, projectName = "Untitled Campaign") {
  const validation = validateExportSettings(settings);
  const normalized = validation.settings;
  const resolution = EXPORT_RESOLUTIONS[normalized.resolution];
  const extension = normalized.format.toLowerCase();
  const createdAt = new Date().toISOString();
  return {
    id: createId("export"),
    name: `${projectName.replace(/\s+/g, "_")}_${resolution.label}.${extension}`,
    settings: normalized,
    sizeEstimateMb: estimateExportSize(normalized),
    status: validation.valid ? "queued" : "error",
    progress: 0,
    error: validation.errors[0] ?? null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function updateExportJob(job, patch = {}) {
  return { ...job, ...patch, updatedAt: new Date().toISOString() };
}
