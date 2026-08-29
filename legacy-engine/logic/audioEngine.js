import { clamp } from "../utils/math.js";
import { evaluateKeyframes } from "../editing/keyframes.js";

export const DEFAULT_AUDIO_MIX = Object.freeze({
  volume: 1,
  pan: 0,
  fadeIn: 0,
  fadeOut: 0,
  muted: false,
  solo: false,
  noiseReduction: 0,
  voiceEnhance: 0,
  eq: { low: 0, mid: 0, high: 0 },
  compressor: { threshold: -18, ratio: 2.5, attack: 12, release: 120, makeupGain: 0, enabled: false },
  limiter: { ceiling: -1, release: 60, enabled: false },
  keyframes: [],
});

export function normalizeAudioMix(audio = {}) {
  return {
    ...DEFAULT_AUDIO_MIX,
    ...audio,
    volume: clamp(Number(audio.volume ?? DEFAULT_AUDIO_MIX.volume), 0, 2),
    pan: clamp(Number(audio.pan ?? DEFAULT_AUDIO_MIX.pan), -1, 1),
    fadeIn: clamp(Number(audio.fadeIn ?? DEFAULT_AUDIO_MIX.fadeIn), 0, 30),
    fadeOut: clamp(Number(audio.fadeOut ?? DEFAULT_AUDIO_MIX.fadeOut), 0, 30),
    muted: Boolean(audio.muted ?? DEFAULT_AUDIO_MIX.muted),
    solo: Boolean(audio.solo ?? DEFAULT_AUDIO_MIX.solo),
    noiseReduction: clamp(Number(audio.noiseReduction ?? DEFAULT_AUDIO_MIX.noiseReduction), 0, 100),
    voiceEnhance: clamp(Number(audio.voiceEnhance ?? DEFAULT_AUDIO_MIX.voiceEnhance), 0, 100),
    eq: {
      low: clamp(Number(audio.eq?.low ?? DEFAULT_AUDIO_MIX.eq.low), -24, 24),
      mid: clamp(Number(audio.eq?.mid ?? DEFAULT_AUDIO_MIX.eq.mid), -24, 24),
      high: clamp(Number(audio.eq?.high ?? DEFAULT_AUDIO_MIX.eq.high), -24, 24),
    },
    compressor: {
      ...DEFAULT_AUDIO_MIX.compressor,
      ...(audio.compressor ?? {}),
      threshold: clamp(Number(audio.compressor?.threshold ?? DEFAULT_AUDIO_MIX.compressor.threshold), -60, 0),
      ratio: clamp(Number(audio.compressor?.ratio ?? DEFAULT_AUDIO_MIX.compressor.ratio), 1, 20),
      attack: clamp(Number(audio.compressor?.attack ?? DEFAULT_AUDIO_MIX.compressor.attack), 0, 100),
      release: clamp(Number(audio.compressor?.release ?? DEFAULT_AUDIO_MIX.compressor.release), 10, 1000),
      makeupGain: clamp(Number(audio.compressor?.makeupGain ?? DEFAULT_AUDIO_MIX.compressor.makeupGain), -24, 24),
      enabled: Boolean(audio.compressor?.enabled ?? DEFAULT_AUDIO_MIX.compressor.enabled),
    },
    limiter: {
      ...DEFAULT_AUDIO_MIX.limiter,
      ...(audio.limiter ?? {}),
      ceiling: clamp(Number(audio.limiter?.ceiling ?? DEFAULT_AUDIO_MIX.limiter.ceiling), -24, 0),
      release: clamp(Number(audio.limiter?.release ?? DEFAULT_AUDIO_MIX.limiter.release), 10, 1000),
      enabled: Boolean(audio.limiter?.enabled ?? DEFAULT_AUDIO_MIX.limiter.enabled),
    },
    waveform: [...(audio.waveform ?? [])],
    syncOffset: Number(audio.syncOffset ?? 0),
    keyframes: [...(audio.keyframes ?? [])],
  };
}

export function evaluateAudioMix(audio = {}, localTime = 0, clipDuration = 1) {
  const mix = normalizeAudioMix(audio);
  const k = mix.keyframes ?? [];
  const volume = evaluateKeyframes(k, "volume", localTime, mix.volume);
  const pan = evaluateKeyframes(k, "pan", localTime, mix.pan);
  const noiseReduction = evaluateKeyframes(k, "noiseReduction", localTime, mix.noiseReduction);
  const voiceEnhance = evaluateKeyframes(k, "voiceEnhance", localTime, mix.voiceEnhance);
  const low = evaluateKeyframes(k, "eq.low", localTime, mix.eq.low);
  const mid = evaluateKeyframes(k, "eq.mid", localTime, mix.eq.mid);
  const high = evaluateKeyframes(k, "eq.high", localTime, mix.eq.high);
  const fadeInGain = mix.fadeIn > 0 ? clamp(localTime / mix.fadeIn, 0, 1) : 1;
  const fadeOutStart = Math.max(0, clipDuration - mix.fadeOut);
  const fadeOutGain = mix.fadeOut > 0 && localTime > fadeOutStart ? clamp((clipDuration - localTime) / mix.fadeOut, 0, 1) : 1;
  const cleanBoost = 1 + (voiceEnhance / 100) * 0.12;
  const reductionLoss = 1 - (noiseReduction / 100) * 0.08;
  return {
    ...mix,
    volume: clamp(volume * fadeInGain * fadeOutGain * cleanBoost * reductionLoss, 0, 2),
    pan,
    noiseReduction,
    voiceEnhance,
    eq: { low, mid, high },
    compressor: mix.compressor,
    limiter: mix.limiter,
    gainReduction: mix.compressor.enabled ? Math.min(18, Math.max(0, (mix.compressor.ratio - 1) * 1.8 + noiseReduction * 0.035)) : 0,
    peak: mix.limiter.enabled ? Math.min(1, 10 ** (mix.limiter.ceiling / 20)) : 1,
  };
}

export function mixAudioLayers(layers = []) {
  const audible = layers.filter((layer) => !layer.muted && layer.volume > 0);
  const sum = audible.reduce((total, layer) => total + layer.volume, 0);
  const peak = audible.reduce((max, layer) => Math.max(max, layer.volume * (layer.peak ?? 1)), 0);
  return {
    audibleCount: audible.length,
    masterGain: clamp(sum / Math.max(1, audible.length), 0, 2),
    peak: clamp(peak, 0, 2),
    clipping: peak > 1,
  };
}
