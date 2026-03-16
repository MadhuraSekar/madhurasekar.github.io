'use client'

import { useState } from 'react'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', redDim: '#ff407018',
  amber: '#ffb830', amberDim: '#ffb83018',
  blue: '#4090ff', blueDim: '#4090ff18',
  purple: '#a855f7', purpleDim: '#a855f718',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"

const STATS = [
  { label: 'Components scanned', value: '847', icon: '⊕', color: T.blue },
  { label: 'Compliance rate', value: '94%', icon: '◉', color: T.green },
  { label: 'Violations auto-fixed this week', value: '23', icon: '⊞', color: T.amber },
  { label: 'AI tools connected', value: '4', icon: '◇', color: T.purple },
]

const TOOL_BADGE: Record<string, { label: string; color: string; dim: string }> = {
  claude: { label: 'Claude Code', color: T.amber, dim: T.amberDim },
  cursor: { label: 'Cursor', color: T.blue, dim: T.blueDim },
  v0: { label: 'v0', color: T.purple, dim: T.purpleDim },
  copilot: { label: 'Copilot', color: T.green, dim: T.greenDim },
}

const RECENT_SCANS = [
  { time: '2 min ago', tool: 'claude', component: 'CheckoutButton', nodes: 12, violations: 4, fixed: 4, score: 100 },
  { time: '18 min ago', tool: 'cursor', component: 'PricingCard', nodes: 8, violations: 2, fixed: 2, score: 100 },
  { time: '1 hour ago', tool: 'v0', component: 'HeroSection', nodes: 24, violations: 7, fixed: 5, score: 84 },
  { time: '3 hours ago', tool: 'copilot', component: 'NavBar', nodes: 6, violations: 1, fixed: 1, score: 100 },
]

const CATEGORY_SCORES = [
  { name: 'Color', score: 95, color: T.red },
  { name: 'Spacing', score: 100, color: T.amber },
  { name: 'Typography', score: 88, color: T.purple },
  { name: 'Motion', score: 100, color: T.blue },
  { name: 'Accessibility', score: 92, color: T.green },
]

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const col = score >= 90 ? T.green : score >= 60 ? T.amber : T.red
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border2} strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={4}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{
          fontFamily: mono, fontSize: size * 0.28, fill: col, fontWeight: 700,
          transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`,
        }}>
        {score}
      </text>
    </svg>
  )
}

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', active: true },
    { label: 'Scan', href: '/scan', active: false },
    { label: 'Rules', href: '/rules', active: false },
    { label: 'Governance', href: '/governance', active: false },
    { label: 'Integrate', href: '/integrate', active: false },
    { label: 'Team', href: '/team', active: false },
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
          </div>
          <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>muteform</span>
        </div>
        <nav className="nav-links" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {navItems.map(l => (
            <a key={l.label} href={l.href} style={{
              fontFamily: mono, fontSize: 11, color: l.active ? T.green : T.muted,
              textDecoration: 'none', letterSpacing: '0.02em',
              borderBottom: l.active ? `2px solid ${T.green}` : '2px solid transparent',
              paddingBottom: 2,
            }}>{l.label}</a>
          ))}
        </nav>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        {navItems.map(l => (
          <a key={l.label} href={l.href} onClick={() => setMobileMenuOpen(false)}
            style={{ fontFamily: sans, color: l.active ? T.green : undefined }}>{l.label}</a>
        ))}
      </div>

      <div className="page-container" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* 4 Stat Cards */}
        <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {STATS.map(s => (
            <div key={s.label} style={{
              padding: '20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 14, width: 28, height: 28, borderRadius: 6,
                  background: `${s.color}18`, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{s.icon}</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: T.textBright, marginBottom: 4 }}>
                {s.value}
              </div>
              <div style={{ fontFamily: sans, fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Health Score Section */}
        <div className="grid-3-auto" style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center',
          padding: '24px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 20,
        }}>
          <ScoreRing score={94} size={100} />
          <div>
            <div style={{ fontFamily: sans, fontSize: 20, fontWeight: 700, color: T.textBright }}>
              Health Score
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginTop: 4 }}>
              Acme Core v8 · Last scan: 2 minutes ago
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {CATEGORY_SCORES.map(c => (
                <div key={c.name} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 4,
                  background: T.surface2, border: `1px solid ${T.border}`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
                  <span style={{ fontFamily: mono, fontSize: 9, color: T.muted }}>{c.name}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.score >= 90 ? T.green : T.amber }}>{c.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            fontFamily: mono, fontSize: 11, color: T.green, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ↑ 3 pts this week
          </div>
        </div>

        {/* Recent Scans Feed */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.textBright }}>Recent Scans</span>
            <a href="/scan" style={{ fontFamily: mono, fontSize: 10, color: T.green, textDecoration: 'none' }}>View all →</a>
          </div>
          {RECENT_SCANS.map((s, i) => {
            const badge = TOOL_BADGE[s.tool]
            const scoreCol = s.score >= 90 ? T.green : s.score >= 60 ? T.amber : T.red
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: i < RECENT_SCANS.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.dim, minWidth: 80 }}>{s.time}</span>
                <span style={{
                  fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                  padding: '2px 8px', borderRadius: 4,
                  color: badge.color, background: badge.dim, border: `1px solid ${badge.color}33`,
                }}>{badge.label}</span>
                <span style={{ fontFamily: sans, fontSize: 12, color: T.textBright, flex: 1 }}>{s.component}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{s.violations} violations · {s.fixed} fixed</span>
                {/* Health score mini ring */}
                <svg width={28} height={28} viewBox="0 0 28 28" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={14} cy={14} r={11} fill="none" stroke={T.border2} strokeWidth={2} />
                  <circle cx={14} cy={14} r={11} fill="none" stroke={scoreCol} strokeWidth={2}
                    strokeDasharray={`${(s.score / 100) * 2 * Math.PI * 11} ${2 * Math.PI * 11}`} strokeLinecap="round" />
                  <text x={14} y={14.5} textAnchor="middle" dominantBaseline="middle"
                    style={{
                      fontFamily: mono, fontSize: 8, fill: scoreCol, fontWeight: 700,
                      transform: 'rotate(90deg)', transformOrigin: '14px 14px',
                    }}>
                    {s.score}
                  </text>
                </svg>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
