'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { ScanResult, RewriteResult, MuteformConfig } from '@/lib/engine'
import { FIXTURES, getFixture } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718', greenGlow: '#00e08733',
  red: '#ff4070', redDim: '#ff407018',
  amber: '#ffb830', amberDim: '#ffb83018',
  blue: '#4090ff', blueDim: '#4090ff18',
  purple: '#a855f7', purpleDim: '#a855f718',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', 'Inter', system-ui, sans-serif"

const DEMO_YAML = `name: "Acme Design System"
version: "1.0.0"
tokens:
  colors:
    primary: "#0055FF"
    neutral900: "#111111"
    success: "#22c55e"
    warning: "#f59e0b"
    accent: "#9ca3af"
  spacing:
    scale: [4, 8, 12, 16, 24, 32, 48, 64]
  typography:
    families:
      display: "Instrument Serif"
      body: "DM Sans"
      mono: "JetBrains Mono"
    allowed_styles: [h1, h2, h3, body, body-sm, caption, label]
  components:
    button:
      allowed_variants: [primary, secondary]
      allowed_sizes: [sm, md, lg]
  layout:
    grid_columns: [4, 8, 12]
rules:
  - id: "color-token-compliance"
    severity: high
    description: "All colors must reference approved design tokens"
    check: "color.value IN tokens.colors.*"
    auto_fix: "snap_nearest_delta_e"
  - id: "spacing-scale-compliance"
    severity: medium
    description: "Spacing values must use the approved scale"
    check: "spacing.value IN tokens.spacing.scale"
    auto_fix: "snap_nearest"
  - id: "contrast-wcag-aa"
    severity: critical
    description: "All text must meet WCAG AA contrast requirements"
    check: "contrast.ratio >= 4.5"
    auto_fix: "adjust_foreground"
  - id: "typography-style-compliance"
    severity: high
    description: "Typography styles must be from approved list"
    check: "typography.style IN tokens.typography.allowed_styles"
    auto_fix: "snap_nearest_category"
  - id: "component-variant-compliance"
    severity: critical
    description: "Component variants must be from approved list"
    check: "component.variant IN tokens.components.*.allowed_variants"
    auto_fix: "snap_nearest_category"
  - id: "layout-grid-compliance"
    severity: medium
    description: "Grid columns must use approved column counts"
    check: "layout.columns IN tokens.layout.grid_columns"
    auto_fix: false`

const GOV_SEV: Record<GovernanceSeverity, { color: string; dim: string; label: string }> = {
  'auto-fix': { color: T.green, dim: T.greenDim, label: 'FIXED' },
  'warn': { color: T.amber, dim: T.amberDim, label: 'WARN' },
  'block': { color: T.red, dim: T.redDim, label: 'BLOCK' },
}

function ScoreRing({ score, size = 90 }: { score: number; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * score) / 100
  const col = score >= 90 ? T.green : score >= 60 ? T.amber : score > 0 ? T.red : T.dim
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.border} strokeWidth={5} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={5} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.28, fontWeight: 700, color: col, lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: sans, fontSize: 8, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>health</span>
      </div>
    </div>
  )
}

function ViolationVisual({ v }: { v: EnrichedViolation }) {
  if (v.type === 'color_token') {
    const hex = v.evidence.match(/#[0-9a-fA-F]{6}/)?.[0] || '#ff0000'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 16, height: 16, borderRadius: 3, background: hex, border: `1px solid ${T.border2}` }} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{hex}</span>
        {v.suggestedFix && v.suggestedFix.startsWith('#') && (
          <>
            <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>→</span>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: v.suggestedFix, border: `1px solid ${T.border2}` }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>{v.suggestedFix}</span>
          </>
        )}
      </div>
    )
  }
  if (v.type === 'spacing') {
    const cur = parseInt(v.evidence.match(/(\d+)/)?.[1] || '10')
    const sug = parseInt(v.suggestedFix.match(/(\d+)/)?.[1] || String(cur))
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: Math.min(cur * 1.5, 40), height: 7, borderRadius: 2, background: `${T.red}80` }} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{cur}px</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>→</span>
        <div style={{ width: Math.min(sug * 1.5, 40), height: 7, borderRadius: 2, background: `${T.green}80` }} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>{sug}px</span>
      </div>
    )
  }
  if (v.type === 'component') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 3, background: T.redDim, color: T.red, border: `1px solid ${T.red}33` }}>
          {v.evidence.match(/"([^"]+)"/)?.[1] || '?'}
        </span>
        <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>→</span>
        <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 3, background: T.greenDim, color: T.green, border: `1px solid ${T.green}33` }}>
          {v.suggestedFix}
        </span>
      </div>
    )
  }
  if (v.type === 'layout') {
    const curCols = parseInt(v.evidence.match(/(\d+)/)?.[1] || '5')
    const sugCols = parseInt(v.suggestedFix.match(/(\d+)/)?.[1] || '12')
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${curCols}, 1fr)`, gap: 1, width: 36 }}>
          {Array.from({ length: curCols }).map((_, i) => <div key={i} style={{ height: 6, borderRadius: 1, background: T.red, opacity: 0.6 }} />)}
        </div>
        <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>→</span>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sugCols}, 1fr)`, gap: 1, width: 36 }}>
          {Array.from({ length: sugCols }).map((_, i) => <div key={i} style={{ height: 6, borderRadius: 1, background: T.green, opacity: 0.6 }} />)}
        </div>
      </div>
    )
  }
  return null
}

export default function ScanPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedFixture, setSelectedFixture] = useState('dashboard')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(null)
  const [config, setConfig] = useState<MuteformConfig | null>(null)
  const [score, setScore] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [governed, setGoverned] = useState(false)
  const [copied, setCopied] = useState(false)
  const firstRun = useRef(false)

  const runScan = useCallback((fixtureId: string) => {
    setScanning(true)
    setGoverned(false)
    setRewriteResult(null)
    setReport(null)

    setTimeout(() => {
      const fixture = getFixture(fixtureId)
      if (!fixture) { setScanning(false); return }
      const policy = loadConfig(DEMO_YAML)
      setConfig(policy)
      const result = scanArtifact(fixture.artifact, policy)
      setScanResult(result)
      setScore(result.score)
      const r = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, result, null, policy)
      setReport(r)
      setScanning(false)
    }, 50)
  }, [])

  // Auto-run on first load
  useEffect(() => {
    if (firstRun.current) return
    firstRun.current = true
    runScan('dashboard')
  }, [runScan])

  const handleFixtureSelect = (id: string) => {
    setSelectedFixture(id)
    runScan(id)
  }

  const handleGovernance = () => {
    if (!scanResult || !config) return
    const fixture = getFixture(selectedFixture)
    if (!fixture) return
    const result = rewriteArtifact(fixture.artifact, scanResult.violations, config)
    setRewriteResult(result)
    setScore(result.afterScore)
    const r = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, scanResult, result, config)
    setReport(r)
    setGoverned(true)
  }

  const handleCopy = () => {
    if (!report) return
    navigator.clipboard.writeText(reportToJSON(report))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fixture = getFixture(selectedFixture)
  const fixtureOptions = FIXTURES.filter(f => ['dashboard', 'onboarding', 'settings'].includes(f.id))

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px ${T.greenGlow} } 50% { box-shadow: 0 0 40px ${T.green}44 } }
        @media (max-width: 768px) { .scan-grid { grid-template-columns: 1fr !important; } }
      `}</style>

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
          <span style={{ fontFamily: mono, fontSize: 10, color: T.blue, background: T.blueDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.blue}33`, letterSpacing: '0.06em' }}>
            SCAN
          </span>
        </div>
        <a href="/dashboard" className="nav-links" style={{ fontFamily: mono, fontSize: 11, color: T.muted, textDecoration: 'none' }}>← Dashboard</a>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        <a href="/dashboard" style={{ fontFamily: sans }}>Dashboard</a>
        <a href="/scan" style={{ fontFamily: sans, color: T.green }}>Scan</a>
        <a href="/playground" style={{ fontFamily: sans }}>Playground</a>
        <a href="/rules" style={{ fontFamily: sans }}>Rules</a>
      </div>

      <div className="page-container" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Fixture Selector */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {fixtureOptions.map(f => {
            const active = f.id === selectedFixture
            return (
              <button key={f.id} onClick={() => handleFixtureSelect(f.id)} style={{
                flex: 1, padding: '14px 16px',
                background: active ? T.greenDim : T.surface,
                border: `1px solid ${active ? T.green : T.border}`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: active ? T.green : T.text }}>{f.name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: active ? T.green : T.muted, marginTop: 4 }}>
                  {f.source} · {f.nodeCount} nodes
                </div>
              </button>
            )
          })}
        </div>

        {/* Results Grid */}
        <div className="scan-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left: Violations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Score */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            }}>
              <ScoreRing score={score} size={70} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.textBright }}>{fixture?.name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>
                  {governed ? `${report?.autoFixedCount} auto-fixed · ${report?.warningCount} warnings · ${report?.blockedCount} blocked` : `${scanResult?.violations.length || 0} violations found`}
                </div>
              </div>
            </div>

            {scanning && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${T.border}`, borderTopColor: T.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontFamily: mono, fontSize: 11, color: T.green, marginLeft: 10 }}>SCANNING...</span>
              </div>
            )}

            {report && !scanning && report.violations.map((v, i) => {
              const sev = GOV_SEV[v.severity]
              return (
                <div key={v.id} style={{
                  padding: '10px 14px', background: T.surface,
                  border: `1px solid ${v.fixApplied ? T.green + '33' : T.border}`,
                  borderRadius: 8, opacity: v.fixApplied ? 0.6 : 1,
                  transition: 'all 0.3s', animation: `fadeSlideIn 0.2s ease ${i * 0.03}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: mono, fontSize: 9, fontWeight: 600, color: sev.color, background: sev.dim,
                      padding: '2px 6px', borderRadius: 3, border: `1px solid ${sev.color}33`, letterSpacing: '0.06em',
                    }}>{sev.label}</span>
                    <span style={{ fontFamily: sans, fontSize: 11, color: T.text, flex: 1 }}>{v.ruleName}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, color: T.dim }}>{v.ruleSource}</span>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.dim, marginBottom: 4 }}>{v.nodePath}</div>
                  <div style={{ fontFamily: sans, fontSize: 10, color: T.muted, marginBottom: 4 }}>{v.evidence}</div>
                  <ViolationVisual v={v} />
                </div>
              )
            })}
          </div>

          {/* Right: Report + Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!governed && scanResult && !scanning && (
              <button onClick={handleGovernance} style={{
                width: '100%', padding: '16px', borderRadius: 10, cursor: 'pointer', border: 'none',
                background: `linear-gradient(135deg, ${T.green}, #00c070)`,
                fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.bg, letterSpacing: 1.5,
                textTransform: 'uppercase', boxShadow: `0 0 24px ${T.greenGlow}`, animation: 'glow 2s ease-in-out infinite',
              }}>Apply Governance</button>
            )}

            {governed && report && (
              <>
                {/* Three category cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ padding: '12px', background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: T.green }}>{report.autoFixedCount}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: T.green, letterSpacing: '0.08em', marginTop: 2 }}>✓ AUTO-FIXED</div>
                  </div>
                  <div style={{ padding: '12px', background: T.amberDim, border: `1px solid ${T.amber}33`, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: T.amber }}>{report.warningCount}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: T.amber, letterSpacing: '0.08em', marginTop: 2 }}>⚠ WARNINGS</div>
                  </div>
                  <div style={{ padding: '12px', background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: T.red }}>{report.blockedCount}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: T.red, letterSpacing: '0.08em', marginTop: 2 }}>✕ BLOCKED</div>
                  </div>
                </div>

                {/* Report */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: T.textBright }}>Governance Report</span>
                    <span style={{ fontFamily: mono, fontSize: 9, color: T.muted }}>{fixture?.source}</span>
                  </div>

                  {/* Category bars */}
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                    {report.categories.map(c => (
                      <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: sans, fontSize: 10, color: T.muted, width: 90 }}>{c.name}</span>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: T.border }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${c.score}%`, background: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, transition: 'width 0.6s' }} />
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, width: 24 }}>{c.score}</span>
                      </div>
                    ))}
                  </div>

                  {/* Score delta */}
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.red }}>{report.overallScore}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
                    <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.green }}>{report.afterScore}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>+{report.afterScore - report.overallScore} pts</span>
                  </div>

                  {/* Buttons */}
                  <div style={{ padding: '10px 16px', display: 'flex', gap: 8 }}>
                    <button onClick={handleCopy} style={{
                      flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '8px', borderRadius: 6, cursor: 'pointer',
                      background: copied ? T.greenDim : T.surface2, color: copied ? T.green : T.textBright,
                      border: `1px solid ${copied ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
                    }}>{copied ? 'COPIED ✓' : 'Copy Report'}</button>
                    <button style={{
                      flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '8px', borderRadius: 6,
                      background: T.surface2, color: T.dim, border: `1px solid ${T.border}`, cursor: 'not-allowed', opacity: 0.5, letterSpacing: '0.06em',
                    }}>Download PDF</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
