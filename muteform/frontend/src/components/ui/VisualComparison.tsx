'use client'
import { C, mono, syne } from './tokens'

/* ── Color Preview ── */
function ColorPreview({ color, label }: { color: string; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 6, backgroundColor: color,
        border: `1px solid ${C.border2}`, flexShrink: 0,
      }} />
      {label && (
        <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{label}</span>
      )}
    </div>
  )
}

/* ── Spacing Preview ── */
function SpacingPreview({ value, label }: { value: number; label?: string }) {
  const barWidth = Math.min(Math.max(value, 4), 120)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: barWidth, height: 12, borderRadius: 2, backgroundColor: C.blue,
        opacity: 0.6, flexShrink: 0,
      }} />
      <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>
        {label || `${value}px`}
      </span>
    </div>
  )
}

/* ── Typography Preview ── */
const fontSizeMap: Record<string, number> = {
  xs: 10, sm: 12, base: 14, md: 14, lg: 16, xl: 18, '2xl': 22, '3xl': 26, '4xl': 30,
}

function TypographyPreview({ value, label }: { value: string; label?: string }) {
  const size = fontSizeMap[value] || parseInt(value, 10) || 14
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontFamily: syne, fontSize: size, color: C.text, fontWeight: 600 }}>Aa</span>
      {label && (
        <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{label}</span>
      )}
    </div>
  )
}

/* ── Component Preview ── */
function ComponentPreview({ variant, approved }: { variant: string; approved?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20,
      border: `1px solid ${approved ? C.greenBorder : C.border2}`,
      background: approved ? C.greenDim : C.surface2,
    }}>
      <span style={{ fontFamily: mono, fontSize: 11, color: approved ? C.green : C.muted }}>
        {variant}
      </span>
    </div>
  )
}

/* ── Grid Preview ── */
function GridPreview({ columns, label }: { columns: number; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: Math.min(columns, 12) }).map((_, i) => (
          <div key={i} style={{
            width: 6, height: 20, borderRadius: 1,
            backgroundColor: C.blue, opacity: 0.4,
          }} />
        ))}
      </div>
      {label && (
        <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{label}</span>
      )}
    </div>
  )
}

/* ── Confidence Badge ── */
export function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'manual' | string }) {
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    high: { label: 'AUTO-FIX', color: C.green, bg: C.greenDim, border: C.greenBorder },
    medium: { label: 'REVIEW', color: C.amber, bg: C.amberDim, border: '#332200' },
    manual: { label: 'MANUAL', color: C.muted, bg: C.surface2, border: C.border2 },
  }
  const c = config[level] || config.manual
  return (
    <span style={{
      fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px',
      borderRadius: 3, color: c.color, background: c.bg, border: `1px solid ${c.border}`,
    }}>
      {c.label}
    </span>
  )
}

/* ── Helpers to pick the right preview ── */
function getPreviewType(violation: any): string {
  const t = violation.type || ''
  if (t.includes('color')) return 'color'
  if (t.includes('spacing')) return 'spacing'
  if (t.includes('typography')) return 'typography'
  if (t.includes('component')) return 'component'
  if (t.includes('layout')) return 'grid'
  return 'color'
}

function renderPreview(type: string, value: any, label?: string) {
  switch (type) {
    case 'color':
      return <ColorPreview color={String(value || '#888')} label={label} />
    case 'spacing':
      return <SpacingPreview value={typeof value === 'number' ? value : parseInt(value, 10) || 8} label={label} />
    case 'typography':
      return <TypographyPreview value={String(value || 'base')} label={label} />
    case 'component':
      return <ComponentPreview variant={String(value || 'default')} approved={false} />
    case 'grid':
      return <GridPreview columns={typeof value === 'number' ? value : parseInt(value, 10) || 3} label={label} />
    default:
      return <ColorPreview color={String(value || '#888')} label={label} />
  }
}

/* ── Main VisualComparison ── */
export function VisualComparison({ violation }: { violation: any }) {
  const previewType = getPreviewType(violation)
  const current = violation.currentValue ?? violation.actual
  const suggested = violation.suggestedValue ?? violation.expected
  const currentLabel = typeof current === 'string' ? current : undefined
  const suggestedLabel = typeof suggested === 'string' ? suggested : undefined

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16,
      alignItems: 'center', padding: '12px 0',
    }}>
      {/* Current */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{
          fontFamily: mono, fontSize: 9, letterSpacing: '0.1em',
          color: C.dim, textTransform: 'uppercase' as const,
        }}>
          CURRENT
        </span>
        {renderPreview(previewType, current, currentLabel)}
      </div>

      {/* Arrow */}
      <div style={{ color: C.dim, fontSize: 14 }}>{'\u2192'}</div>

      {/* Suggested */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{
          fontFamily: mono, fontSize: 9, letterSpacing: '0.1em',
          color: C.dim, textTransform: 'uppercase' as const,
        }}>
          SUGGESTED
        </span>
        {renderPreview(previewType, suggested, suggestedLabel)}
      </div>
    </div>
  )
}
