import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { glassmorphismStyles, theme } from '../styles/theme';

export interface EditorLayoutProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const EditorLayout = forwardRef<HTMLDivElement, EditorLayoutProps>(
  ({ children, className = '', style = {} }, ref) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState<{
      left: boolean;
      right: boolean;
    }>({ left: false, right: false });
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    const layoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const updateSize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }, []);

    const isMobile = windowSize.width < 1024;
    const isTablet = windowSize.width >= 1024 && windowSize.width < 1440;

    return (
      <div
        ref={ref}
        className={`editor-layout ${className}`}
        style={{
          ...glassmorphismStyles.layout,
          ...style,
          '--sidebar-left-width': sidebarCollapsed.left ? '56px' : (isMobile ? '0px' : isTablet ? '280px' : '320px'),
          '--sidebar-right-width': sidebarCollapsed.right ? '56px' : (isMobile ? '0px' : isTablet ? '300px' : '360px'),
          '--toolbar-height': '56px',
          '--timeline-controls-height': '72px',
        } as React.CSSProperties}
      >
        <div
          className="editor-bg"
          style={glassmorphismStyles.background}
          aria-hidden="true"
        >
          <div className="editor-glow" style={glassmorphismStyles.ambientGlow} />
          <div className="editor-grid" style={glassmorphismStyles.subtleGrid} />
        </div>

        <aside
          className="editor-sidebar editor-sidebar-left"
          style={{
            ...glassmorphismStyles.sidebar,
            width: 'var(--sidebar-left-width)',
            transform: sidebarCollapsed.left && !isMobile ? 'translateX(-100%)' : 'none',
            transition: 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          data-collapsed={sidebarCollapsed.left}
        >
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(p => ({ ...p, left: !p.left }))}
            aria-label={sidebarCollapsed.left ? 'Expand tools panel' : 'Collapse tools panel'}
            style={glassmorphismStyles.sidebarToggle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed.left ? (
                <path d="M9 18l6-6-6-6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>
          </button>
          <div className="sidebar-content" style={glassmorphismStyles.sidebarContent}>
            {children}
          </div>
        </aside>

        <main
          className="editor-main"
          style={{
            ...glassmorphismStyles.main,
            marginLeft: isMobile ? 0 : sidebarCollapsed.left ? '56px' : isTablet ? '280px' : '320px',
            marginRight: isMobile ? 0 : sidebarCollapsed.right ? '56px' : isTablet ? '300px' : '360px',
          }}
        >
          <div className="editor-toolbar-spacer" style={{ height: 'var(--toolbar-height)' }} />
          <div className="editor-content" style={glassmorphismStyles.content}>
            {children}
          </div>
          <div className="editor-timeline-spacer" style={{ height: 'var(--timeline-controls-height)' }} />
        </main>

        <aside
          className="editor-sidebar editor-sidebar-right"
          style={{
            ...glassmorphismStyles.sidebar,
            width: 'var(--sidebar-right-width)',
            right: 0,
            transform: sidebarCollapsed.right && !isMobile ? 'translateX(100%)' : 'none',
            transition: 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          data-collapsed={sidebarCollapsed.right}
        >
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(p => ({ ...p, right: !p.right }))}
            aria-label={sidebarCollapsed.right ? 'Expand properties panel' : 'Collapse properties panel'}
            style={glassmorphismStyles.sidebarToggle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed.right ? (
                <path d="M15 18l-6-6 6-6" />
              ) : (
                <path d="M9 18l6-6-6-6" />
              )}
            </svg>
          </button>
          <div className="sidebar-content" style={glassmorphismStyles.sidebarContent}>
            {children}
          </div>
        </aside>

        {isMobile && (
          <>
            <div
              className="mobile-overlay"
              style={glassmorphismStyles.mobileOverlay}
              onClick={() => setSidebarCollapsed({ left: true, right: true })}
              aria-hidden="true"
            />
            <button
              className="mobile-menu-trigger left"
              onClick={() => setSidebarCollapsed(p => ({ ...p, left: !p.left }))}
              style={glassmorphismStyles.mobileTrigger}
              aria-label="Toggle tools panel"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <button
              className="mobile-menu-trigger right"
              onClick={() => setSidebarCollapsed(p => ({ ...p, right: !p.right }))}
              style={{ ...glassmorphismStyles.mobileTrigger, right: '16px', left: 'auto' }}
              aria-label="Toggle properties panel"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </button>
          </>
        )}

        <style jsx global>{`
          .editor-layout {
            position: relative;
            width: 100%;
            height: 100vh;
            overflow: hidden;
            display: grid;
            grid-template-columns: var(--sidebar-left-width) 1fr var(--sidebar-right-width);
            grid-template-rows: var(--toolbar-height) 1fr var(--timeline-controls-height);
            grid-template-areas:
              "toolbar toolbar toolbar"
              "left main right"
              "timeline timeline timeline";
            background: var(--bg-primary);
            font-family: var(--font-sans);
            color: var(--text-primary);
          }

          .editor-bg {
            position: fixed;
            inset: 0;
            z-index: -1;
            pointer-events: none;
          }

          .editor-glow {
            position: absolute;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            filter: blur(120px);
            opacity: 0.15;
            animation: float 20s ease-in-out infinite;
          }

          .editor-glow:nth-child(1) {
            top: -200px;
            right: -200px;
            background: radial-gradient(circle, var(--accent-cyan) 0%, transparent 70%);
          }

          .editor-glow:nth-child(2) {
            bottom: -200px;
            left: -200px;
            background: radial-gradient(circle, var(--accent-mint) 0%, transparent 70%);
            animation-delay: -10s;
          }

          .editor-grid {
            position: absolute;
            inset: 0;
            background-image: 
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
            background-size: 64px 64px;
            mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
          }

          @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(30px, -20px) scale(1.05); }
            50% { transform: translate(-20px, 30px) scale(0.95); }
            75% { transform: translate(20px, 20px) scale(1.02); }
          }

          .editor-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            z-index: 100;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-right: 1px solid var(--border-subtle);
          }

          .editor-sidebar-right {
            border-right: none;
            border-left: 1px solid var(--border-subtle);
          }

          .sidebar-toggle {
            position: absolute;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            width: 32px;
            height: 32px;
            border-radius: 12px;
            border: 1px solid var(--border-subtle);
            background: var(--surface-elevated);
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
            z-index: 10;
          }

          .sidebar-toggle:hover {
            background: var(--surface-hover);
            border-color: var(--border-accent);
            color: var(--text-primary);
            transform: translateX(-50%) scale(1.05);
          }

          .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            padding-bottom: 80px;
          }

          .editor-main {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: var(--surface-base);
          }

          .editor-content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .editor-toolbar-spacer,
          .editor-timeline-spacer {
            flex-shrink: 0;
          }

          .mobile-overlay {
            position: fixed;
            inset: 0;
            z-index: 90;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
          }

          .mobile-overlay:has(+ .editor-sidebar-left[data-collapsed="false"]) {
            opacity: 1;
            pointer-events: auto;
          }

          .mobile-menu-trigger {
            position: fixed;
            bottom: 24px;
            left: 16px;
            z-index: 110;
            width: 48px;
            height: 48px;
            border-radius: 16px;
            border: 1px solid var(--border-subtle);
            background: var(--surface-elevated);
            color: var(--text-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: var(--shadow-lg);
            transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .mobile-menu-trigger:hover {
            transform: scale(1.05);
            border-color: var(--border-accent);
            background: var(--surface-hover);
          }

          @media (max-width: 1023px) {
            .editor-layout {
              grid-template-columns: 1fr;
              grid-template-areas:
                "toolbar"
                "main"
                "timeline";
            }

            .editor-sidebar {
              position: fixed;
              top: 0;
              bottom: 0;
              z-index: 95;
              transform: translateX(-100%);
            }

            .editor-sidebar[data-collapsed="false"] {
              transform: translateX(0);
            }

            .editor-sidebar-right {
              left: auto;
              right: 0;
              transform: translateX(100%);
            }

            .editor-sidebar-right[data-collapsed="false"] {
              transform: translateX(0);
            }

            .editor-main {
              margin-left: 0 !important;
              margin-right: 0 !important;
            }

            .sidebar-toggle {
              display: none;
            }
          }

          @media (min-width: 1024px) and (max-width: 1439px) {
            .editor-layout {
              grid-template-columns: 280px 1fr 300px;
            }
          }

          @media (min-width: 1440px) {
            .editor-layout {
              grid-template-columns: 320px 1fr 360px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .editor-sidebar,
            .sidebar-toggle,
            .mobile-menu-trigger,
            .editor-glow {
              animation: none !important;
              transition: none !important;
            }
          }
        `}</style>
      </div>
    );
  }
);

EditorLayout.displayName = 'EditorLayout';