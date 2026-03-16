'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/Header'
import { tokens } from '@/lib/design-tokens'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, ScanResult, RewriteResult } from '@/lib/engine'
import { FIXTURES, getFixture } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'

const T = tokens
const mono = T.fontMono
const syne = T.fontDisplay
const sans = T.fontMono
const serif = T.fontDisplay

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
  switch (s) { case 'critical': return T.red; case 'high': return T.red; case 'medium': return T.amber; default: return T.textMuted }
}
function scoreColor(score: number): string {
  if (score < 50) return T.red; if (score < 80) return T.amber; return T.green
}

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
        <span style={{ fontFamily: sans, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>{label || 'health'}</span>
      </div>
    </div>
  )
}

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

// ─── Node Card for diff tabs ─────────────────────────────────
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

// ─── Violation Card for violations tab ───────────────────────
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

export default function PlaygroundPage() {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [yamlText, setYamlText] = useState(buildYaml(DEFAULT_RULES))
  const [selectedFixture, setSelectedFixture] = useState<string>('dashboard')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [diffTab, setDiffTab] = useState<'original' | 'violations' | 'governed'>('original')

  const runScan = useCallback((yaml: string, fixtureId: string) => {
    setError(null); setRewriteResult(null); setReport(null)
    try {
      const policy = loadConfig(yaml)
      const fixture = getFixture(fixtureId)
      if (!fixture) { setError(`Fixture "${fixtureId}" not found.`); return }
      const result = scanArtifact(fixture.artifact, policy)
      setScanResult(result)
      const r = buildGovernanceReport(fixture.name, fixture.source, fixture.artifact, result, null, policy)
      setReport(r)
    } catch (e: any) { setError(e.message || 'Failed to parse YAML or run scan.') }
  }, [])

  const handleScan = useCallback((yaml?: string, fixtureId?: string) => {
    runScan(yaml || yamlText, fixtureId || selectedFixture)
  }, [yamlText, selectedFixture, runScan])

  useEffect(() => { runScan(buildYaml(DEFAULT_RULES), 'dashboard') }, [runScan])

  const handleToggleRule = (ruleId: string) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    const newYaml = buildYaml(updated)
    setYamlText(newYaml)
    handleScan(newYaml)
  }

  const handleFixtureSelect = (id: string) => {
    setSelectedFixture(id); setRewriteResult(null); setReport(null)
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
      setDiffTab('original')
    } catch (e: any) { setError(e.message) }
  }, [scanResult, yamlText, selectedFixture])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const fixture = getFixture(selectedFixture)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: mono }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) { .two-col { flex-direction: column !important; } .two-col-left, .two-col-right { width: 100% !important; padding: 16px !important; border-right: none !important; } }
      `}</style>

      <Header />

      <div className="two-col" style={{ display: 'flex', gap: 0, maxWidth: 1440, margin: '0 auto', minHeight: 'calc(100vh - 56px)' }}>
        {/* LEFT */}
        <div className="two-col-left" style={{ width: '55%', padding: '24px 20px 24px 32px', borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Rules (toggle to rerun scan)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rules.map(r => (
                <div key={r.id} onClick={() => handleToggleRule(r.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: r.enabled ? T.surface : T.bg, border: `1px solid ${r.enabled ? T.green + '44' : T.border}`,
                  borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: r.enabled ? T.green : 'transparent', border: `2px solid ${r.enabled ? T.green : T.textDim}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {r.enabled && <span style={{ color: T.bg, fontSize: 9, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: mono, fontSize: 11, color: r.enabled ? T.text : T.textDim, flex: 1 }}>{r.id}</span>
                  <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: severityColor(r.severity), padding: '1px 6px', borderRadius: 3, background: `${severityColor(r.severity)}18` }}>{r.severity.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Policy YAML</div>
            <textarea value={yamlText} onChange={e => setYamlText(e.target.value)} spellCheck={false} style={{
              width: '100%', minHeight: 300, background: T.surface, color: T.text, fontFamily: mono, fontSize: 12, lineHeight: 1.7,
              border: `1px solid ${T.border}`, borderRadius: 8, outline: 'none', padding: '14px 18px', resize: 'vertical', caretColor: T.green,
            }} />
          </div>

          <div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Select Fixture</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {FIXTURES.map(f => {
                const active = f.id === selectedFixture
                return (
                  <button key={f.id} onClick={() => handleFixtureSelect(f.id)} style={{
                    padding: '10px 12px', background: active ? T.greenDim : T.surface,
                    border: `1px solid ${active ? T.green : T.border}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: active ? T.green : T.text }}>{f.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: active ? T.green : T.textMuted, marginTop: 3 }}>{f.nodeCount} nodes</div>
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={() => handleScan()} style={{
            width: '100%', padding: '14px 0', background: `linear-gradient(135deg, ${T.green}, #00c070)`,
            border: 'none', borderRadius: 8, fontFamily: mono, fontSize: 14, fontWeight: 700,
            color: T.bg, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase', boxShadow: `0 0 24px ${T.greenDim}`,
          }}>Run Scan</button>

          {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: T.redDim, border: `1px solid ${T.red}44`, fontFamily: mono, fontSize: 12, color: T.red }}><strong>Error:</strong> {error}</div>}
        </div>

        {/* RIGHT */}
        <div className="two-col-right" style={{ width: '45%', padding: '24px 32px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2 }}>Results</div>

          {scanResult && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Nodes', value: scanResult.nodesScanned },
                  { label: 'Rules', value: scanResult.rulesEvaluated },
                  { label: 'Violations', value: scanResult.violations.length },
                  { label: 'Time', value: `${scanResult.scanDurationMs}ms` },
                ].map(s => (
                  <div key={s.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.text }}>{s.value}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                <ScoreRing score={rewriteResult ? rewriteResult.afterScore : scanResult.score} />
                <div style={{ fontFamily: mono, fontSize: 10, color: T.green, border: `1px solid ${T.green}44`, borderRadius: 20, padding: '4px 14px', background: T.greenDim, letterSpacing: 0.5 }}>Deterministic evaluation · No AI in the loop</div>
              </div>

              {/* Violations (before governance) */}
              {scanResult.violations.length > 0 && !rewriteResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 2 }}>Violations ({scanResult.violations.length})</div>
                  {scanResult.violations.map((v, i) => (
                    <div key={`${v.ruleId}-${v.nodeId}-${i}`} style={{
                      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px',
                      display: 'flex', flexDirection: 'column', gap: 6, animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: severityColor(v.severity), background: `${severityColor(v.severity)}18`, padding: '2px 8px', borderRadius: 4 }}>{v.severity}</span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: T.blue, background: T.blueDim, padding: '2px 8px', borderRadius: 4 }}>{v.ruleId}</span>
                        <span style={{ flex: 1 }} />
                        {v.autoFixAvailable
                          ? <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: T.green, background: T.greenDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.green}33` }}>AUTO-FIX</span>
                          : <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: T.amber, background: T.amberDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.amber}33` }}>MANUAL</span>}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted }}>{v.nodePath}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ValuePreview property={v.property} value={v.currentValue} />
                        {v.suggestedValue != null && <><span style={{ fontFamily: mono, fontSize: 12, color: T.textDim }}>→</span><ValuePreview property={v.property} value={v.suggestedValue} /></>}
                      </div>
                      <div style={{ fontFamily: sans, fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>{v.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {scanResult.violations.length > 0 && !rewriteResult && (
                <button onClick={handleApplyGovernance} style={{
                  width: '100%', padding: '14px 0', background: `linear-gradient(135deg, ${T.green}, #00c070)`,
                  border: 'none', borderRadius: 8, fontFamily: mono, fontSize: 14, fontWeight: 700,
                  color: T.bg, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase', boxShadow: `0 0 24px ${T.greenDim}`,
                }}>Apply Governance</button>
              )}

              {/* ═══ GOVERNED: 3-Tab Diff + Enterprise Report ═══ */}
              {rewriteResult && report && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '12px', background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.green }}>{report.autoFixedCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.green, letterSpacing: '0.08em' }}>✓ FIXED</div>
                    </div>
                    <div style={{ padding: '12px', background: T.amberDim, border: `1px solid ${T.amber}33`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.amber }}>{report.warningCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.amber, letterSpacing: '0.08em' }}>⚠ WARN</div>
                    </div>
                    <div style={{ padding: '12px', background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 8, textAlign: 'center' }}>
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

                  {/* ─── 3-TAB DIFF VIEW ─── */}
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
                      {([
                        { id: 'original' as const, label: 'Original', col: T.red },
                        { id: 'violations' as const, label: 'Violations', col: T.amber },
                        { id: 'governed' as const, label: 'Governed', col: T.green },
                      ]).map(tab => (
                        <button key={tab.id} onClick={() => setDiffTab(tab.id)} style={{
                          flex: 1, padding: '10px', background: diffTab === tab.id ? T.surface2 : 'transparent',
                          border: 'none', borderBottom: diffTab === tab.id ? `2px solid ${tab.col}` : '2px solid transparent',
                          fontFamily: mono, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          color: diffTab === tab.id ? T.text : T.textMuted,
                        }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: '12px', maxHeight: 400, overflow: 'auto' }}>
                      {diffTab === 'original' && fixture && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontFamily: mono, fontSize: 9, color: T.textDim, marginBottom: 4 }}>Raw fixture — violations in red</div>
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
                          <div style={{ fontFamily: mono, fontSize: 9, color: T.textDim, marginBottom: 4 }}>Governed output — fixes in green</div>
                          {rewriteResult.rewrittenArtifact.nodes.map(n => <NodeCard key={n.id} node={n} violations={report.violations} isGoverned={true} />)}
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button onClick={() => copyText(JSON.stringify(rewriteResult.rewrittenArtifact, null, 2), 'gov')} style={{
                              flex: 1, fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '8px', borderRadius: 5, cursor: 'pointer',
                              background: copied === 'gov' ? T.greenDim : T.bg, color: copied === 'gov' ? T.green : T.text, border: `1px solid ${T.border}`,
                            }}>{copied === 'gov' ? 'COPIED ✓' : 'Copy Output'}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ─── ENTERPRISE REPORT ─── */}
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, background: `linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)` }}>
                      <div style={{ fontFamily: syne, fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Governance Report</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted }}>
                        {report.fixtureName} · {report.fixtureSource} · Acme Design System v2.1
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.textDim, marginTop: 2 }}>{new Date(report.timestamp).toLocaleString()}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.red }}>{report.overallScore}</span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: T.textDim }}>→</span>
                        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.green }}>{report.afterScore}</span>
                        <span style={{ fontFamily: mono, fontSize: 9, color: T.green, background: T.greenDim, padding: '2px 8px', borderRadius: 3 }}>+{report.afterScore - report.overallScore} pts</span>
                      </div>
                    </div>

                    {/* Category scores */}
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Categories</div>
                      {report.categories.map(c => (
                        <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, width: 80 }}>{c.name}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border }}>
                            <div style={{ height: '100%', borderRadius: 2, width: `${c.score}%`, background: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red }} />
                          </div>
                          <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, width: 20 }}>{c.score}</span>
                        </div>
                      ))}
                    </div>

                    {/* Fixed */}
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontFamily: syne, fontSize: 11, fontWeight: 700, color: T.green, marginBottom: 8 }}>✓ Auto-Fixed ({report.autoFixedCount})</div>
                      {report.violations.filter(v => v.fixApplied).map(v => (
                        <div key={v.id} style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, padding: '6px 8px', marginBottom: 4, background: T.greenDim, borderRadius: 4 }}>
                          <span style={{ color: T.green, fontWeight: 600 }}>{v.ruleName}</span> — {v.nodePath}<br />{v.fixDescription}
                        </div>
                      ))}
                    </div>

                    {/* Warnings */}
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontFamily: syne, fontSize: 11, fontWeight: 700, color: T.amber, marginBottom: 8 }}>⚠ Warnings ({report.warningCount})</div>
                      {report.violations.filter(v => !v.fixApplied && v.severity === 'warn').map(v => (
                        <div key={v.id} style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, padding: '6px 8px', marginBottom: 4, background: T.amberDim, borderRadius: 4 }}>
                          <span style={{ color: T.amber, fontWeight: 600 }}>{v.ruleName}</span> — {v.nodePath}<br />{v.evidence}
                        </div>
                      ))}
                      {report.warningCount === 0 && <div style={{ fontFamily: mono, fontSize: 9, color: T.textDim }}>No warnings</div>}
                    </div>

                    {/* Blocked */}
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontFamily: syne, fontSize: 11, fontWeight: 700, color: T.red, marginBottom: 8 }}>✕ Blocked ({report.blockedCount})</div>
                      {report.violations.filter(v => !v.fixApplied && v.severity === 'block').map(v => (
                        <div key={v.id} style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, padding: '6px 8px', marginBottom: 4, background: T.redDim, borderRadius: 4 }}>
                          <span style={{ color: T.red, fontWeight: 600 }}>{v.ruleName}</span> — {v.nodePath}<br />{v.evidence}
                        </div>
                      ))}
                      {report.blockedCount === 0 && <div style={{ fontFamily: mono, fontSize: 9, color: T.textDim }}>No blockers</div>}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '12px 16px', display: 'flex', gap: 6 }}>
                      <button onClick={() => copyText(reportToJSON(report), 'json')} style={{
                        flex: 1, fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '8px', borderRadius: 5, cursor: 'pointer',
                        background: copied === 'json' ? T.greenDim : T.bg, color: copied === 'json' ? T.green : T.text, border: `1px solid ${T.border}`,
                      }}>{copied === 'json' ? '✓' : 'JSON'}</button>
                      <button onClick={() => copyText(reportToMarkdown(report), 'md')} style={{
                        flex: 1, fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '8px', borderRadius: 5, cursor: 'pointer',
                        background: copied === 'md' ? T.greenDim : T.bg, color: copied === 'md' ? T.green : T.text, border: `1px solid ${T.border}`,
                      }}>{copied === 'md' ? '✓' : 'Markdown'}</button>
                      <button onClick={() => { setCopied('share'); setTimeout(() => setCopied(null), 2000) }} style={{
                        flex: 1, fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '8px', borderRadius: 5, cursor: 'pointer',
                        background: copied === 'share' ? T.greenDim : T.bg, color: copied === 'share' ? T.green : T.text, border: `1px solid ${T.border}`,
                      }}>{copied === 'share' ? '✓' : 'Share'}</button>
                    </div>
                  </div>
                </div>
              )}

              {scanResult.violations.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontFamily: sans, fontSize: 16, color: T.green, fontWeight: 600, marginBottom: 6 }}>All clear</div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: T.textMuted }}>No violations found. Design is fully compliant.</div>
                </div>
              )}
            </>
          )}

          {!scanResult && !error && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, minHeight: 300 }}>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 28, color: T.textDim, opacity: 0.5 }}>muteform</div>
              <div style={{ fontFamily: mono, fontSize: 12, color: T.textDim }}>Loading scan...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
