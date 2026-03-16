'use client'

import { useState } from 'react'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', redDim: '#ff407018',
  amber: '#ffb830', amberDim: '#ffb83018',
  blue: '#4090ff', blueDim: '#4090ff18',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"

const CATEGORY_SCORES = [
  { name: 'Color', score: 95, color: '#ff4070' },
  { name: 'Spacing', score: 100, color: '#ffb830' },
  { name: 'Typography', score: 88, color: '#a855f7' },
  { name: 'Motion', score: 100, color: '#4090ff' },
  { name: 'Accessibility', score: 92, color: '#00e087' },
]

const RECENT_SCANS = [
  { time: '2 min ago', source: 'Manual paste', nodes: 12, violations: 3, fixed: 3, score: 100 },
  { time: '1 hour ago', source: 'Sample: Checkout', nodes: 8, violations: 4, fixed: 4, score: 100 },
  { time: '3 hours ago', source: 'Manual paste', nodes: 24, violations: 7, fixed: 5, score: 84 },
  { time: 'Yesterday', source: 'Sample: Dashboard', nodes: 16, violations: 2, fixed: 2, score: 100 },
  { time: '2 days ago', source: 'Manual paste', nodes: 6, violations: 5, fixed: 3, score: 72 },
]

const RULES = [
  { id: 'contrast-wcag-aa', triggered: 12, lastTriggered: '2 min ago' },
  { id: 'color-token-compliance', triggered: 8, lastTriggered: '1 hour ago' },
  { id: 'spacing-scale-compliance', triggered: 6, lastTriggered: '3 hours ago' },
  { id: 'motion-performance', triggered: 3, lastTriggered: 'Yesterday' },
  { id: 'typography-family', triggered: 2, lastTriggered: '2 days ago' },
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
  const overallScore = 94

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
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[
            { label: 'Dashboard', href: '/dashboard', active: true },
            { label: 'Scan', href: '/scan', active: false },
            { label: 'Rules', href: '/rules', active: false },
            { label: 'Governance', href: '/governance', active: false },
            { label: 'Integrate', href: '/integrate', active: false },
            { label: 'Team', href: '/team', active: false },
          ].map(l => (
            <a key={l.label} href={l.href} style={{
              fontFamily: mono, fontSize: 11, color: l.active ? T.green : T.muted,
              textDecoration: 'none', letterSpacing: '0.02em',
              borderBottom: l.active ? `2px solid ${T.green}` : '2px solid transparent',
              paddingBottom: 2,
            }}>{l.label}</a>
          ))}
        </nav>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Health Score Section */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center',
          padding: '24px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 20,
        }}>
          <ScoreRing score={overallScore} size={100} />
          <div>
            <div style={{ fontFamily: sans, fontSize: 20, fontWeight: 700, color: T.textBright }}>
              Health Score
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginTop: 4 }}>
              Acme Core v8 · Last scan: 2 minutes ago
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
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

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Paste & Scan', href: '/scan', icon: '⊕' },
            { label: 'Edit Rules', href: '/rules', icon: '⊞' },
            { label: 'View All Scans', href: '/scan', icon: '◇' },
            { label: 'Get SDK', href: '/integrate', icon: '◉' },
          ].map(a => (
            <a key={a.label} href={a.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
              textDecoration: 'none', transition: 'border-color 0.15s',
            }}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.textBright }}>{a.label}</span>
            </a>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Recent Scans */}
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
            {RECENT_SCANS.map((s, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '80px 1fr auto auto',
                alignItems: 'center', gap: 12, padding: '10px 16px',
                borderBottom: i < RECENT_SCANS.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>{s.time}</span>
                <span style={{ fontFamily: sans, fontSize: 11, color: T.text }}>{s.source}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{s.violations} violations</span>
                <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: s.score >= 90 ? T.green : s.score >= 60 ? T.amber : T.red }}>{s.score}</span>
              </div>
            ))}
          </div>

          {/* Active Rules */}
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.textBright }}>Active Rules</span>
              <a href="/rules" style={{ fontFamily: mono, fontSize: 10, color: T.green, textDecoration: 'none' }}>Edit →</a>
            </div>
            {RULES.map((r, i) => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                alignItems: 'center', gap: 12, padding: '10px 16px',
                borderBottom: i < RULES.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: T.text }}>{r.id}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{r.triggered} caught</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>{r.lastTriggered}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
