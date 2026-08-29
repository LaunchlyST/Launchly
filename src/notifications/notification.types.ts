export type NotificationType = 'error' | 'warning' | 'success' | 'info';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  message?: string;
  /** ms before auto-dismiss. Defaults to EDITOR_LIMITS.errorToastDuration. */
  duration?: number;
}

export interface EditorNotification extends NotificationInput {
  id: string;
  /** Set briefly before removal so the exit animation can play. */
  leaving?: boolean;
}
