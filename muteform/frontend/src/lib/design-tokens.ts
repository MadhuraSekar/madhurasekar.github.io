// Muteform Design Tokens — single source of truth for all visual styling
// Import this into every page and component.

export const tokens = {
  // Colors
  bg: '#080909',
  surface: '#0c0d0f',
  surface2: '#111316',
  border: '#1a1d21',
  border2: '#242830',

  text: '#f0f1f3',
  textMuted: '#6b7280',
  textDim: '#374151',

  blue: '#0055FF',
  blueDim: 'rgba(0,85,255,0.08)',
  blueBorder: 'rgba(0,85,255,0.2)',

  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.08)',
  greenBorder: 'rgba(34,197,94,0.2)',

  amber: '#f59e0b',
  amberDim: 'rgba(245,158,11,0.08)',

  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.08)',

  // Typography
  fontDisplay: "'Syne', sans-serif",
  fontMono: "'DM Mono', monospace",

  // Spacing
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
} as const
