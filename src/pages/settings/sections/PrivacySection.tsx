import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../../../store';
import { useSettingsStore } from '../settingsStore';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { SettingsToggle } from '../components/SettingsToggle';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface PrivacySectionProps {
  onNavigateToAccount: () => void;
}

export function PrivacySection({ onNavigateToAccount }: PrivacySectionProps) {
  const clearKeys = useStore((s) => s.clearKeys);
  const { settings, update } = useSettingsStore();

  const [clearKeysOpen, setClearKeysOpen] = useState(false);
  const [keysCleared, setKeysCleared] = useState(false);

  const [clearLocalOpen, setClearLocalOpen] = useState(false);

  const confirmClearKeys = () => {
    clearKeys();
    setClearKeysOpen(false);
    setKeysCleared(true);
    setTimeout(() => setKeysCleared(false), 2000);
  };

  const confirmClearLocal = () => {
    /* Everything Launchly keeps in this browser is either the zustand-persisted
       app store (keys, generation prefs) or this settings store — both under
       localStorage. Clearing both is the whole of "local data" today. */
    try {
      window.localStorage.removeItem('tiktok-shop-creator-v2');
      window.localStorage.removeItem('launchly-settings-v1');
    } catch {
      /* storage unavailable — nothing to clear */
    }
    setClearLocalOpen(false);
    window.location.reload();
  };

  return (
    <SettingsSection
      title="Privacy & Data"
      subtitle="Control locally stored Launchly data and AI session history."
    >
      <SettingsCard title="Stored API keys">
        <SettingsRow label="Saved AI provider credentials" description="Remove saved AI provider credentials from this device.">
          <button type="button" className="stg-btn stg-btn--danger" onClick={() => setClearKeysOpen(true)}>
            {keysCleared ? <Check size={15} /> : 'Clear all saved API keys'}
          </button>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Monitor Control history">
        <SettingsToggle
          label="Do not save Monitor Control session history"
          description="Monitor Control chat/action history is not persistently stored by Launchly unless this is explicitly implemented later."
          checked={settings.doNotSaveMonitorHistory}
          onChange={(v) => update({ doNotSaveMonitorHistory: v })}
        />
      </SettingsCard>

      <SettingsCard title="Clear local data">
        <SettingsRow
          label="Clear local Launchly data"
          description="Removes local preferences, cached UI data and temporary session data from this browser. Does not delete your account or server-side data."
        >
          <button type="button" className="stg-btn stg-btn--danger" onClick={() => setClearLocalOpen(true)}>
            Clear local data
          </button>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard>
        <p className="stg-hint">
          Account deletion is managed under{' '}
          <button type="button" className="stg-link" onClick={onNavigateToAccount}>
            Account
          </button>
          .
        </p>
      </SettingsCard>

      <ConfirmationModal
        open={clearKeysOpen}
        title="Clear all API keys?"
        body="This removes saved OpenAI, Grok and Claude credentials from this device."
        confirmLabel="Clear keys"
        danger
        onConfirm={confirmClearKeys}
        onCancel={() => setClearKeysOpen(false)}
      />

      <ConfirmationModal
        open={clearLocalOpen}
        title="Clear local Launchly data?"
        body="This removes preferences, saved keys and cached data from this browser only. Your account and any server-side data are not affected. The page will reload."
        confirmLabel="Clear local data"
        danger
        onConfirm={confirmClearLocal}
        onCancel={() => setClearLocalOpen(false)}
      />
    </SettingsSection>
  );
}
