import React from 'react';
import { useSettingsStore } from '../settingsStore';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsDivider } from '../components/SettingsRow';
import { SettingsToggle } from '../components/SettingsToggle';

export function NotificationsSection() {
  const { settings, updateNotifications } = useSettingsStore();
  const n = settings.notifications;

  return (
    <SettingsSection title="Notifications" subtitle="Choose which Launchly events should notify you.">
      <SettingsCard>
        <SettingsToggle
          label="AI task completed"
          checked={n.aiTaskCompleted}
          onChange={(v) => updateNotifications({ aiTaskCompleted: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Monitor Control disconnected"
          checked={n.monitorDisconnected}
          onChange={(v) => updateNotifications({ monitorDisconnected: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Monitor Control task completed"
          checked={n.monitorTaskCompleted}
          onChange={(v) => updateNotifications({ monitorTaskCompleted: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="API connection problem"
          checked={n.apiConnectionProblem}
          onChange={(v) => updateNotifications({ apiConnectionProblem: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Subscription or payment issue"
          checked={n.paymentIssue}
          onChange={(v) => updateNotifications({ paymentIssue: v })}
        />
        <SettingsDivider />
        <SettingsToggle
          label="Product/job generation completed"
          checked={n.generationCompleted}
          onChange={(v) => updateNotifications({ generationCompleted: v })}
        />
      </SettingsCard>
      <p className="stg-hint">
        These control in-app notifications only. Browser and email notification delivery can be
        added later.
      </p>
    </SettingsSection>
  );
}
