'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Stepper from '@/components/Stepper'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, ScanResult, RewriteResult, InterfaceDefinition } from '@/lib/engine'
import { getFixture, FIXTURES } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON, type GovernanceReport, type EnrichedViolation, type GovernanceSeverity } from '@/lib/governance'
import { loadSession, saveScanResult, saveReport, markStepComplete, syncScanReport } from '@/lib/session'
import { loadDesignSystem } from '@/lib/design-system-store'

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
  color: 0.20,
  spacing: 0.15,
  typography: 0.15,
  components: 0.10,
  layout: 0.10,
}

// ─── Phase type ─────────────────────────────────────────────
type Phase = 'select' | 'scanning' | 'results' | 'governed'

// ─── Animation keyframes (injected once) ────────────────────
const KEYFRAMES = `
@keyframes pulseFixed {
  0% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes progressFill {
  from { width: 0%; }
  to { width: 100%; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scoreReveal {
  from { stroke-dashoffset: var(--circ); }
  to { stroke-dashoffset: var(--target-offset); }
}
`

// ─── Score color helper using CSS vars ──────────────────────
function scoreColorVar(score: number): string {
  if (score >= 90) return 'var(--success)'
  if (score >= 60) return 'var(--warning)'
  return 'var(--error)'
}

function scoreColorDimVar(score: number): string {
  if (score >= 90) return 'var(--success-dim)'
  if (score >= 60) return 'var(--warning-dim)'
  return 'var(--error-dim)'
}

// ─── Severity color helper ──────────────────────────────────
function severityColorVar(s: GovernanceSeverity): string {
  if (s === 'block') return 'var(--error)'
  if (s === 'warn') return 'var(--warning)'
  return 'var(--success)'
}

function severityDimVar(s: GovernanceSeverity): string {
  if (s === 'block') return 'var(--error-dim)'
  if (s === 'warn') return 'var(--warning-dim)'
  return 'var(--success-dim)'
}

// ─── ScoreRing Component ────────────────────────────────────
function ScoreRing({
  score,
  size = 120,
  strokeWidth = 6,
  label,
  animate = true,
}: {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  animate?: boolean
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const [offset, setOffset] = useState(animate ? circumference : circumference - (score / 100) * circumference)
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score)

  const color = scoreColorVar(score)

  useEffect(() => {
    if (!animate) {
      setOffset(circumference - (score / 100) * circumference)
      setDisplayScore(score)
      return
    }
    const timer = setTimeout(() => {
      setOffset(circumference - (score / 100) * circumference)
    }, 50)

    // Animate number counting
    const duration = 1400
    const startTime = Date.now()
    const startScore = 0
    const endScore = score
    const frame = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(startScore + (endScore - startScore) * eased))
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return () => clearTimeout(timer)
  }, [score, animate, circumference])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track circle */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="var(--border)" strokeWidth={strokeWidth}
          />
          {/* Score arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: animate ? '1.4s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            }}
          />
        </svg>
        {/* Score number in center */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: size * 0.3, fontWeight: 700,
            color: color, lineHeight: 1,
          }}>
            {displayScore}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: size * 0.09, color: 'var(--text-muted)',
            letterSpacing: '0.05em', marginTop: 2,
          }}>
            / 100
          </span>
        </div>
      </div>
      {label && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {label}
        </span>
      )}
    </div>
  )
}

// ─── AnimatedScoreRing — animates between two values ─────────
function AnimatedScoreRing({
  fromScore,
  toScore,
  size = 120,
  strokeWidth = 6,
  label,
}: {
  fromScore: number
  toScore: number
  size?: number
  strokeWidth?: number
  label?: string
}) {
  const [currentScore, setCurrentScore] = useState(fromScore)

  useEffect(() => {
    const timer = setTimeout(() => setCurrentScore(toScore), 200)
    return () => clearTimeout(timer)
  }, [toScore])

  return (
    <ScoreRing score={currentScore} size={size} strokeWidth={strokeWidth} label={label} animate={true} />
  )
}

// ─── ViolationCard Component ────────────────────────────────
function ViolationCard({
  violation,
  index,
  showFixed = false,
}: {
  violation: EnrichedViolation
  index: number
  showFixed?: boolean
}) {
  const sevColor = severityColorVar(violation.severity)
  const sevDim = severityDimVar(violation.severity)

  const borderLeftColor = violation.severity === 'block'
    ? 'var(--error)'
    : violation.severity === 'warn'
    ? 'var(--warning)'
    : 'var(--success)'

  const isColorType = violation.type === 'color_token'
  const isSpacingType = violation.type === 'spacing'
  const isTypographyType = violation.type === 'typography'
  const isComponentType = violation.type === 'component'

  // Extract color values from evidence
  const colorMatch = violation.evidence.match(/(#[0-9a-fA-F]{3,8})/)
  const suggestedColor = violation.suggestedFix?.match?.(/(#[0-9a-fA-F]{3,8})/)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${borderLeftColor}`,
      borderRadius: 4,
      padding: 16,
      animation: `fadeInUp 300ms ease both`,
      animationDelay: `${index * 50}ms`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Rule name */}
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            {violation.ruleName}
          </div>
          {/* Node path */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
            marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {violation.nodePath}
          </div>
          {/* Evidence */}
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            {violation.evidence}
          </div>

          {/* Visual previews */}
          {isColorType && colorMatch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>was:</span>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: colorMatch[1],
                  border: '1px solid var(--border)',
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{colorMatch[1]}</span>
              </div>
              {violation.fixApplied && suggestedColor && (
                <>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{'-->'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>now:</span>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: suggestedColor[1],
                      border: '1px solid var(--border)',
                    }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--success)' }}>{suggestedColor[1]}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {isSpacingType && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div style={{
                height: 6, borderRadius: 3,
                background: violation.fixApplied ? 'var(--success-dim)' : 'var(--error-dim)',
                width: Math.min(80, Math.max(16, parseInt(String(violation.suggestedFix)) || 32)),
                transition: 'width 300ms ease',
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                {violation.fixApplied ? violation.suggestedFix + 'px' : 'off-scale'}
              </span>
            </div>
          )}

          {isTypographyType && (
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, fontStyle: 'italic',
              color: violation.fixApplied ? 'var(--success)' : 'var(--warning)',
              marginTop: 8, padding: '4px 8px',
              background: violation.fixApplied ? 'var(--success-dim)' : 'var(--warning-dim)',
              borderRadius: 4, display: 'inline-block',
            }}>
              {violation.fixApplied ? violation.suggestedFix : violation.evidence.split('"')[1] || 'unknown style'}
            </div>
          )}

          {isComponentType && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: violation.fixApplied ? 'var(--success)' : 'var(--warning)',
              marginTop: 8, padding: '3px 10px',
              background: violation.fixApplied ? 'var(--success-dim)' : 'var(--warning-dim)',
              borderRadius: 12, display: 'inline-block',
            }}>
              {violation.fixApplied
                ? `variant: ${violation.suggestedFix}`
                : `variant: ${violation.evidence.split('"')[1] || '?'}`}
            </div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: sevColor, background: sevDim,
            padding: '3px 8px', borderRadius: 4,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {violation.severity}
          </span>
          {showFixed && violation.fixApplied && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: 'var(--bg)', background: 'var(--success)',
              padding: '3px 8px', borderRadius: 4,
              animation: 'pulseFixed 600ms ease-out',
              letterSpacing: '0.05em',
            }}>
              FIXED
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page Component ────────────────────────────────────
export default function ScanPage() {
  // ─── State ──────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [customExpanded, setCustomExpanded] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  // Scanning animation
  const [scanProgress, setScanProgress] = useState(0)
  const [scanSteps, setScanSteps] = useState<{ label: string; done: boolean }[]>([
    { label: 'Loading fixture...', done: false },
    { label: 'Applying ruleset...', done: false },
    { label: 'Running checks...', done: false },
    { label: 'Building report...', done: false },
  ])

  // Engine state
  const [config, setConfig] = useState<MuteformConfig | null>(null)
  const [artifact, setArtifact] = useState<InterfaceDefinition | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [report, setReport] = useState<GovernanceReport | null>(null)

  // Context banner
  const [systemName, setSystemName] = useState('Acme Design System')
  const [ruleCount, setRuleCount] = useState(6)

  // Post-governance
  const [activeTab, setActiveTab] = useState<'original' | 'violations' | 'governed'>('violations')
  const [fixesApplied, setFixesApplied] = useState(0)
  const [applyingGovernance, setApplyingGovernance] = useState(false)

  // ─── Load context on mount ────────────────────────
  useEffect(() => {
    const ds = loadDesignSystem()
    if (ds) {
      setSystemName(ds.sourceLabel)
    }
    try {
      const cfg = loadConfig(DEMO_YAML)
      setConfig(cfg)
      setRuleCount(cfg.rules.length)
    } catch {
      // fallback
    }
  }, [])

  // ─── Fixture descriptions for cards ───────────────
  const fixtureCards: {
    id: string
    name: string
    source: string
    nodeCount: number
    description: string
  }[] = FIXTURES.filter(f => f.id !== 'checkout').map(f => ({
    id: f.id,
    name: f.name,
    source: f.source,
    nodeCount: f.nodeCount,
    description: f.description,
  }))

  // ─── Parse custom input ───────────────────────────
  const parseCustomInput = useCallback((input: string): InterfaceDefinition | null => {
    setParseError(null)
    if (!input.trim()) return null

    // Try JSON: InterfaceDefinition format
    try {
      const parsed = JSON.parse(input)
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        return parsed as InterfaceDefinition
      }
      // Try raw nodes array
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
        return {
          nodes: parsed,
          metadata: { source: 'custom', platform: 'web', generatedAt: new Date().toISOString() },
        }
      }
    } catch {
      // Not JSON
    }

    // Try HTML
    if (input.trim().startsWith('<')) {
      try {
        const { parseHTML } = require('@/lib/engine')
        const result = parseHTML(input)
        if (result.nodes.length > 0) return result
      } catch {
        // Not valid HTML
      }
    }

    setParseError("Could not parse that input. Try pasting valid JSON with a 'nodes' array, or raw HTML.")
    return null
  }, [])

  // ─── Run scan ─────────────────────────────────────
  const runScan = useCallback(async (fixtureId: string | null, customArtifact: InterfaceDefinition | null) => {
    if (!config) return

    let art: InterfaceDefinition | null = null
    let fixtureName = 'Custom Input'
    let fixtureSource = 'User Input'

    if (fixtureId) {
      const fixture = getFixture(fixtureId)
      if (!fixture) return
      art = fixture.artifact
      fixtureName = fixture.name
      fixtureSource = fixture.source
    } else if (customArtifact) {
      art = customArtifact
    }

    if (!art) return
    setArtifact(art)

    // Start scanning animation
    setPhase('scanning')
    setScanProgress(0)
    setScanSteps([
      { label: 'Loading fixture...', done: false },
      { label: 'Applying ruleset...', done: false },
      { label: 'Running checks...', done: false },
      { label: 'Building report...', done: false },
    ])

    // Actually run the scan immediately
    const result = scanArtifact(art, config)
    setScanResult(result)

    // Build initial report (no rewrite yet)
    const initialReport = buildGovernanceReport(fixtureName, fixtureSource, art, result, null, config)
    setReport(initialReport)

    // Animate the scanning steps
    const stepTimings = [300, 600, 1000, 1500]
    for (let i = 0; i < stepTimings.length; i++) {
      await new Promise<void>(resolve => {
        setTimeout(() => {
          setScanSteps(prev => prev.map((s, idx) => idx <= i ? { ...s, done: true } : s))
          setScanProgress(((i + 1) / stepTimings.length) * 100)
          resolve()
        }, i === 0 ? stepTimings[i] : stepTimings[i] - stepTimings[i - 1])
      })
    }

    // Brief pause after last step completes
    await new Promise<void>(resolve => setTimeout(resolve, 200))
    setPhase('results')
  }, [config])

  // ─── Handle fixture selection ─────────────────────
  const handleSelectFixture = useCallback((fixtureId: string) => {
    setSelectedFixture(fixtureId)
    setCustomExpanded(false)
    setParseError(null)
    runScan(fixtureId, null)
  }, [runScan])

  // ─── Handle custom paste submission ───────────────
  const handleCustomSubmit = useCallback(() => {
    const parsed = parseCustomInput(customInput)
    if (parsed) {
      setSelectedFixture(null)
      runScan(null, parsed)
    }
  }, [customInput, parseCustomInput, runScan])

  // ─── Apply governance ─────────────────────────────
  const handleApplyGovernance = useCallback(async () => {
    if (!artifact || !config || !scanResult || !report) return
    setApplyingGovernance(true)
    setFixesApplied(0)

    const rw = rewriteArtifact(artifact, scanResult.violations, config)
    setRewriteResult(rw)

    // Build the post-governance report
    const fixtureName = report.fixtureName
    const fixtureSource = report.fixtureSource
    const govReport = buildGovernanceReport(fixtureName, fixtureSource, artifact, scanResult, rw, config)

    // Animate fixes applying one by one
    const totalFixes = rw.appliedFixes.length
    for (let i = 0; i < totalFixes; i++) {
      await new Promise<void>(resolve => {
        setTimeout(() => {
          setFixesApplied(i + 1)
          resolve()
        }, 200)
      })
    }

    setReport(govReport)

    // Brief pause before reveal
    await new Promise<void>(resolve => setTimeout(resolve, 300))
    setPhase('governed')
    setApplyingGovernance(false)

    // Persist
    saveScanResult({
      fixtureName,
      fixtureSource,
      scanResult,
      rewriteResult: rw,
    })
    saveReport(govReport)
    markStepComplete(2)

    // Fire and forget Supabase sync
    const session = loadSession()
    syncScanReport(session.user?.id ?? null, govReport).catch(() => {})
  }, [artifact, config, scanResult, report])

  // ─── Render ───────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <Stepper />
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}>
        {/* Context Banner */}
        <div style={{
          padding: '12px 24px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block',
            }} />
            {systemName} &middot; {ruleCount} rules active
          </span>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

          {/* ═══════════════════════════════════════════════
              PHASE 1: FIXTURE SELECTION
              ═══════════════════════════════════════════════ */}
          {phase === 'select' && (
            <div style={{ animation: 'fadeIn 300ms ease' }}>
              <div style={{ marginBottom: 40 }}>
                <h1 style={{
                  fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700,
                  color: 'var(--text-primary)', margin: 0, marginBottom: 8,
                  lineHeight: 1.2,
                }}>
                  Scan Artifact
                </h1>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-secondary)', margin: 0,
                }}>
                  Choose an AI-generated UI fixture or paste your own code to scan against the active ruleset.
                </p>
              </div>

              {/* Fixture cards grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}>
                {fixtureCards.map(f => {
                  const isSelected = selectedFixture === f.id
                  const isHovered = hoveredCard === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFixture(f.id)}
                      onMouseEnter={() => setHoveredCard(f.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      style={{
                        background: 'var(--surface)',
                        border: isSelected
                          ? '1px solid var(--accent)'
                          : isHovered
                          ? '1px solid var(--border-strong)'
                          : '1px solid var(--border)',
                        borderRadius: 4,
                        padding: 20,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 200ms ease',
                        outline: 'none',
                      }}
                    >
                      <div style={{
                        fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
                        color: 'var(--text-primary)', marginBottom: 6,
                      }}>
                        {f.name}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{
                          background: 'var(--accent-dim)', color: 'var(--accent)',
                          padding: '2px 6px', borderRadius: 3,
                          fontSize: 10, fontWeight: 600,
                        }}>
                          {f.source.replace(' output', '')}
                        </span>
                        <span>{f.nodeCount} nodes</span>
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
                      }}>
                        {f.description}
                      </div>
                    </button>
                  )
                })}

                {/* Custom input card */}
                <button
                  onClick={() => {
                    setCustomExpanded(!customExpanded)
                    setSelectedFixture(null)
                    setParseError(null)
                  }}
                  onMouseEnter={() => setHoveredCard('custom')}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: customExpanded ? 'var(--surface)' : 'var(--bg)',
                    border: customExpanded
                      ? '1px solid var(--accent)'
                      : hoveredCard === 'custom'
                      ? '1px solid var(--border-strong)'
                      : '1px solid var(--border)',
                    borderRadius: 4,
                    padding: 20,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 200ms ease',
                    outline: 'none',
                    borderStyle: customExpanded ? 'solid' : 'dashed',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
                    color: customExpanded ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 6,
                  }}>
                    + Paste your own
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
                  }}>
                    JSON (InterfaceDefinition or nodes array) or HTML
                  </div>
                </button>
              </div>

              {/* Custom input expanded area */}
              {customExpanded && (
                <div style={{
                  animation: 'fadeInUp 200ms ease',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: 20,
                  marginBottom: 24,
                }}>
                  <textarea
                    value={customInput}
                    onChange={e => { setCustomInput(e.target.value); setParseError(null) }}
                    placeholder={'Paste JSON or HTML here...\n\n{\n  "nodes": [\n    {\n      "id": "btn-1",\n      "type": "interactive",\n      "path": "root > button",\n      "properties": { ... }\n    }\n  ],\n  "metadata": { ... }\n}'}
                    style={{
                      width: '100%', minHeight: 200,
                      background: 'var(--code-bg)', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
                      border: '1px solid var(--border)',
                      borderRadius: 4, padding: 16,
                      resize: 'vertical', outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 200ms ease',
                    }}
                  />
                  {parseError && (
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--error)',
                      marginTop: 10, padding: '8px 12px',
                      background: 'var(--error-dim)', borderRadius: 4,
                    }}>
                      {parseError}
                    </div>
                  )}
                  <button
                    onClick={handleCustomSubmit}
                    onMouseEnter={() => setHoveredBtn('custom-submit')}
                    onMouseLeave={() => setHoveredBtn(null)}
                    disabled={!customInput.trim()}
                    style={{
                      marginTop: 12,
                      fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
                      color: 'var(--bg)',
                      background: !customInput.trim() ? 'var(--border)' : 'var(--accent)',
                      border: 'none', borderRadius: 4,
                      padding: '10px 24px', cursor: !customInput.trim() ? 'default' : 'pointer',
                      transition: 'all 200ms ease',
                      opacity: !customInput.trim() ? 0.5 : 1,
                    }}
                  >
                    Scan this code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              PHASE 2: SCANNING ANIMATION
              ═══════════════════════════════════════════════ */}
          {phase === 'scanning' && (
            <div style={{
              animation: 'fadeIn 150ms ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: 400,
            }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700,
                color: 'var(--text-primary)', marginBottom: 32,
              }}>
                Scanning interface
              </div>

              {/* Progress bar */}
              <div style={{
                width: '100%', maxWidth: 400, height: 4,
                background: 'var(--surface-elevated)', borderRadius: 2,
                overflow: 'hidden', marginBottom: 32,
              }}>
                <div style={{
                  height: '100%', background: 'var(--accent)',
                  borderRadius: 2,
                  width: `${scanProgress}%`,
                  transition: 'width 300ms ease',
                }} />
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
                {scanSteps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: step.done ? 1 : (i === 0 || scanSteps[i - 1]?.done) ? 0.8 : 0.3,
                    transition: 'opacity 200ms ease',
                  }}>
                    <span style={{
                      width: 20, height: 20,
                      borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: step.done ? 'var(--success-dim)' : 'var(--surface-elevated)',
                      border: step.done ? '1px solid var(--success)' : '1px solid var(--border)',
                      color: step.done ? 'var(--success)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                      transition: 'all 200ms ease',
                      flexShrink: 0,
                    }}>
                      {step.done ? '\u2713' : ''}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13,
                      color: step.done ? 'var(--success)' : 'var(--text-muted)',
                      transition: 'color 200ms ease',
                    }}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              PHASE 3: SCAN RESULTS
              ═══════════════════════════════════════════════ */}
          {phase === 'results' && report && (
            <div style={{ animation: 'fadeIn 150ms ease' }}>
              {/* Health Score Ring */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: 40,
              }}>
                <ScoreRing score={report.overallScore} size={140} strokeWidth={7} label="BEFORE GOVERNANCE" />
              </div>

              {/* Category breakdown */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 4, padding: 24, marginBottom: 24,
              }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
                  color: 'var(--text-primary)', marginBottom: 16,
                }}>
                  Category Breakdown
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.entries(CATEGORY_WEIGHTS).map(([key, weight]) => {
                    const cat = report.categories.find(c => {
                      if (key === 'color') return c.key === 'token'
                      if (key === 'components') return c.key === 'component'
                      return c.key === key
                    })
                    const score = cat?.score ?? 100
                    const barColor = scoreColorVar(score)
                    const label = key.charAt(0).toUpperCase() + key.slice(1)
                    return (
                      <div key={key}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginBottom: 6,
                        }}>
                          <span style={{
                            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
                          }}>
                            {label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
                            }}>
                              {Math.round(weight * 100)}%
                            </span>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 12, color: barColor, fontWeight: 600,
                            }}>
                              {score}
                            </span>
                          </div>
                        </div>
                        <div style={{
                          width: '100%', height: 6, background: 'var(--border)', borderRadius: 3,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${score}%`,
                            background: barColor, borderRadius: 3,
                            transition: 'width 800ms cubic-bezier(0.22, 1, 0.36, 1)',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Violation summary cards */}
              <div className="grid-3" style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12, marginBottom: 32,
              }}>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: 20, textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--success)',
                    lineHeight: 1,
                  }}>
                    {report.autoFixedCount + report.violations.filter(v => !v.fixApplied && v.severity === 'auto-fix').length}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
                    letterSpacing: '0.05em',
                  }}>
                    Auto-fixable
                  </div>
                </div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: 20, textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--warning)',
                    lineHeight: 1,
                  }}>
                    {report.warningCount}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
                    letterSpacing: '0.05em',
                  }}>
                    Warnings
                  </div>
                </div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: 20, textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--error)',
                    lineHeight: 1,
                  }}>
                    {report.blockedCount}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
                    letterSpacing: '0.05em',
                  }}>
                    Blocked
                  </div>
                </div>
              </div>

              {/* APPLY GOVERNANCE BUTTON */}
              <button
                onClick={handleApplyGovernance}
                onMouseEnter={() => setHoveredBtn('apply')}
                onMouseLeave={() => setHoveredBtn(null)}
                disabled={applyingGovernance}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700,
                  color: 'var(--bg)', background: 'var(--accent)',
                  border: 'none', borderRadius: 4,
                  padding: '16px 32px',
                  cursor: applyingGovernance ? 'wait' : 'pointer',
                  transition: 'all 200ms ease',
                  filter: hoveredBtn === 'apply' ? 'brightness(0.92)' : 'brightness(1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  letterSpacing: '0.02em',
                }}
              >
                {applyingGovernance ? (
                  <span>Applying fixes... ({fixesApplied})</span>
                ) : (
                  <>
                    <span>Apply Governance</span>
                    <span style={{ fontSize: 18 }}>{'\u2192'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              PHASE 4: POST-GOVERNANCE
              ═══════════════════════════════════════════════ */}
          {phase === 'governed' && report && (
            <div style={{ animation: 'fadeIn 150ms ease' }}>
              {/* Governed banner */}
              <div style={{
                width: '100%', textAlign: 'center', padding: '16px 20px',
                background: 'var(--success-dim)', borderRadius: 4, marginBottom: 20,
                border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
                  color: 'var(--success)', marginBottom: 4,
                }}>
                  Governed &mdash; ready to ship
                </div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)',
                }}>
                  {report.autoFixedCount} fixes applied &middot; {report.warningCount} warning{report.warningCount !== 1 ? 's' : ''} &middot; {report.blockedCount} blocked
                </div>
              </div>

              {/* Before / After comparison */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 40, marginBottom: 16, flexWrap: 'wrap',
              }}>
                <ScoreRing
                  score={report.overallScore}
                  size={110}
                  strokeWidth={6}
                  label="BEFORE"
                  animate={false}
                />
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700,
                    color: 'var(--success)',
                  }}>
                    +{report.afterScore - report.overallScore}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    points
                  </span>
                </div>
                <AnimatedScoreRing
                  fromScore={report.overallScore}
                  toScore={report.afterScore}
                  size={110}
                  strokeWidth={6}
                  label="AFTER"
                />
              </div>

              {/* Violation summary (post-governance) */}
              <div className="grid-3" style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12, marginBottom: 32,
              }}>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: 16, textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--success)', lineHeight: 1,
                  }}>
                    {report.autoFixedCount}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4,
                    letterSpacing: '0.05em',
                  }}>
                    Auto-fixed
                  </div>
                </div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: 16, textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--warning)', lineHeight: 1,
                  }}>
                    {report.warningCount}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4,
                    letterSpacing: '0.05em',
                  }}>
                    Warnings
                  </div>
                </div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: 16, textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--error)', lineHeight: 1,
                  }}>
                    {report.blockedCount}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4,
                    letterSpacing: '0.05em',
                  }}>
                    Blocked
                  </div>
                </div>
              </div>

              {/* Three-tab diff view */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 4, overflow: 'hidden', marginBottom: 32,
              }}>
                {/* Tab bar */}
                <div style={{
                  display: 'flex', borderBottom: '1px solid var(--border)',
                }}>
                  {(['original', 'violations', 'governed'] as const).map(tab => {
                    const isActive = activeTab === tab
                    const tabLabel = tab === 'original' ? 'Original'
                      : tab === 'violations' ? 'Violations'
                      : 'Governed Output'
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          flex: 1, padding: '12px 16px',
                          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                          background: isActive ? 'var(--accent-dim)' : 'transparent',
                          border: 'none',
                          borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 200ms ease',
                        }}
                      >
                        {tabLabel}
                      </button>
                    )
                  })}
                </div>

                {/* Tab content */}
                <div style={{ padding: 20, maxHeight: 500, overflowY: 'auto' }}>
                  {activeTab === 'original' && artifact && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {artifact.nodes.map(node => {
                        const hasViolation = report.violations.some(v => v.nodeId === node.id)
                        return (
                          <div key={node.id} style={{
                            fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
                            padding: '10px 14px', borderRadius: 4,
                            background: hasViolation ? 'var(--error-dim)' : 'var(--surface-elevated)',
                            border: hasViolation ? '1px solid var(--error)' : '1px solid var(--border)',
                          }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                              {node.path}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                              {node.type} &middot; id: {node.id}
                              {node.properties.colors && (
                                <span> &middot; colors: {Object.values(node.properties.colors).join(', ')}</span>
                              )}
                              {node.properties.spacing && (
                                <span> &middot; spacing: {JSON.stringify(node.properties.spacing)}</span>
                              )}
                              {node.properties.component && (
                                <span> &middot; component: {node.properties.component.name}/{node.properties.component.variant}</span>
                              )}
                              {node.properties.typography?.style && (
                                <span> &middot; style: {node.properties.typography.style}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {activeTab === 'violations' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {report.violations.length === 0 ? (
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--success)',
                          textAlign: 'center', padding: 32,
                        }}>
                          No violations found
                        </div>
                      ) : (
                        report.violations.map((v, i) => (
                          <ViolationCard key={v.id} violation={v} index={i} showFixed />
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'governed' && rewriteResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rewriteResult.rewrittenArtifact.nodes.map(node => {
                        const wasFixed = rewriteResult.appliedFixes.some(f => f.nodeId === node.id)
                        return (
                          <div key={node.id} style={{
                            fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
                            padding: '10px 14px', borderRadius: 4,
                            background: wasFixed ? 'var(--success-dim)' : 'var(--surface-elevated)',
                            border: wasFixed ? '1px solid var(--success)' : '1px solid var(--border)',
                          }}>
                            <div style={{
                              color: wasFixed ? 'var(--success)' : 'var(--text-primary)',
                              fontWeight: 600, marginBottom: 4,
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                              {node.path}
                              {wasFixed && (
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                                  color: 'var(--bg)', background: 'var(--success)',
                                  padding: '2px 6px', borderRadius: 3,
                                  animation: 'pulseFixed 600ms ease-out',
                                }}>
                                  FIXED
                                </span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                              {node.type} &middot; id: {node.id}
                              {node.properties.colors && (
                                <span> &middot; colors: {Object.values(node.properties.colors).join(', ')}</span>
                              )}
                              {node.properties.spacing && (
                                <span> &middot; spacing: {JSON.stringify(node.properties.spacing)}</span>
                              )}
                              {node.properties.component && (
                                <span> &middot; component: {node.properties.component.name}/{node.properties.component.variant}</span>
                              )}
                              {node.properties.typography?.style && (
                                <span> &middot; style: {node.properties.typography.style}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom actions */}
              <div className="action-bar-mobile" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, flexWrap: 'wrap',
              }}>
                <a
                  href="/report"
                  onMouseEnter={() => setHoveredBtn('report')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
                    color: 'var(--accent)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 200ms ease',
                  }}
                >
                  View full report {'\u2192'}
                </a>
                <button
                  onClick={() => {
                    setPhase('select')
                    setSelectedFixture(null)
                    setCustomExpanded(false)
                    setCustomInput('')
                    setParseError(null)
                    setScanResult(null)
                    setRewriteResult(null)
                    setReport(null)
                    setArtifact(null)
                    setActiveTab('violations')
                    setFixesApplied(0)
                  }}
                  onMouseEnter={() => setHoveredBtn('another')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
                    color: 'var(--text-secondary)', background: 'transparent',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4, padding: '10px 20px',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  Scan another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
