export interface AIModel {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export const AI_MODELS: AIModel[] = [
  // OpenAI / ChatGPT family — current & useful only
  {
    id: 'gpt-5.1',
    label: 'GPT-5.1',
    shortLabel: 'GPT-5.1',
    icon: '⬢',
    description: 'OpenAI GPT-5.1 — flagship reasoning & creative',
    enabled: true,
  },
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    shortLabel: 'GPT-5 Mini',
    icon: '⬣',
    description: 'GPT-5 Mini — fast & capable',
    enabled: true,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    shortLabel: 'GPT-4o',
    icon: '◈',
    description: 'GPT-4o — versatile multimodal',
    enabled: true,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    shortLabel: '4o Mini',
    icon: '◇',
    description: 'GPT-4o Mini — efficient',
    enabled: true,
  },
  // Claude family — current & useful only
  {
    id: 'claude-opus-4.5',
    label: 'Claude Opus 4.5',
    shortLabel: 'Opus 4.5',
    icon: '⬔',
    description: 'Anthropic Claude Opus 4.5 — most capable',
    enabled: true,
  },
  {
    id: 'claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    shortLabel: 'Sonnet 4.5',
    icon: '⬕',
    description: 'Claude Sonnet 4.5 — balanced',
    enabled: true,
  },
  {
    id: 'claude-haiku-4',
    label: 'Claude Haiku 4',
    shortLabel: 'Haiku 4',
    icon: '⬖',
    description: 'Claude Haiku 4 — fast',
    enabled: true,
  },
  {
    id: 'claude-sonnet-3.5',
    label: 'Claude Sonnet 3.5',
    shortLabel: 'Sonnet 3.5',
    icon: '⬗',
    description: 'Claude Sonnet 3.5 — proven',
    enabled: true,
  },
];

export const DEFAULT_AI_MODEL_ID = 'gpt-5.1';

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getEnabledModels(): AIModel[] {
  return AI_MODELS.filter((m) => m.enabled);
}
