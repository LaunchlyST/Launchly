import React, { useState } from 'react';
import { AlertTriangle, CreditCard, ExternalLink } from 'lucide-react';
import { useSubscription } from '../../../useSubscription';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsRow, SettingsDivider } from '../components/SettingsRow';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PLANS } from '../../paywall/plans';

const PLAN = PLANS.find((p) => p.id === 'model-access')!;

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  cancelled: 'Cancelled',
  past_due: 'Past due',
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export function BillingSection() {
  const { subscription, loading, checkoutLoading, error, manageSubscription } = useSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);

  const status = subscription?.subscription_status ?? 'inactive';
  const periodEnd = formatDate(subscription?.subscription_current_period_end ?? null);

  const openPortalToCancel = () => {
    setCancelOpen(false);
    manageSubscription();
  };

  return (
    <SettingsSection
      title="Subscription & Billing"
      subtitle="Manage your Launchly plan, payment method and cancellation."
    >
      <SettingsCard title="Current plan">
        {loading ? (
          <p className="stg-muted">Loading your subscription…</p>
        ) : (
          <>
            <SettingsRow label="Plan">
              <span className="stg-value">{PLAN.name}</span>
            </SettingsRow>
            <SettingsRow label="Price">
              <span className="stg-value">
                {PLAN.price} {PLAN.period ?? ''}
              </span>
            </SettingsRow>
            <SettingsRow label="Status">
              <span className={`stg-badge ${status === 'active' ? 'is-ok' : status === 'past_due' ? 'is-warn' : ''}`}>
                {STATUS_LABEL[status] ?? status}
              </span>
            </SettingsRow>
            <SettingsRow label="Next billing date">
              <span className="stg-value">{periodEnd ?? 'Not available'}</span>
            </SettingsRow>

            {error && (
              <p className="stg-inline-error" style={{ marginTop: 10 }}>
                <AlertTriangle size={13} /> {error}
              </p>
            )}
          </>
        )}
      </SettingsCard>

      <SettingsCard title="Payment method">
        <SettingsRow label={<span className="stg-payment-row"><CreditCard size={15} /> Managed securely through Stripe</span>}>
          <button
            type="button"
            className="stg-btn stg-btn--ghost"
            onClick={manageSubscription}
            disabled={checkoutLoading || status !== 'active'}
          >
            {checkoutLoading ? 'Opening…' : 'Manage payment method'}
            <ExternalLink size={13} />
          </button>
        </SettingsRow>
        <p className="stg-hint">
          Launchly does not store your card. Stripe's customer portal handles viewing, updating and
          removing payment methods.
        </p>
      </SettingsCard>

      <SettingsCard title="Cancel subscription">
        <SettingsRow
          label="End your subscription"
          description="You keep access until your current billing period ends."
        >
          <button
            type="button"
            className="stg-btn stg-btn--danger"
            onClick={() => setCancelOpen(true)}
            disabled={status !== 'active'}
          >
            Cancel subscription
          </button>
        </SettingsRow>
        <SettingsDivider />
        <p className="stg-hint">
          Launchly's Stripe integration does not yet track a scheduled cancellation date separately
          from an active subscription — Stripe's own customer portal (opened below) is the real place
          this happens today, and it applies cancel-at-period-end so you are never cut off mid-period.
        </p>
      </SettingsCard>

      <ConfirmationModal
        open={cancelOpen}
        title="Cancel Launchly subscription?"
        body="You will keep access to Launchly until the end of your current billing period. After your subscription ends, paid tools will be locked and you will return to the Launchly paywall."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        danger
        onConfirm={openPortalToCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </SettingsSection>
  );
}
