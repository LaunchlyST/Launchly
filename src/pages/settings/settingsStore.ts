import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LAUNCHLY_SETTINGS, type LaunchlySettings } from './types';

/**
 * The one place workspace preferences are read from and written to. Nothing
 * outside this file should call localStorage directly for these — that's the
 * scatter the settings spec asked to avoid.
 */
interface SettingsStore {
  settings: LaunchlySettings;
  update: (patch: Partial<LaunchlySettings>) => void;
  updateMonitorPermissions: (patch: Partial<LaunchlySettings['monitorPermissions']>) => void;
  updateNotifications: (patch: Partial<LaunchlySettings['notifications']>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_LAUNCHLY_SETTINGS,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateMonitorPermissions: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            monitorPermissions: { ...s.settings.monitorPermissions, ...patch },
          },
        })),
      updateNotifications: (patch) =>
        set((s) => ({
          settings: { ...s.settings, notifications: { ...s.settings.notifications, ...patch } },
        })),
      reset: () => set({ settings: DEFAULT_LAUNCHLY_SETTINGS }),
    }),
    {
      name: 'launchly-settings-v1',
      /* Merge onto the current defaults so a settings shape added in a later
         release doesn't get lost behind an older persisted blob. */
      merge: (persisted, current) => ({
        ...current,
        settings: { ...current.settings, ...(persisted as SettingsStore)?.settings },
      }),
    }
  )
);
