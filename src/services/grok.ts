import { StyleType } from './types';

const GROK_BASE = 'https://api.x.ai/v1';

export async function generateImage(
  apiKey: string,
  prompt: string,
  style: StyleType
): Promise<string> {
  const styledPrompt = style === 'realistic'
    ? `Photorealistic, high detail, professional product photography: ${prompt}`
    : `Cartoon style, animated, colorful, fun: ${prompt}`;

  const res = await fetch(`${GROK_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-image-1',
      prompt: styledPrompt,
      n: 1,
      size: '1024x1024',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `Grok image error ${res.status}`);
  }

  const data = await res.json();
  const item = data.data?.[0];
  if (item?.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  if (item?.url) {
    return item.url;
  }
  throw new Error('No image returned from Grok');
}

export async function generateVideo(
  apiKey: string,
  prompt: string,
  style: StyleType
): Promise<{ startJob: () => Promise<string>; poll: (id: string) => Promise<{ status: string; url?: string; error?: string }> }> {
  const styledPrompt = style === 'realistic'
    ? `Photorealistic, cinematic, high detail: ${prompt}`
    : `Cartoon style, animated, fun: ${prompt}`;

  const startJob = async (): Promise<string> => {
    const res = await fetch(`${GROK_BASE}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-video',
        prompt: styledPrompt,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `Grok video start error ${res.status}`);
    }

    const data = await res.json();
    return data.request_id || data.id;
  };

  const poll = async (requestId: string) => {
    const res = await fetch(`${GROK_BASE}/videos/${requestId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Grok video poll error ${res.status}`);
    }

    const data = await res.json();
    if (data.status === 'done' || data.status === 'completed') {
      const url = data.video?.url || data.output?.video_url || data.url;
      return { status: 'done', url };
    }
    if (data.status === 'failed' || data.status === 'expired') {
      return { status: 'failed', error: data.error || 'Video generation failed' };
    }
    return { status: data.status || 'processing' };
  };

  return { startJob, poll };
}

export async function analyzeImage(
  apiKey: string,
  imageUrl: string
): Promise<string> {
  const res = await fetch(`${GROK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-2-vision-1212',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in detail for a TikTok Shop product listing.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `Grok analysis error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No description returned';
}
