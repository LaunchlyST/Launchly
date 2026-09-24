import React from 'react';
import { useStore } from '../../../store';
import { useSettingsStore } from '../settingsStore';
import { AI_PROVIDER_MODELS, type ChatProvider } from '../types';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { SettingsSelect } from '../components/SettingsSelect';

export function AiPreferencesSection() {
  const openaiKey = useStore((s) => s.openaiKey);
  const claudeKey = useStore((s) => s.claudeKey);
  const grokKey = useStore((s) => s.grokKey);
  const { settings, update } = useSettingsStore();

  const configured = (provider: ChatProvider) => (provider === 'openai' ? openaiKey.length > 0 : claudeKey.length > 0);

  return (
    <SettingsSection
      title="AI Preferences"
      subtitle="Choose which AI providers and models Launchly should use by default."
    >
      <SettingsCard title="Chat / Agent">
        <SettingsRow label="Default provider">
          <div className="stg-provider-choice">
            {(['openai', 'anthropic'] as ChatProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`stg-choice-btn ${settings.defaultChatProvider === p ? 'is-selected' : ''}`}
                onClick={() => update({ defaultChatProvider: p, defaultChatModel: undefined })}
              >
                <span>{AI_PROVIDER_MODELS[p].label}</span>
                <span className={`stg-choice-btn__status ${configured(p) ? 'is-ok' : ''}`}>
                  {configured(p) ? 'Configured' : 'API key required'}
                </span>
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Default model" description="Applies once the selected provider is connected.">
          <SettingsSelect
            ariaLabel="Default chat model"
            value={settings.defaultChatModel ?? AI_PROVIDER_MODELS[settings.defaultChatProvider].models[0].id}
            onChange={(v) => update({ defaultChatModel: v })}
            options={AI_PROVIDER_MODELS[settings.defaultChatProvider].models.map((m) => ({
              value: m.id,
              label: m.label,
            }))}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Image generation">
        <SettingsRow label="Default image provider" description="Launchly currently generates images through OpenAI only.">
          <SettingsSelect
            ariaLabel="Default image provider"
            value={settings.defaultImageProvider}
            onChange={() => update({ defaultImageProvider: 'openai' })}
            options={[{ value: 'openai', label: 'OpenAI' }]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Video generation">
        <SettingsRow label="Default video provider" description="Launchly currently generates video through Grok (xAI) only.">
          <SettingsSelect
            ariaLabel="Default video provider"
            value={settings.defaultVideoProvider}
            onChange={() => update({ defaultVideoProvider: 'grok' })}
            options={[{ value: 'grok', label: 'Grok / xAI' }]}
          />
        </SettingsRow>
        {!grokKey && <p className="stg-hint">Add a Grok API key under API Keys to use video generation.</p>}
      </SettingsCard>

      <SettingsCard title="Monitor Control default">
        <SettingsRow label="Preselected provider" description="Used when a new Monitor Control session starts. An active session is never switched.">
          <div className="stg-provider-choice">
            {(['openai', 'anthropic'] as ChatProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`stg-choice-btn ${settings.defaultMonitorProvider === p ? 'is-selected' : ''}`}
                onClick={() => update({ defaultMonitorProvider: p })}
              >
                <span>{AI_PROVIDER_MODELS[p].label}</span>
                <span className={`stg-choice-btn__status ${configured(p) ? 'is-ok' : ''}`}>
                  {configured(p) ? 'Configured' : 'API key required'}
                </span>
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
