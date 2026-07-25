import React, { useEffect } from 'react';
import { useEditorStore, Toast as ToastType } from '../store/editorStore';

export interface ToastContainerProps {
  toasts: ToastType[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useEditorStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div className={`toast toast-${toast.type}`} role="alert">
      {toast.title && <strong>{toast.title}</strong>}
      <span>{toast.message}</span>
    </div>
  );
}
