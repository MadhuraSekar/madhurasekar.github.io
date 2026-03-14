'use client'
import { useEffect, useState } from 'react'
import { C, mono, syne, VMETA, scoreColor, fmtDate } from './ui/tokens'
import { ScoreRing } from './ui/ScoreRing'
import { api } from '@/lib/api'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DriftEntry {
  scan_id: string
  artifact_name: string
  health_score: number
  violation_count: number
  high_count: number
  medium_count: number
  low_count: number
  created_at: string
  by_type: Record<string, number>
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111', border: `1px solid ${C.border2}`, borderRadius: 6, padding: '10px 14px' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
          <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{p.name}</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: C.text, marginLeft: 'auto' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px',
  ...extra,
})

const label: React.CSSProperties = {
  fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted, marginBottom: 6,
}

const bigNum = (color?: string): React.CSSProperties => ({
  fontFamily: syne, fontSize: 28, fontWeight: 700, color: color || C.text,
})

export default function DriftTab() {
  const [driftData, setDriftData] = useState<DriftEntry[]>([])
  const [focus, setFocus] = useState<string | null>(null)

  useEffect(() => {
    api<DriftEntry[]>('/analytics/drift').then(setDriftData).catch(() => {})
  }, [])

  // Derived
  const totalViolations = driftData.reduce((a, d) => a + d.violation_count, 0)
  const avgHealth = driftData.length
    ? Math.round(driftData.reduce((a, d) => a + d.health_score, 0) / driftData.length)
    : 0
  const trend = driftData.length >= 2
    ? driftData[driftData.length - 1].health_score - driftData[driftData.length - 2].health_score
    : 0

  // All violation types across all scans
  const typeMap: Record<string, number> = {}
  driftData.forEach(d => {
    Object.entries(d.by_type || {}).forEach(([k, v]) => { typeMap[k] = (typeMap[k] || 0) + v })
  })
  const typeTotal = Object.values(typeMap).reduce((a, b) => a + b, 0) || 1
  const typeKeys = Object.keys(VMETA)

  // Chart data
  const chartData = driftData.map(d => ({
    date: fmtDate(d.created_at),
    score: d.health_score,
    total: d.violation_count,
    ...typeKeys.reduce((acc, k) => ({ ...acc, [k]: d.by_type?.[k] || 0 }), {}),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div style={card()}>
          <div style={label}>SCANS</div>
          <div style={bigNum()}>{driftData.length}</div>
        </div>
        <div style={card()}>
          <div style={label}>TOTAL VIOLATIONS</div>
          <div style={bigNum(C.amber)}>{totalViolations}</div>
        </div>
        <div style={card()}>
          <div style={label}>AVG HEALTH</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ScoreRing score={avgHealth} size={44} />
            <span style={bigNum(scoreColor(avgHealth))}>{avgHealth}</span>
          </div>
        </div>
        <div style={card()}>
          <div style={label}>TREND</div>
          <div style={bigNum(trend >= 0 ? C.green : C.red)}>
            {trend >= 0 ? '+' : ''}{trend}
          </div>
        </div>
      </div>

      {/* Health score area chart */}
      <div style={card()}>
        <div style={label}>HEALTH OVER TIME</div>
        <div style={{ height: 200, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontFamily: mono, fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontFamily: mono, fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="score" name="Health" stroke={C.blue} fill="url(#healthGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column: stacked bar + type breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Stacked bar chart */}
        <div style={card()}>
          <div style={label}>VIOLATIONS PER SCAN</div>
          <div style={{ height: 220, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontFamily: mono, fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: mono, fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                {typeKeys.map(k => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={VMETA[k]?.short || k}
                    stackId="v"
                    fill={VMETA[k]?.color || C.muted}
                    opacity={!focus || focus === k ? 1 : 0.2}
                    radius={k === typeKeys[typeKeys.length - 1] ? [2, 2, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By type breakdown */}
        <div style={card()}>
          <div style={label}>BY TYPE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
            {typeKeys.map(k => {
              const count = typeMap[k] || 0
              const pct = Math.round((count / typeTotal) * 100)
              const meta = VMETA[k]
              const isFocused = focus === k
              return (
                <div
                  key={k}
                  onClick={() => setFocus(isFocused ? null : k)}
                  style={{ cursor: 'pointer', opacity: !focus || isFocused ? 1 : 0.4, transition: 'opacity 0.2s' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: isFocused ? meta.color : C.text }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', background: meta.color,
                      borderRadius: 2, transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
