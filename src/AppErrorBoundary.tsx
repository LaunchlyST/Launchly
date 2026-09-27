import React from 'react';

/**
 * Last line of defence: a render crash shows a short message with Reload
 * instead of a blank white page, and the error is logged for debugging.
 */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Launchly] render error', error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#f6f8fb', color: '#0b1220' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#667085', margin: '0 0 18px' }}>This page hit an error. Reloading usually fixes it.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ height: 38, padding: '0 18px', border: 0, borderRadius: 10, background: '#0b1220', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
          <pre style={{ marginTop: 18, fontSize: 11, color: '#98a2b3', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
        </div>
      </div>
    );
  }
}
