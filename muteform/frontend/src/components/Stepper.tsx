'use client'

import { usePathname } from 'next/navigation'

const T = {
  bg: '#080909', surface: '#0c0d0f', surface2: '#101214',
  border: '#161819', border2: '#1e2226',
  green: '#22c55e', greenDim: '#22c55e18',
  text: '#f0f1f3', muted: '#6b7280', dim: '#374151',
}
const mono = "'DM Mono', monospace"
const syne = "'Syne', sans-serif"

const STEPS = [
  { label: 'Import', href: '/import', step: 0 },
  { label: 'Rules', href: '/rules', step: 1 },
  { label: 'Scan', href: '/scan', step: 2 },
  { label: 'Report', href: '/report', step: 3 },
]

export default function Stepper() {
  const pathname = usePathname()
  const currentIdx = STEPS.findIndex(s => pathname === s.href)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '12px 24px',
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      overflowX: 'auto',
    }}>
      {/* Logo */}
      <a href="/" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        textDecoration: 'none', marginRight: 24, flexShrink: 0,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: T.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.bg }}>M</span>
        </div>
        <span style={{ fontFamily: syne, fontSize: 15, fontWeight: 700, color: T.text }}>muteform</span>
      </a>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
        {STEPS.map((step, i) => {
          const isActive = i === currentIdx
          const isCompleted = i < currentIdx
          const isClickable = isCompleted || isActive
          return (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {isClickable ? (
                <a href={step.href} style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  color: isActive ? '#000' : T.green,
                  background: isActive ? T.green : T.greenDim,
                  padding: '6px 14px', borderRadius: 6,
                  border: isCompleted ? `1px solid ${T.green}33` : '1px solid transparent',
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: isActive ? 'rgba(0,0,0,0.15)' : `${T.green}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: mono, fontSize: 10, fontWeight: 700,
                    color: isActive ? '#000' : T.green,
                  }}>
                    {isCompleted ? '\u2713' : i + 1}
                  </span>
                  {step.label}
                </a>
              ) : (
                <span style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600,
                  color: T.dim,
                  padding: '6px 14px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: T.surface2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: mono, fontSize: 10, fontWeight: 700,
                    color: T.dim,
                    border: `1px solid ${T.border2}`,
                  }}>
                    {i + 1}
                  </span>
                  {step.label}
                </span>
              )}
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 32, height: 1,
                  background: isCompleted ? T.green : T.border,
                  margin: '0 2px',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Advanced link (Playground) */}
      <a href="/playground" style={{
        fontFamily: mono, fontSize: 11, color: T.muted,
        textDecoration: 'none', padding: '5px 12px', borderRadius: 6,
        marginLeft: 16, flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        Advanced
      </a>
    </div>
  )
}
