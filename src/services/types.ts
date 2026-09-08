export type ModelType = 'chatgpt' | 'grok';
export type GenerationType = 'image' | 'video';
export type StyleType = 'realistic' | 'cartoon';

export interface GenerationResult {
  type: GenerationType;
  url: string;
  model: ModelType;
  prompt: string;
  timestamp: number;
}

export function buildStyledPrompt(prompt: string, style: StyleType): string {
  if (style === 'realistic') {
    return `Photorealistic, high detail, professional product photography: ${prompt}`;
  }
  return `Cartoon style, animated, colorful, fun: ${prompt}`;
}
