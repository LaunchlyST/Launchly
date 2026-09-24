import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useStore } from '../../../store';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { ApiKeyProviderCard } from '../components/ApiKeyProviderCard';

export function ApiKeysSection() {
  const openaiKey = useStore((s) => s.openaiKey);
  const grokKey = useStore((s) => s.grokKey);
  const claudeKey = useStore((s) => s.claudeKey);
  const setOpenaiKey = useStore((s) => s.setOpenaiKey);
  const setGrokKey = useStore((s) => s.setGrokKey);
  const setClaudeKey = useStore((s) => s.setClaudeKey);

  return (
    <SettingsSection
      title="API Keys"
      subtitle="Connect the AI providers Launchly uses to generate and to run Monitor Control."
    >
      <ApiKeyProviderCard
        provider="openai"
        title="ChatGPT API key"
        subtitle="OpenAI · Chat & Image generation"
        value={openaiKey}
        onSave={setOpenaiKey}
        placeholder="sk-••••••••••••"
      />

      <ApiKeyProviderCard
        provider="grok"
        title="Grok API key"
        subtitle="xAI · Chat & Video generation"
        value={grokKey}
        onSave={setGrokKey}
        placeholder="xai-••••••••••••"
      />

      <ApiKeyProviderCard
        provider="claude"
        title="Claude API key"
        subtitle="Anthropic · Chat, Agent & Monitor Control"
        value={claudeKey}
        onSave={setClaudeKey}
        placeholder="Enter your Anthropic API key"
      />

      <SettingsCard>
        <div className="stg-notice">
          <ShieldCheck size={17} className="stg-notice__icon" />
          <div>
            <p className="stg-notice__title">Keep your API keys private</p>
            <p className="stg-notice__text">
              Your keys are used only to connect Launchly with the AI providers you choose. Never
              share your keys publicly or commit them to source code.
            </p>
            <p className="stg-notice__text">
              Your saved keys are stored on this device/browser (in this browser's local storage).
              They are not encrypted and are never sent to Launchly's servers.
            </p>
          </div>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
