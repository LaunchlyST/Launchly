import React, { useState } from 'react';
import { SettingsNav } from './SettingsNav';
import type { SettingsSectionId } from './types';
import { AccountSection } from './sections/AccountSection';
import { BillingSection } from './sections/BillingSection';
import { ApiKeysSection } from './sections/ApiKeysSection';
import { AiPreferencesSection } from './sections/AiPreferencesSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { MonitorControlSection } from './sections/MonitorControlSection';
import { PrivacySection } from './sections/PrivacySection';
import { NotificationsSection } from './sections/NotificationsSection';
import { DeveloperSection } from './sections/DeveloperSection';
import './settings.css';

interface SettingsPageProps {
  onSignOut: () => void;
}

export function SettingsPage({ onSignOut }: SettingsPageProps) {
  const [active, setActive] = useState<SettingsSectionId>('account');

  return (
    <div className="stg-page">
      <header className="stg-page-header">
        <span className="stg-eyebrow">Workspace settings</span>
        <h1 className="stg-page-title">Settings</h1>
        <p className="stg-page-subtitle">
          Manage your Launchly account, AI providers and workspace preferences.
        </p>
      </header>

      <div className="stg-layout">
        <SettingsNav active={active} onSelect={setActive} />
        <div className="stg-content">
          {active === 'account' && <AccountSection onSignOut={onSignOut} />}
          {active === 'billing' && <BillingSection />}
          {active === 'api-keys' && <ApiKeysSection />}
          {active === 'ai-preferences' && <AiPreferencesSection />}
          {active === 'appearance' && <AppearanceSection />}
          {active === 'monitor-control' && <MonitorControlSection />}
          {active === 'privacy' && <PrivacySection onNavigateToAccount={() => setActive('account')} />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'developer' && <DeveloperSection />}
        </div>
      </div>
    </div>
  );
}
