import { StyleType } from './types';

const OPENAI_BASE = 'https://api.openai.com/v1';

export async function generateImage(
  apiKey: string,
  prompt: string,
  style: StyleType
): Promise<string> {
  const styledPrompt = style === 'realistic'
    ? `Photorealistic, high detail, professional product photography: ${prompt}`
    : `Cartoon style, animated, colorful, fun: ${prompt}`;

  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: styledPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `OpenAI image error ${res.status}`);
  }

  const data = await res.json();
  const item = data.data?.[0];
  if (item?.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  if (item?.url) {
    return item.url;
  }
  throw new Error('No image returned from OpenAI');
}

export async function generateVideo(
  apiKey: string,
  prompt: string,
  style: StyleType
): Promise<string> {
  const styledPrompt = style === 'realistic'
    ? `Photorealistic, cinematic, high detail: ${prompt}`
    : `Cartoon style, animated, fun: ${prompt}`;

  const res = await fetch(`${OPENAI_BASE}/video/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sora-2',
      prompt: styledPrompt,
      size: '1080x1920',
      duration: 10,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `OpenAI video error ${res.status}`);
  }

  const data = await res.json();
  if (data.data?.[0]?.url) {
    return data.data[0].url;
  }
  if (data.video?.url) {
    return data.video.url;
  }
  throw new Error('No video returned from OpenAI');
}
