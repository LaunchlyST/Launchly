export type AIProvider = 'chatgpt' | 'claude';

export interface AIModel {
  id: string;
  /** Which company makes it — drives the logo under the name. */
  provider: AIProvider;
  /** Display name, e.g. "ChatGPT". Edit freely. */
  name: string;
  /** Version shown after the name, e.g. "5.1" or "Opus 4.8". Edit freely. */
  version: string;
  description: string;
  enabled: boolean;

  /* Kept for older call sites that read these. Derived from the fields above. */
  label: string;
  shortLabel: string;
  icon: string;
}

/**
 * Edit names and versions here — everything else follows automatically.
 * ChatGPT and Claude only.
 */
const RAW: Array<Omit<AIModel, 'label' | 'shortLabel' | 'icon'>> = [
  {
    id: 'gpt-5.1',
    provider: 'chatgpt',
    name: 'ChatGPT',
    version: '5.1',
    description: 'Flagship reasoning and creative work',
    enabled: true,
  },
  {
    id: 'gpt-5-mini',
    provider: 'chatgpt',
    name: 'ChatGPT',
    version: '5 Mini',
    description: 'Fast and capable',
    enabled: true,
  },
  {
    id: 'gpt-4o',
    provider: 'chatgpt',
    name: 'ChatGPT',
    version: '4o',
    description: 'Versatile multimodal',
    enabled: true,
  },
  {
    id: 'claude-opus-4.8',
    provider: 'claude',
    name: 'Claude',
    version: 'Opus 4.8',
    description: 'Most capable for long, complex edits',
    enabled: true,
  },
  {
    id: 'claude-sonnet-4.5',
    provider: 'claude',
    name: 'Claude',
    version: 'Sonnet 4.5',
    description: 'Balanced speed and quality',
    enabled: true,
  },
  {
    id: 'claude-haiku-4.5',
    provider: 'claude',
    name: 'Claude',
    version: 'Haiku 4.5',
    description: 'Fastest, for quick passes',
    enabled: true,
  },
];

const PROVIDER_GLYPH: Record<AIProvider, string> = {
  chatgpt: '◍',
  claude: '✳',
};

export const AI_MODELS: AIModel[] = RAW.map((m) => ({
  ...m,
  label: `${m.name} ${m.version}`,
  shortLabel: `${m.name} ${m.version}`,
  icon: PROVIDER_GLYPH[m.provider],
}));

export const DEFAULT_AI_MODEL_ID = 'gpt-5.1';

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getEnabledModels(): AIModel[] {
  return AI_MODELS.filter((m) => m.enabled);
}
