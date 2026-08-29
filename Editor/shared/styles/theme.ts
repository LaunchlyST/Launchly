export const theme = {
  colors: {
    bgPrimary: '#0a0d12',
    bgSecondary: '#0f131a',
    bgTertiary: '#151a22',
    surfaceBase: 'rgba(15, 19, 26, 0.72)',
    surfaceElevated: 'rgba(22, 28, 38, 0.8)',
    surfaceHover: 'rgba(30, 38, 50, 0.6)',
    surfaceActive: 'rgba(142, 223, 240, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderDefault: 'rgba(255, 255, 255, 0.12)',
    borderAccent: 'rgba(142, 223, 240, 0.3)',
    borderFocus: 'rgba(142, 223, 240, 0.6)',
    textPrimary: '#f0f2f5',
    textSecondary: '#a0a8b4',
    textMuted: '#6b7380',
    textInverse: '#0a0d12',
    accentCyan: '#8edff0',
    accentMint: '#9de7c6',
    accentAmber: '#e7c478',
    accentRose: '#e59aa7',
    accentViolet: '#c4b5fd',
    success: '#9de7c6',
    warning: '#e7c478',
    error: '#e59aa7',
    focusRing: 'rgba(142, 223, 240, 0.4)',
    overlay: 'rgba(5, 8, 12, 0.8)',
    scrollbarThumb: 'rgba(142, 223, 240, 0.3)',
    scrollbarTrack: 'rgba(255, 255, 255, 0.03)',
  },
  spacing: {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  radius: {
    xs: '6px',
    sm: '10px',
    md: '14px',
    lg: '18px',
    xl: '24px',
    full: '9999px',
  },
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.15)',
    sm: '0 4px 8px rgba(0, 0, 0, 0.2)',
    md: '0 8px 24px rgba(0, 0, 0, 0.25)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.3)',
    xl: '0 24px 64px rgba(0, 0, 0, 0.35)',
    inner: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    glow: '0 0 24px rgba(142, 223, 240, 0.15)',
    glowStrong: '0 0 48px rgba(142, 223, 240, 0.25)',
  },
  typography: {
    fontSans: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
    sizes: {
      xs: '11px',
      sm: '12px',
      base: '13px',
      md: '14px',
      lg: '16px',
      xl: '18px',
      '2xl': '22px',
      '3xl': '28px',
      '4xl': '36px',
    },
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      heavy: 800,
      black: 900,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7,
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.02em',
    },
  },
  transitions: {
    fast: '120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    normal: '180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    slow: '280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  zIndex: {
    base: 0,
    dropdown: 50,
    modal: 100,
    popover: 150,
    tooltip: 200,
    toast: 300,
    overlay: 400,
  },
  breakpoints: {
    mobile: '640px',
    tablet: '1024px',
    desktop: '1440px',
    wide: '1920px',
  },
  timeline: {
    trackHeight: '72px',
    trackHeightCompact: '56px',
    rulerHeight: '36px',
    minClipWidth: '48px',
    snapThreshold: 8,
    magneticThreshold: 16,
  },
  glassmorphism: {
    light: `
      background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 50%),
                  linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 
        0 1px 0 rgba(255,255,255,0.05) inset,
        0 8px 32px rgba(0,0,0,0.2),
        0 2px 8px rgba(0,0,0,0.15);
    `,
    medium: `
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 40%),
                  linear-gradient(180deg, rgba(22,28,38,0.9) 0%, rgba(15,19,26,0.7) 100%);
      backdrop-filter: blur(24px) saturate(200%);
      -webkit-backdrop-filter: blur(24px) saturate(200%);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 
        0 1px 0 rgba(255,255,255,0.06) inset,
        0 12px 40px rgba(0,0,0,0.25),
        0 4px 16px rgba(0,0,0,0.2);
    `,
    heavy: `
      background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 35%),
                  linear-gradient(180deg, rgba(22,28,38,0.95) 0%, rgba(10,13,18,0.85) 100%);
      backdrop-filter: blur(32px) saturate(220%);
      -webkit-backdrop-filter: blur(32px) saturate(220%);
      border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 
        0 1px 0 rgba(255,255,255,0.08) inset,
        0 20px 60px rgba(0,0,0,0.3),
        0 8px 24px rgba(0,0,0,0.25),
        0 0 0 1px rgba(142,223,240,0.05) inset;
    `,
    panel: `
      background: linear-gradient(180deg, rgba(22, 28, 38, 0.88) 0%, rgba(15, 19, 26, 0.72) 100%);
      backdrop-filter: blur(16px) saturate(160%);
      -webkit-backdrop-filter: blur(16px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 
        0 1px 0 rgba(255, 255, 255, 0.05) inset,
        0 8px 24px rgba(0, 0, 0, 0.18);
    `,
    toolbar: `
      background: linear-gradient(180deg, rgba(18, 24, 34, 0.92) 0%, rgba(10, 13, 18, 0.84) 100%);
      backdrop-filter: blur(12px) saturate(140%);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    `,
  },
  easing: {
    easeOut: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    snappy: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
} as const;

export type Theme = typeof theme;

export const glassmorphismStyles = {
  layout: {
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    background: theme.colors.bgPrimary,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textPrimary,
  },
  background: {
    position: 'fixed',
    inset: 0,
    zIndex: -1,
    pointerEvents: 'none',
    background: `
      radial-gradient(ellipse at 20% 0%, rgba(142, 223, 240, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 100%, rgba(157, 231, 198, 0.06) 0%, transparent 50%),
      linear-gradient(135deg, #0a0d12 0%, #0f131a 50%, #060910 100%)
    `,
  },
  ambientGlow: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    filter: 'blur(120px)',
    opacity: 0.12,
    animation: 'float 20s ease-in-out infinite',
    top: '-200px',
    right: '-200px',
    background: 'radial-gradient(circle, rgba(142, 223, 240, 0.6) 0%, transparent 70%)',
  },
  subtleGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
    `,
    backgroundSize: '64px 64px',
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: theme.glassmorphism.panel,
    borderRight: `1px solid ${theme.colors.borderSubtle}`,
    transition: 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing[4],
    paddingBottom: '80px',
  },
  sidebarToggle: {
    position: 'absolute',
    bottom: theme.spacing[4],
    left: '50%',
    transform: 'translateX(-50%)',
    width: '32px',
    height: '32px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.borderSubtle}`,
    background: theme.colors.surfaceElevated,
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
    zIndex: 10,
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: theme.colors.surfaceBase,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  centerPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  mobileOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease',
  },
  mobileTrigger: {
    position: 'fixed',
    bottom: theme.spacing[6],
    left: theme.spacing[4],
    zIndex: 110,
    width: '48px',
    height: '48px',
    borderRadius: theme.radius.xl,
    border: `1px solid ${theme.colors.borderSubtle}`,
    background: theme.colors.surfaceElevated,
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: theme.shadows.lg,
    transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  button: {
    base: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[2],
      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
      borderRadius: theme.radius.md,
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.semibold,
      fontFamily: theme.typography.fontSans,
      letterSpacing: theme.typography.letterSpacing.normal,
      lineHeight: theme.typography.lineHeights.normal,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
      outline: 'none',
      userSelect: 'none',
      '-webkit-tap-highlight-color': 'transparent',
    },
    primary: {
      background: `linear-gradient(135deg, ${theme.colors.accentCyan} 0%, ${theme.colors.accentMint} 100%)`,
      color: theme.colors.textInverse,
      boxShadow: `0 4px 16px rgba(142, 223, 240, 0.25)`,
    },
    secondary: {
      background: theme.colors.surfaceElevated,
      color: theme.colors.textPrimary,
      border: `1px solid ${theme.colors.borderSubtle}`,
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.textSecondary,
    },
    danger: {
      background: `linear-gradient(135deg, ${theme.colors.error} 0%, #f06d7f 100%)`,
      color: theme.colors.textInverse,
      boxShadow: `0 4px 16px rgba(229, 154, 167, 0.25)`,
    },
    icon: {
      width: '40px',
      height: '40px',
      padding: 0,
      borderRadius: theme.radius.md,
    },
    sm: {
      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
      fontSize: theme.typography.sizes.xs,
      height: '32px',
    },
    lg: {
      padding: `${theme.spacing[3]} ${theme.spacing[5]}`,
      fontSize: theme.typography.sizes.md,
      height: '48px',
    },
  },
  input: {
    base: {
      width: '100%',
      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.borderSubtle}`,
      background: theme.colors.surfaceBase,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.sm,
      fontFamily: theme.typography.fontSans,
      lineHeight: theme.typography.lineHeights.normal,
      outline: 'none',
      transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
    },
    focus: {
      borderColor: theme.colors.borderFocus,
      boxShadow: `0 0 0 3px ${theme.colors.focusRing}`,
    },
    error: {
      borderColor: theme.colors.error,
      boxShadow: `0 0 0 3px rgba(229, 154, 167, 0.2)`,
    },
  },
  select: {
    base: {
      ...theme.typography,
      width: '100%',
      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
      paddingRight: theme.spacing[8],
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.borderSubtle}`,
      background: `${theme.colors.surfaceBase} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a0a8b4' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center`,
      backgroundSize: '16px',
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.sm,
      fontFamily: theme.typography.fontSans,
      appearance: 'none',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
    },
  },
  slider: {
    track: {
      height: '4px',
      borderRadius: '2px',
      background: theme.colors.borderSubtle,
      appearance: 'none',
    },
    thumb: {
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: theme.colors.accentCyan,
      border: 'none',
      boxShadow: '0 2px 8px rgba(142, 223, 240, 0.4)',
      cursor: 'pointer',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    },
    thumbHover: {
      transform: 'scale(1.2)',
      boxShadow: '0 4px 16px rgba(142, 223, 240, 0.6)',
    },
  },
  scrollbar: {
    width: '8px',
    height: '8px',
    track: {
      background: theme.colors.scrollbarTrack,
      borderRadius: '4px',
    },
    thumb: {
      background: theme.colors.scrollbarThumb,
      borderRadius: '4px',
      transition: 'background 0.2s ease',
    },
    thumbHover: {
      background: theme.colors.accentCyan,
    },
  },
  tooltip: {
    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
    borderRadius: theme.radius.sm,
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.borderSubtle}`,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    boxShadow: theme.shadows.md,
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  badge: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: `${theme.spacing[0]} ${theme.spacing[2]}`,
      borderRadius: theme.radius.full,
      fontSize: theme.typography.sizes.xs,
      fontWeight: theme.typography.weights.semibold,
      lineHeight: '1.4',
    },
    success: {
      background: 'rgba(157, 231, 198, 0.12)',
      color: theme.colors.accentMint,
      border: `1px solid rgba(157, 231, 198, 0.2)`,
    },
    warning: {
      background: 'rgba(231, 196, 120, 0.12)',
      color: theme.colors.accentAmber,
      border: `1px solid rgba(231, 196, 120, 0.2)`,
    },
    error: {
      background: 'rgba(229, 154, 167, 0.12)',
      color: theme.colors.error,
      border: `1px solid rgba(229, 154, 167, 0.2)`,
    },
    info: {
      background: 'rgba(142, 223, 240, 0.12)',
      color: theme.colors.accentCyan,
      border: `1px solid rgba(142, 223, 240, 0.2)`,
    },
    new: {
      background: 'rgba(196, 181, 253, 0.12)',
      color: theme.colors.accentViolet,
      border: `1px solid rgba(196, 181, 253, 0.2)`,
    },
  },
  card: {
    base: {
      background: theme.colors.surfaceElevated,
      border: `1px solid ${theme.colors.borderSubtle}`,
      borderRadius: theme.radius.lg,
      padding: theme.spacing[4],
      transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
    },
    hover: {
      borderColor: theme.colors.borderAccent,
      background: theme.colors.surfaceHover,
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows.lg,
    },
  },
  panel: {
    base: {
      background: theme.glassmorphism.panel,
      border: `1px solid ${theme.colors.borderSubtle}`,
      borderRadius: theme.radius.lg,
    },
    header: {
      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
      borderBottom: `1px solid ${theme.colors.borderSubtle}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    content: {
      padding: theme.spacing[4],
    },
    footer: {
      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
      borderTop: `1px solid ${theme.colors.borderSubtle}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing[2],
    },
  },
  divider: {
    horizontal: {
      height: '1px',
      background: `linear-gradient(90deg, transparent, ${theme.colors.borderSubtle}, transparent)`,
      border: 'none',
      margin: `${theme.spacing[3]} 0`,
    },
    vertical: {
      width: '1px',
      background: `linear-gradient(180deg, transparent, ${theme.colors.borderSubtle}, transparent)`,
      border: 'none',
      margin: `0 ${theme.spacing[3]}`,
    },
  },
  focusRing: {
    outline: 'none',
    ring: '2px',
    ringColor: theme.colors.borderFocus,
    ringOffset: '2px',
    ringOffsetColor: theme.colors.bgPrimary,
  },
} as const;

export const cssVariables = `
  :root {
    --bg-primary: ${theme.colors.bgPrimary};
    --bg-secondary: ${theme.colors.bgSecondary};
    --bg-tertiary: ${theme.colors.bgTertiary};
    --surface-base: ${theme.colors.surfaceBase};
    --surface-elevated: ${theme.colors.surfaceElevated};
    --surface-hover: ${theme.colors.surfaceHover};
    --surface-active: ${theme.colors.surfaceActive};
    --border-subtle: ${theme.colors.borderSubtle};
    --border-default: ${theme.colors.borderDefault};
    --border-accent: ${theme.colors.borderAccent};
    --border-focus: ${theme.colors.borderFocus};
    --text-primary: ${theme.colors.textPrimary};
    --text-secondary: ${theme.colors.textSecondary};
    --text-muted: ${theme.colors.textMuted};
    --text-inverse: ${theme.colors.textInverse};
    --accent-cyan: ${theme.colors.accentCyan};
    --accent-mint: ${theme.colors.accentMint};
    --accent-amber: ${theme.colors.accentAmber};
    --accent-rose: ${theme.colors.accentRose};
    --accent-violet: ${theme.colors.accentViolet};
    --success: ${theme.colors.success};
    --warning: ${theme.colors.warning};
    --error: ${theme.colors.error};
    --focus-ring: ${theme.colors.focusRing};
    --overlay: ${theme.colors.overlay};
    --font-sans: ${theme.typography.fontSans};
    --font-mono: ${theme.typography.fontMono};
    --shadow-xs: ${theme.shadows.xs};
    --shadow-sm: ${theme.shadows.sm};
    --shadow-md: ${theme.shadows.md};
    --shadow-lg: ${theme.shadows.lg};
    --shadow-xl: ${theme.shadows.xl};
    --shadow-inner: ${theme.shadows.inner};
    --shadow-glow: ${theme.shadows.glow};
    --shadow-glow-strong: ${theme.shadows.glowStrong};
    --radius-xs: ${theme.radius.xs};
    --radius-sm: ${theme.radius.sm};
    --radius-md: ${theme.radius.md};
    --radius-lg: ${theme.radius.lg};
    --radius-xl: ${theme.radius.xl};
    --radius-full: ${theme.radius.full};
    --transition-fast: ${theme.transitions.fast};
    --transition-normal: ${theme.transitions.normal};
    --transition-slow: ${theme.transitions.slow};
    --transition-spring: ${theme.transitions.spring};
    --ease-out: ${theme.easing.easeOut};
    --ease-in-out: ${theme.easing.easeInOut};
    --ease-spring: ${theme.easing.spring};
    --ease-snappy: ${theme.easing.snappy};
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bg-primary: #f8f9fb;
      --bg-secondary: #f0f2f6;
      --bg-tertiary: #e8ebf0;
      --surface-base: rgba(255, 255, 255, 0.88);
      --surface-elevated: rgba(255, 255, 255, 0.96);
      --surface-hover: rgba(240, 242, 246, 0.8);
      --border-subtle: rgba(0, 0, 0, 0.06);
      --border-default: rgba(0, 0, 0, 0.1);
      --border-accent: rgba(14, 116, 144, 0.3);
      --text-primary: #0f1419;
      --text-secondary: #4a535e;
      --text-muted: #7a838e;
      --text-inverse: #f8f9fb;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export function generateCSSVariables(prefix = ''): string {
  const vars: string[] = [];
  const flatten = (obj: Record<string, unknown>, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}-${key}` : key;
      if (typeof value === 'object' && value !== null) {
        flatten(value, newPath);
      } else {
        vars.push(`  --${prefix}${newPath}: ${value};`);
      }
    }
  };
  flatten(theme.colors);
  flatten(theme.spacing);
  flatten(theme.radius);
  flatten(theme.shadows);
  flatten(theme.typography.sizes);
  flatten(theme.transitions);
  return vars.join('\n');
}