import React from 'react';
import { Webhook } from 'lucide-react';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';

export function DeveloperSection() {
  return (
    <SettingsSection title="Developer" subtitle="Manage Launchly API access and developer tools.">
      <SettingsCard title="Launchly API">
        <SettingsRow label="Status">
          <span className="stg-badge">Coming soon</span>
        </SettingsRow>
        <SettingsRow label="Launchly API key">
          <span className="stg-muted">
            API key generation will become available when Launchly API access is enabled.
          </span>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Creator API">
        <SettingsRow
          label="Search TikTok Shop creators"
          description="Search TikTok Shop creators and retrieve creator analytics through Launchly."
        >
          <span className="stg-badge is-warn">In development</span>
        </SettingsRow>
        <SettingsRow label="Endpoint">
          <code className="stg-code">GET /api/launchly/creators/search</code>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="API documentation">
        <SettingsRow label="Documentation">
          <span className="stg-muted">Documentation coming soon</span>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow label={<span className="stg-payment-row"><Webhook size={15} /> Webhooks</span>}>
          <span className="stg-badge">Coming soon</span>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
