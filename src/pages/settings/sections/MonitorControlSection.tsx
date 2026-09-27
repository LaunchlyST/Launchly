import React from 'react';
import { useSettingsStore } from '../settingsStore';
import { AI_PROVIDER_MODELS, type ChatProvider } from '../types';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsRow, SettingsDivider } from '../components/SettingsRow';
import { SettingsToggle } from '../components/SettingsToggle';

export function MonitorControlSection() {
  const { settings, update, updateMonitorPermissions } = useSettingsStore();

  return (
    <SettingsSection
      title="Monitor Control"
      subtitle="Configure defaults for AI computer control sessions."
    >
      <SettingsCard title="Default AI provider">
        <SettingsRow label="Preselected on a new session">
          <div className="stg-provider-choice">
            {(['openai', 'anthropic'] as ChatProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`stg-choice-btn ${settings.defaultMonitorProvider === p ? 'is-selected' : ''}`}
                onClick={() => update({ defaultMonitorProvider: p })}
              >
                {AI_PROVIDER_MODELS[p].label}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Permissions" description="Defaults for new sessions only. Windows permissions have not been granted yet — that happens once the Launchly Desktop Agent exists.">
        <SettingsToggle
          label="Screen viewing"
          checked={settings.monitorPermissions.screenViewing}
          onChange={(v) => updateMonitorPermissions({ screenViewing: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Mouse control"
          checked={settings.monitorPermissions.mouseControl}
          onChange={(v) => updateMonitorPermissions({ mouseControl: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Keyboard control"
          checked={settings.monitorPermissions.keyboardControl}
          onChange={(v) => updateMonitorPermissions({ keyboardControl: v })}
        />
      </SettingsCard>

      <SettingsCard title="Session behaviour">
        <SettingsToggle
          label="Always ask before starting control"
          checked={settings.monitorAlwaysAsk}
          onChange={(v) => update({ monitorAlwaysAsk: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Confirm before high-impact actions"
          checked={settings.monitorConfirmHighImpact}
          onChange={(v) => update({ monitorConfirmHighImpact: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Show AI cursor"
          checked={settings.monitorShowAiCursor}
          onChange={(v) => update({ monitorShowAiCursor: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Highlight active monitor"
          checked={settings.monitorHighlightActive}
          onChange={(v) => update({ monitorHighlightActive: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Double-click monitor to stop"
          checked={settings.monitorDoubleClickStop}
          onChange={(v) => update({ monitorDoubleClickStop: v })}
        />
      </SettingsCard>

      <SettingsCard title="Reference">
        <SettingsRow label="Active control border">
          <span className="stg-color-indicator">
            <span className="stg-color-indicator__dot" style={{ background: '#ff9d2e' }} />
            Orange
          </span>
        </SettingsRow>
        <SettingsRow label="Emergency stop shortcut" description="Available when the Launchly Desktop Agent supports the system-level emergency shortcut.">
          <kbd className="stg-kbd">Ctrl + Shift + Escape</kbd>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
