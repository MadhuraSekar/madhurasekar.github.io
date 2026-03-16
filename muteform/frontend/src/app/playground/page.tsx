'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, Violation, ScanResult, RewriteResult } from '@/lib/engine'
import { FIXTURES, getFixture, type FixtureEntry } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'

// ─── Design Tokens ───────────────────────────────────────────
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
const serif = "'Instrument Serif', Georgia, serif"

// ─── Default YAML with toggleable rules ──────────────────────
const DEFAULT_RULES = [
  { id: 'color-token-compliance', severity: 'high', description: 'All colors must reference approved design tokens', check: 'color.value IN tokens.colors.*', auto_fix: 'snap_nearest_delta_e', enabled: true },
  { id: 'spacing-scale-compliance', severity: 'medium', description: 'Spacing values must use the approved scale', check: 'spacing.value IN tokens.spacing.scale', auto_fix: 'snap_nearest', enabled: true },
  { id: 'contrast-wcag-aa', severity: 'critical', description: 'All text must meet WCAG AA contrast requirements', check: 'contrast.ratio >= 4.5', auto_fix: 'adjust_foreground', enabled: true },
  { id: 'typography-style-compliance', severity: 'high', description: 'Typography styles must be from approved list', check: 'typography.style IN tokens.typography.allowed_styles', auto_fix: 'snap_nearest_category', enabled: true },
  { id: 'component-variant-compliance', severity: 'critical', description: 'Component variants must be from approved list', check: 'component.variant IN tokens.components.*.allowed_variants', auto_fix: 'snap_nearest_category', enabled: true },
  { id: 'layout-grid-compliance', severity: 'medium', description: 'Grid columns must use approved column counts', check: 'layout.columns IN tokens.layout.grid_columns', auto_fix: 'false', enabled: true },
]

function buildYaml(rules: typeof DEFAULT_RULES): string {
  const enabledRules = rules.filter(r => r.enabled)
  const rulesYaml = enabledRules.map(r =>
    `  - id: "${r.id}"\n    severity: ${r.severity}\n    description: "${r.description}"\n    check: "${r.check}"\n    auto_fix: ${r.auto_fix === 'false' ? 'false' : `"${r.auto_fix}"`}`
  ).join('\n')

  return `name: "Acme Design System"
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
${rulesYaml}`
}

// ─── Severity helpers ────────────────────────────────────────
const GOV_SEV: Record<GovernanceSeverity, { color: string; dim: string; label: string }> = {
  'auto-fix': { color: T.green, dim: T.greenDim, label: 'FIXED' },
  'warn': { color: T.amber, dim: T.amberDim, label: 'WARN' },
  'block': { color: T.red, dim: T.redDim, label: 'BLOCK' },
}

function severityColor(s: string): string {
  switch (s) { case 'critical': return T.red; case 'high': return T.red; case 'medium': return T.amber; default: return T.muted }
}

function scoreColor(score: number): string {
  if (score < 50) return T.red; if (score < 80) return T.amber; return T.green
}

// ─── Score Ring ──────────────────────────────────────────────
function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef<number>()

  useEffect(() => {
    setDisplayed(0)
    const start = performance.now()
    const duration = 1000
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(eased * score))
      if (t < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score])

  const r = (size - 14) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * displayed) / 100
  const color = scoreColor(displayed)

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.border} strokeWidth={7} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke 0.3s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.28, fontWeight: 700, color, lineHeight: 1 }}>{displayed}</span>
        <span style={{ fontFamily: sans, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>health</span>
      </div>
    </div>
  )
}

// ─── Value Preview ───────────────────────────────────────────
function ValuePreview({ property, value }: { property: string; value: any }) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (property.startsWith('colors.') && typeof value === 'string' && value.startsWith('#')) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 14, height: 14, background: value, borderRadius: 3, border: `1px solid ${T.border2}` }} />
        <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{value}</span>
      </span>
    )
  }
  if (property.startsWith('spacing.')) {
    const num = parseInt(str, 10)
    if (!isNaN(num)) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: Math.min(num * 1.5, 80), height: 8, background: T.blue, borderRadius: 2, opacity: 0.7 }} />
          <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{str}</span>
        </span>
      )
    }
  }
  return <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{str}</span>
}

// ─── Main Page ───────────────────────────────────────────────
export default function PlaygroundPage() {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [yamlText, setYamlText] = useState(buildYaml(DEFAULT_RULES))
  const [selectedFixture, setSelectedFixture] = useState<string>('dashboard')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const runScan = useCallback((yaml: string, fixtureId: string) => {
    setError(null)
    setRewriteResult(null)
    setReport(null)
    try {
      const policy = loadConfig(yaml)
      const fixture = getFixture(fixtureId)
      if (!fixture) { setError(`Fixture "${fixtureId}" not found.`); return }
      const result = scanArtifact(fixture.artifact, policy)
      setScanResult(result)
      const r = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, result, null, policy)
      setReport(r)
    } catch (e: any) {
      setError(e.message || 'Failed to parse YAML or run scan.')
    }
  }, [])

  const handleScan = useCallback((yaml?: string, fixtureId?: string) => {
    runScan(yaml || yamlText, fixtureId || selectedFixture)
  }, [yamlText, selectedFixture, runScan])

  // Auto-run on load — synchronous, no delay
  useEffect(() => {
    runScan(buildYaml(DEFAULT_RULES), 'dashboard')
  }, [runScan])

  const handleToggleRule = (ruleId: string) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    const newYaml = buildYaml(updated)
    setYamlText(newYaml)
    // Immediately rerun scan
    handleScan(newYaml)
  }

  const handleFixtureSelect = (id: string) => {
    setSelectedFixture(id)
    setRewriteResult(null)
    setReport(null)
    handleScan(yamlText, id)
  }

  const handleApplyGovernance = useCallback(() => {
    if (!scanResult) return
    try {
      const policy = loadConfig(yamlText)
      const fixture = getFixture(selectedFixture)
      if (!fixture) return
      const result = rewriteArtifact(fixture.artifact, scanResult.violations, policy)
      setRewriteResult(result)
      const r = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, scanResult, result, policy)
      setReport(r)
    } catch (e: any) {
      setError(e.message)
    }
  }, [scanResult, yamlText, selectedFixture])

  const handleCopy = () => {
    if (!report) return
    navigator.clipboard.writeText(reportToJSON(report))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fixture = getFixture(selectedFixture)
  const navItems = [
    { label: 'Demo', href: '/demo' },
    { label: 'Playground', href: '/playground' },
    { label: 'Rules', href: '/rules' },
    { label: 'Governance', href: '/governance' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: sans }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) { .two-col-left, .two-col-right { padding: 16px !important; } }
      `}</style>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 56, borderBottom: `1px solid ${T.border}`, background: T.surface,
      }}>
        <a href="/" style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 22, color: T.textBright, textDecoration: 'none' }}>muteform</a>
        <div className="nav-links" style={{ display: 'flex', gap: 28 }}>
          {navItems.map(n => (
            <a key={n.label} href={n.href} style={{
              fontFamily: sans, fontSize: 14, fontWeight: 500,
              color: n.label === 'Playground' ? T.green : T.muted, textDecoration: 'none',
            }}>{n.label}</a>
          ))}
        </div>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </nav>
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        {navItems.map(n => (
          <a key={n.label} href={n.href} onClick={() => setMobileMenuOpen(false)}
            style={{ fontFamily: sans, color: n.label === 'Playground' ? T.green : undefined }}>{n.label}</a>
        ))}
      </div>

      {/* Two-column Layout */}
      <div className="two-col" style={{ display: 'flex', gap: 0, maxWidth: 1440, margin: '0 auto', minHeight: 'calc(100vh - 56px)' }}>
        {/* LEFT: Editor + Rules + Fixtures */}
        <div className="two-col-left" style={{
          width: '55%', padding: '24px 20px 24px 32px', borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto',
        }}>
          {/* Rule Toggles */}
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Rules (toggle to rerun scan)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rules.map(r => (
                <div key={r.id} onClick={() => handleToggleRule(r.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: r.enabled ? T.surface : T.bg,
                  border: `1px solid ${r.enabled ? T.green + '44' : T.border}`,
                  borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    background: r.enabled ? T.green : 'transparent',
                    border: `2px solid ${r.enabled ? T.green : T.dim}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {r.enabled && <span style={{ color: T.bg, fontSize: 9, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: r.enabled ? T.text : T.dim }}>{r.id}</span>
                  </div>
                  <span style={{
                    fontFamily: mono, fontSize: 9, fontWeight: 600,
                    color: severityColor(r.severity), padding: '1px 6px', borderRadius: 3,
                    background: `${severityColor(r.severity)}18`, letterSpacing: '0.04em',
                  }}>{r.severity.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* YAML Editor */}
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Policy YAML</div>
            <textarea
              value={yamlText}
              onChange={e => setYamlText(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 300, background: T.surface, color: T.text,
                fontFamily: mono, fontSize: 12, lineHeight: 1.7,
                border: `1px solid ${T.border}`, borderRadius: 8, outline: 'none',
                padding: '14px 18px', resize: 'vertical', caretColor: T.green,
              }}
            />
          </div>

          {/* Fixture Selector */}
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Select Fixture</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {FIXTURES.map(f => {
                const active = f.id === selectedFixture
                return (
                  <button key={f.id} onClick={() => handleFixtureSelect(f.id)} style={{
                    padding: '10px 12px', background: active ? T.greenDim : T.surface,
                    border: `1px solid ${active ? T.green : T.border}`,
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: active ? T.green : T.text }}>{f.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: active ? T.green : T.muted, marginTop: 3 }}>{f.nodeCount} nodes</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* RUN SCAN button */}
          <button onClick={() => handleScan()} style={{
            width: '100%', padding: '14px 0',
            background: `linear-gradient(135deg, ${T.green}, #00c070)`,
            border: 'none', borderRadius: 8, fontFamily: mono, fontSize: 14, fontWeight: 700,
            color: T.bg, cursor: 'pointer',
            letterSpacing: 1.5, textTransform: 'uppercase',
            boxShadow: `0 0 24px ${T.greenGlow}`,
          }}>Run Scan</button>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 8, background: T.redDim,
              border: `1px solid ${T.red}44`, fontFamily: mono, fontSize: 12, color: T.red,
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* RIGHT: Results */}
        <div className="two-col-right" style={{
          width: '45%', padding: '24px 32px 24px 20px',
          display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto',
        }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 2 }}>Results</div>

          {scanResult && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Nodes', value: scanResult.nodesScanned },
                  { label: 'Rules', value: scanResult.rulesEvaluated },
                  { label: 'Violations', value: scanResult.violations.length },
                  { label: 'Time', value: `${scanResult.scanDurationMs}ms` },
                ].map(s => (
                  <div key={s.label} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: '10px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.textBright }}>{s.value}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Health Score */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                <ScoreRing score={rewriteResult ? rewriteResult.afterScore : scanResult.score} />
                <div style={{
                  fontFamily: mono, fontSize: 10, color: T.green, border: `1px solid ${T.green}44`,
                  borderRadius: 20, padding: '4px 14px', background: T.greenDim, letterSpacing: 0.5,
                }}>Deterministic evaluation · No AI in the loop</div>
              </div>

              {/* Violations */}
              {scanResult.violations.length > 0 && !rewriteResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 2 }}>
                    Violations ({scanResult.violations.length})
                  </div>
                  {scanResult.violations.map((v, i) => (
                    <div key={`${v.ruleId}-${v.nodeId}-${i}`} style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 8, padding: '12px 14px',
                      display: 'flex', flexDirection: 'column', gap: 6,
                      animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          color: severityColor(v.severity), background: `${severityColor(v.severity)}18`,
                          padding: '2px 8px', borderRadius: 4,
                        }}>{v.severity}</span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: T.blue, background: T.blueDim, padding: '2px 8px', borderRadius: 4 }}>{v.ruleId}</span>
                        <span style={{ flex: 1 }} />
                        {v.autoFixAvailable ? (
                          <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: T.green, background: T.greenDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.green}33` }}>AUTO-FIX</span>
                        ) : (
                          <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: T.amber, background: T.amberDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.amber}33` }}>MANUAL REVIEW</span>
                        )}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{v.nodePath}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ValuePreview property={v.property} value={v.currentValue} />
                        {v.suggestedValue != null && (
                          <>
                            <span style={{ fontFamily: mono, fontSize: 12, color: T.dim }}>→</span>
                            <ValuePreview property={v.property} value={v.suggestedValue} />
                          </>
                        )}
                      </div>
                      <div style={{ fontFamily: sans, fontSize: 12, color: T.muted, lineHeight: 1.4 }}>{v.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Apply Governance button */}
              {scanResult.violations.length > 0 && !rewriteResult && (
                <button onClick={handleApplyGovernance} style={{
                  width: '100%', padding: '14px 0',
                  background: `linear-gradient(135deg, ${T.green}, #00c070)`,
                  border: 'none', borderRadius: 8, fontFamily: mono, fontSize: 14, fontWeight: 700,
                  color: T.bg, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase',
                  boxShadow: `0 0 24px ${T.greenGlow}`,
                }}>Apply Governance</button>
              )}

              {/* Governance Results */}
              {rewriteResult && report && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Three-category cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '12px', background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.green }}>{report.autoFixedCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.green, letterSpacing: '0.08em', marginTop: 2 }}>✓ AUTO-FIXED</div>
                    </div>
                    <div style={{ padding: '12px', background: T.amberDim, border: `1px solid ${T.amber}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.amber }}>{report.warningCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.amber, letterSpacing: '0.08em', marginTop: 2 }}>⚠ WARNINGS</div>
                    </div>
                    <div style={{ padding: '12px', background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.red }}>{report.blockedCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.red, letterSpacing: '0.08em', marginTop: 2 }}>✕ BLOCKED</div>
                    </div>
                  </div>

                  {/* Category Bars */}
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Category Scores</div>
                    {report.categories.map(c => (
                      <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: sans, fontSize: 10, color: T.muted, width: 90 }}>{c.name}</span>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: T.border }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${c.score}%`, background: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, width: 24 }}>{c.score}</span>
                      </div>
                    ))}
                  </div>

                  {/* Score delta */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
                  }}>
                    <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.red }}>{report.overallScore}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
                    <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.green }}>{report.afterScore}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>+{report.afterScore - report.overallScore} pts</span>
                  </div>

                  {/* Enriched violation list grouped by severity */}
                  {(['auto-fix', 'warn', 'block'] as GovernanceSeverity[]).map(sev => {
                    const group = report.violations.filter(v => (v.fixApplied && sev === 'auto-fix') || (!v.fixApplied && v.severity === sev))
                    if (group.length === 0) return null
                    const s = GOV_SEV[sev]
                    return (
                      <div key={sev}>
                        <div style={{ fontFamily: mono, fontSize: 10, color: s.color, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                          {s.label} ({group.length})
                        </div>
                        {group.map(v => (
                          <div key={v.id} style={{
                            padding: '8px 12px', marginBottom: 6, background: T.surface,
                            border: `1px solid ${s.color}22`, borderRadius: 6, opacity: v.fixApplied ? 0.6 : 1,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: s.color, background: s.dim, padding: '1px 5px', borderRadius: 3, border: `1px solid ${s.color}33` }}>{s.label}</span>
                              <span style={{ fontFamily: sans, fontSize: 10, color: T.text, flex: 1 }}>{v.ruleName}</span>
                              <span style={{ fontFamily: mono, fontSize: 8, color: T.dim }}>{v.ruleSource}</span>
                            </div>
                            <div style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>{v.nodePath}</div>
                            <div style={{ fontFamily: sans, fontSize: 10, color: T.muted, marginTop: 2 }}>{v.evidence}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })}

                  {/* Copy + PDF buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleCopy} style={{
                      flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                      background: copied ? T.greenDim : T.surface, color: copied ? T.green : T.text,
                      border: `1px solid ${copied ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
                    }}>{copied ? 'COPIED ✓' : 'Copy Report'}</button>
                    <button style={{
                      flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6,
                      background: T.surface, color: T.dim, border: `1px solid ${T.border}`, cursor: 'not-allowed', opacity: 0.5, letterSpacing: '0.06em',
                    }}>Download PDF</button>
                  </div>
                </div>
              )}

              {/* No violations */}
              {scanResult.violations.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontFamily: sans, fontSize: 16, color: T.green, fontWeight: 600, marginBottom: 6 }}>All clear</div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>No violations found. Design is fully compliant.</div>
                </div>
              )}
            </>
          )}

          {!scanResult && !error && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, minHeight: 300 }}>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 28, color: T.dim, opacity: 0.5 }}>muteform</div>
              <div style={{ fontFamily: mono, fontSize: 12, color: T.dim }}>Loading scan...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
