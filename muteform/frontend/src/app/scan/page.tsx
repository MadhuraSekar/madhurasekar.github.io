'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Stepper from '@/components/Stepper'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, ScanResult, RewriteResult, InterfaceDefinition } from '@/lib/engine'
import { getFixture, FIXTURES } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'
import { loadSession, saveScanResult, saveReport, markStepComplete, syncScanReport } from '@/lib/session'
import { loadDesignSystem } from '@/lib/design-system-store'

// ─── Design Tokens ──────────────────────────────────────────
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

// ─── Demo YAML Config ───────────────────────────────────────
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

// ─── Category Weights ───────────────────────────────────────
const CATEGORY_WEIGHTS: Record<string, number> = {
  accessibility: 0.30,
  token: 0.25,
  component: 0.20,
  spacing: 0.15,
  layout: 0.10,
}

function computeWeightedScore(categories: { key: string; score: number }[]): number {
  let weighted = 0
  let totalWeight = 0
  for (const c of categories) {
    const w = CATEGORY_WEIGHTS[c.key] ?? 0
    if (w > 0) {
      weighted += c.score * w
      totalWeight += w
    }
  }
  return totalWeight > 0 ? Math.round(weighted / totalWeight) : 0
}

// ─── Severity display config ────────────────────────────────
const GOV_SEV: Record<GovernanceSeverity, { color: string; dim: string; label: string; icon: string }> = {
  'auto-fix': { color: T.green, dim: T.greenDim, label: 'FIXED', icon: '\u2713' },
  'warn': { color: T.amber, dim: T.amberDim, label: 'WARN', icon: '\u26A0' },
  'block': { color: T.red, dim: T.redDim, label: 'BLOCK', icon: '\u2715' },
}

// ─── Fixture card definitions ───────────────────────────────
const FIXTURE_CARDS: { id: string; label: string; source: string; isPaste?: boolean }[] = [
  { id: 'onboarding', label: 'Onboarding Flow', source: 'Cursor AI' },
  { id: 'dashboard', label: 'SaaS Dashboard', source: 'Claude Code' },
  { id: 'settings', label: 'Settings Page', source: 'v0' },
  { id: 'paste', label: 'Paste JSX/HTML', source: 'Custom input', isPaste: true },
]

// ─── Score Ring ─────────────────────────────────────────────
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

// ─── Violation Visual Card ──────────────────────────────────
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
      {/* Color swatch */}
      {v.type === 'color_token' && (() => {
        const hex = v.evidence.match(/#[0-9a-fA-F]{6}/)?.[0] || '#ff0000'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: hex, border: `2px solid ${T.red}` }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: T.red }}>{hex}</span>
            </div>
            {v.suggestedFix && <>
              <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>{'\u2192'}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: v.suggestedFix.startsWith('#') ? v.suggestedFix : T.green, border: `2px solid ${T.green}` }} />
                <span style={{ fontFamily: mono, fontSize: 9, color: T.green }}>{v.suggestedFix}</span>
              </div>
            </>}
          </div>
        )
      })()}
      {/* Spacing bars */}
      {v.type === 'spacing' && (() => {
        const cur = parseInt(v.evidence.match(/(\d+)/)?.[1] || '10')
        const sug = parseInt(v.suggestedFix?.match(/(\d+)/)?.[1] || String(cur))
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ width: Math.min(cur * 2, 80), height: 12, borderRadius: 3, background: `${T.red}80` }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: T.red }}>{cur}px</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>{'\u2192'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ width: Math.min(sug * 2, 80), height: 12, borderRadius: 3, background: `${T.green}80` }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: T.green }}>{sug}px</span>
            </div>
          </div>
        )
      })()}
      {/* Typography preview */}
      {v.type === 'typography' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: '6px 12px', borderRadius: 6, background: T.redDim, border: `1px solid ${T.red}33` }}>
            <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.red }}>Aa</span>
            <div style={{ fontFamily: mono, fontSize: 9, color: T.red, marginTop: 2 }}>{v.evidence.match(/"([^"]+)"/)?.[1] || 'unknown'}</div>
          </div>
          <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>{'\u2192'}</span>
          <div style={{ padding: '6px 12px', borderRadius: 6, background: T.greenDim, border: `1px solid ${T.green}33` }}>
            <span style={{ fontFamily: syne, fontSize: 18, fontWeight: 700, color: T.green }}>Aa</span>
            <div style={{ fontFamily: mono, fontSize: 9, color: T.green, marginTop: 2 }}>{v.suggestedFix || 'approved'}</div>
          </div>
        </div>
      )}
      {/* Component badges */}
      {v.type === 'component' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: mono, fontSize: 11, padding: '4px 12px', borderRadius: 6, background: T.redDim, color: T.red, border: `1px solid ${T.red}33` }}>
            {v.evidence.match(/"([^"]+)"/)?.[1] || v.evidence}
          </span>
          <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>{'\u2192'}</span>
          <span style={{ fontFamily: mono, fontSize: 11, padding: '4px 12px', borderRadius: 6, background: T.greenDim, color: T.green, border: `1px solid ${T.green}33` }}>
            {v.suggestedFix}
          </span>
        </div>
      )}
      {/* Layout grid */}
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
            <span style={{ fontFamily: mono, fontSize: 16, color: T.dim }}>{'\u2192'}</span>
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

// ─── Node Card ──────────────────────────────────────────────
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

// ─── Try to parse pasted input into InterfaceDefinition ─────
function parsePastedInput(input: string): InterfaceDefinition | null {
  const trimmed = input.trim()
  // Try as JSON InterfaceDefinition
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed.nodes && Array.isArray(parsed.nodes)) {
      return parsed as InterfaceDefinition
    }
    // Maybe it's a nodes array directly
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
      return {
        nodes: parsed,
        metadata: { source: 'pasted-json', platform: 'web', generatedAt: new Date().toISOString() },
      }
    }
  } catch { /* not JSON */ }

  // Try to import parseHTML dynamically for HTML/JSX input
  try {
    // Simple heuristic: if it contains < tags, treat as HTML
    if (trimmed.startsWith('<') || trimmed.includes('<div') || trimmed.includes('<button')) {
      // Use engine's parseHTML
      const { parseHTML } = require('@/lib/engine')
      return parseHTML(trimmed)
    }
  } catch { /* parse failed */ }

  return null
}

// ─── Main Scan Page ─────────────────────────────────────────
export default function ScanPage() {
  const [selectedFixture, setSelectedFixture] = useState<string>('onboarding')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(null)
  const [config, setConfig] = useState<MuteformConfig | null>(null)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'scanned' | 'governed'>('idle')
  const [copied, setCopied] = useState<string | null>(null)
  const [diffTab, setDiffTab] = useState<'original' | 'violations' | 'governed'>('original')

  // Paste mode
  const [showPasteInput, setShowPasteInput] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [customArtifact, setCustomArtifact] = useState<InterfaceDefinition | null>(null)

  // Design system info
  const [dsLabel, setDsLabel] = useState('Acme')
  const [ruleCount, setRuleCount] = useState(6)

  // Load design system info on mount
  useEffect(() => {
    const ds = loadDesignSystem()
    if (ds) {
      setDsLabel(ds.sourceLabel || 'Acme')
    }
    const policy = loadConfig(DEMO_YAML)
    setRuleCount(policy.rules.length)
  }, [])

  // Auto-run scan on initial mount
  const hasAutoRun = useRef(false)
  useEffect(() => {
    if (hasAutoRun.current) return
    hasAutoRun.current = true
    runScan('onboarding')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runScan = useCallback((fixtureId: string, artifact?: InterfaceDefinition) => {
    setPhase('scanning')
    setRewriteResult(null)
    setDiffTab('original')

    // Use setTimeout(0) to allow UI to show scanning state
    setTimeout(() => {
      try {
        const policy = loadConfig(DEMO_YAML)
        setConfig(policy)

        let art: InterfaceDefinition
        let fixtureName: string
        let fixtureSource: string

        if (artifact) {
          // Custom pasted input
          art = artifact
          fixtureName = 'Custom Input'
          fixtureSource = 'Pasted JSX/HTML'
        } else {
          const fixture = getFixture(fixtureId)
          if (!fixture) { setPhase('idle'); return }
          art = fixture.artifact
          fixtureName = fixture.name
          fixtureSource = fixture.source
        }

        const result = scanArtifact(art, policy)
        setScanResult(result)

        const govReport = buildGovernanceReport(fixtureName, fixtureSource, art, result, null, policy)

        // Compute weighted score
        const weightedScore = computeWeightedScore(govReport.categories)
        setScore(weightedScore)
        setReport(govReport)
        setPhase('scanned')

        // Persist to localStorage
        saveScanResult({ fixtureId, result, report: govReport })
        markStepComplete(2)

        // Sync to Supabase (fire and forget)
        const session = loadSession()
        syncScanReport(session.user?.id ?? null, govReport).catch(() => {})
      } catch (err) {
        console.error('Scan failed:', err)
        setPhase('idle')
      }
    }, 50)
  }, [])

  const handleFixtureSelect = useCallback((id: string) => {
    if (id === 'paste') {
      setSelectedFixture('paste')
      setShowPasteInput(true)
      setPasteError(null)
      setPhase('idle')
      setScanResult(null)
      setReport(null)
      setRewriteResult(null)
      setCustomArtifact(null)
      return
    }
    setShowPasteInput(false)
    setPasteError(null)
    setSelectedFixture(id)
    runScan(id)
  }, [runScan])

  const handlePasteScan = useCallback(() => {
    setPasteError(null)
    const artifact = parsePastedInput(pasteValue)
    if (!artifact || artifact.nodes.length === 0) {
      setPasteError('Could not parse input. Paste valid JSON (InterfaceDefinition) or HTML/JSX.')
      return
    }
    setCustomArtifact(artifact)
    setSelectedFixture('paste')
    runScan('paste', artifact)
  }, [pasteValue, runScan])

  const handleGovernance = useCallback(() => {
    if (!scanResult || !config) return

    let art: InterfaceDefinition
    let fixtureName: string
    let fixtureSource: string

    if (selectedFixture === 'paste' && customArtifact) {
      art = customArtifact
      fixtureName = 'Custom Input'
      fixtureSource = 'Pasted JSX/HTML'
    } else {
      const fixture = getFixture(selectedFixture)
      if (!fixture) return
      art = fixture.artifact
      fixtureName = fixture.name
      fixtureSource = fixture.source
    }

    const result = rewriteArtifact(art, scanResult.violations, config)
    setRewriteResult(result)

    const govReport = buildGovernanceReport(fixtureName, fixtureSource, art, scanResult, result, config)
    const weightedAfter = computeWeightedScore(govReport.categories)
    setScore(weightedAfter)
    setReport(govReport)
    setPhase('governed')
    setDiffTab('original')

    // Persist
    saveReport(govReport)
  }, [scanResult, config, selectedFixture, customArtifact])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const fixture = selectedFixture !== 'paste' ? getFixture(selectedFixture) : null
  const activeArtifact = selectedFixture === 'paste' ? customArtifact : fixture?.artifact
  const violationCount = scanResult?.violations.length || 0

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px ${T.greenGlow} } 50% { box-shadow: 0 0 40px ${T.green}44 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 768px) {
          .scan-grid { grid-template-columns: 1fr !important; }
          .fixture-cards { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .fixture-cards { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Stepper */}
      <Stepper />

      {/* Page Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 80px' }}>

        {/* Design System Context Banner */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 16px', marginBottom: 20, borderRadius: 8,
          background: T.surface, border: `1px solid ${T.border}`,
        }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>
            Scanning against:
          </span>
          <span style={{ fontFamily: syne, fontSize: 12, fontWeight: 700, color: T.textBright }}>
            {dsLabel} design system
          </span>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>{'\u00B7'}</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>
            {ruleCount} rules active
          </span>
        </div>

        {/* Fixture Selector */}
        <div className="fixture-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {FIXTURE_CARDS.map(fc => {
            const isActive = selectedFixture === fc.id
            const fixtureData = fc.isPaste ? null : FIXTURES.find(f => f.id === fc.id)
            return (
              <button key={fc.id} onClick={() => handleFixtureSelect(fc.id)} style={{
                padding: '16px 14px', textAlign: 'left', cursor: 'pointer',
                background: isActive ? T.greenDim : T.surface,
                border: `1px solid ${isActive ? T.green : T.border}`,
                borderRadius: 10, transition: 'all 0.2s',
              }}>
                <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: isActive ? T.green : T.textBright, marginBottom: 4 }}>
                  {fc.label}
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: isActive ? T.green : T.muted }}>
                  {fc.isPaste ? 'Custom JSX/HTML input' : `${fc.source} \u00B7 ${fixtureData?.nodeCount ?? '?'} nodes`}
                </div>
              </button>
            )
          })}
        </div>

        {/* Paste Input Area */}
        {showPasteInput && (
          <div style={{
            padding: '16px', marginBottom: 20, borderRadius: 10,
            background: T.surface, border: `1px solid ${T.border}`,
            animation: 'fadeSlideIn 0.3s ease both',
          }}>
            <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.textBright, marginBottom: 10 }}>
              Paste JSX, HTML, or InterfaceDefinition JSON
            </div>
            <textarea
              value={pasteValue}
              onChange={e => { setPasteValue(e.target.value); setPasteError(null) }}
              placeholder={'{\n  "nodes": [...],\n  "metadata": { "source": "...", "platform": "web", "generatedAt": "..." }\n}\n\nor paste raw HTML/JSX:\n<div style="color: #ff0000; padding: 13px;">...'}
              style={{
                width: '100%', minHeight: 160, padding: '12px', borderRadius: 8,
                background: T.bg, border: `1px solid ${T.border}`, color: T.text,
                fontFamily: mono, fontSize: 11, lineHeight: 1.6, resize: 'vertical',
                outline: 'none',
              }}
            />
            {pasteError && (
              <div style={{ fontFamily: mono, fontSize: 11, color: T.red, marginTop: 8, padding: '8px 12px', background: T.redDim, borderRadius: 6, border: `1px solid ${T.red}33` }}>
                {pasteError}
              </div>
            )}
            <button onClick={handlePasteScan} style={{
              marginTop: 10, padding: '10px 24px', borderRadius: 8, cursor: 'pointer', border: 'none',
              background: pasteValue.trim() ? T.green : T.dim,
              fontFamily: mono, fontSize: 12, fontWeight: 700, color: T.bg,
              letterSpacing: '0.06em', opacity: pasteValue.trim() ? 1 : 0.5,
            }}>
              Scan Input
            </button>
          </div>
        )}

        {/* Scanning Spinner */}
        {phase === 'scanning' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, marginBottom: 20 }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${T.border}`, borderTopColor: T.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 11, color: T.green, marginLeft: 12, letterSpacing: '0.06em' }}>SCANNING FIXTURE...</span>
          </div>
        )}

        {/* Results */}
        {(phase === 'scanned' || phase === 'governed') && report && (
          <div className="scan-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* LEFT: Score + Violations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Score Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <ScoreRing score={score} size={100} animate />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.textBright }}>
                    {fixture?.name || (selectedFixture === 'paste' ? 'Custom Input' : 'Scan')}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    Source: {fixture?.source || (selectedFixture === 'paste' ? 'Pasted JSX/HTML' : 'Unknown')}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.amber, marginTop: 2 }}>
                    {violationCount} violation{violationCount !== 1 ? 's' : ''} detected
                  </div>
                  {/* Category pills */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {report.categories.map(c => (
                      <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: T.surface2, border: `1px solid ${T.border}` }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }} />
                        <span style={{ fontFamily: mono, fontSize: 8, color: T.muted }}>{c.name}</span>
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red }}>{c.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category Score Bars */}
              <div style={{ padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <div style={{ fontFamily: syne, fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                  Category Scores
                </div>
                {report.categories.map(c => {
                  const weight = CATEGORY_WEIGHTS[c.key]
                  return (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: T.muted, width: 100, flexShrink: 0 }}>{c.name}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.border }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${c.score}%`, background: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, transition: 'width 0.6s' }} />
                      </div>
                      <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, width: 28, textAlign: 'right' }}>{c.score}</span>
                      {weight != null && (
                        <span style={{ fontFamily: mono, fontSize: 8, color: T.dim, width: 30, textAlign: 'right' }}>{Math.round(weight * 100)}%</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Violation list (pre-governance) */}
              {phase === 'scanned' && report.violations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: syne, fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 4px' }}>
                    Violations ({report.violations.length})
                  </div>
                  {report.violations.map((v, i) => (
                    <div key={v.id} style={{ animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both` }}>
                      <ViolationCard v={v} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Actions + Governance Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Apply Governance Button */}
              {phase === 'scanned' && (
                <button onClick={handleGovernance} style={{
                  width: '100%', padding: '16px 0', background: `linear-gradient(135deg, ${T.green}, #00c070)`,
                  border: 'none', borderRadius: 10, fontFamily: mono, fontSize: 14, fontWeight: 700,
                  color: T.bg, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase',
                  boxShadow: `0 0 24px ${T.greenGlow}`, animation: 'glow 2s ease-in-out infinite',
                }}>Apply Governance</button>
              )}

              {/* Governed Results */}
              {phase === 'governed' && report && (
                <>
                  {/* Fix/Warn/Block counts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '14px', background: T.greenDim, border: `1px solid ${T.green}33`, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.green }}>{report.autoFixedCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.green, letterSpacing: '0.08em', marginTop: 4 }}>{'\u2713'} AUTO-FIXED</div>
                    </div>
                    <div style={{ padding: '14px', background: T.amberDim, border: `1px solid ${T.amber}33`, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.amber }}>{report.warningCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.amber, letterSpacing: '0.08em', marginTop: 4 }}>{'\u26A0'} WARNINGS</div>
                    </div>
                    <div style={{ padding: '14px', background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.red }}>{report.blockedCount}</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.red, letterSpacing: '0.08em', marginTop: 4 }}>{'\u2715'} BLOCKED</div>
                    </div>
                  </div>

                  {/* Score Before -> After */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                    <ScoreRing score={report.overallScore} size={80} animate label="before" />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontFamily: mono, fontSize: 20, color: T.dim }}>{'\u2192'}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: T.green, marginTop: 2 }}>+{report.afterScore - report.overallScore} pts</span>
                    </div>
                    <ScoreRing score={report.afterScore} size={80} animate label="after" />
                  </div>

                  {/* Ship Badge */}
                  <div style={{ textAlign: 'center', padding: '14px', background: T.greenDim, borderRadius: 10, border: `1px solid ${T.green}33`, animation: 'glow 2s ease-in-out infinite' }}>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.green, letterSpacing: '0.1em' }}>GOVERNED {'\u2014'} READY TO SHIP</div>
                  </div>

                  {/* View full report link */}
                  <a href="/report" style={{
                    display: 'block', textAlign: 'center', padding: '12px', borderRadius: 8,
                    background: T.surface2, border: `1px solid ${T.border}`,
                    fontFamily: mono, fontSize: 12, fontWeight: 600, color: T.green,
                    textDecoration: 'none', letterSpacing: '0.04em',
                  }}>
                    View full report {'\u2192'}
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ Governed Diff Tabs ═══ */}
        {phase === 'governed' && report && activeArtifact && (
          <div style={{ marginTop: 20 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
                {([
                  { id: 'original' as const, label: 'Original', icon: '\u25C9' },
                  { id: 'violations' as const, label: `Violations (${report.violations.length})`, icon: '\u26A1' },
                  { id: 'governed' as const, label: 'Governed Output', icon: '\u2713' },
                ] as const).map(tab => (
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
                      Raw Fixture {'\u2014'} violations highlighted in red
                    </div>
                    {activeArtifact.nodes.map(node => (
                      <NodeCard key={node.id} node={node} violations={report.violations} isGoverned={false} />
                    ))}
                  </div>
                )}

                {diffTab === 'violations' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                      All Violations {'\u2014'} visual comparison
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
                      Governed Output {'\u2014'} fixes highlighted in green
                    </div>
                    {rewriteResult.rewrittenArtifact.nodes.map(node => (
                      <NodeCard key={node.id} node={node} violations={report.violations} isGoverned={true} />
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => copyText(JSON.stringify(rewriteResult.rewrittenArtifact, null, 2), 'governed')} style={{
                        flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                        background: copied === 'governed' ? T.greenDim : T.surface2, color: copied === 'governed' ? T.green : T.textBright,
                        border: `1px solid ${copied === 'governed' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
                      }}>{copied === 'governed' ? 'COPIED \u2713' : 'Copy Governed Output'}</button>
                      <button onClick={() => copyText(reportToJSON(report), 'dl')} style={{
                        flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                        background: copied === 'dl' ? T.greenDim : T.surface2, color: copied === 'dl' ? T.green : T.textBright,
                        border: `1px solid ${copied === 'dl' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
                      }}>{copied === 'dl' ? 'COPIED \u2713' : 'Download Report'}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Enterprise Governance Report (post-governance) ═══ */}
        {phase === 'governed' && report && (
          <div style={{ marginTop: 20 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Report Header */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, background: `linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)` }}>
                <div style={{ fontFamily: syne, fontSize: 18, fontWeight: 700, color: T.textBright, marginBottom: 8 }}>Enterprise Governance Report</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: mono, fontSize: 11 }}>
                  <span style={{ color: T.muted }}>Screen: <span style={{ color: T.text }}>{report.fixtureName}</span></span>
                  <span style={{ color: T.muted }}>Source: <span style={{ color: T.amber }}>{report.fixtureSource}</span></span>
                  <span style={{ color: T.muted }}>Baseline: <span style={{ color: T.blue }}>{dsLabel} Design System</span></span>
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{new Date(report.timestamp).toLocaleString()}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>Governance Score:</span>
                  <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: T.red }}>{report.overallScore}</span>
                  <span style={{ fontFamily: mono, fontSize: 14, color: T.dim }}>{'\u2192'}</span>
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
                  {report.categories.map(c => (
                    <div key={c.key} style={{ padding: '12px', background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{c.name}</span>
                        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red }}>{c.score}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: T.border }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${c.score}%`, background: c.score >= 90 ? T.green : c.score >= 60 ? T.amber : T.red, transition: 'width 0.6s' }} />
                      </div>
                      {CATEGORY_WEIGHTS[c.key] != null && (
                        <div style={{ fontFamily: mono, fontSize: 8, color: T.dim, marginTop: 4, textAlign: 'right' }}>
                          Weight: {Math.round(CATEGORY_WEIGHTS[c.key] * 100)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto-Fixed */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {'\u2713'} AUTO-FIXED ({report.autoFixedCount})
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

              {/* Warnings */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.amber, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {'\u26A0'} WARNINGS ({report.warningCount} {'\u2014'} review recommended)
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

              {/* Blocked */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {'\u2715'} BLOCKED ({report.blockedCount} {'\u2014'} cannot ship)
                </div>
                {report.violations.filter(v => !v.fixApplied && v.severity === 'block').map(v => (
                  <div key={v.id} style={{ padding: '10px 14px', marginBottom: 8, background: T.redDim, borderRadius: 8, border: `1px solid ${T.red}22` }}>
                    <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.red, marginBottom: 4 }}>{v.ruleName}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 4 }}>{v.nodePath}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>Why: {v.evidence}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.red }}>Must fix before shipping: {v.fixDescription}</div>
                  </div>
                ))}
                {report.blockedCount === 0 && <div style={{ fontFamily: mono, fontSize: 11, color: T.dim }}>No blockers {'\u2014'} clear to ship</div>}
              </div>

              {/* Report Footer */}
              <div style={{ padding: '16px 24px', display: 'flex', gap: 10 }}>
                <button onClick={() => copyText(reportToJSON(report), 'json')} style={{
                  flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6, cursor: 'pointer',
                  background: copied === 'json' ? T.greenDim : T.surface2, color: copied === 'json' ? T.green : T.textBright,
                  border: `1px solid ${copied === 'json' ? T.green + '33' : T.border}`, letterSpacing: '0.06em',
                }}>{copied === 'json' ? 'COPIED \u2713' : 'Copy as JSON'}</button>
                <a href="/report" style={{
                  flex: 1, fontFamily: mono, fontSize: 10, fontWeight: 600, padding: '10px', borderRadius: 6,
                  background: T.surface2, color: T.green, textDecoration: 'none', textAlign: 'center',
                  border: `1px solid ${T.green}33`, letterSpacing: '0.06em',
                }}>View full report {'\u2192'}</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
