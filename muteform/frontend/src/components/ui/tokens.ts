export const C = {
  bg: '#080909', surface: '#0c0d0f', surface2: '#101214',
  border: '#161819', border2: '#1e2226',
  blue: '#0055FF', blueDim: '#0a1428', blueGlow: 'rgba(0,85,255,0.1)',
  text: '#f0f1f3', muted: '#6b7280', dim: '#374151', dim2: '#252b33',
  green: '#22c55e', greenDim: '#061a0c', greenBorder: '#0d3018',
  amber: '#f59e0b', amberDim: '#1a1000', red: '#ef4444', redDim: '#1a0505',
  purple: '#a855f7',
}

export const syne = "'Syne', sans-serif"
export const mono = "'DM Mono', monospace"

export const VMETA: Record<string, { label: string; short: string; icon: string; color: string }> = {
  color_token_violation: { label: 'Color Token', short: 'Color', icon: '\u25CF', color: '#FF453A' },
  spacing_violation: { label: 'Spacing', short: 'Spacing', icon: '#', color: '#FF9F0A' },
  typography_violation: { label: 'Typography', short: 'Type', icon: 'T', color: '#BF5AF2' },
  component_violation: { label: 'Component', short: 'Component', icon: 'C', color: '#30D158' },
  layout_violation: { label: 'Layout', short: 'Layout', icon: 'L', color: '#0A84FF' },
}

export const SEVC: Record<string, string> = {
  high: '#FF453A', medium: '#FF9F0A', low: '#34C759',
}

export function scoreColor(s: number): string {
  return s >= 80 ? C.green : s >= 55 ? C.amber : C.red
}

export function healthScore(violations: Array<{ severity: string; status?: string }>): number {
  const active = violations.filter(v => v.status !== 'ignored')
  if (!active.length) return 100
  const p = active.reduce((a, v) => a + (v.severity === 'high' ? 12 : v.severity === 'medium' ? 5 : 2), 0)
  return Math.max(0, 100 - p)
}

export function fmtDate(ts: number | string): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtTime(ts: number | string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
