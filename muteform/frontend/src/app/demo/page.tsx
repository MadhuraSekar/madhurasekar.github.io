'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact, scoreFromViolations } from '@/lib/engine'
import type { MuteformConfig, Violation, ScanResult, RewriteResult } from '@/lib/engine'
import { FIXTURES, getFixture } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'

// ─── Design tokens ───────────────────────────────────────────
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

// ─── Severity helpers ────────────────────────────────────────
const SEV: Record<string, { color: string; dim: string; label: string }> = {
  critical: { color: T.red, dim: T.redDim, label: 'CRITICAL' },
  high: { color: T.red, dim: T.redDim, label: 'HIGH' },
  medium: { color: T.amber, dim: T.amberDim, label: 'MEDIUM' },
  low: { color: T.muted, dim: `${T.muted}18`, label: 'LOW' },
}

const GOV_SEV: Record<GovernanceSeverity, { color: string; dim: string; label: string; icon: string }> = {
  'auto-fix': { color: T.green, dim: T.greenDim, label: 'FIXED', icon: '✓' },
  'warn': { color: T.amber, dim: T.amberDim, label: 'WARN', icon: '⚠' },
  'block': { color: T.red, dim: T.redDim, label: 'BLOCK', icon: '✕' },
}

// ─── Score Ring ──────────────────────────────────────────────
function ScoreRing({ score, size = 120, animate = false }: { score: number; size?: number; animate?: boolean }) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef<number>()

  useEffect(() => {
    if (!animate) { setDisplayed(score); return }
    setDisplayed(0)
    const start = performance.now()
    const duration = 1200
    const run = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(eased * score))
      if (t < 1) animRef.current = requestAnimationFrame(run)
    }
    animRef.current = requestAnimationFrame(run)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score, animate])

  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * displayed) / 100
  const col = displayed >= 90 ? T.green : displayed >= 60 ? T.amber : displayed > 0 ? T.red : T.dim

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.border} strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={6} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s, stroke 0.3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.28, fontWeight: 700, color: col, lineHeight: 1 }}>{displayed}</span>
        <span style={{ fontFamily: sans, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 3 }}>health</span>
      </div>
    </div>
  )
}

// ─── Visual preview for violation values ─────────────────────
function ViolationVisual({ v }: { v: EnrichedViolation }) {
  if (v.type === 'color_token') {
    const hexMatch = v.evidence.match(/#[0-9a-fA-F]{6}/)
    const hex = hexMatch ? hexMatch[0] : '#ff0000'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, background: hex, border: `1px solid ${T.border2}` }} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{hex}</span>
        {v.suggestedFix && (
          <>
            <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: v.suggestedFix.startsWith('#') ? v.suggestedFix : T.green, border: `1px solid ${T.border2}` }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>{v.suggestedFix}</span>
          </>
        )}
      </div>
    )
  }
  if (v.type === 'spacing') {
    const curMatch = v.evidence.match(/(\d+)px/)
    const cur = curMatch ? parseInt(curMatch[1]) : 10
    const sugMatch = v.suggestedFix.match(/(\d+)/)
    const sug = sugMatch ? parseInt(sugMatch[1]) : cur
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: Math.min(cur * 1.5, 50), height: 8, borderRadius: 2, background: `${T.red}80` }} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{cur}px</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
        <div style={{ width: Math.min(sug * 1.5, 50), height: 8, borderRadius: 2, background: `${T.green}80` }} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>{sug}px</span>
      </div>
    )
  }
  if (v.type === 'component') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 10, padding: '2px 8px', borderRadius: 4, background: T.redDim, color: T.red, border: `1px solid ${T.red}33` }}>
          {v.evidence.match(/"([^"]+)"/)?.[1] || v.evidence}
        </span>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
        <span style={{ fontFamily: mono, fontSize: 10, padding: '2px 8px', borderRadius: 4, background: T.greenDim, color: T.green, border: `1px solid ${T.green}33` }}>
          {v.suggestedFix}
        </span>
      </div>
    )
  }
  if (v.type === 'layout') {
    const curCols = parseInt(v.evidence.match(/(\d+)/)?.[1] || '5')
    const sugCols = parseInt(v.suggestedFix.match(/(\d+)/)?.[1] || '12')
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${curCols}, 1fr)`, gap: 1, width: 40 }}>
          {Array.from({ length: curCols }).map((_, i) => (
            <div key={i} style={{ height: 8, borderRadius: 1, background: T.red, opacity: 0.6 }} />
          ))}
        </div>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sugCols}, 1fr)`, gap: 1, width: 40 }}>
          {Array.from({ length: sugCols }).map((_, i) => (
            <div key={i} style={{ height: 8, borderRadius: 1, background: T.green, opacity: 0.6 }} />
          ))}
        </div>
      </div>
    )
  }
  return null
}

// ─── Main Demo Page ──────────────────────────────────────────
export default function DemoPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(null)
  const [config, setConfig] = useState<MuteformConfig | null>(null)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'scanned' | 'governed'>('loading')
  const [copied, setCopied] = useState(false)
  const autoRan = useRef(false)

  // Auto-run on page load: select onboarding fixture, scan after 800ms
  useEffect(() => {
    if (autoRan.current) return
    autoRan.current = true

    const timer = setTimeout(() => {
      const fixture = getFixture('onboarding')
      if (!fixture) return
      const policy = loadConfig(DEMO_YAML)
      setConfig(policy)
      const result = scanArtifact(fixture.artifact, policy)
      setScanResult(result)
      setScore(result.score)

      // Build initial report (no fixes yet)
      const initialReport = buildGovernanceReport(
        fixture.name, fixture.source, fixture.artifact, result, null, policy
      )
      setReport(initialReport)
      setPhase('scanned')
    }, 800)

    return () => clearTimeout(timer)
  }, [])

  const handleGovernance = useCallback(() => {
    if (!scanResult || !config) return
    const fixture = getFixture('onboarding')
    if (!fixture) return

    const result = rewriteArtifact(fixture.artifact, scanResult.violations, config)
    setRewriteResult(result)
    setScore(result.afterScore)

    const govReport = buildGovernanceReport(
      fixture.name, fixture.source, fixture.artifact, scanResult, result, config
    )
    setReport(govReport)
    setPhase('governed')
  }, [scanResult, config])

  const handleCopyReport = () => {
    if (!report) return
    navigator.clipboard.writeText(reportToJSON(report))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fixture = getFixture('onboarding')
  const violationCount = scanResult?.violations.length || 0

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px ${T.greenGlow} } 50% { box-shadow: 0 0 40px ${T.green}44 } }
        @media (max-width: 768px) {
          .demo-hero h1 { font-size: 26px !important; }
          .demo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ─── Top Bar ─── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
          </div>
          <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>muteform</span>
          <span style={{
            fontFamily: mono, fontSize: 9, color: T.green,
            background: T.greenDim, padding: '2px 8px', borderRadius: 4,
            border: `1px solid ${T.green}33`, letterSpacing: '0.08em',
          }}>LIVE DEMO</span>
        </div>
        <div className="nav-links" style={{ display: 'flex', gap: 20 }}>
          {[{ l: 'Demo', h: '/demo', a: true }, { l: 'Playground', h: '/playground' }, { l: 'Rules', h: '/rules' }, { l: 'Governance', h: '/governance' }].map(n => (
            <a key={n.l} href={n.h} style={{ fontFamily: sans, fontSize: 14, fontWeight: 500, color: n.a ? T.green : T.muted, textDecoration: 'none' }}>{n.l}</a>
          ))}
        </div>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        <a href="/demo" style={{ fontFamily: sans, color: T.green }}>Demo</a>
        <a href="/playground" style={{ fontFamily: sans }}>Playground</a>
        <a href="/rules" style={{ fontFamily: sans }}>Rules</a>
        <a href="/governance" style={{ fontFamily: sans }}>Governance</a>
      </div>

      {/* ─── Hero ─── */}
      <div className="demo-hero" style={{ padding: '36px 20px 24px', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontFamily: serif, fontSize: 38, fontWeight: 400, color: T.textBright, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>
          Design governance for<br />AI-generated interfaces
        </h1>
        <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, marginTop: 10, lineHeight: 1.6 }}>
          Scanning: <strong style={{ color: T.textBright }}>Onboarding Flow</strong> from <strong style={{ color: T.amber }}>Cursor AI</strong> — {violationCount} violations detected
        </p>
      </div>

      {/* ─── Main Content ─── */}
      <div className="demo-grid" style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 20px 60px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
      }}>
        {/* ═══ LEFT: Score + Violations ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Score Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px',
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
          }}>
            <ScoreRing score={score} size={100} animate />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: T.textBright }}>
                {fixture?.name || 'Onboarding Flow'}
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                Source: {fixture?.source || 'Cursor AI output'}
              </div>
              {report && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {report.categories.map(c => (
                    <div key={c.key} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 6px', borderRadius: 4, background: T.surface2, border: `1px solid ${T.border}`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }} />
                      <span style={{ fontFamily: mono, fontSize: 8, color: T.muted }}>{c.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red }}>{c.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Violations */}
          {phase === 'loading' && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 40, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
            }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${T.border}`, borderTopColor: T.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: mono, fontSize: 11, color: T.green, marginLeft: 12, letterSpacing: '0.06em' }}>SCANNING FIXTURE...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {report && report.violations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.violations.map((v, i) => {
                const sev = GOV_SEV[v.severity]
                return (
                  <div key={v.id} style={{
                    padding: '12px 16px', background: T.surface,
                    border: `1px solid ${v.fixApplied ? T.green + '33' : T.border}`,
                    borderRadius: 10, opacity: v.fixApplied ? 0.65 : 1,
                    transition: 'all 0.4s', animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: mono, fontSize: 9, fontWeight: 600,
                        color: sev.color, background: sev.dim,
                        padding: '2px 6px', borderRadius: 3, border: `1px solid ${sev.color}33`, letterSpacing: '0.06em',
                      }}>{sev.label}</span>
                      <span style={{ fontFamily: sans, fontSize: 11, color: T.text, flex: 1 }}>{v.ruleName}</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>{v.ruleSource}</span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>{v.nodePath}</div>
                    <div style={{ fontFamily: sans, fontSize: 11, color: T.muted, marginBottom: 6, lineHeight: 1.4 }}>{v.evidence}</div>
                    <ViolationVisual v={v} />
                    {v.fixApplied && (
                      <div style={{ fontFamily: mono, fontSize: 10, color: T.green, marginTop: 6 }}>{v.fixDescription}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Actions + Report ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Apply Governance */}
          {phase === 'scanned' && (
            <button onClick={handleGovernance} style={{
              width: '100%', padding: '16px 0',
              background: `linear-gradient(135deg, ${T.green}, #00c070)`,
              border: 'none', borderRadius: 10,
              fontFamily: mono, fontSize: 14, fontWeight: 700,
              color: T.bg, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase',
              boxShadow: `0 0 24px ${T.greenGlow}`, animation: 'glow 2s ease-in-out infinite',
            }}>Apply Governance</button>
          )}

          {/* Three-category summary */}
          {phase === 'governed' && report && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{
                  padding: '14px', background: T.greenDim, border: `1px solid ${T.green}33`,
                  borderRadius: 10, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.green }}>{report.autoFixedCount}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.green, letterSpacing: '0.08em', marginTop: 4 }}>✓ AUTO-FIXED</div>
                </div>
                <div style={{
                  padding: '14px', background: T.amberDim, border: `1px solid ${T.amber}33`,
                  borderRadius: 10, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.amber }}>{report.warningCount}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.amber, letterSpacing: '0.08em', marginTop: 4 }}>⚠ WARNINGS</div>
                </div>
                <div style={{
                  padding: '14px', background: T.redDim, border: `1px solid ${T.red}33`,
                  borderRadius: 10, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.red }}>{report.blockedCount}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.red, letterSpacing: '0.08em', marginTop: 4 }}>✕ BLOCKED</div>
                </div>
              </div>

              {/* Governance Report */}
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: `1px solid ${T.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: T.textBright }}>Governance Report</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{new Date(report.timestamp).toLocaleString()}</span>
                </div>

                {/* Category Breakdown */}
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Category Scores</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {report.categories.map(c => (
                      <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: sans, fontSize: 11, color: T.muted, width: 100 }}>{c.name}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.border }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${c.score}%`,
                            background: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, width: 28 }}>{c.score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Delta */}
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>Score:</span>
                  <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.red }}>{report.overallScore}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: T.dim }}>→</span>
                  <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.green }}>{report.afterScore}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>+{report.afterScore - report.overallScore} pts</span>
                </div>

                {/* Summary */}
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: mono, fontSize: 12, color: T.text, lineHeight: 1.8 }}>
                    <span style={{ color: T.green }}>{report.autoFixedCount}</span> auto-fixed · <span style={{ color: T.amber }}>{report.warningCount}</span> warnings · <span style={{ color: T.red }}>{report.blockedCount}</span> blocked
                  </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '14px 18px', display: 'flex', gap: 10 }}>
                  <button onClick={handleCopyReport} style={{
                    flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                    padding: '10px', borderRadius: 6, cursor: 'pointer',
                    background: copied ? T.greenDim : T.surface2,
                    color: copied ? T.green : T.textBright,
                    border: `1px solid ${copied ? T.green + '33' : T.border}`,
                  }}>{copied ? 'COPIED ✓' : 'Copy Report'}</button>
                  <button style={{
                    flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                    padding: '10px', borderRadius: 6, cursor: 'not-allowed',
                    background: T.surface2, color: T.dim, border: `1px solid ${T.border}`, opacity: 0.5,
                  }}>Download PDF</button>
                </div>
              </div>
            </>
          )}

          {/* Ship It badge */}
          {phase === 'governed' && (
            <div style={{
              textAlign: 'center', padding: '20px',
              background: T.greenDim, borderRadius: 10, border: `1px solid ${T.green}33`,
              animation: 'glow 2s ease-in-out infinite',
            }}>
              <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.green, letterSpacing: '0.1em' }}>
                GOVERNED — READY TO SHIP
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                Deterministic evaluation · No AI in the loop
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CTA Section ─── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px', textAlign: 'center' }}>
        <div style={{ padding: '48px 24px', background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`, borderRadius: 16, border: `1px solid ${T.border}` }}>
          <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: T.textBright, letterSpacing: '-0.02em', marginBottom: 8 }}>
            TypeScript for design. Enforced at generation.
          </h2>
          <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, marginBottom: 28, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Define your rules. AI generates, Muteform intercepts. Auto-fix, score, ship.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/playground" style={{
              display: 'inline-block', fontFamily: mono, fontSize: 13, fontWeight: 600,
              color: T.bg, background: T.green, padding: '12px 28px', borderRadius: 8,
              textDecoration: 'none', boxShadow: `0 4px 24px ${T.green}33`,
            }}>Try the Playground →</a>
            <a href="mailto:hello@muteform.com" style={{
              display: 'inline-block', fontFamily: mono, fontSize: 13, fontWeight: 600,
              color: T.green, background: 'transparent', padding: '12px 28px', borderRadius: 8,
              textDecoration: 'none', border: `1px solid ${T.green}44`,
            }}>Join the Waitlist</a>
          </div>
        </div>
      </div>
    </div>
  )
}
