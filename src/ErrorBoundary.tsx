import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render crash anywhere below this point unmounts the
 * whole tree, which is what turned a single hook-order bug into a blank page.
 * Catching it here keeps something on screen and gives the user a way out.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app app--auth">
        <main className="app__main">
          <div className="auth-loading" style={{ flexDirection: 'column', gap: 16 }}>
            <p style={{ opacity: 0.72, textAlign: 'center', maxWidth: 420 }}>
              Something went wrong loading Launchly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                height: 44,
                padding: '0 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </main>
      </div>
    );
  }
}
