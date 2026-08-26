import { Clip } from '../types';

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  type: 'video';
}

interface AudioMetadata {
  duration: number;
  type: 'audio';
}

interface ImageMetadata {
  width: number;
  height: number;
  type: 'image';
}

type MediaMetadata = VideoMetadata | AudioMetadata | ImageMetadata;

export function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        type: 'video',
      };
      URL.revokeObjectURL(video.src);
      resolve(metadata);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error(`Failed to load video: ${file.name}`));
    };

    video.src = URL.createObjectURL(file);
  });
}

export function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';

    audio.onloadedmetadata = () => {
      const metadata: AudioMetadata = {
        duration: audio.duration,
        type: 'audio',
      };
      URL.revokeObjectURL(audio.src);
      resolve(metadata);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error(`Failed to load audio: ${file.name}`));
    };

    audio.src = URL.createObjectURL(file);
  });
}

export function extractImageMetadata(file: File): Promise<ImageMetadata> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const metadata: ImageMetadata = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        type: 'image',
      };
      URL.revokeObjectURL(img.src);
      resolve(metadata);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = URL.createObjectURL(file);
  });
}

export async function generateVideoThumbnail(file: File, time: number = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.crossOrigin = 'anonymous';

    video.onloadeddata = () => {
      video.currentTime = Math.min(time, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(video.src);
        resolve('');
        return;
      }

      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      const scale = Math.max(scaleX, scaleY);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      const offsetX = (canvas.width - drawWidth) / 2;
      const offsetY = (canvas.height - drawHeight) / 2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

      const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
      URL.revokeObjectURL(video.src);
      resolve(thumbnail);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve('');
    };

    video.src = URL.createObjectURL(file);
  });
}

export async function generateVideoThumbnails(file: File, count: number = 5): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;

    let duration = 0;
    const thumbnails: string[] = [];
    let currentIndex = 0;

    video.onloadedmetadata = () => {
      duration = video.duration;
      if (duration <= 0) {
        resolve([]);
        return;
      }
      captureNext();
    };

    const captureNext = () => {
      if (currentIndex >= count) {
        URL.revokeObjectURL(video.src);
        resolve(thumbnails);
        return;
      }

      const time = (duration / (count + 1)) * (currentIndex + 1);
      video.currentTime = Math.min(time, duration - 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        currentIndex++;
        captureNext();
        return;
      }

      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      const scale = Math.max(scaleX, scaleY);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      const offsetX = (canvas.width - drawWidth) / 2;
      const offsetY = (canvas.height - drawHeight) / 2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

      thumbnails.push(canvas.toDataURL('image/jpeg', 0.5));
      currentIndex++;
      captureNext();
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(thumbnails);
    };

    video.src = URL.createObjectURL(file);
  });
}

export async function generateWaveform(file: File, bars: number = 100): Promise<number[]> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const rawData = audioBuffer.getChannelData(0);
    const samplesPerBar = Math.floor(rawData.length / bars);
    const waveform: number[] = [];

    for (let i = 0; i < bars; i++) {
      let sum = 0;
      const start = i * samplesPerBar;
      for (let j = start; j < start + samplesPerBar && j < rawData.length; j++) {
        sum += Math.abs(rawData[j]);
      }
      waveform.push(sum / samplesPerBar);
    }

    const max = Math.max(...waveform, 0.001);
    const normalized = waveform.map((v) => v / max);

    audioContext.close();
    return normalized;
  } catch {
    return new Array(bars).fill(0.5);
  }
}

export function detectFpsFromFile(_file: File): number {
  return 30;
}

interface ImportResult {
  videoClip: Clip;
  audioClip: Clip | null;
  thumbnail: string;
  waveform: number[];
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export async function importMediaFile(
  file: File,
  videoTrackId: string,
  audioTrackId: string,
  timelineStart: number
): Promise<ImportResult> {
  const isAudio = file.type.startsWith('audio/');
  const isImage = file.type.startsWith('image/');
  const src = URL.createObjectURL(file);

  let duration = 10;
  let width = 1920;
  let height = 1080;
  let fps = 30;
  let thumbnail = '';
  let waveform: number[] = [];

  if (isAudio) {
    const meta = await extractAudioMetadata(file);
    duration = meta.duration;
    waveform = await generateWaveform(file);
  } else if (isImage) {
    const meta = await extractImageMetadata(file);
    width = meta.width;
    height = meta.height;
    duration = 5;
  } else {
    const meta = await extractVideoMetadata(file);
    duration = meta.duration;
    width = meta.width;
    height = meta.height;
    fps = detectFpsFromFile(file);
    thumbnail = await generateVideoThumbnail(file);

    try {
      waveform = await generateWaveform(file);
    } catch {
      waveform = [];
    }
  }

  const clipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // For video, create ONE linked clip with embedded audio (no separate audio clip)
  const hasEmbeddedAudio = !isAudio && !isImage && waveform.length > 0;

  // Generate thumbnail strip for video (keep single thumb + try multi if possible)
  let thumbnails: string[] | undefined = undefined;
  if (!isImage && !isAudio && file.type.startsWith('video/')) {
    try {
      const thumbs = await generateVideoThumbnails(file, 4);
      if (thumbs.length) thumbnails = thumbs;
    } catch {}
  }

  const videoClip: Clip = {
    id: clipId,
    name: file.name,
    type: isAudio ? 'audio' : isImage ? 'image' : 'video',
    src,
    trackId: isAudio ? audioTrackId : videoTrackId,
    timelineStart,
    start: 0,
    duration: isImage ? 4 : duration,
    layer: 0,
    hidden: false,
    locked: false,
    solo: false,
    opacity: 1,
    transform: { scale: 1, rotate: 0, position: { x: 0, y: 0 } },
    speed: 1,
    blendMode: 'normal',
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    crop: 0,
    blur: 0,
    shadow: 0,
    border: 0,
    thumbnail: thumbnail || undefined,
    thumbnails,
    waveform: waveform.length > 0 ? waveform : undefined,
    width,
    height,
    fps,
    sourceStart: 0,
    sourceDuration: isImage ? undefined : duration,
    hasEmbeddedAudio,
    audioDetached: false,
  } as any;

  // No separate audio clip for video — stays linked
  let audioClip: Clip | null = null;

  return {
    videoClip,
    audioClip,
    thumbnail,
    waveform,
    duration: isImage ? 4 : duration,
    width,
    height,
    fps,
  };
}

export async function importMediaFiles(
  files: FileList | File[],
  videoTrackId: string,
  audioTrackId: string,
  existingClips: Clip[]
): Promise<{ clips: Clip[]; totalDuration: number }> {
  const fileArray = Array.from(files);
  const clips: Clip[] = [];
  let currentTime = existingClips.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);

  for (const file of fileArray) {
    try {
      const result = await importMediaFile(file, videoTrackId, audioTrackId, currentTime);
      clips.push(result.videoClip);
      // audioClip is now null for linked video — do not duplicate
      if (result.audioClip) {
        clips.push(result.audioClip);
      }
      currentTime += result.duration;
    } catch (err) {
      console.error(`Failed to import ${file.name}:`, err);
    }
  }

  return {
    clips,
    totalDuration: currentTime,
  };
}
