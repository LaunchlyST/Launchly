import React, { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useAuthStore } from '../../../auth-store';
import { SettingsSection, SettingsCard } from '../components/SettingsSection';
import { SettingsRow, SettingsDivider } from '../components/SettingsRow';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { changePassword, deleteAccount, sendPasswordResetEmail, updateDisplayName } from '../accountService';

interface AccountSectionProps {
  onSignOut: () => void;
}

export function AccountSection({ onSignOut }: AccountSectionProps) {
  const user = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState(
    (user?.user_metadata?.display_name as string | undefined) ?? ''
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateDisplayName(displayName.trim());
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1800);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPasswordChange = async () => {
    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await changePassword(newPassword);
      setPasswordMessage('Password updated.');
      setNewPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change your password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!user?.email) return;
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(user.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 4000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setResetBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!user) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount(user.id);
      setDeleteOpen(false);
      onSignOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete your account.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <SettingsSection title="Account" subtitle="Manage basic user account information.">
      <SettingsCard title="Profile">
        <SettingsRow label="Display name">
          <input
            className="stg-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            aria-label="Display name"
          />
        </SettingsRow>
        <SettingsRow label="Email address" description="Managed by your Launchly sign-in — not editable here.">
          <input className="stg-input" value={user?.email ?? ''} disabled aria-label="Email address" />
        </SettingsRow>
        <div className="stg-card__actions">
          {profileError && <span className="stg-inline-error"><AlertTriangle size={13} /> {profileError}</span>}
          <button type="button" className="stg-btn stg-btn--primary" onClick={saveProfile} disabled={profileSaving}>
            {profileSaved ? <Check size={15} /> : profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Security">
        <SettingsRow label="New password" description="At least 8 characters.">
          <input
            className="stg-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            aria-label="New password"
            autoComplete="new-password"
          />
        </SettingsRow>
        <div className="stg-card__actions">
          {passwordError && <span className="stg-inline-error"><AlertTriangle size={13} /> {passwordError}</span>}
          {passwordMessage && <span className="stg-inline-ok"><Check size={13} /> {passwordMessage}</span>}
          <button
            type="button"
            className="stg-btn stg-btn--ghost"
            onClick={requestPasswordReset}
            disabled={resetBusy || !user?.email}
          >
            {resetSent ? 'Reset email sent' : resetBusy ? 'Sending…' : 'Email me a reset link'}
          </button>
          <button type="button" className="stg-btn stg-btn--primary" onClick={submitPasswordChange} disabled={passwordBusy}>
            {passwordBusy ? 'Updating…' : 'Change password'}
          </button>
        </div>

        <SettingsDivider />

        <SettingsRow label="Session" description="Sign out of Launchly on this device.">
          <button type="button" className="stg-btn stg-btn--ghost" onClick={onSignOut}>
            Sign out
          </button>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Danger zone">
        <SettingsRow
          label="Delete account"
          description="Deleting your account permanently removes your Launchly account and associated account data."
        >
          <button type="button" className="stg-btn stg-btn--danger" onClick={() => setDeleteOpen(true)}>
            Delete account
          </button>
        </SettingsRow>
        {deleteError && (
          <p className="stg-inline-error" style={{ marginTop: 10 }}>
            <AlertTriangle size={13} /> {deleteError}
          </p>
        )}
      </SettingsCard>

      <ConfirmationModal
        open={deleteOpen}
        title="Delete your account?"
        body="This action is permanent and cannot be undone."
        confirmLabel="Delete account"
        danger
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </SettingsSection>
  );
}
