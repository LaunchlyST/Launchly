/** Workspace settings — shared types and the one central provider/model map. */

export type ThemePreference = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'orange' | 'green' | 'neutral';
export type ChatProvider = 'openai' | 'anthropic';

export interface LaunchlySettings {
  theme: ThemePreference;
  accentColor: AccentColor;
  reduceAnimations: boolean;
  compactInterface: boolean;

  defaultChatProvider: ChatProvider;
  defaultChatModel?: string;

  defaultImageProvider: 'openai';
  defaultVideoProvider: 'grok';
  defaultMonitorProvider: ChatProvider;

  monitorPermissions: {
    screenViewing: boolean;
    mouseControl: boolean;
    keyboardControl: boolean;
  };

  monitorAlwaysAsk: boolean;
  monitorConfirmHighImpact: boolean;
  monitorShowAiCursor: boolean;
  monitorHighlightActive: boolean;
  monitorDoubleClickStop: boolean;

  doNotSaveMonitorHistory: boolean;

  notifications: {
    aiTaskCompleted: boolean;
    monitorDisconnected: boolean;
    monitorTaskCompleted: boolean;
    apiConnectionProblem: boolean;
    paymentIssue: boolean;
    generationCompleted: boolean;
  };
}

export const DEFAULT_LAUNCHLY_SETTINGS: LaunchlySettings = {
  theme: 'light',
  accentColor: 'blue',
  reduceAnimations: false,
  compactInterface: false,

  defaultChatProvider: 'openai',
  defaultChatModel: undefined,

  defaultImageProvider: 'openai',
  defaultVideoProvider: 'grok',
  defaultMonitorProvider: 'openai',

  monitorPermissions: {
    screenViewing: false,
    mouseControl: false,
    keyboardControl: false,
  },

  monitorAlwaysAsk: true,
  monitorConfirmHighImpact: true,
  monitorShowAiCursor: true,
  monitorHighlightActive: true,
  monitorDoubleClickStop: true,

  doNotSaveMonitorHistory: true,

  notifications: {
    aiTaskCompleted: true,
    monitorDisconnected: true,
    monitorTaskCompleted: true,
    apiConnectionProblem: true,
    paymentIssue: true,
    generationCompleted: true,
  },
};

/**
 * Every model a "chat / agent" provider can be set as default, in one place —
 * nowhere else in Settings should hardcode a model id or label.
 *
 * These ids are not yet wired to any live call in Launchly (the generator
 * only switches between the OpenAI and Grok *providers*, see store.ts); this
 * is preference storage for Monitor Control and future chat features to read.
 */
export const AI_PROVIDER_MODELS: Record<
  ChatProvider,
  { label: string; models: Array<{ id: string; label: string }> }
> = {
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
  anthropic: {
    label: 'Claude',
    models: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
};

export type SettingsSectionId =
  | 'account'
  | 'billing'
  | 'api-keys'
  | 'ai-preferences'
  | 'appearance'
  | 'monitor-control'
  | 'privacy'
  | 'notifications'
  | 'developer';

export const SETTINGS_SECTIONS: Array<{ id: SettingsSectionId; label: string }> = [
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Subscription & Billing' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'ai-preferences', label: 'AI Preferences' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'monitor-control', label: 'Monitor Control' },
  { id: 'privacy', label: 'Privacy & Data' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'developer', label: 'Developer' },
];
