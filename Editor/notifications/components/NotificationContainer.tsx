import React from 'react';
import { useNotifications } from '../components/NotificationProvider';
import { NotificationToast } from './NotificationToast';

/**
 * Fixed top-right stack. Mount this once near the app root — every other
 * system raises toasts through `useNotify()` and never renders its own
 * notification JSX.
 */
export function NotificationContainer() {
  const { notifications, dismiss } = useNotifications();
  if (notifications.length === 0) return null;
  return (
    <div className="editor-toast-stack" aria-live="polite" aria-atomic="false">
      {notifications.map((n) => (
        <NotificationToast key={n.id} notification={n} onDismiss={dismiss} />
      ))}
    </div>
  );
}
