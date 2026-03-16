'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, ScanResult, RewriteResult, InterfaceDefinition } from '@/lib/engine'
import { getFixture } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'

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
  'auto-fix': { color: 'var(--success)', dim: 'var(--success-dim)', label: 'FIXED', icon: '\u2713' },
  'warn': { color: 'var(--warning)', dim: 'var(--warning-dim)', label: 'WARN', icon: '\u26a0' },
  'block': { color: 'var(--error)', dim: 'var(--error-dim)', label: 'BLOCK', icon: '\u2715' },
}

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
  const col = displayed >= 90 ? 'var(--success)' : displayed >= 60 ? 'var(--warning)' : displayed > 0 ? 'var(--error)' : 'var(--text-muted)'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={6} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s, stroke 0.3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: size * 0.28, fontWeight: 700, color: col, lineHeight: 1 }}>{displayed}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 3 }}>{label || 'health'}</span>
      </div>
    </div>
  )
}

function ViolationCard({ v }: { v: EnrichedViolation }) {
  const sev = GOV_SEV[v.severity]
  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, borderLeft: `3px solid ${sev.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: sev.color, background: sev.dim, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em' }}>{sev.label}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{v.ruleName}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{v.ruleSource}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{v.nodePath}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>{v.evidence}</div>
      {v.type === 'color_token' && (() => {
        const hex = v.evidence.match(/#[0-9a-fA-F]{6}/)?.[0] || '#ff0000'
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: hex, border: '2px solid var(--error)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--error)' }}>{hex}</span>
          </div>
          {v.suggestedFix && <><span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>{'\u2192'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: v.suggestedFix.startsWith('#') ? v.suggestedFix : 'var(--success)', border: '2px solid var(--success)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)' }}>{v.suggestedFix}</span>
          </div></>}
        </div>)
      })()}
      {v.type === 'spacing' && (() => {
        const cur = parseInt(v.evidence.match(/(\d+)/)?.[1] || '10')
        const sug = parseInt(v.suggestedFix?.match(/(\d+)/)?.[1] || String(cur))
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ width: Math.min(cur * 2, 80), height: 12, borderRadius: 3, background: 'var(--error-dim)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--error)' }}>{cur}px</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>{'\u2192'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ width: Math.min(sug * 2, 80), height: 12, borderRadius: 3, background: 'var(--success-dim)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)' }}>{sug}px</span>
          </div>
        </div>)
      })()}
      {v.type === 'typography' && (<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--error-dim)', border: '1px solid var(--error)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--error)' }}>Aa</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--error)', marginTop: 2 }}>{v.evidence.match(/"([^"]+)"/)?.[1] || 'unknown'}</div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>{'\u2192'}</span>
        <div style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--success-dim)', border: '1px solid var(--success)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>Aa</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)', marginTop: 2 }}>{v.suggestedFix || 'approved'}</div>
        </div>
      </div>)}
      {v.type === 'component' && (<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 12px', borderRadius: 6, background: 'var(--error-dim)', color: 'var(--error)', border: '1px solid var(--error)' }}>{v.evidence.match(/"([^"]+)"/)?.[1] || v.evidence}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>{'\u2192'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 12px', borderRadius: 6, background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)' }}>{v.suggestedFix}</span>
      </div>)}
      {v.type === 'layout' && (() => {
        const curCols = parseInt(v.evidence.match(/(\d+)/)?.[1] || '5')
        const sugCols = parseInt(v.suggestedFix?.match(/(\d+)/)?.[1] || '12')
        return (<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${curCols}, 1fr)`, gap: 2, width: 60 }}>
              {Array.from({ length: curCols }).map((_, i) => <div key={i} style={{ height: 12, borderRadius: 2, background: 'var(--error)', opacity: 0.6 }} />)}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--error)' }}>{curCols}-col</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>{'\u2192'}</span>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sugCols}, 1fr)`, gap: 2, width: 60 }}>
              {Array.from({ length: sugCols }).map((_, i) => <div key={i} style={{ height: 12, borderRadius: 2, background: 'var(--success)', opacity: 0.6 }} />)}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)' }}>{sugCols}-col</span>
          </div>
        </div>)
      })()}
    </div>
  )
}

function NodeCard({ node, violations, isGoverned }: { node: any; violations: EnrichedViolation[]; isGoverned: boolean }) {
  const nodeViolations = violations.filter(v => v.nodeId === node.id)
  const hasViolation = nodeViolations.length > 0 && !isGoverned
  const wasFixed = isGoverned && nodeViolations.some(v => v.fixApplied)
  const borderColor = hasViolation ? 'var(--error)' : wasFixed ? 'var(--success)' : 'var(--border)'
  return (
    <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: `1px solid ${borderColor}`, borderBottom: hasViolation ? '3px solid var(--error)' : wasFixed ? '3px solid var(--success)' : `1px solid ${borderColor}`, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 3 }}>{node.type}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>{node.path}</span>
        {hasViolation && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--error)', background: 'var(--error-dim)', padding: '1px 6px', borderRadius: 3 }}>{nodeViolations.length} violation{nodeViolations.length > 1 ? 's' : ''}</span>}
        {wasFixed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--success)', background: 'var(--success-dim)', padding: '1px 6px', borderRadius: 3 }}>FIXED</span>}
      </div>
      {node.properties.colors && (<div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        {Object.entries(node.properties.colors).map(([k, v]: [string, any]) => (<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: v, border: '1px solid var(--border-strong)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>{v}</span>
        </div>))}
      </div>)}
      {node.properties.component && (<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a855f7', background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 3, marginTop: 4, display: 'inline-block' }}>{node.properties.component.name}: {node.properties.component.variant}</span>)}
      {hasViolation && nodeViolations.map(v => (<div key={v.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--error)', marginTop: 4, padding: '4px 8px', background: 'var(--error-dim)', borderRadius: 4 }}>{v.ruleName}: {v.evidence}</div>))}
      {wasFixed && nodeViolations.filter(v => v.fixApplied).map(v => (<div key={v.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)', marginTop: 4, padding: '4px 8px', background: 'var(--success-dim)', borderRadius: 4 }}>{v.fixDescription}</div>))}
    </div>
  )
}

function reportToMarkdown(report: GovernanceReport): string {
  let md = `# Governance Report\n\n`
  md += `**Screen:** ${report.fixtureName}\n**Source:** ${report.fixtureSource}\n**Baseline:** Acme Design System v2.1\n**Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n**Score:** ${report.overallScore} \u2192 ${report.afterScore} (+${report.afterScore - report.overallScore} pts)\n\n`
  md += `## Category Scores\n\n`
  report.categories.forEach(c => { md += `- ${c.name}: ${c.score}/100\n` })
  md += `\n## Auto-Fixed (${report.autoFixedCount})\n\n`
  report.violations.filter(v => v.fixApplied).forEach(v => { md += `- **${v.ruleName}** \u2014 ${v.nodePath}\n  - ${v.fixDescription}\n` })
  md += `\n## Warnings (${report.warningCount})\n\n`
  report.violations.filter(v => !v.fixApplied && v.severity === 'warn').forEach(v => { md += `- **${v.ruleName}** \u2014 ${v.nodePath}\n  - ${v.evidence}\n` })
  md += `\n## Blocked (${report.blockedCount})\n\n`
  report.violations.filter(v => !v.fixApplied && v.severity === 'block').forEach(v => { md += `- **${v.ruleName}** \u2014 ${v.nodePath}\n  - ${v.evidence}\n` })
  return md
}

function runInitialScan() {
  const fixture = getFixture('onboarding')
  if (!fixture) return null
  const policy = loadConfig(DEMO_YAML)
  const result = scanArtifact(fixture.artifact, policy)
  const initialReport = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, result, null, policy)
  return { policy, result, initialReport }
}

export default function DemoPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [initial] = useState(runInitialScan)
  const [scanResult, setScanResult] = useState<ScanResult | null>(initial?.result ?? null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(initial?.initialReport ?? null)
  const [config, setConfig] = useState<MuteformConfig | null>(initial?.policy ?? null)
  const [score, setScore] = useState(initial?.initialReport?.overallScore ?? 0)
  const [phase, setPhase] = useState<'loading' | 'scanned' | 'governed'>(initial ? 'scanned' : 'loading')
  const [copied, setCopied] = useState<string | null>(null)
  const [diffTab, setDiffTab] = useState<'original' | 'violations' | 'governed'>('original')

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

  const copyText = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000) }

  const fixture = getFixture('onboarding')
  const violationCount = scanResult?.violations.length || 0
  const navItems = [
    { l: 'Import', h: '/import' }, { l: 'Demo', h: '/demo', a: true },
    { l: 'Playground', h: '/playground' }, { l: 'Governance', h: '/governance' }, { l: 'Integrate', h: '/integrate' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px var(--success-dim) } 50% { box-shadow: 0 0 40px var(--success-dim) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 768px) { .demo-hero h1 { font-size: 26px !important; } .demo-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 800, color: 'var(--bg)' }}>M</span>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>muteform</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)', background: 'var(--success-dim)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--success)', letterSpacing: '0.08em' }}>LIVE DEMO</span>
        </div>
        <div className="nav-links" style={{ display: 'flex', gap: 20 }}>
          {navItems.map(n => (<a key={n.l} href={n.h} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: n.a ? 'var(--success)' : 'var(--text-muted)', textDecoration: 'none' }}>{n.l}</a>))}
        </div>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        {navItems.map(n => <a key={n.l} href={n.h} style={{ fontFamily: 'var(--font-sans)', color: n.a ? 'var(--success)' : undefined }}>{n.l}</a>)}
      </div>
      <div className="demo-hero" style={{ padding: '36px 20px 24px', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>Design governance for<br />AI-generated interfaces</h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>Scanning: <strong style={{ color: 'var(--text-primary)' }}>Onboarding Flow</strong> from <strong style={{ color: 'var(--warning)' }}>Cursor AI</strong> {'\u2014'} {violationCount} violations detected</p>
      </div>
      <div className="demo-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <ScoreRing score={score} size={100} animate />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{fixture?.name || 'Onboarding Flow'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Source: {fixture?.source || 'Cursor AI output'}</div>
              {report && (<div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {report.categories.map(c => (<div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>{c.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: c.score >= 90 ? 'var(--success)' : c.score >= 60 ? 'var(--warning)' : 'var(--error)' }}>{c.score}</span>
                </div>))}
              </div>)}
            </div>
          </div>
          {phase === 'loading' && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--success)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--success)', marginLeft: 12, letterSpacing: '0.06em' }}>SCANNING FIXTURE...</span>
          </div>)}
          {report && report.violations.length > 0 && phase !== 'governed' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.violations.map((v, i) => { const sev = GOV_SEV[v.severity]; return (
              <div key={v.id} style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: sev.color, background: sev.dim, padding: '2px 6px', borderRadius: 3 }}>{sev.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>{v.ruleName}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{v.ruleSource}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{v.nodePath}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.4 }}>{v.evidence}</div>
              </div>) })}
          </div>)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {phase === 'scanned' && (<button onClick={handleGovernance} style={{ width: '100%', padding: '16px 0', background: 'linear-gradient(135deg, var(--success), #00c070)', border: 'none', borderRadius: 10, fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--bg)', cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase', boxShadow: '0 0 24px var(--success-dim)', animation: 'glow 2s ease-in-out infinite' }}>Apply Governance</button>)}
          {phase === 'governed' && report && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ padding: '14px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{report.autoFixedCount}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)', letterSpacing: '0.08em', marginTop: 4 }}>{'\u2713'} AUTO-FIXED</div>
              </div>
              <div style={{ padding: '14px', background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{report.warningCount}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--warning)', letterSpacing: '0.08em', marginTop: 4 }}>{'\u26a0'} WARNINGS</div>
              </div>
              <div style={{ padding: '14px', background: 'var(--error-dim)', border: '1px solid var(--error)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--error)' }}>{report.blockedCount}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--error)', letterSpacing: '0.08em', marginTop: 4 }}>{'\u2715'} BLOCKED</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <ScoreRing score={report.overallScore} size={80} animate label="before" />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--text-muted)' }}>{'\u2192'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--success)', marginTop: 2 }}>+{report.afterScore - report.overallScore} pts</span>
              </div>
              <ScoreRing score={report.afterScore} size={80} animate label="after" />
            </div>
            <div style={{ textAlign: 'center', padding: '14px', background: 'var(--success-dim)', borderRadius: 10, border: '1px solid var(--success)', animation: 'glow 2s ease-in-out infinite' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--success)', letterSpacing: '0.1em' }}>GOVERNED {'\u2014'} READY TO SHIP</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/report" style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 4, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--bg)', background: 'var(--accent)', textDecoration: 'none', transition: 'all 150ms ease' }}>View full report {'\u2192'}</a>
              <a href="/demo" style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 4, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'all 150ms ease' }} onClick={(e) => { e.preventDefault(); window.location.reload() }}>Scan another {'\u2192'}</a>
            </div>
          </>)}
        </div>
      </div>
      {phase === 'governed' && report && fixture && (<div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {([{ id: 'original' as const, label: 'Original', icon: '\u25c9' }, { id: 'violations' as const, label: `Violations (${report.violations.filter(v => !v.fixApplied).length + report.violations.filter(v => v.fixApplied).length})`, icon: '\u26a1' }, { id: 'governed' as const, label: 'Governed Output', icon: '\u2713' }]).map(tab => (
              <button key={tab.id} onClick={() => setDiffTab(tab.id)} style={{ flex: 1, padding: '12px 16px', background: diffTab === tab.id ? 'var(--surface-elevated)' : 'transparent', border: 'none', borderBottom: diffTab === tab.id ? `2px solid ${diffTab === 'original' ? 'var(--error)' : diffTab === 'violations' ? 'var(--warning)' : 'var(--success)'}` : '2px solid transparent', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: diffTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.04em' }}>{tab.icon} {tab.label}</button>))}
          </div>
          <div style={{ padding: '16px', maxHeight: 500, overflow: 'auto' }}>
            {diffTab === 'original' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Raw Fixture {'\u2014'} violations highlighted in red</div>
              {fixture.artifact.nodes.map(node => (<NodeCard key={node.id} node={node} violations={report.violations} isGoverned={false} />))}
            </div>)}
            {diffTab === 'violations' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>All Violations {'\u2014'} visual comparison</div>
              {(['color_token', 'spacing', 'typography', 'component', 'layout', 'accessibility'] as const).map(type => {
                const group = report.violations.filter(v => v.type === type); if (group.length === 0) return null
                const typeLabels: Record<string, string> = { color_token: 'COLOR', spacing: 'SPACING', typography: 'TYPOGRAPHY', component: 'COMPONENT', layout: 'LAYOUT', accessibility: 'ACCESSIBILITY' }
                return (<div key={type}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>{typeLabels[type]} ({group.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{group.map(v => <ViolationCard key={v.id} v={v} />)}</div>
                </div>)
              })}
            </div>)}
            {diffTab === 'governed' && rewriteResult && (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Governed Output {'\u2014'} fixes highlighted in green</div>
              {rewriteResult.rewrittenArtifact.nodes.map(node => (<NodeCard key={node.id} node={node} violations={report.violations} isGoverned={true} />))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => copyText(JSON.stringify(rewriteResult.rewrittenArtifact, null, 2), 'governed')} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer', background: copied === 'governed' ? 'var(--success-dim)' : 'var(--surface-elevated)', color: copied === 'governed' ? 'var(--success)' : 'var(--text-primary)', border: copied === 'governed' ? '1px solid var(--success)' : '1px solid var(--border)', letterSpacing: '0.06em' }}>{copied === 'governed' ? 'COPIED \u2713' : 'Copy Governed Output'}</button>
                <button onClick={() => copyText(reportToJSON(report), 'dl')} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer', background: copied === 'dl' ? 'var(--success-dim)' : 'var(--surface-elevated)', color: copied === 'dl' ? 'var(--success)' : 'var(--text-primary)', border: copied === 'dl' ? '1px solid var(--success)' : '1px solid var(--border)', letterSpacing: '0.06em' }}>{copied === 'dl' ? 'COPIED \u2713' : 'Download Report'}</button>
              </div>
            </div>)}
          </div>
        </div>
      </div>)}
      {phase === 'governed' && report && (<div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--surface-elevated) 0%, var(--surface) 100%)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Enterprise Governance Report</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>Screen: <span style={{ color: 'var(--text-primary)' }}>{report.fixtureName}</span></span>
              <span style={{ color: 'var(--text-muted)' }}>Source: <span style={{ color: 'var(--warning)' }}>{report.fixtureSource}</span></span>
              <span style={{ color: 'var(--text-muted)' }}>Baseline: <span style={{ color: 'var(--accent)' }}>Acme Design System v2.1</span></span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(report.timestamp).toLocaleString()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Governance Score:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--error)' }}>{report.overallScore}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-muted)' }}>{'\u2192'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{report.afterScore}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--success)', background: 'var(--success-dim)', padding: '2px 10px', borderRadius: 4 }}>+{report.afterScore - report.overallScore} points after auto-fix</span>
            </div>
          </div>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Category Scores</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {[...report.categories, { name: 'Design Principles', key: 'principles', score: 85, color: '#a855f7' }].map(c => (<div key={c.key} style={{ padding: '12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{c.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: c.score >= 90 ? 'var(--success)' : c.score >= 60 ? 'var(--warning)' : 'var(--error)' }}>{c.score}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${c.score}%`, background: c.score >= 90 ? 'var(--success)' : c.score >= 60 ? 'var(--warning)' : 'var(--error)', transition: 'width 0.6s' }} />
                </div>
              </div>))}
            </div>
          </div>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>{'\u2713'} AUTO-FIXED ({report.autoFixedCount})</div>
            {report.violations.filter(v => v.fixApplied).map(v => (<div key={v.id} style={{ padding: '10px 14px', marginBottom: 8, background: 'var(--success-dim)', borderRadius: 8, border: '1px solid var(--success)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>{v.ruleName}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{v.nodePath}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{v.fixDescription}</div>
            </div>))}
            {report.autoFixedCount === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>No auto-fixes applied</div>}
          </div>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>{'\u26a0'} WARNINGS ({report.warningCount} {'\u2014'} review recommended)</div>
            {report.violations.filter(v => !v.fixApplied && v.severity === 'warn').map(v => (<div key={v.id} style={{ padding: '10px 14px', marginBottom: 8, background: 'var(--warning-dim)', borderRadius: 8, border: '1px solid var(--warning)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>{v.ruleName}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{v.nodePath}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{v.evidence}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warning)' }}>Recommended: {v.fixDescription}</div>
            </div>))}
            {report.warningCount === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>No warnings</div>}
          </div>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--error)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>{'\u2715'} BLOCKED ({report.blockedCount} {'\u2014'} cannot ship)</div>
            {report.violations.filter(v => !v.fixApplied && v.severity === 'block').map(v => (<div key={v.id} style={{ padding: '10px 14px', marginBottom: 8, background: 'var(--error-dim)', borderRadius: 8, border: '1px solid var(--error)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--error)', marginBottom: 4 }}>{v.ruleName}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{v.nodePath}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Why: {v.evidence}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--error)' }}>Must fix before shipping: {v.fixDescription}</div>
            </div>))}
            {report.blockedCount === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>No blockers {'\u2014'} clear to ship</div>}
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', gap: 10 }}>
            <button onClick={() => copyText(reportToJSON(report), 'json')} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer', background: copied === 'json' ? 'var(--success-dim)' : 'var(--surface-elevated)', color: copied === 'json' ? 'var(--success)' : 'var(--text-primary)', border: copied === 'json' ? '1px solid var(--success)' : '1px solid var(--border)', letterSpacing: '0.06em' }}>{copied === 'json' ? 'COPIED \u2713' : 'Copy as JSON'}</button>
            <button onClick={() => copyText(reportToMarkdown(report), 'md')} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer', background: copied === 'md' ? 'var(--success-dim)' : 'var(--surface-elevated)', color: copied === 'md' ? 'var(--success)' : 'var(--text-primary)', border: copied === 'md' ? '1px solid var(--success)' : '1px solid var(--border)', letterSpacing: '0.06em' }}>{copied === 'md' ? 'COPIED \u2713' : 'Copy as Markdown'}</button>
            <button onClick={() => { setCopied('share'); setTimeout(() => setCopied(null), 2000) }} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer', background: copied === 'share' ? 'var(--success-dim)' : 'var(--surface-elevated)', color: copied === 'share' ? 'var(--success)' : 'var(--text-primary)', border: copied === 'share' ? '1px solid var(--success)' : '1px solid var(--border)', letterSpacing: '0.06em' }}>{copied === 'share' ? 'Link Copied \u2713' : 'Share Report Link'}</button>
          </div>
        </div>
      </div>)}
      {phase !== 'governed' && (<div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px', textAlign: 'center' }}>
        <div style={{ padding: '48px 24px', background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>TypeScript for design. Enforced at generation.</h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 28, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>Define your rules. AI generates, Muteform intercepts. Auto-fix, score, ship.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/playground" style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--bg)', background: 'var(--success)', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', boxShadow: '0 4px 24px var(--success-dim)' }}>Try the Playground {'\u2192'}</a>
            <a href="/import" style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--success)', background: 'transparent', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', border: '1px solid var(--success)' }}>Import Your System</a>
          </div>
        </div>
      </div>)}
    </div>
  )
}
