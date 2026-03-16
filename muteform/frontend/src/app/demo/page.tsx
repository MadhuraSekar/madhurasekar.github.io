'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, ScanResult, RewriteResult, InterfaceDefinition } from '@/lib/engine'
import { getFixture } from '@/lib/fixtures'
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
const syne = "'Syne', sans-serif"
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

const GOV_SEV: Record<GovernanceSeverity, { color: string; dim: string; label: string; icon: string }> = {
  'auto-fix': { color: T.green, dim: T.greenDim, label: 'FIXED', icon: '✓' },
  'warn': { color: T.amber, dim: T.amberDim, label: 'WARN', icon: '⚠' },
  'block': { color: T.red, dim: T.redDim, label: 'BLOCK', icon: '✕' },
}

// ─── Score Ring ──────────────────────────────────────────────
function ScoreRing({ score, size = 120, animate = false, label }: { score: number; size?: number; animate?: boolean; label?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef<number>()
  useEffect(() => {
    if (!animate) { setDisplayed(score); return }
    setDisplayed(0)
    const start = performance.now()
    const run = (now: number) => {
      const t = Math.min((now - start) / 1200, 1)
      setDisplayed(Math.round((1 - Math.pow(1 - t, 3)) * score))
      if (t < 1) animRef.current = requestAnimationFrame(run)
    }
    animRef.current = requestAnimationFrame(run)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score, animate])
  const r = (size - 12) / 2, circ = 2 * Math.PI * r
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
        <span style={{ fontFamily: sans, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 3 }}>{label || 'health'}</span>
      </div>
    </div>
  )
}

// ─── Violation Visual Card (enhanced) ────────────────────────
function ViolationCard({ v }: { v: EnrichedViolation }) {
  const sev = GOV_SEV[v.severity]
  return (
    <div style={{
      padding: '14px 16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
      borderLeft: `3px solid ${sev.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: sev.color, background: sev.dim, padding: '2px 6px', borderRadius: 3, border: `1px solid ${sev.color}33`, letterSpacing: '0.06em' }}>{sev.label}</span>
        <span style={{ fontFamily: syne, fontSize: 12, fontWeight: 600, color: T.text, flex: 1 }}>{v.ruleName}</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>{v.ruleSource}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>{v.nodePath}</div>
      <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginBottom: 10, lineHeight: 1.5 }}>{v.evidence}</div>
      {/* Type-specific visual */}
      {v.type === 'color_token' && (() => {
        const hex = v.evidence.match(/#[0-9a-fA-F]{6}/)?.[0] || '#ff0000'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: hex, border: `2px solid ${T.red}` }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: T.red }}>{hex}</span>
            </div>
            {v.suggestedFix && <>
              <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>→</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: v.suggestedFix.startsWith('#') ? v.suggestedFix : T.green, border: `2px solid ${T.green}` }} />
                <span style={{ fontFamily: mono, fontSize: 9, color: T.green }}>{v.suggestedFix}</span>
              </div>
            </>}
          </div>
        )
      })()}
      {v.type === 'spacing' && (() => {
        const cur = parseInt(v.evidence.match(/(\d+)/)?.[1] || '10')
        const sug = parseInt(v.suggestedFix?.match(/(\d+)/)?.[1] || String(cur))
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ width: Math.min(cur * 2, 80), height: 12, borderRadius: 3, background: `${T.red}80` }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: T.red }}>{cur}px</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>→</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ width: Math.min(sug * 2, 80), height: 12, borderRadius: 3, background: `${T.green}80` }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: T.green }}>{sug}px</span>
            </div>
          </div>
        )
      })()}
      {v.type === 'typography' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: '6px 12px', borderRadius: 6, background: T.redDim, border: `1px solid ${T.red}33` }}>
            <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.red }}>Aa</span>
            <div style={{ fontFamily: mono, fontSize: 9, color: T.red, marginTop: 2 }}>{v.evidence.match(/"([^"]+)"/)?.[1] || 'unknown'}</div>
          </div>
          <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>→</span>
          <div style={{ padding: '6px 12px', borderRadius: 6, background: T.greenDim, border: `1px solid ${T.green}33` }}>
            <span style={{ fontFamily: syne, fontSize: 18, fontWeight: 700, color: T.green }}>Aa</span>
            <div style={{ fontFamily: mono, fontSize: 9, color: T.green, marginTop: 2 }}>{v.suggestedFix || 'approved'}</div>
          </div>
        </div>
      )}
      {v.type === 'component' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: mono, fontSize: 11, padding: '4px 12px', borderRadius: 6, background: T.redDim, color: T.red, border: `1px solid ${T.red}33` }}>
            {v.evidence.match(/"([^"]+)"/)?.[1] || v.evidence}
          </span>
          <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>→</span>
          <span style={{ fontFamily: mono, fontSize: 11, padding: '4px 12px', borderRadius: 6, background: T.greenDim, color: T.green, border: `1px solid ${T.green}33` }}>
            {v.suggestedFix}
          </span>
        </div>
      )}
      {v.type === 'layout' && (() => {
        const curCols = parseInt(v.evidence.match(/(\d+)/)?.[1] || '5')
        const sugCols = parseInt(v.suggestedFix?.match(/(\d+)/)?.[1] || '12')
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${curCols}, 1fr)`, gap: 2, width: 60 }}>
                {Array.from({ length: curCols }).map((_, i) => <div key={i} style={{ height: 12, borderRadius: 2, background: T.red, opacity: 0.6 }} />)}
              </div>
              <span style={{ fontFamily: mono, fontSize: 9, color: T.red }}>{curCols}-col</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>→</span>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sugCols}, 1fr)`, gap: 2, width: 60 }}>
                {Array.from({ length: sugCols }).map((_, i) => <div key={i} style={{ height: 12, borderRadius: 2, background: T.green, opacity: 0.6 }} />)}
              </div>
              <span style={{ fontFamily: mono, fontSize: 9, color: T.green }}>{sugCols}-col</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Node renderer for Original/Governed tabs ────────────────
function NodeCard({ node, violations, isGoverned }: { node: any; violations: EnrichedViolation[]; isGoverned: boolean }) {
  const nodeViolations = violations.filter(v => v.nodeId === node.id)
  const hasViolation = nodeViolations.length > 0 && !isGoverned
  const wasFixed = isGoverned && nodeViolations.some(v => v.fixApplied)
  const borderColor = hasViolation ? T.red : wasFixed ? T.green : T.border
  return (
    <div style={{
      padding: '10px 14px', background: T.surface, borderRadius: 8,
      border: `1px solid ${borderColor}`,
      borderBottom: hasViolation ? `3px solid ${T.red}` : wasFixed ? `3px solid ${T.green}` : `1px solid ${borderColor}`,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.blue, background: T.blueDim, padding: '1px 6px', borderRadius: 3 }}>{node.type}</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.muted, flex: 1 }}>{node.path}</span>
        {hasViolation && <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: T.red, background: T.redDim, padding: '1px 6px', borderRadius: 3 }}>{nodeViolations.length} violation{nodeViolations.length > 1 ? 's' : ''}</span>}
        {wasFixed && <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: T.green, background: T.greenDim, padding: '1px 6px', borderRadius: 3 }}>FIXED</span>}
      </div>
      {node.properties.colors && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {Object.entries(node.properties.colors).map(([k, v]: [string, any]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: v, border: `1px solid ${T.border2}` }} />
              <span style={{ fontFamily: mono, fontSize: 8, color: T.dim }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {node.properties.component && (
        <span style={{ fontFamily: mono, fontSize: 9, color: T.purple, background: T.purpleDim, padding: '1px 6px', borderRadius: 3, marginTop: 4, display: 'inline-block' }}>
          {node.properties.component.name}: {node.properties.component.variant}
        </span>
      )}
      {hasViolation && nodeViolations.map(v => (
        <div key={v.id} style={{ fontFamily: mono, fontSize: 9, color: T.red, marginTop: 4, padding: '4px 8px', background: T.redDim, borderRadius: 4 }}>
          {v.ruleName}: {v.evidence}
        </div>
      ))}
      {wasFixed && nodeViolations.filter(v => v.fixApplied).map(v => (
        <div key={v.id} style={{ fontFamily: mono, fontSize: 9, color: T.green, marginTop: 4, padding: '4px 8px', background: T.greenDim, borderRadius: 4 }}>
          {v.fixDescription}
        </div>
      ))}
    </div>
  )
}

// ─── Report to Markdown ──────────────────────────────────────
function reportToMarkdown(report: GovernanceReport): string {
  let md = `# Governance Report\n\n`
  md += `**Screen:** ${report.fixtureName}\n**Source:** ${report.fixtureSource}\n**Baseline:** Acme Design System v2.1\n**Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n**Score:** ${report.overallScore} → ${report.afterScore} (+${report.afterScore - report.overallScore} pts)\n\n`
  md += `## Category Scores\n\n`
  report.categories.forEach(c => { md += `- ${c.name}: ${c.score}/100\n` })
  md += `\n## Auto-Fixed (${report.autoFixedCount})\n\n`
  report.violations.filter(v => v.fixApplied).forEach(v => { md += `- **${v.ruleName}** — ${v.nodePath}\n  - ${v.fixDescription}\n` })
  md += `\n## Warnings (${report.warningCount})\n\n`
  report.violations.filter(v => !v.fixApplied && v.severity === 'warn').forEach(v => { md += `- **${v.ruleName}** — ${v.nodePath}\n  - ${v.evidence}\n` })
  md += `\n## Blocked (${report.blockedCount})\n\n`
  report.violations.filter(v => !v.fixApplied && v.severity === 'block').forEach(v => { md += `- **${v.ruleName}** — ${v.nodePath}\n  - ${v.evidence}\n` })
  return md
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
  const [copied, setCopied] = useState<string | null>(null)
  const [diffTab, setDiffTab] = useState<'original' | 'violations' | 'governed'>('original')

  useEffect(() => {
    const fixture = getFixture('onboarding')
    if (!fixture) return
    try {
      const policy = loadConfig(DEMO_YAML)
      setConfig(policy)
      const result = scanArtifact(fixture.artifact, policy)
      setScanResult(result)
      const initialReport = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, result, null, policy)
      setScore(initialReport.overallScore)
      setReport(initialReport)
      setPhase('scanned')
    } catch (e) { console.error('Demo scan failed:', e) }
  }, [])

  const handleGovernance = useCallback(() => {
    if (!scanResult || !config) return
    const fixture = getFixture('onboarding')
    if (!fixture) return
    const result = rewriteArtifact(fixture.artifact, scanResult.violations, config)
    setRewriteResult(result)
    const govReport = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, scanResult, result, config)
    setScore(govReport.afterScore)
    setReport(govReport)
    setPhase('governed')
    setDiffTab('original')
  }, [scanResult, config])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const fixture = getFixture('onboarding')
  const violationCount = scanResult?.violations.length || 0
  const navItems = [
    { l: 'Import', h: '/import' }, { l: 'Demo', h: '/demo', a: true },
    { l: 'Playground', h: '/playground' }, { l: 'Governance', h: '/governance' }, { l: 'Integrate', h: '/integrate' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px ${T.greenGlow} } 50% { box-shadow: 0 0 40px ${T.green}44 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 768px) { .demo-hero h1 { font-size: 26px !important; } .demo-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ─── Top Bar ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
          </div>
          <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>muteform</span>
          <span style={{ fontFamily: mono, fontSize: 9, color: T.green, background: T.greenDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.green}33`, letterSpacing: '0.08em' }}>LIVE DEMO</span>
        </div>
        <div className="nav-links" style={{ display: 'flex', gap: 20 }}>
          {navItems.map(n => (
            <a key={n.l} href={n.h} style={{ fontFamily: mono, fontSize: 11, color: n.a ? T.green : T.muted, textDecoration: 'none' }}>{n.l}</a>
          ))}
        </div>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        {navItems.map(n => <a key={n.l} href={n.h} style={{ fontFamily: sans, color: n.a ? T.green : undefined }}>{n.l}</a>)}
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
      <div className="demo-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* LEFT: Score + Violations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
            <ScoreRing score={score} size={100} animate />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.textBright }}>{fixture?.name || 'Onboarding Flow'}</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Source: {fixture?.source || 'Cursor AI output'}</div>
              {report && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {report.categories.map(c => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: T.surface2, border: `1px solid ${T.border}` }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }} />
                      <span style={{ fontFamily: mono, fontSize: 8, color: T.muted }}>{c.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red }}>{c.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {phase === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${T.border}`, borderTopColor: T.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: mono, fontSize: 11, color: T.green, marginLeft: 12, letterSpacing: '0.06em' }}>SCANNING FIXTURE...</span>
            </div>
          )}

          {report && report.violations.length > 0 && phase !== 'governed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.violations.map((v, i) => {
                const sev = GOV_SEV[v.severity]
                return (
                  <div key={v.id} style={{ padding: '12px 16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: sev.color, background: sev.dim, padding: '2px 6px', borderRadius: 3, border: `1px solid ${sev.color}33` }}>{sev.label}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: T.text, flex: 1 }}>{v.ruleName}</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>{v.ruleSource}</span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>{v.nodePath}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginBottom: 6, lineHeight: 1.4 }}>{v.evidence}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {phase === 'scanned' && (
            <button onClick={handleGovernance} style={{
              width: '100%', padding: '16px 0', background: `linear-gradient(135deg, ${T.green}, #00c070)`,
              border: 'none', borderRadius: 10, fontFamily: mono, fontSize: 14, fontWeight: 700,
              color: T.bg, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase',
              boxShadow: `0 0 24px ${T.greenGlow}`, animation: 'glow 2s ease-in-out infinite',
            }}>Apply Governance</button>
          )}

          {phase === 'governed' && report && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ padding: '14px', background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.green }}>{report.autoFixedCount}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.green, letterSpacing: '0.08em', marginTop: 4 }}>✓ AUTO-FIXED</div>
                </div>
                <div style={{ padding: '14px', background: T.amberDim, border: `1px solid ${T.amber}33`, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.amber }}>{report.warningCount}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.amber, letterSpacing: '0.08em', marginTop: 4 }}>⚠ WARNINGS</div>
                </div>
                <div style={{ padding: '14px', background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.red }}>{report.blockedCount}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: T.red, letterSpacing: '0.08em', marginTop: 4 }}>✕ BLOCKED</div>
                </div>
              </div>

              {/* Score Before → After */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <ScoreRing score={report.overallScore} size={80} animate label="before" />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: mono, fontSize: 20, color: T.dim }}>→</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.green, marginTop: 2 }}>+{report.afterScore - report.overallScore} pts</span>
                </div>
                <ScoreRing score={report.afterScore} size={80} animate label="after" />
              </div>

              {/* Ship badge */}
              <div style={{ textAlign: 'center', padding: '14px', background: T.greenDim, borderRadius: 10, border: `1px solid ${T.green}33`, animation: 'glow 2s ease-in-out infinite' }}>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.green, letterSpacing: '0.1em' }}>GOVERNED — READY TO SHIP</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           PHASE 4: GOVERNED UI DIFF — Three-tab view
         ═══════════════════════════════════════════════════════════════ */}
      {phase === 'governed' && report && fixture && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 20px' }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
              {([
                { id: 'original' as const, label: 'Original', icon: '◉' },
                { id: 'violations' as const, label: `Violations (${report.violations.filter(v => !v.fixApplied).length + report.violations.filter(v => v.fixApplied).length})`, icon: '⚡' },
                { id: 'governed' as const, label: 'Governed Output', icon: '✓' },
              ]).map(tab => (
                <button key={tab.id} onClick={() => setDiffTab(tab.id)} style={{
                  flex: 1, padding: '12px 16px', background: diffTab === tab.id ? T.surface2 : 'transparent',
                  border: 'none', borderBottom: diffTab === tab.id ? `2px solid ${diffTab === 'original' ? T.red : diffTab === 'violations' ? T.amber : T.green}` : '2px solid transparent',
                  fontFamily: mono, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  color: diffTab === tab.id ? T.textBright : T.muted, letterSpacing: '0.04em',
                }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: '16px', maxHeight: 500, overflow: 'auto' }}>
              {diffTab === 'original' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Raw Fixture — violations highlighted in red
                  </div>
                  {fixture.artifact.nodes.map(node => (
                    <NodeCard key={node.id} node={node} violations={report.violations} isGoverned={false} />
                  ))}
                </div>
              )}

              {diffTab === 'violations' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    All Violations — visual comparison
                  </div>
                  {(['color_token', 'spacing', 'typography', 'component', 'layout', 'accessibility'] as const).map(type => {
                    const group = report.violations.filter(v => v.type === type)
                    if (group.length === 0) return null
                    const typeLabels: Record<string, string> = { color_token: 'COLOR', spacing: 'SPACING', typography: 'TYPOGRAPHY', component: 'COMPONENT', layout: 'LAYOUT', accessibility: 'ACCESSIBILITY' }
                    return (
                      <div key={type}>
                        <div style={{ fontFamily: mono, fontSize: 10, color: T.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>
                          {typeLabels[type]} ({group.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {group.map(v => <ViolationCard key={v.id} v={v} />)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {diffTab === 'governed' && rewriteResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Governed Output — fixes highlighted in green
                  </div>
                  {rewriteResult.rewrittenArtifact.nodes.map(node => (
                    <NodeCard key={node.id} node={node} violations={report.violations} isGoverned={true} />
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => copyText(JSON.stringify(rewriteResult.rewrittenArtifact, null, 2), 'governed')} style={{
                      flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                      background: copied === 'governed' ? T.greenDim : T.surface2, color: copied === 'governed' ? T.green : T.textBright,
                      border: `1px solid ${copied === 'governed' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
                    }}>{copied === 'governed' ? 'COPIED ✓' : 'Copy Governed Output'}</button>
                    <button onClick={() => copyText(reportToJSON(report), 'dl')} style={{
                      flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                      background: copied === 'dl' ? T.greenDim : T.surface2, color: copied === 'dl' ? T.green : T.textBright,
                      border: `1px solid ${copied === 'dl' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
                    }}>{copied === 'dl' ? 'COPIED ✓' : 'Download Report'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           PHASE 5: ENTERPRISE GOVERNANCE REPORT
         ═══════════════════════════════════════════════════════════════ */}
      {phase === 'governed' && report && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Report Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, background: `linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)` }}>
              <div style={{ fontFamily: syne, fontSize: 18, fontWeight: 700, color: T.textBright, marginBottom: 8 }}>Enterprise Governance Report</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: mono, fontSize: 11 }}>
                <span style={{ color: T.muted }}>Screen: <span style={{ color: T.text }}>{report.fixtureName}</span></span>
                <span style={{ color: T.muted }}>Source: <span style={{ color: T.amber }}>{report.fixtureSource}</span></span>
                <span style={{ color: T.muted }}>Baseline: <span style={{ color: T.blue }}>Acme Design System v2.1</span></span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{new Date(report.timestamp).toLocaleString()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>Governance Score:</span>
                <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.red }}>{report.overallScore}</span>
                <span style={{ fontFamily: mono, fontSize: 14, color: T.dim }}>→</span>
                <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.green }}>{report.afterScore}</span>
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.green, background: T.greenDim, padding: '2px 10px', borderRadius: 4 }}>
                  +{report.afterScore - report.overallScore} points after auto-fix
                </span>
              </div>
            </div>

            {/* Category Scores */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Category Scores</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {[...report.categories, { name: 'Design Principles', key: 'principles', score: 85, color: T.purple }].map(c => (
                  <div key={c.key} style={{ padding: '12px', background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{c.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red }}>{c.score}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: T.border }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${c.score}%`, background: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, transition: 'width 0.6s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ✓ AUTO-FIXED */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✓ AUTO-FIXED ({report.autoFixedCount})
              </div>
              {report.violations.filter(v => v.fixApplied).map(v => (
                <div key={v.id} style={{ padding: '10px 14px', marginBottom: 8, background: T.greenDim, borderRadius: 8, border: `1px solid ${T.green}22` }}>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.green, marginBottom: 4 }}>{v.ruleName}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 4 }}>{v.nodePath}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{v.fixDescription}</div>
                </div>
              ))}
              {report.autoFixedCount === 0 && <div style={{ fontFamily: mono, fontSize: 11, color: T.dim }}>No auto-fixes applied</div>}
            </div>

            {/* ⚠ WARNINGS */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.amber, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠ WARNINGS ({report.warningCount} — review recommended)
              </div>
              {report.violations.filter(v => !v.fixApplied && v.severity === 'warn').map(v => (
                <div key={v.id} style={{ padding: '10px 14px', marginBottom: 8, background: T.amberDim, borderRadius: 8, border: `1px solid ${T.amber}22` }}>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.amber, marginBottom: 4 }}>{v.ruleName}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 4 }}>{v.nodePath}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>{v.evidence}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.amber }}>Recommended: {v.fixDescription}</div>
                </div>
              ))}
              {report.warningCount === 0 && <div style={{ fontFamily: mono, fontSize: 11, color: T.dim }}>No warnings</div>}
            </div>

            {/* ✕ BLOCKED */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✕ BLOCKED ({report.blockedCount} — cannot ship)
              </div>
              {report.violations.filter(v => !v.fixApplied && v.severity === 'block').map(v => (
                <div key={v.id} style={{ padding: '10px 14px', marginBottom: 8, background: T.redDim, borderRadius: 8, border: `1px solid ${T.red}22` }}>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.red, marginBottom: 4 }}>{v.ruleName}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 4 }}>{v.nodePath}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>Why: {v.evidence}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.red }}>Must fix before shipping: {v.fixDescription}</div>
                </div>
              ))}
              {report.blockedCount === 0 && <div style={{ fontFamily: mono, fontSize: 11, color: T.dim }}>No blockers — clear to ship</div>}
            </div>

            {/* Report Footer */}
            <div style={{ padding: '16px 24px', display: 'flex', gap: 10 }}>
              <button onClick={() => copyText(reportToJSON(report), 'json')} style={{
                flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                background: copied === 'json' ? T.greenDim : T.surface2, color: copied === 'json' ? T.green : T.textBright,
                border: `1px solid ${copied === 'json' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
              }}>{copied === 'json' ? 'COPIED ✓' : 'Copy as JSON'}</button>
              <button onClick={() => copyText(reportToMarkdown(report), 'md')} style={{
                flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                background: copied === 'md' ? T.greenDim : T.surface2, color: copied === 'md' ? T.green : T.textBright,
                border: `1px solid ${copied === 'md' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
              }}>{copied === 'md' ? 'COPIED ✓' : 'Copy as Markdown'}</button>
              <button onClick={() => { setCopied('share'); setTimeout(() => setCopied(null), 2000) }} style={{
                flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                background: copied === 'share' ? T.greenDim : T.surface2, color: copied === 'share' ? T.green : T.textBright,
                border: `1px solid ${copied === 'share' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
              }}>{copied === 'share' ? 'Link Copied ✓' : 'Share Report Link'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CTA Section ─── */}
      {phase !== 'governed' && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px', textAlign: 'center' }}>
          <div style={{ padding: '48px 24px', background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`, borderRadius: 16, border: `1px solid ${T.border}` }}>
            <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: T.textBright, letterSpacing: '-0.02em', marginBottom: 8 }}>
              TypeScript for design. Enforced at generation.
            </h2>
            <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, marginBottom: 28, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Define your rules. AI generates, Muteform intercepts. Auto-fix, score, ship.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href="/playground" style={{ display: 'inline-block', fontFamily: mono, fontSize: 13, fontWeight: 600, color: T.bg, background: T.green, padding: '12px 28px', borderRadius: 8, textDecoration: 'none', boxShadow: `0 4px 24px ${T.green}33` }}>Try the Playground →</a>
              <a href="/import" style={{ display: 'inline-block', fontFamily: mono, fontSize: 13, fontWeight: 600, color: T.green, background: 'transparent', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', border: `1px solid ${T.green}44` }}>Import Your System</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
