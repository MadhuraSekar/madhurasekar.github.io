'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Header from '@/components/Header'
import { tokens } from '@/lib/design-tokens'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const T = tokens
const mono = T.fontMono
const syne = T.fontDisplay

/* ─── Mock data ─── */

const STATS = [
  { label: 'Health Score', value: '94', suffix: '/100', color: T.green, sparkline: [82, 85, 84, 87, 89, 91, 94] },
  { label: 'Total Scans', value: '1,247', color: T.blue, sparkline: null },
  { label: 'Auto-Fix Rate', value: '78', suffix: '%', color: T.amber, sparkline: null },
  { label: 'Active Rules', value: '5', color: T.text, sparkline: null },
]

const HEALTH_DATA = [
  { day: 'Feb 14', score: 42 },
  { day: 'Feb 17', score: 45 },
  { day: 'Feb 20', score: 48, event: 'Design system v2.0 rules added' },
  { day: 'Feb 23', score: 55 },
  { day: 'Feb 26', score: 62 },
  { day: 'Mar 01', score: 68 },
  { day: 'Mar 04', score: 74, event: 'MCP integration enabled' },
  { day: 'Mar 07', score: 79 },
  { day: 'Mar 10', score: 85 },
  { day: 'Mar 13', score: 91 },
  { day: 'Mar 16', score: 94 },
]

const TOOL_BADGE: Record<string, { label: string; color: string; dim: string }> = {
  claude: { label: 'Claude', color: T.amber, dim: T.amberDim },
  cursor: { label: 'Cursor', color: T.blue, dim: T.blueDim },
  v0: { label: 'v0', color: '#a855f7', dim: 'rgba(168,85,247,0.08)' },
  copilot: { label: 'Copilot', color: T.green, dim: T.greenDim },
}

const VIOLATIONS_TABLE = [
  { time: '2 min ago', interface: 'Checkout Flow', rule: 'color-token-compliance', severity: 'high', status: 'fixed', tool: 'claude' },
  { time: '2 min ago', interface: 'Checkout Flow', rule: 'component-variant-compliance', severity: 'critical', status: 'fixed', tool: 'claude' },
  { time: '18 min ago', interface: 'Dashboard', rule: 'spacing-scale-compliance', severity: 'medium', status: 'fixed', tool: 'cursor' },
  { time: '18 min ago', interface: 'Dashboard', rule: 'typography-style-compliance', severity: 'high', status: 'fixed', tool: 'cursor' },
  { time: '1h ago', interface: 'Onboarding', rule: 'contrast-wcag-aa', severity: 'critical', status: 'pending', tool: 'v0' },
  { time: '1h ago', interface: 'Onboarding', rule: 'color-token-compliance', severity: 'high', status: 'fixed', tool: 'v0' },
  { time: '3h ago', interface: 'Settings', rule: 'layout-grid-compliance', severity: 'medium', status: 'pending', tool: 'copilot' },
  { time: '3h ago', interface: 'Settings', rule: 'spacing-scale-compliance', severity: 'medium', status: 'fixed', tool: 'copilot' },
  { time: '6h ago', interface: 'Checkout Flow', rule: 'component-variant-compliance', severity: 'critical', status: 'fixed', tool: 'claude' },
  { time: '6h ago', interface: 'Dashboard', rule: 'color-token-compliance', severity: 'high', status: 'fixed', tool: 'cursor' },
]

const AGENT_FEED = [
  { time: '2 min ago', agent: 'Claude via MCP', interface: 'Checkout Flow', nodes: 20, violations: 4, fixed: 4, tool: 'claude' },
  { time: '18 min ago', agent: 'Cursor', interface: 'SaaS Dashboard', nodes: 24, violations: 2, fixed: 2, tool: 'cursor' },
  { time: '1h ago', agent: 'v0 by Vercel', interface: 'Onboarding Flow', nodes: 18, violations: 7, fixed: 5, tool: 'v0' },
  { time: '3h ago', agent: 'GitHub Copilot', interface: 'Settings Page', nodes: 12, violations: 3, fixed: 2, tool: 'copilot' },
  { time: '6h ago', agent: 'Claude via MCP', interface: 'Checkout Flow', nodes: 20, violations: 5, fixed: 5, tool: 'claude' },
]

function sevColor(s: string): string {
  switch (s) { case 'critical': return T.red; case 'high': return '#f97316'; case 'medium': return T.amber; default: return T.textMuted }
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 8) / 2, circ = 2 * Math.PI * r
  const col = score >= 90 ? T.green : score >= 60 ? T.amber : T.red
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={5}
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.28, fontWeight: 700, color: col }}>{score}</span>
      </div>
    </div>
  )
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data), min = Math.min(...data)
  const w = 60, h = 20
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min + 1)) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const data = HEALTH_DATA.find(d => d.day === label)
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 12px', fontFamily: mono, fontSize: 10 }}>
      <div style={{ color: T.text, fontWeight: 600 }}>{label}: {payload[0].value}/100</div>
      {data?.event && <div style={{ color: T.blue, marginTop: 2 }}>{data.event}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [tab, setTab] = useState<'violations' | 'agents'>('violations')

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <Header />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 60px' }}>
        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: syne, fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Dashboard</h1>
          <p style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, marginTop: 4 }}>Design system health overview · Acme Design System v2.1</p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ padding: '16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</span>
                  {s.suffix && <span style={{ fontFamily: mono, fontSize: 12, color: T.textMuted }}>{s.suffix}</span>}
                </div>
                {s.sparkline && <MiniSparkline data={s.sparkline} color={s.color} />}
              </div>
            </div>
          ))}
        </div>

        {/* Health over time chart */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 16px 8px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: T.text }}>Health Score Over Time</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, marginTop: 2 }}>Last 30 days · Trending upward</div>
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, color: T.green, display: 'flex', alignItems: 'center', gap: 4 }}>
              ↑ 52 pts since launch
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={HEALTH_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.green} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="day" tick={{ fontFamily: mono, fontSize: 9, fill: T.textDim }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis domain={[0, 100]} tick={{ fontFamily: mono, fontSize: 9, fill: T.textDim }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="score" stroke={T.green} strokeWidth={2} fill="url(#healthGrad)" dot={false} />
              {/* Event markers */}
              {HEALTH_DATA.filter(d => d.event).map(d => {
                const idx = HEALTH_DATA.indexOf(d)
                return (
                  <Area key={idx} type="monotone" dataKey="score" stroke="none" fill="none" dot={{ r: 4, fill: T.blue, stroke: T.blue }} activeDot={false} />
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tabs: Violations / Agent Activity */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => setTab('violations')} style={{
              flex: 1, padding: '10px', background: tab === 'violations' ? T.surface2 : 'transparent',
              border: 'none', borderBottom: tab === 'violations' ? `2px solid ${T.red}` : '2px solid transparent',
              fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              color: tab === 'violations' ? T.text : T.textMuted,
            }}>Recent Violations</button>
            <button onClick={() => setTab('agents')} style={{
              flex: 1, padding: '10px', background: tab === 'agents' ? T.surface2 : 'transparent',
              border: 'none', borderBottom: tab === 'agents' ? `2px solid ${T.blue}` : '2px solid transparent',
              fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              color: tab === 'agents' ? T.text : T.textMuted,
            }}>Agent Activity</button>
          </div>

          {tab === 'violations' && (
            <div>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px 70px', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${T.border}` }}>
                {['Time', 'Interface', 'Rule', 'Severity', 'Status'].map(h => (
                  <div key={h} style={{ fontFamily: mono, fontSize: 8, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1.5 }}>{h}</div>
                ))}
              </div>
              {VIOLATIONS_TABLE.map((v, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px 70px', gap: 8,
                  padding: '8px 14px', borderBottom: i < VIOLATIONS_TABLE.length - 1 ? `1px solid ${T.border}` : 'none',
                  alignItems: 'center',
                }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.textDim }}>{v.time}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.text }}>{v.interface}</span>
                  <span style={{ fontFamily: mono, fontSize: 9, color: T.blue }}>{v.rule}</span>
                  <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: sevColor(v.severity), background: `${sevColor(v.severity)}18`, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', textAlign: 'center' }}>{v.severity}</span>
                  <span style={{
                    fontFamily: mono, fontSize: 8, fontWeight: 600, textTransform: 'uppercase', textAlign: 'center',
                    color: v.status === 'fixed' ? T.green : T.amber,
                    background: v.status === 'fixed' ? T.greenDim : T.amberDim,
                    padding: '2px 6px', borderRadius: 3,
                  }}>{v.status === 'fixed' ? '✓ Fixed' : '⏳ Pending'}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'agents' && (
            <div>
              {AGENT_FEED.map((a, i) => {
                const badge = TOOL_BADGE[a.tool]
                const scoreAfter = a.violations === a.fixed ? 100 : Math.round(100 - ((a.violations - a.fixed) / a.nodes) * 100)
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderBottom: i < AGENT_FEED.length - 1 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: T.textDim, minWidth: 70 }}>{a.time}</span>
                    <span style={{
                      fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      color: badge.color, background: badge.dim, border: `1px solid ${badge.color}22`,
                      minWidth: 60, textAlign: 'center',
                    }}>{badge.label}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: T.text, flex: 1 }}>{a.interface}</span>
                    <span style={{ fontFamily: mono, fontSize: 9, color: T.textMuted }}>{a.nodes} nodes</span>
                    <span style={{ fontFamily: mono, fontSize: 9, color: T.textMuted }}>{a.violations} violations</span>
                    <span style={{ fontFamily: mono, fontSize: 9, color: T.green }}>{a.fixed} fixed</span>
                    {/* Mini score */}
                    <div style={{ position: 'relative', width: 28, height: 28 }}>
                      <svg width={28} height={28} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={14} cy={14} r={11} fill="none" stroke={T.border} strokeWidth={2} />
                        <circle cx={14} cy={14} r={11} fill="none" stroke={scoreAfter >= 90 ? T.green : T.amber} strokeWidth={2}
                          strokeDasharray={`${(scoreAfter / 100) * 69.1} 69.1`} strokeLinecap="round" />
                      </svg>
                      <span style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: mono, fontSize: 7, fontWeight: 700, color: scoreAfter >= 90 ? T.green : T.amber,
                      }}>{scoreAfter}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
