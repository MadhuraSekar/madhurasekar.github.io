'use client'
import { C, mono, syne } from './tokens'

/* ── Color Preview ── */
function ColorPreview({ color, label, variant }: { color: string; label?: string; variant: 'current' | 'suggested' }) {
  const borderColor = variant === 'current' ? C.red : C.green
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 6, backgroundColor: color,
        border: `2px solid ${borderColor}`, flexShrink: 0,
        boxShadow: `0 0 8px ${borderColor}22`,
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {label && (
          <span style={{ fontFamily: mono, fontSize: 11, color: variant === 'current' ? C.red : C.green, fontWeight: 600 }}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Spacing Preview ── */
function SpacingPreview({ value, label, variant }: { value: number; label?: string; variant: 'current' | 'suggested' }) {
  const barWidth = Math.min(Math.max(value * 2, 8), 160)
  const barColor = variant === 'current' ? C.red : C.green
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        width: barWidth, height: 16, borderRadius: 3, backgroundColor: barColor,
        opacity: 0.8, flexShrink: 0, transition: 'width 0.3s ease',
      }} />
      <span style={{
        fontFamily: mono, fontSize: 11, color: barColor, fontWeight: 600,
        textDecoration: variant === 'current' ? 'line-through' : 'none',
      }}>
        {label || `${value}px`}{variant === 'suggested' ? ' (token)' : ''}
      </span>
    </div>
  )
}

/* ── Typography Preview ── */
function TypographyPreview({ value, label, variant }: { value: string; label?: string; variant: 'current' | 'suggested' }) {
  const col = variant === 'current' ? C.red : C.green
  const size = variant === 'current' ? 28 : 20
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: syne, fontSize: size, color: col, fontWeight: 700,
        lineHeight: 1.1,
      }}>
        Aa
      </span>
      <span style={{ fontFamily: mono, fontSize: 10, color: col, fontWeight: 600 }}>
        {label || value}
      </span>
    </div>
  )
}

/* ── Component Preview ── */
function ComponentPreview({ variant, isApproved }: { variant: string; isApproved: boolean }) {
  const col = isApproved ? C.green : C.red
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderRadius: 20,
      border: `2px solid ${col}`,
      background: isApproved ? `${C.green}18` : 'transparent',
      boxShadow: `0 0 8px ${col}22`,
    }}>
      <span style={{ fontFamily: mono, fontSize: 12, color: col, fontWeight: 600 }}>
        {variant}
      </span>
    </div>
  )
}

/* ── Grid Preview ── */
function GridPreview({ columns, label, variant }: { columns: number; label?: string; variant: 'current' | 'suggested' }) {
  const col = variant === 'current' ? C.red : C.green
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: Math.min(columns, 12) }).map((_, i) => (
          <div key={i} style={{
            width: 8, height: 24, borderRadius: 2,
            backgroundColor: col, opacity: 0.6,
          }} />
        ))}
      </div>
      <span style={{ fontFamily: mono, fontSize: 10, color: col, fontWeight: 600 }}>
        {label || `${columns} cols`}
      </span>
    </div>
  )
}

/* ── Confidence Badge ── */
export function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'manual' | string }) {
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    high: { label: 'HIGH', color: C.green, bg: C.greenDim, border: C.greenBorder },
    medium: { label: 'MEDIUM', color: C.amber, bg: C.amberDim, border: '#332200' },
    manual: { label: 'MANUAL REVIEW', color: C.muted, bg: C.surface2, border: C.border2 },
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

/* ── Severity Badge ── */
export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: C.red, high: C.red, medium: C.amber, low: '#6b7280',
  }
  const col = colors[severity] || C.muted
  return (
    <span style={{
      fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px',
      borderRadius: 3, color: col, background: `${col}18`, border: `1px solid ${col}33`,
      textTransform: 'uppercase',
    }}>
      {severity}
    </span>
  )
}

/* ── Helpers to pick the right preview ── */
function getPreviewType(violation: any): string {
  const p = (violation.property || violation.type || '').toLowerCase()
  if (p.includes('color') || p.includes('contrast')) return 'color'
  if (p.includes('spacing') || p.includes('margin') || p.includes('padding')) return 'spacing'
  if (p.includes('typography') || p.includes('font') || p.includes('typographyStyle')) return 'typography'
  if (p.includes('component') || p.includes('variant')) return 'component'
  if (p.includes('layout') || p.includes('grid') || p.includes('column')) return 'grid'
  // fallback to type field
  const t = (violation.type || '').toLowerCase()
  if (t.includes('color')) return 'color'
  if (t.includes('spacing')) return 'spacing'
  if (t.includes('typography')) return 'typography'
  if (t.includes('component')) return 'component'
  if (t.includes('layout')) return 'grid'
  return 'color'
}

function renderPreview(type: string, value: any, variant: 'current' | 'suggested', label?: string) {
  switch (type) {
    case 'color':
      return <ColorPreview color={String(value || '#888')} label={label || String(value || '')} variant={variant} />
    case 'spacing':
      return <SpacingPreview value={typeof value === 'number' ? value : parseInt(value, 10) || 8} label={label} variant={variant} />
    case 'typography':
      return <TypographyPreview value={String(value || 'base')} label={label || String(value || '')} variant={variant} />
    case 'component':
      return <ComponentPreview variant={String(value || 'default')} isApproved={variant === 'suggested'} />
    case 'grid':
      return <GridPreview columns={typeof value === 'number' ? value : parseInt(value, 10) || 3} label={label} variant={variant} />
    default:
      return <ColorPreview color={String(value || '#888')} label={label} variant={variant} />
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
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: 10, borderRadius: 8,
        background: `${C.red}08`, border: `1px solid ${C.red}22`,
      }}>
        <span style={{
          fontFamily: mono, fontSize: 9, letterSpacing: '0.1em',
          color: C.red, textTransform: 'uppercase' as const, fontWeight: 600,
        }}>
          CURRENT
        </span>
        {renderPreview(previewType, current, 'current', currentLabel)}
      </div>

      {/* Arrow */}
      <div style={{
        color: C.muted, fontSize: 18, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: '50%',
        background: C.surface2, border: `1px solid ${C.border2}`,
      }}>
        {'\u2192'}
      </div>

      {/* Suggested */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: 10, borderRadius: 8,
        background: `${C.green}08`, border: `1px solid ${C.green}22`,
      }}>
        <span style={{
          fontFamily: mono, fontSize: 9, letterSpacing: '0.1em',
          color: C.green, textTransform: 'uppercase' as const, fontWeight: 600,
        }}>
          SUGGESTED
        </span>
        {renderPreview(previewType, suggested, 'suggested', suggestedLabel)}
      </div>
    </div>
  )
}
