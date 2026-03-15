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

const YAML_CONTENT = `name: "Acme Core v8"
version: "8.0.0"

tokens:
  colors:
    brand:
      primary: "#00e087"
      secondary: "#0a1628"
    semantic:
      success: "#00e087"
      warning: "#ffb830"
      error: "#ff4070"
      info: "#4090ff"
  spacing:
    scale: [4, 8, 12, 16, 24, 32, 48, 64]
    tolerance: 0
  typography:
    families:
      display: "Instrument Serif"
      body: "DM Sans"
      mono: "JetBrains Mono"
  motion:
    max_duration: 300

rules:
  - id: "contrast-wcag-aa"
    severity: critical
    description: "Interactive elements must meet WCAG AA"
    auto_fix: "adjust_foreground"
  - id: "color-token-compliance"
    severity: high
    description: "All colors must reference approved tokens"
    auto_fix: "snap_nearest_delta_e"
  - id: "spacing-scale-compliance"
    severity: medium
    description: "Spacing values must use approved scale"
    auto_fix: "snap_nearest"
  - id: "typography-family"
    severity: high
    description: "Font families must be from approved list"
    auto_fix: "snap_nearest_category"
  - id: "typography-scale"
    severity: medium
    description: "Type sizes must maintain minimum scale ratio"
    auto_fix: false
  - id: "motion-performance"
    severity: low
    description: "Transitions must not exceed max duration"
    auto_fix: "clamp"`

interface Rule {
  id: string; severity: string; description: string; autoFix: string | false; enabled: boolean
}

const INITIAL_RULES: Rule[] = [
  { id: 'contrast-wcag-aa', severity: 'critical', description: 'Interactive elements must meet WCAG AA', autoFix: 'adjust_foreground', enabled: true },
  { id: 'color-token-compliance', severity: 'high', description: 'All colors must reference approved tokens', autoFix: 'snap_nearest_delta_e', enabled: true },
  { id: 'spacing-scale-compliance', severity: 'medium', description: 'Spacing values must use approved scale', autoFix: 'snap_nearest', enabled: true },
  { id: 'typography-family', severity: 'high', description: 'Font families must be from approved list', autoFix: 'snap_nearest_category', enabled: true },
  { id: 'typography-scale', severity: 'medium', description: 'Type sizes must maintain minimum scale ratio', autoFix: false, enabled: true },
  { id: 'motion-performance', severity: 'low', description: 'Transitions must not exceed max duration', autoFix: 'clamp', enabled: true },
]

const SEV: Record<string, { color: string; dim: string }> = {
  critical: { color: T.red, dim: T.redDim },
  high: { color: T.red, dim: T.redDim },
  medium: { color: T.amber, dim: T.amberDim },
  low: { color: T.muted, dim: `${T.muted}18` },
}

const SEVERITIES = ['critical', 'high', 'medium', 'low']

export default function RulesPage() {
  const [yaml, setYaml] = useState(YAML_CONTENT)
  const [rules, setRules] = useState(INITIAL_RULES)

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const changeSeverity = (id: string, severity: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, severity } : r))
  }

  const toggleAutoFix = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, autoFix: r.autoFix ? false : 'snap_nearest' } : r))
  }

  const activeCount = rules.filter(r => r.enabled).length

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
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>muteform</span>
          </a>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.amber, background: T.amberDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.amber}33`, letterSpacing: '0.06em' }}>
            RULES EDITOR
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{activeCount} rules active</span>
          <a href="/dashboard" style={{ fontFamily: mono, fontSize: 11, color: T.muted, textDecoration: 'none' }}>← Dashboard</a>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 80px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: YAML editor */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: T.textBright }}>
              .muteform.yml
            </span>
            <button
              onClick={() => {
                const blob = new Blob([yaml], { type: 'text/yaml' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = '.muteform.yml'; a.click()
                URL.revokeObjectURL(url)
              }}
              style={{
                fontFamily: mono, fontSize: 10, padding: '4px 10px', borderRadius: 4,
                background: T.surface2, color: T.muted, border: `1px solid ${T.border}`, cursor: 'pointer',
              }}
            >
              Export ↓
            </button>
          </div>
          <textarea
            value={yaml}
            onChange={e => setYaml(e.target.value)}
            style={{
              width: '100%', minHeight: 600, fontFamily: mono, fontSize: 11, lineHeight: 1.7,
              background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: 16, resize: 'vertical', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = T.green)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />
        </div>

        {/* Right: Rule cards */}
        <div>
          <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: T.textBright, marginBottom: 12 }}>
            Visual Rule Builder
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map(r => {
              const sev = SEV[r.severity] || SEV.low
              return (
                <div key={r.id} style={{
                  padding: '14px 16px', background: T.surface, border: `1px solid ${r.enabled ? T.border : T.border}`,
                  borderRadius: 10, opacity: r.enabled ? 1 : 0.4, transition: 'opacity 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {/* Toggle */}
                    <div
                      onClick={() => toggleRule(r.id)}
                      style={{
                        width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
                        background: r.enabled ? T.green : T.dim,
                        position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 2,
                        left: r.enabled ? 16 : 2, transition: 'left 0.2s',
                      }} />
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 11, color: T.textBright, flex: 1 }}>{r.id}</span>
                    <select
                      value={r.severity}
                      onChange={e => changeSeverity(r.id, e.target.value)}
                      style={{
                        fontFamily: mono, fontSize: 9, color: sev.color, background: sev.dim,
                        border: `1px solid ${sev.color}33`, borderRadius: 3, padding: '2px 6px',
                        cursor: 'pointer', outline: 'none', letterSpacing: '0.06em',
                      }}
                    >
                      {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <p style={{ fontFamily: sans, fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 8 }}>
                    {r.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>AUTO-FIX:</span>
                    <div
                      onClick={() => toggleAutoFix(r.id)}
                      style={{
                        fontFamily: mono, fontSize: 9, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
                        color: r.autoFix ? T.green : T.dim,
                        background: r.autoFix ? T.greenDim : T.surface2,
                        border: `1px solid ${r.autoFix ? T.green + '33' : T.border}`,
                      }}
                    >
                      {r.autoFix ? 'ON' : 'OFF'}
                    </div>
                    {r.autoFix && (
                      <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>
                        strategy: {typeof r.autoFix === 'string' ? r.autoFix : '—'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div style={{
            marginTop: 16, padding: '12px 16px', background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, fontFamily: mono, fontSize: 10, color: T.muted,
          }}>
            {activeCount} rules active · 11 color tokens · 8 spacing values · 3 font families
          </div>
        </div>
      </div>
    </div>
  )
}
