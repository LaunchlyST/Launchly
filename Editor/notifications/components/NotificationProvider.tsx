import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { EditorNotification, NotificationInput } from '../types/notification.types';
import { EDITOR_LIMITS } from '../../editor-core/config/editorLimits';

/** Length of the exit animation — kept in step with NotificationToast's CSS. */
const EXIT_MS = 260;

interface NotificationContextValue {
  notifications: EditorNotification[];
  notify: (input: NotificationInput) => string;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

let seq = 0;
const nextId = () => `n${++seq}-${Date.now().toString(36)}`;

/**
 * App-wide notification system. Any editor subsystem can call `useNotify()`
 * and raise a toast without owning any notification JSX itself — the
 * provider owns dedup, timers, and lifecycle.
 *
 * Dedup rule: while a notification with the same (type, title) is already
 * showing, calling notify() again just refreshes its auto-dismiss timer
 * instead of stacking a duplicate — this is what stops a held drag against a
 * boundary from spamming the toast list every frame.
 *
 * `listRef` mirrors state synchronously so notify() can make its dedup
 * decision immediately, rather than reasoning about it inside a setState
 * updater (which StrictMode may invoke twice in development).
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<EditorNotification[]>([]);
  const listRef = useRef<EditorNotification[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const exitTimers = useRef<Map<string, number>>(new Map());

  const setList = useCallback((next: EditorNotification[]) => {
    listRef.current = next;
    setNotifications(next);
  }, []);

  const removeNow = useCallback(
    (id: string) => {
      const t = timers.current.get(id);
      if (t) window.clearTimeout(t);
      timers.current.delete(id);
      const et = exitTimers.current.get(id);
      if (et) window.clearTimeout(et);
      exitTimers.current.delete(id);
      setList(listRef.current.filter((n) => n.id !== id));
    },
    [setList]
  );

  const dismiss = useCallback(
    (id: string) => {
      const t = timers.current.get(id);
      if (t) window.clearTimeout(t);
      timers.current.delete(id);
      setList(listRef.current.map((n) => (n.id === id ? { ...n, leaving: true } : n)));
      const exitTimer = window.setTimeout(() => removeNow(id), EXIT_MS);
      exitTimers.current.set(id, exitTimer);
    },
    [setList, removeNow]
  );

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      const existing = timers.current.get(id);
      if (existing) window.clearTimeout(existing);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );

  const notify = useCallback(
    (input: NotificationInput) => {
      const duration = input.duration ?? EDITOR_LIMITS.errorToastDuration;
      const dupe = listRef.current.find((n) => !n.leaving && n.type === input.type && n.title === input.title);
      const id = dupe ? dupe.id : nextId();
      if (!dupe) setList([...listRef.current, { ...input, id }]);
      scheduleDismiss(id, duration);
      return id;
    },
    [setList, scheduleDismiss]
  );

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}

/** Raise editor-wide toasts: `notify({ type: 'error', title, message })`. */
export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotify must be used within a NotificationProvider');
  return ctx.notify;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
