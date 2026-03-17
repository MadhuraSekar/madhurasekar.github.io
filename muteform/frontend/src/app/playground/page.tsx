'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/Header'
import { tokens } from '@/lib/design-tokens'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, ScanResult, RewriteResult } from '@/lib/engine'
import { FIXTURES, getFixture } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'
import { saveReport } from '@/lib/session'

const T = tokens
const mono = T.fontMono
const syne = T.fontDisplay

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
  return `name: "Acme Design System"\nversion: "1.0.0"\n\ntokens:\n  colors:\n    primary: "#0055FF"\n    neutral900: "#111111"\n    success: "#22c55e"\n    warning: "#f59e0b"\n    accent: "#9ca3af"\n  spacing:\n    scale: [4, 8, 12, 16, 24, 32, 48, 64]\n  typography:\n    families:\n      display: "Instrument Serif"\n      body: "DM Sans"\n      mono: "JetBrains Mono"\n    allowed_styles: [h1, h2, h3, body, body-sm, caption, label]\n  components:\n    button:\n      allowed_variants: [primary, secondary]\n      allowed_sizes: [sm, md, lg]\n  layout:\n    grid_columns: [4, 8, 12]\n\nrules:\n${rulesYaml}`
}

const GOV_SEV: Record<GovernanceSeverity, { color: string; dim: string; label: string }> = {
  'auto-fix': { color: T.green, dim: T.greenDim, label: 'FIXED' },
  'warn': { color: T.amber, dim: T.amberDim, label: 'WARN' },
  'block': { color: T.red, dim: T.redDim, label: 'BLOCK' },
}

function severityColor(s: string): string {
  switch (s) { case 'critical': return T.red; case 'high': return '#f97316'; case 'medium': return T.amber; default: return T.textMuted }
}
function scoreColor(score: number): string {
  if (score < 50) return T.red; if (score < 80) return T.amber; return T.green
}

/* ─── Fixture wireframe previews ─── */
const FIXTURE_ICONS: Record<string, { icon: string; meta: string }> = {
  dashboard: { icon: '▦', meta: 'nodes: 24 · platform: web · source: claude-code' },
  onboarding: { icon: '◎', meta: 'nodes: 18 · platform: web · source: cursor-ai' },
  settings: { icon: '⚙', meta: 'nodes: 12 · platform: web · source: v0' },
  checkout: { icon: '▤', meta: 'nodes: 20 · platform: web · source: claude-code' },
}

/* ─── ScoreRing ─── */
function ScoreRing({ score, size = 140, label }: { score: number; size?: number; label?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef<number>()
  useEffect(() => {
    setDisplayed(0)
    const start = performance.now()
    const run = (now: number) => {
      const t = Math.min((now - start) / 1000, 1)
      setDisplayed(Math.round((1 - Math.pow(1 - t, 3)) * score))
      if (t < 1) animRef.current = requestAnimationFrame(run)
    }
    animRef.current = requestAnimationFrame(run)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score])
  const r = (size - 14) / 2, circ = 2 * Math.PI * r
  const offset = circ - (circ * displayed) / 100
  const color = scoreColor(displayed)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.border} strokeWidth={7} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke 0.3s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.28, fontWeight: 700, color, lineHeight: 1 }}>{displayed}</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>{label || 'health'}</span>
      </div>
    </div>
  )
}

/* ─── ValuePreview ─── */
function ValuePreview({ property, value }: { property: string; value: any }) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (property.startsWith('colors.') && typeof value === 'string' && value.startsWith('#')) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 14, height: 14, background: value, borderRadius: 3, border: `1px solid ${T.border2}` }} /><span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{value}</span></span>
  }
  if (property.startsWith('spacing.')) {
    const num = parseInt(str, 10)
    if (!isNaN(num)) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: Math.min(num * 1.5, 80), height: 8, background: T.blue, borderRadius: 2, opacity: 0.7 }} /><span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{str}</span></span>
  }
  return <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{str}</span>
}

/* ─── reportToMarkdown ─── */
function reportToMarkdown(report: GovernanceReport): string {
  let md = `# Governance Report\n\n**Screen:** ${report.fixtureName}\n**Source:** ${report.fixtureSource}\n**Score:** ${report.overallScore} → ${report.afterScore}\n\n`
  md += `## Auto-Fixed (${report.autoFixedCount})\n\n`
  report.violations.filter(v => v.fixApplied).forEach(v => { md += `- **${v.ruleName}** — ${v.nodePath}: ${v.fixDescription}\n` })
  md += `\n## Warnings (${report.warningCount})\n\n`
  report.violations.filter(v => !v.fixApplied && v.severity === 'warn').forEach(v => { md += `- **${v.ruleName}** — ${v.nodePath}: ${v.evidence}\n` })
  md += `\n## Blocked (${report.blockedCount})\n\n`
  report.violations.filter(v => !v.fixApplied && v.severity === 'block').forEach(v => { md += `- **${v.ruleName}** — ${v.nodePath}: ${v.evidence}\n` })
  return md
}

/* ─── ViolationCard ─── */
function ViolationCard({ v }: { v: EnrichedViolation }) {
  const sev = GOV_SEV[v.severity]
  return (
    <div style={{ padding: '10px 12px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, borderLeft: `3px solid ${sev.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: sev.color, background: sev.dim, padding: '1px 5px', borderRadius: 3 }}>{sev.label}</span>
        <span style={{ fontFamily: syne, fontSize: 10, fontWeight: 600, color: T.text, flex: 1 }}>{v.ruleName}</span>
        <span style={{ fontFamily: mono, fontSize: 8, color: T.textDim }}>{v.ruleSource}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 9, color: T.textDim }}>{v.nodePath}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, marginTop: 3 }}>{v.evidence}</div>
      {v.type === 'color_token' && (() => {
        const hex = v.evidence.match(/#[0-9a-fA-F]{6}/)?.[0] || '#ff0000'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 4, background: hex, border: `2px solid ${T.red}` }} />
            {v.suggestedFix && <><span style={{ fontFamily: mono, fontSize: 12, color: T.textDim }}>→</span><div style={{ width: 24, height: 24, borderRadius: 4, background: v.suggestedFix.startsWith('#') ? v.suggestedFix : T.green, border: `2px solid ${T.green}` }} /></>}
          </div>
        )
      })()}
      {v.type === 'spacing' && (() => {
        const cur = parseInt(v.evidence.match(/(\d+)/)?.[1] || '10')
        const sug = parseInt(v.suggestedFix?.match(/(\d+)/)?.[1] || String(cur))
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ width: Math.min(cur * 1.5, 50), height: 8, borderRadius: 2, background: `${T.red}80` }} />
            <span style={{ fontFamily: mono, fontSize: 9, color: T.textDim }}>→</span>
            <div style={{ width: Math.min(sug * 1.5, 50), height: 8, borderRadius: 2, background: `${T.green}80` }} />
          </div>
        )
      })()}
      {v.type === 'component' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 3, background: T.redDim, color: T.red }}>{v.evidence.match(/"([^"]+)"/)?.[1] || 'unknown'}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.textDim }}>→</span>
          <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 3, background: T.greenDim, color: T.green }}>{v.suggestedFix}</span>
        </div>
      )}
    </div>
  )
}

/* ─── NodeCard for diff tabs ─── */
function NodeCard({ node, violations, isGoverned }: { node: any; violations: EnrichedViolation[]; isGoverned: boolean }) {
  const nodeViolations = violations.filter(v => v.nodeId === node.id)
  const hasViolation = nodeViolations.length > 0 && !isGoverned
  const wasFixed = isGoverned && nodeViolations.some(v => v.fixApplied)
  return (
    <div style={{
      padding: '8px 12px', background: T.surface, borderRadius: 6,
      border: `1px solid ${hasViolation ? T.red : wasFixed ? T.green : T.border}`,
      borderBottom: hasViolation ? `3px solid ${T.red}` : wasFixed ? `3px solid ${T.green}` : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontFamily: mono, fontSize: 9, color: T.blue, background: T.blueDim, padding: '1px 5px', borderRadius: 3 }}>{node.type}</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, flex: 1 }}>{node.path}</span>
        {hasViolation && <span style={{ fontFamily: mono, fontSize: 8, color: T.red, background: T.redDim, padding: '1px 5px', borderRadius: 3 }}>{nodeViolations.length} issue{nodeViolations.length > 1 ? 's' : ''}</span>}
        {wasFixed && <span style={{ fontFamily: mono, fontSize: 8, color: T.green, background: T.greenDim, padding: '1px 5px', borderRadius: 3 }}>FIXED</span>}
      </div>
      {hasViolation && nodeViolations.map(v => (
        <div key={v.id} style={{ fontFamily: mono, fontSize: 8, color: T.red, marginTop: 3, padding: '3px 6px', background: T.redDim, borderRadius: 3 }}>{v.ruleName}: {v.evidence}</div>
      ))}
      {wasFixed && nodeViolations.filter(v => v.fixApplied).map(v => (
        <div key={v.id} style={{ fontFamily: mono, fontSize: 8, color: T.green, marginTop: 3, padding: '3px 6px', background: T.greenDim, borderRadius: 3 }}>{v.fixDescription}</div>
      ))}
    </div>
  )
}

/* ─── Interface Wireframe Preview ─── */
function InterfacePreview({ fixtureId, scanning, scanProgress }: { fixtureId: string; scanning: boolean; scanProgress: number }) {
  const fixture = getFixture(fixtureId)
  if (!fixture) return null
  const wireframe = fixture.wireframe
  // Wireframe items have x, y, w, h as percentages
  const maxH = Math.max(...wireframe.map((b: any) => (b.y || 0) + (b.h || 5))) + 2
  return (
    <div style={{ position: 'relative', background: '#0a0b0d', border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, overflow: 'hidden' }}>
      {/* Browser chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        <div style={{ flex: 1, fontFamily: mono, fontSize: 9, color: T.textDim, textAlign: 'center', background: T.surface, padding: '3px 12px', borderRadius: 4 }}>
          acme.com/{fixtureId}
        </div>
      </div>
      {/* Wireframe blocks (positioned) */}
      <div style={{ position: 'relative', height: maxH * 2.2, overflow: 'hidden' }}>
        {wireframe.map((block: any, i: number) => {
          const yPos = (block.y || 0) / maxH
          const isScanned = scanning && scanProgress > yPos
          return (
            <div key={block.id || i} style={{
              position: 'absolute',
              left: `${block.x || 0}%`, top: `${((block.y || 0) / maxH) * 100}%`,
              width: `${block.w || 10}%`, height: `${((block.h || 4) / maxH) * 100}%`,
              background: isScanned ? `${T.green}25` : (block.color || `${T.textDim}30`),
              borderRadius: 2,
              opacity: scanning ? (isScanned ? 1 : 0.25) : 0.5,
              transition: 'opacity 0.3s ease, background 0.3s ease',
            }} />
          )
        })}
      </div>
      {/* Scan line */}
      {scanning && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${T.green}, transparent)`,
          top: `${Math.max(50, scanProgress * 100)}%`,
          transition: 'top 0.1s linear',
          boxShadow: `0 0 12px ${T.green}`,
        }} />
      )}
    </div>
  )
}

export default function PlaygroundPage() {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [yamlText, setYamlText] = useState(buildYaml(DEFAULT_RULES))
  const [savedYaml, setSavedYaml] = useState(buildYaml(DEFAULT_RULES))
  const [selectedFixture, setSelectedFixture] = useState<string>('checkout')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [diffTab, setDiffTab] = useState<'original' | 'violations' | 'governed'>('original')

  // Scanning animation state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [visibleViolations, setVisibleViolations] = useState(0)
  const [showScore, setShowScore] = useState(false)

  // Auto-fix animation state
  const [fixing, setFixing] = useState(false)
  const [fixedCount, setFixedCount] = useState(0)

  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  const hasUnsavedChanges = yamlText !== savedYaml

  const runScanInternal = useCallback((yaml: string, fixtureId: string) => {
    setError(null)
    try {
      const policy = loadConfig(yaml)
      const fixture = getFixture(fixtureId)
      if (!fixture) { setError(`Fixture "${fixtureId}" not found.`); return null }
      const result = scanArtifact(fixture.artifact, policy)
      const r = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, result, null, policy)
      return { result, report: r }
    } catch (e: any) { setError(e.message || 'Failed to parse YAML or run scan.'); return null }
  }, [])

  const handleScan = useCallback(() => {
    setSavedYaml(yamlText)
    setRewriteResult(null); setReport(null); setScanResult(null)
    setShowResults(false); setVisibleViolations(0); setShowScore(false)
    setScanning(true); setScanProgress(0)

    // Phase 1: Scanning animation (1.8s)
    const scanDuration = 1800
    const scanStart = Date.now()
    const scanInterval = setInterval(() => {
      const elapsed = Date.now() - scanStart
      const progress = Math.min(elapsed / scanDuration, 1)
      setScanProgress(progress)
      if (progress >= 1) {
        clearInterval(scanInterval)
        setScanning(false)

        // Actually run the scan
        const scanData = runScanInternal(yamlText, selectedFixture)
        if (scanData) {
          setScanResult(scanData.result)
          setReport(scanData.report)

          // Phase 2: Stagger violations appearance
          setShowResults(true)
          const vCount = scanData.result.violations.length
          let shown = 0
          const violationInterval = setInterval(() => {
            shown++
            setVisibleViolations(shown)
            if (shown >= vCount) {
              clearInterval(violationInterval)
              // Phase 3: Show score
              setTimeout(() => setShowScore(true), 300)
            }
          }, 120)
        }
      }
    }, 16)
  }, [yamlText, selectedFixture, runScanInternal])

  const handleToggleRule = (ruleId: string) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    const newYaml = buildYaml(updated)
    setYamlText(newYaml)
  }

  const handleFixtureSelect = (id: string) => {
    setSelectedFixture(id); setRewriteResult(null); setReport(null); setScanResult(null)
    setShowResults(false); setShowScore(false); setVisibleViolations(0)
  }

  const handleApplyGovernance = useCallback(() => {
    if (!scanResult) return
    setFixing(true); setFixedCount(0)
    const fixableCount = scanResult.violations.filter(v => v.autoFixAvailable).length
    let fixed = 0
    const fixInterval = setInterval(() => {
      fixed++
      setFixedCount(fixed)
      if (fixed >= fixableCount) {
        clearInterval(fixInterval)
        setTimeout(() => {
          try {
            const policy = loadConfig(yamlText)
            const fixture = getFixture(selectedFixture)
            if (!fixture) return
            const result = rewriteArtifact(fixture.artifact, scanResult.violations, policy)
            setRewriteResult(result)
            const r = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, scanResult, result, policy)
            setReport(r)
            saveReport(r)
            setDiffTab('original')
          } catch (e: any) { setError(e.message) }
          setFixing(false)
        }, 400)
      }
    }, 350)
  }, [scanResult, yamlText, selectedFixture])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const fixture = getFixture(selectedFixture)
  const fixtureInfo = FIXTURE_ICONS[selectedFixture] || { icon: '◉', meta: '' }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: mono }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes scanGlow { 0%, 100% { box-shadow: 0 0 20px ${T.greenDim}; } 50% { box-shadow: 0 0 40px ${T.greenDim}; } }
        @keyframes fixFlash { 0% { background: ${T.greenDim}; } 50% { background: ${T.green}33; } 100% { background: ${T.greenDim}; } }
        @media (max-width: 900px) { .pg-split { flex-direction: column !important; } .pg-left, .pg-right { width: 100% !important; border-right: none !important; } }
      `}</style>

      <Header />

      <div className="pg-split" style={{ display: 'flex', gap: 0, maxWidth: 1440, margin: '0 auto', minHeight: 'calc(100vh - 52px)' }}>
        {/* ═══ LEFT PANEL (dark editor side) ═══ */}
        <div className="pg-left" style={{ width: '42%', padding: '20px 16px 20px 24px', borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', background: T.bg }}>

          {/* Rules toggles */}
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Rules ({rules.filter(r => r.enabled).length} active)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rules.map(r => (
                <div key={r.id} style={{
                  background: r.enabled ? T.surface : T.bg, border: `1px solid ${r.enabled ? T.border2 : T.border}`,
                  borderRadius: 8, overflow: 'hidden', transition: 'all 0.2s',
                }}>
                  <div onClick={() => handleToggleRule(r.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer',
                  }}>
                    {/* Toggle switch */}
                    <div style={{
                      width: 28, height: 16, borderRadius: 8, position: 'relative', flexShrink: 0,
                      background: r.enabled ? T.green : T.border2, transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute',
                        top: 2, left: r.enabled ? 14 : 2, transition: 'left 0.2s',
                      }} />
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 10, color: r.enabled ? T.text : T.textDim, flex: 1 }}>{r.id}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: severityColor(r.severity), padding: '1px 6px', borderRadius: 3, background: `${severityColor(r.severity)}18`, textTransform: 'uppercase' }}>{r.severity}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, color: T.textDim, padding: '1px 5px', borderRadius: 3, background: r.auto_fix !== 'false' ? T.greenDim : T.amberDim, }}>{r.auto_fix !== 'false' ? 'auto-fix' : 'manual'}</span>
                    <button onClick={(e) => { e.stopPropagation(); setExpandedRule(expandedRule === r.id ? null : r.id) }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, fontSize: 10, padding: '0 4px',
                      transform: expandedRule === r.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s',
                    }}>▾</button>
                  </div>
                  {expandedRule === r.id && (
                    <div style={{ padding: '0 10px 8px', fontFamily: mono, fontSize: 9, color: T.textMuted, lineHeight: 1.5, borderTop: `1px solid ${T.border}` }}>
                      <div style={{ padding: '6px 0' }}>{r.description}</div>
                      <div style={{ color: T.textDim }}>Check: <span style={{ color: T.blue }}>{r.check}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* YAML Editor */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2 }}>Policy YAML</span>
              {hasUnsavedChanges && (
                <span style={{ fontFamily: mono, fontSize: 8, color: T.amber, background: T.amberDim, padding: '1px 6px', borderRadius: 3, border: `1px solid ${T.amber}33` }}>unsaved</span>
              )}
            </div>
            <div style={{ position: 'relative', background: '#0d0e10', border: `1px solid ${hasUnsavedChanges ? T.amber + '44' : T.border}`, borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              {/* Line numbers + textarea */}
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '14px 0 14px 12px', fontFamily: mono, fontSize: 12, lineHeight: 1.7, color: T.textDim, userSelect: 'none', textAlign: 'right', minWidth: 32 }}>
                  {yamlText.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea value={yamlText} onChange={e => setYamlText(e.target.value)} spellCheck={false} style={{
                  flex: 1, minHeight: 260, background: 'transparent', color: T.text, fontFamily: mono, fontSize: 12, lineHeight: 1.7,
                  border: 'none', outline: 'none', padding: '14px 14px 14px 8px', resize: 'vertical', caretColor: T.green,
                }} />
              </div>
            </div>
          </div>

          {/* Fixture selector */}
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Interface Under Test</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {FIXTURES.map(f => {
                const active = f.id === selectedFixture
                const info = FIXTURE_ICONS[f.id] || { icon: '◉', meta: '' }
                return (
                  <button key={f.id} onClick={() => handleFixtureSelect(f.id)} style={{
                    padding: '10px 12px', background: active ? T.surface2 : T.surface,
                    border: `1px solid ${active ? T.blue : T.border}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16, opacity: 0.6 }}>{info.icon}</span>
                      <div>
                        <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: active ? T.blue : T.text }}>{f.name}</div>
                        <div style={{ fontFamily: mono, fontSize: 8, color: active ? T.blue : T.textDim, marginTop: 2 }}>{f.source} · {f.nodeCount} nodes</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* RUN SCAN button */}
          <button onClick={handleScan} disabled={scanning} style={{
            width: '100%', padding: '14px 0',
            background: scanning ? T.surface2 : `linear-gradient(135deg, ${T.green}, #00c070)`,
            border: scanning ? `1px solid ${T.green}44` : 'none',
            borderRadius: 8, fontFamily: mono, fontSize: 14, fontWeight: 700,
            color: scanning ? T.green : T.bg, cursor: scanning ? 'default' : 'pointer',
            letterSpacing: 1.5, textTransform: 'uppercase',
            boxShadow: scanning ? 'none' : `0 0 24px ${T.greenDim}`,
            animation: scanning ? 'pulse 1.2s ease-in-out infinite' : 'none',
            transition: 'all 0.3s ease',
          }}>{scanning ? 'Scanning…' : 'Run Scan'}</button>

          {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: T.redDim, border: `1px solid ${T.red}44`, fontFamily: mono, fontSize: 11, color: T.red }}><strong>Error:</strong> {error}</div>}
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div className="pg-right" style={{ width: '58%', padding: '20px 24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', background: '#070809' }}>

          {/* Interface Preview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2 }}>Preview</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: T.textDim }}>{fixtureInfo.meta}</span>
            </div>
            <InterfacePreview fixtureId={selectedFixture} scanning={scanning} scanProgress={scanProgress} />
          </div>

          {/* Results area */}
          {!scanResult && !scanning && !error && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, minHeight: 200, opacity: 0.4 }}>
              <div style={{ fontFamily: syne, fontSize: 24, color: T.textDim }}>muteform</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: T.textDim }}>Click "Run Scan" to analyze</div>
            </div>
          )}

          {scanning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: T.surface, borderRadius: 8, border: `1px solid ${T.green}22` }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${T.border}`, borderTopColor: T.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>Scanning {fixture?.nodeCount || 0} nodes against {rules.filter(r => r.enabled).length} rules…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {showResults && scanResult && (
            <>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, animation: 'fadeSlideIn 0.3s ease both' }}>
                {[
                  { label: 'Nodes', value: scanResult.nodesScanned },
                  { label: 'Rules', value: scanResult.rulesEvaluated },
                  { label: 'Violations', value: scanResult.violations.length },
                  { label: 'Auto-fixable', value: scanResult.violations.filter(v => v.autoFixAvailable).length },
                ].map(s => (
                  <div key={s.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.text }}>{s.value}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Health score */}
              {showScore && !rewriteResult && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0', animation: 'fadeSlideIn 0.4s ease both' }}>
                  <ScoreRing score={scanResult.score} />
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, textAlign: 'center' }}>
                    {scanResult.violations.length} violations found across {scanResult.nodesScanned} nodes · {scanResult.violations.filter(v => v.autoFixAvailable).length} auto-fixable
                  </div>
                </div>
              )}

              {/* Violations list (staggered) */}
              {scanResult.violations.length > 0 && !rewriteResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2 }}>Violations</div>
                  {scanResult.violations.slice(0, visibleViolations).map((v, i) => (
                    <div key={`${v.ruleId}-${v.nodeId}-${i}`} style={{
                      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px',
                      display: 'flex', flexDirection: 'column', gap: 4, animation: `fadeSlideIn 0.3s ease both`,
                      borderLeft: `3px solid ${severityColor(v.severity)}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: severityColor(v.severity), background: `${severityColor(v.severity)}18`, padding: '2px 6px', borderRadius: 3 }}>{v.severity}</span>
                        <span style={{ fontFamily: mono, fontSize: 9, color: T.blue, background: T.blueDim, padding: '2px 6px', borderRadius: 3 }}>{v.ruleId}</span>
                        <span style={{ flex: 1 }} />
                        {v.autoFixAvailable
                          ? <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: T.green, background: T.greenDim, padding: '2px 6px', borderRadius: 3, border: `1px solid ${T.green}33` }}>→ Auto-fix available</span>
                          : <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: T.amber, background: T.amberDim, padding: '2px 6px', borderRadius: 3, border: `1px solid ${T.amber}33` }}>Manual review</span>}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted }}>{v.nodePath}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ValuePreview property={v.property} value={v.currentValue} />
                        {v.suggestedValue != null && <><span style={{ fontFamily: mono, fontSize: 12, color: T.textDim }}>→</span><ValuePreview property={v.property} value={v.suggestedValue} /></>}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: T.textDim, lineHeight: 1.4 }}>{v.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* AUTO-FIX button */}
              {showScore && scanResult.violations.length > 0 && !rewriteResult && (
                <button onClick={handleApplyGovernance} disabled={fixing} style={{
                  width: '100%', padding: '14px 0',
                  background: fixing ? T.surface2 : `linear-gradient(135deg, ${T.blue}, #3377ff)`,
                  border: fixing ? `1px solid ${T.blue}44` : 'none',
                  borderRadius: 8, fontFamily: mono, fontSize: 13, fontWeight: 700,
                  color: fixing ? T.blue : '#fff', cursor: fixing ? 'default' : 'pointer',
                  letterSpacing: 1.5, textTransform: 'uppercase',
                  boxShadow: fixing ? 'none' : `0 0 24px ${T.blueDim}`,
                  animation: fixing ? 'pulse 1s ease-in-out infinite' : 'none',
                  transition: 'all 0.3s ease',
                }}>{fixing ? `Fixing ${fixedCount}/${scanResult.violations.filter(v => v.autoFixAvailable).length}…` : `Auto-Fix ${scanResult.violations.filter(v => v.autoFixAvailable).length} Violations`}</button>
              )}

              {/* ═══ GOVERNED RESULTS ═══ */}
              {rewriteResult && report && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeSlideIn 0.4s ease both' }}>
                  {/* Summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div style={{ padding: '10px', background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.green }}>{report.autoFixedCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.green, letterSpacing: '0.08em' }}>✓ FIXED</div>
                    </div>
                    <div style={{ padding: '10px', background: T.amberDim, border: `1px solid ${T.amber}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.amber }}>{report.warningCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.amber, letterSpacing: '0.08em' }}>⚠ WARN</div>
                    </div>
                    <div style={{ padding: '10px', background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.red }}>{report.blockedCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.red, letterSpacing: '0.08em' }}>✕ BLOCK</div>
                    </div>
                  </div>

                  {/* Score before → after */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                    <ScoreRing score={report.overallScore} size={70} label="before" />
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: mono, fontSize: 16, color: T.textDim }}>→</span>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.green }}>+{report.afterScore - report.overallScore}</div>
                    </div>
                    <ScoreRing score={report.afterScore} size={70} label="after" />
                  </div>

                  {report.warningCount + report.blockedCount > 0 && (
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.amber, background: T.amberDim, padding: '8px 12px', borderRadius: 6, border: `1px solid ${T.amber}33`, textAlign: 'center' }}>
                      {report.warningCount + report.blockedCount} violation{report.warningCount + report.blockedCount > 1 ? 's' : ''} require{report.warningCount + report.blockedCount === 1 ? 's' : ''} manual review
                    </div>
                  )}

                  {/* 3-tab diff */}
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
                      {([
                        { id: 'original' as const, label: 'Original', col: T.red },
                        { id: 'violations' as const, label: 'Violations', col: T.amber },
                        { id: 'governed' as const, label: 'Governed', col: T.green },
                      ]).map(tab => (
                        <button key={tab.id} onClick={() => setDiffTab(tab.id)} style={{
                          flex: 1, padding: '8px', background: diffTab === tab.id ? T.surface2 : 'transparent',
                          border: 'none', borderBottom: diffTab === tab.id ? `2px solid ${tab.col}` : '2px solid transparent',
                          fontFamily: mono, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          color: diffTab === tab.id ? T.text : T.textMuted,
                        }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: '10px', maxHeight: 350, overflow: 'auto' }}>
                      {diffTab === 'original' && fixture && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {fixture.artifact.nodes.map(n => <NodeCard key={n.id} node={n} violations={report.violations} isGoverned={false} />)}
                        </div>
                      )}
                      {diffTab === 'violations' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(['color_token', 'spacing', 'typography', 'component', 'layout', 'accessibility'] as const).map(type => {
                            const group = report.violations.filter(v => v.type === type)
                            if (!group.length) return null
                            return (
                              <div key={type}>
                                <div style={{ fontFamily: mono, fontSize: 9, color: T.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{type.replace('_', ' ')} ({group.length})</div>
                                {group.map(v => <ViolationCard key={v.id} v={v} />)}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {diffTab === 'governed' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {rewriteResult.rewrittenArtifact.nodes.map(n => <NodeCard key={n.id} node={n} violations={report.violations} isGoverned={true} />)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export / Next Step */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => copyText(reportToJSON(report), 'json')} style={{
                      flex: 1, fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '8px', borderRadius: 5, cursor: 'pointer',
                      background: copied === 'json' ? T.greenDim : T.surface, color: copied === 'json' ? T.green : T.text, border: `1px solid ${T.border}`,
                    }}>{copied === 'json' ? '✓ Copied' : 'Export JSON'}</button>
                    <button onClick={() => copyText(reportToMarkdown(report), 'md')} style={{
                      flex: 1, fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '8px', borderRadius: 5, cursor: 'pointer',
                      background: copied === 'md' ? T.greenDim : T.surface, color: copied === 'md' ? T.green : T.text, border: `1px solid ${T.border}`,
                    }}>{copied === 'md' ? '✓ Copied' : 'Export Markdown'}</button>
                  </div>

                  {/* Green banner */}
                  <div style={{
                    padding: '12px 16px', borderRadius: 8, background: T.greenDim, border: `1px solid ${T.green}33`,
                    textAlign: 'center', fontFamily: mono, fontSize: 11, color: T.green,
                  }}>
                    Governance applied — {report.autoFixedCount} fixes · {report.warningCount} warning{report.warningCount !== 1 ? 's' : ''} · {report.blockedCount} blocked
                  </div>

                  <a href="/report" style={{
                    display: 'block', textAlign: 'center', fontFamily: mono, fontSize: 12, fontWeight: 700, color: T.bg, textDecoration: 'none',
                    padding: '12px', borderRadius: 8, background: `linear-gradient(135deg, ${T.green}, #00c070)`,
                    letterSpacing: 0.5, boxShadow: `0 0 20px ${T.greenDim}`,
                  }}>View full report →</a>

                  <a href="/governance" style={{
                    display: 'block', textAlign: 'center', fontFamily: mono, fontSize: 11, color: T.blue, textDecoration: 'none',
                    padding: '10px', borderRadius: 6, border: `1px solid ${T.blue}33`, background: T.blueDim,
                    transition: 'all 0.15s ease',
                  }}>Connect MCP for continuous governance →</a>
                </div>
              )}

              {scanResult.violations.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontFamily: mono, fontSize: 14, color: T.green, fontWeight: 600, marginBottom: 4 }}>All clear</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted }}>No violations found. Design is fully compliant.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
