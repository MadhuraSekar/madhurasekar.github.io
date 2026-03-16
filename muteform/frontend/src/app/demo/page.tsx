'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact, scoreFromViolations } from '@/lib/engine'
import type { MuteformConfig, Violation, ScanResult, RewriteResult, Fix } from '@/lib/engine'
import { CHECKOUT_FLOW, CHECKOUT_WIREFRAME } from '@/lib/fixtures'

// ─── Design tokens ───────────────────────────────────────────
const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718', greenGlow: '#00e08733',
  red: '#ff4070', redDim: '#ff407018',
  amber: '#ffb830', amberDim: '#ffb83018',
  blue: '#4090ff', blueDim: '#4090ff18',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', 'Inter', system-ui, sans-serif"
const serif = "'Instrument Serif', Georgia, serif"

// ─── Severity display ────────────────────────────────────────
const SEV: Record<string, { color: string; dim: string; label: string }> = {
  critical: { color: T.red, dim: T.redDim, label: 'CRITICAL' },
  high: { color: T.red, dim: T.redDim, label: 'HIGH' },
  medium: { color: T.amber, dim: T.amberDim, label: 'MEDIUM' },
  low: { color: T.muted, dim: `${T.muted}18`, label: 'LOW' },
}

// ─── YAML config for the demo ────────────────────────────────
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

const DEMO_YAML_LINES = DEMO_YAML.split('\n')

// ─── Log entry type ──────────────────────────────────────────
interface LogEntry {
  text: string
  phase: 'init' | 'scan' | 'intercept' | 'generate' | 'fix' | 'done' | 'skip'
}

// ─── Demo phases ─────────────────────────────────────────────
type Phase = 'idle' | 'typing' | 'intercept' | 'generate' | 'scanning' | 'violations' | 'fixing' | 'done'

export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [yamlLine, setYamlLine] = useState(0)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [scanY, setScanY] = useState(0)
  const [visibleViolations, setVisibleViolations] = useState<Violation[]>([])
  const [fixedNodeIds, setFixedNodeIds] = useState<Set<string>>(new Set())
  const [fixedRuleNodeKeys, setFixedRuleNodeKeys] = useState<Set<string>>(new Set())
  const [score, setScore] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [shipIt, setShipIt] = useState(false)
  const [skippedCount, setSkippedCount] = useState(0)

  const logRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRunning = useRef(false)

  // Pre-computed engine results
  const engineData = useRef<{
    config: MuteformConfig
    scanResult: ScanResult
    rewriteResult: RewriteResult
  } | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    isRunning.current = false
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logEntries])

  const addLog = useCallback((entry: LogEntry) => {
    setLogEntries(prev => [...prev, entry])
  }, [])

  const delay = (ms: number) => new Promise<void>(r => { timerRef.current = setTimeout(r, ms) })

  // Build a unique key for a violation
  const vKey = (v: Violation) => `${v.ruleId}::${v.nodeId}::${v.property}`

  // ─── Map node IDs to wireframe blocks ──────────────────────
  const violationNodeIds = useMemo(() => {
    const set = new Set<string>()
    visibleViolations.forEach(v => set.add(v.nodeId))
    return set
  }, [visibleViolations])

  // ─── Compute which wireframe nodes have violations ─────────
  const nodeHasViolation = useCallback((nodeId: string) => {
    return visibleViolations.some(v => v.nodeId === nodeId && !fixedRuleNodeKeys.has(vKey(v)))
  }, [visibleViolations, fixedRuleNodeKeys])

  const nodeIsFixed = useCallback((nodeId: string) => {
    return fixedNodeIds.has(nodeId)
  }, [fixedNodeIds])

  // ─── Run the demo ──────────────────────────────────────────
  const runDemo = useCallback(async () => {
    if (isRunning.current) return
    isRunning.current = true

    // Reset state
    setPhase('idle')
    setYamlLine(0)
    setLogEntries([])
    setScanY(0)
    setVisibleViolations([])
    setFixedNodeIds(new Set())
    setFixedRuleNodeKeys(new Set())
    setScore(0)
    setExpanded(null)
    setShipIt(false)
    setSkippedCount(0)

    // Pre-compute engine results
    const config = loadConfig(DEMO_YAML)
    const scanResult = scanArtifact(CHECKOUT_FLOW, config)
    const rewriteResult = rewriteArtifact(CHECKOUT_FLOW, scanResult.violations, config)
    engineData.current = { config, scanResult, rewriteResult }

    const colorCount = Object.keys(config.tokens.colors || {}).length
    const spacingCount = config.tokens.spacing?.scale?.length || 0

    await delay(300)

    // ─── Phase 1: Typing ───────────────────────────────────
    setPhase('typing')

    // Log entries during typing appear at specific YAML lines
    for (let i = 0; i <= DEMO_YAML_LINES.length && isRunning.current; i++) {
      setYamlLine(i)
      if (i === 2) addLog({ text: 'Muteform engine initialized', phase: 'init' })
      if (i === 8) addLog({ text: 'Loading ruleset...', phase: 'init' })
      if (i === 15) addLog({ text: `Parsed ${config.rules.length} rules`, phase: 'init' })
      if (i === 25) addLog({ text: `Token palette loaded: ${colorCount} colors, ${spacingCount} spacing values`, phase: 'init' })
      await delay(35)
    }
    if (!isRunning.current) return

    // ─── Phase 2: Intercept ────────────────────────────────
    setPhase('intercept')
    addLog({ text: 'Intercepted generation request', phase: 'intercept' })
    await delay(400)
    addLog({ text: 'Injecting design constraints...', phase: 'intercept' })
    await delay(300)

    // ─── Phase 3: Generate ─────────────────────────────────
    setPhase('generate')
    addLog({ text: 'AI generating interface: Checkout Flow', phase: 'generate' })
    await delay(600)
    addLog({ text: `Generation complete. ${CHECKOUT_FLOW.nodes.length} nodes detected.`, phase: 'generate' })
    await delay(400)

    // ─── Phase 4: Scanning ─────────────────────────────────
    setPhase('scanning')
    addLog({ text: `Scanning ${scanResult.nodesScanned} nodes against ${scanResult.rulesEvaluated} rules...`, phase: 'scan' })

    // Build a map: nodeId -> violations for that node
    const violationsByNode = new Map<string, Violation[]>()
    for (const v of scanResult.violations) {
      const existing = violationsByNode.get(v.nodeId) || []
      existing.push(v)
      violationsByNode.set(v.nodeId, existing)
    }

    const nodes = CHECKOUT_FLOW.nodes
    const wireframe = CHECKOUT_WIREFRAME
    const totalScanSteps = nodes.length
    let scanNodeIndex = 0

    for (let y = 0; y <= 100 && isRunning.current; y += 2) {
      setScanY(y)

      // Check if any node's wireframe position is being scanned
      while (scanNodeIndex < totalScanSteps) {
        const node = nodes[scanNodeIndex]
        const block = wireframe.find(b => b.id === node.id)
        const nodeY = block ? block.y : (scanNodeIndex / totalScanSteps) * 100

        if (y >= nodeY) {
          const nodeViolations = violationsByNode.get(node.id)
          const nodeName = node.path.split(' > ').pop() || node.id

          if (nodeViolations && nodeViolations.length > 0) {
            for (const nv of nodeViolations) {
              addLog({
                text: `Scanning node: ${nodeName} \u2717 ${nv.severity.toUpperCase()}: ${nv.ruleId}`,
                phase: 'scan',
              })
              setVisibleViolations(prev => [...prev, nv])
            }
          } else {
            addLog({ text: `Scanning node: ${nodeName} \u2713`, phase: 'scan' })
          }
          scanNodeIndex++
        } else {
          break
        }
      }

      await delay(25)
    }
    if (!isRunning.current) return

    addLog({
      text: `Scan complete. ${scanResult.violations.length} violations found. Health score: ${scanResult.score}`,
      phase: 'scan',
    })

    // ─── Phase 5: Violations pause ─────────────────────────
    setPhase('violations')

    // Animate score counting up to beforeScore
    const beforeScore = rewriteResult.beforeScore
    const scoreSteps = 20
    for (let s = 1; s <= scoreSteps && isRunning.current; s++) {
      setScore(Math.round((beforeScore * s) / scoreSteps))
      await delay(60)
    }
    setScore(beforeScore)
    await delay(600)

    // ─── Phase 6: Auto-fixing ──────────────────────────────
    setPhase('fixing')
    addLog({ text: 'Auto-remediation starting...', phase: 'fix' })
    await delay(400)

    const autoFixable = scanResult.violations.filter(v => v.autoFixAvailable)
    const notFixable = scanResult.violations.filter(v => !v.autoFixAvailable)
    const totalFixes = autoFixable.length
    let fixCount = 0

    // Build remaining violations for progressive score
    let remainingViolations = [...scanResult.violations]

    for (const violation of autoFixable) {
      if (!isRunning.current) return
      fixCount++

      // Generate fix description
      let fixDesc = ''
      if (violation.property.startsWith('colors.')) {
        fixDesc = `Snapping color ${violation.currentValue} \u2192 ${violation.suggestedValue}`
      } else if (violation.property.startsWith('spacing.')) {
        fixDesc = `Snapping spacing ${violation.currentValue} \u2192 ${violation.suggestedValue}`
      } else if (violation.property === 'contrast.ratio') {
        fixDesc = `Adjusting foreground for WCAG AA contrast`
      } else if (violation.property === 'component.variant') {
        fixDesc = `Replacing variant "${violation.currentValue}" \u2192 "${violation.suggestedValue}"`
      } else if (violation.property === 'typography.style') {
        fixDesc = `Snapping typography style "${violation.currentValue}" \u2192 "${violation.suggestedValue}"`
      } else {
        fixDesc = `Fixing ${violation.property}: ${violation.currentValue} \u2192 ${violation.suggestedValue}`
      }

      addLog({
        text: `FIX ${fixCount}/${totalFixes}: ${fixDesc} \u2713`,
        phase: 'fix',
      })

      // Remove this violation from remaining and recalculate score
      const key = vKey(violation)
      remainingViolations = remainingViolations.filter(v => vKey(v) !== key)
      const newScore = scoreFromViolations(remainingViolations)
      setScore(newScore)

      // Mark as fixed
      setFixedRuleNodeKeys(prev => new Set(prev).add(key))
      // Check if all violations for this node are now fixed
      const nodeStillHasViolations = remainingViolations.some(v => v.nodeId === violation.nodeId && v.autoFixAvailable)
      const nodeHasUnfixable = remainingViolations.some(v => v.nodeId === violation.nodeId && !v.autoFixAvailable)
      if (!nodeStillHasViolations) {
        setFixedNodeIds(prev => new Set(prev).add(violation.nodeId))
      }

      await delay(500)
    }

    // Skip non-auto-fixable
    for (const violation of notFixable) {
      if (!isRunning.current) return
      addLog({
        text: `SKIP: ${violation.ruleId} (requires human review)`,
        phase: 'skip',
      })
      await delay(300)
    }
    setSkippedCount(notFixable.length)

    const totalTime = ((scanResult.scanDurationMs || 0) / 1000 + 1.4).toFixed(1)
    addLog({
      text: `${fixCount}/${scanResult.violations.length} auto-remediated \u00b7 ${notFixable.length} human intervention \u00b7 ${totalTime}s total`,
      phase: 'fix',
    })
    await delay(500)

    // ─── Phase 7: Done ─────────────────────────────────────
    setPhase('done')
    setScore(rewriteResult.afterScore)
    addLog({
      text: `Governed UI ready to ship. Final score: ${rewriteResult.afterScore}`,
      phase: 'done',
    })
    setShipIt(true)
    isRunning.current = false
  }, [addLog])

  const handleRestart = () => {
    cleanup()
    setShipIt(false)
    setTimeout(runDemo, 100)
  }

  const logColor = (p: string) => {
    if (p === 'fix') return T.green
    if (p === 'scan') return T.blue
    if (p === 'intercept') return T.amber
    if (p === 'generate') return T.amber
    if (p === 'done') return T.green
    if (p === 'skip') return T.amber
    return T.muted
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        @keyframes scanLine { from { top: 0% } to { top: 100% } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px ${T.greenGlow} } 50% { box-shadow: 0 0 40px ${T.green}44 } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes scoreUp { from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      {/* ─── Top Bar ─── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
          </div>
          <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright, letterSpacing: '-0.02em' }}>
            muteform
          </span>
          <span style={{
            fontFamily: mono, fontSize: 9, color: T.green,
            background: T.greenDim, padding: '2px 8px', borderRadius: 4,
            border: `1px solid ${T.green}33`, letterSpacing: '0.08em',
          }}>
            LIVE DEMO
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {phase === 'idle' ? (
            <button onClick={runDemo} style={btnStyle(T.green, T.bg)}>
              &#9654; RUN DEMO
            </button>
          ) : phase === 'done' ? (
            <button onClick={handleRestart} style={btnStyle(T.green, T.bg)}>
              &#8635; RESTART
            </button>
          ) : (
            <span style={{
              fontFamily: mono, fontSize: 10, color: T.green,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: T.green, animation: 'pulse 1s infinite',
              }} />
              {phase === 'typing' ? 'LOADING RULES' :
               phase === 'intercept' ? 'INTERCEPTING' :
               phase === 'generate' ? 'GENERATING' :
               phase === 'scanning' ? 'SCANNING' :
               phase === 'violations' ? 'VIOLATIONS FOUND' :
               phase === 'fixing' ? 'AUTO-FIXING' : 'RUNNING'}
            </span>
          )}
          {shipIt && (
            <span style={{
              fontFamily: mono, fontSize: 10, fontWeight: 700,
              color: T.bg, background: T.green,
              padding: '4px 12px', borderRadius: 4,
              letterSpacing: '0.1em',
              animation: 'glow 2s ease-in-out infinite',
            }}>
              SHIP IT
            </span>
          )}
        </div>
      </div>

      {/* ─── Hero ─── */}
      <div style={{
        padding: '36px 20px 24px', maxWidth: 1200, margin: '0 auto', textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: serif, fontSize: 38, fontWeight: 400,
          color: T.textBright, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0,
        }}>
          Design governance for<br />AI-generated interfaces
        </h1>
        <p style={{
          fontFamily: mono, fontSize: 12, color: T.muted,
          marginTop: 10, lineHeight: 1.6, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Token rules + Design principles. Enforced at the point of AI generation.
        </p>
      </div>

      {/* ─── Two-Column Layout ─── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 20px 60px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
      }}>
        {/* ═══ LEFT COLUMN ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* YAML Panel */}
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            overflow: 'hidden', flex: '0 0 auto',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.green, letterSpacing: '0.06em' }}>
                  .muteform.yml
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
              </div>
            </div>
            <div style={{
              padding: '12px 14px', fontFamily: mono, fontSize: 11, lineHeight: 1.7,
              maxHeight: 320, overflowY: 'auto', background: T.bg,
            }}>
              {DEMO_YAML_LINES.slice(0, yamlLine).map((line, i) => (
                <div key={i} style={{
                  animation: 'fadeIn 0.15s ease',
                  whiteSpace: 'pre',
                  color: yamlSyntaxColor(line),
                }}>
                  <span style={{ color: T.dim, userSelect: 'none', display: 'inline-block', width: 28, textAlign: 'right', marginRight: 12 }}>
                    {i + 1}
                  </span>
                  {renderYamlLine(line)}
                </div>
              ))}
              {phase === 'typing' && (
                <span style={{ color: T.green, animation: 'pulse 0.6s infinite' }}>&#9612;</span>
              )}
            </div>
          </div>

          {/* Engine Log */}
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            overflow: 'hidden', flex: 1, minHeight: 200,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: phase === 'idle' ? T.dim : T.green,
                boxShadow: phase !== 'idle' ? `0 0 8px ${T.green}66` : 'none',
              }} />
              <span style={{ fontFamily: mono, fontSize: 10, color: T.muted, letterSpacing: '0.06em' }}>
                ENGINE LOG
              </span>
            </div>
            <div ref={logRef} style={{
              padding: '10px 14px', fontFamily: mono, fontSize: 10.5, lineHeight: 1.8,
              maxHeight: 300, overflowY: 'auto', background: T.bg,
            }}>
              {logEntries.map((entry, i) => (
                <div key={i} style={{ animation: 'slideIn 0.2s ease', display: 'flex', gap: 8 }}>
                  <span style={{ color: T.dim, flexShrink: 0 }}>
                    {String(i).padStart(2, '0')}
                  </span>
                  <span style={{ color: logColor(entry.phase) }}>
                    {entry.text}
                  </span>
                </div>
              ))}
              {phase !== 'idle' && phase !== 'done' && (
                <span style={{ color: T.green, animation: 'pulse 0.6s infinite' }}>_</span>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Interface Preview */}
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            overflow: 'hidden',
          }}>
            {/* Browser chrome */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
              </div>
              <div style={{
                flex: 1, fontFamily: mono, fontSize: 10, color: T.muted,
                background: T.bg, padding: '3px 10px', borderRadius: 4,
                border: `1px solid ${T.border}`,
              }}>
                acme.com/checkout
              </div>
            </div>

            {/* Wireframe area */}
            <div style={{
              position: 'relative', height: 280, background: T.bg,
              padding: 0, overflow: 'hidden',
            }}>
              {(phase !== 'idle' && phase !== 'typing') && CHECKOUT_WIREFRAME.map(block => {
                const hasViolation = nodeHasViolation(block.id)
                const isFixed = nodeIsFixed(block.id)

                return (
                  <div key={block.id} style={{
                    position: 'absolute',
                    left: `${block.x}%`, top: `${block.y}%`,
                    width: `${block.w}%`, height: `${block.h}%`,
                    background: block.color,
                    borderRadius: 3,
                    border: hasViolation
                      ? `2px solid ${T.red}`
                      : isFixed
                        ? `2px solid ${T.green}`
                        : `1px solid ${T.border}`,
                    animation: hasViolation ? 'pulse 1.5s infinite' : 'fadeIn 0.3s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border 0.3s, box-shadow 0.3s',
                    boxShadow: hasViolation ? `0 0 12px ${T.red}33` :
                               isFixed ? `0 0 8px ${T.green}22` : 'none',
                  }}>
                    <span style={{
                      fontFamily: mono, fontSize: 8, color: T.muted,
                      letterSpacing: '0.04em', opacity: 0.7,
                    }}>
                      {block.label}
                    </span>
                    {hasViolation && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: T.red, fontSize: 8, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: mono, fontWeight: 700,
                      }}>!</span>
                    )}
                    {isFixed && !hasViolation && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: T.green, fontSize: 8, color: T.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: mono, fontWeight: 700,
                      }}>{'\u2713'}</span>
                    )}
                  </div>
                )
              })}

              {/* Scan line */}
              {phase === 'scanning' && (
                <div style={{
                  position: 'absolute', left: 0, right: 0,
                  top: `${scanY}%`, height: 2,
                  background: `linear-gradient(90deg, transparent, ${T.green}, transparent)`,
                  boxShadow: `0 0 12px ${T.green}66`,
                  transition: 'top 0.02s linear',
                  zIndex: 10,
                }} />
              )}

              {/* Green glow overlay when done */}
              {phase === 'done' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(ellipse at center, ${T.green}08, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          </div>

          {/* Health Score */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 20px',
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
          }}>
            <ScoreRingDemo score={score} size={64} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>
                Health Score
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginTop: 2 }}>
                {phase === 'done'
                  ? (() => {
                      const data = engineData.current
                      if (!data) return 'Governed UI ready to ship'
                      const autoFixed = data.rewriteResult.appliedFixes.length
                      const total = data.scanResult.violations.length
                      const skipped = total - autoFixed
                      return `${autoFixed}/${total} auto-remediated \u00b7 ${skipped} human intervention`
                    })()
                  : visibleViolations.length > 0
                    ? `${visibleViolations.length} violations found`
                    : 'Waiting for scan...'}
              </div>
              {phase === 'done' && skippedCount > 0 && (
                <div style={{ fontFamily: mono, fontSize: 10, color: T.amber, marginTop: 2 }}>
                  {skippedCount} requires human review
                </div>
              )}
            </div>
            {score > 0 && (
              <span style={{
                fontFamily: mono, fontSize: 28, fontWeight: 700,
                color: score >= 90 ? T.green : score >= 60 ? T.amber : T.red,
                animation: 'scoreUp 0.3s ease',
              }}>
                {score}
              </span>
            )}
          </div>

          {/* Violations Panel */}
          {visibleViolations.length > 0 && (
            <div style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
              }}>
                <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.textBright }}>
                  Violations
                </span>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>
                  {fixedRuleNodeKeys.size}/{visibleViolations.length} fixed
                </span>
              </div>

              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {visibleViolations.map((v, idx) => {
                  const sev = SEV[v.severity] || SEV.medium
                  const key = vKey(v)
                  const isFixed = fixedRuleNodeKeys.has(key)
                  const isExp = expanded === key

                  return (
                    <div key={key} style={{
                      borderBottom: `1px solid ${T.border}`,
                      opacity: isFixed ? 0.5 : 1,
                      transition: 'opacity 0.3s',
                      animation: 'slideIn 0.2s ease',
                    }}>
                      <div
                        onClick={() => setExpanded(isExp ? null : key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 14px', cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = T.surface2)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{
                          fontFamily: mono, fontSize: 9, width: 12, textAlign: 'center',
                          color: T.dim, transform: isExp ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s', display: 'inline-block',
                        }}>{'\u25B6'}</span>

                        <span style={{
                          fontFamily: mono, fontSize: 9, fontWeight: 600,
                          color: sev.color, background: sev.dim,
                          padding: '2px 6px', borderRadius: 3,
                          border: `1px solid ${sev.color}33`,
                          letterSpacing: '0.06em',
                        }}>{sev.label}</span>

                        <span style={{
                          fontFamily: sans, fontSize: 11, color: T.text, flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: isFixed ? 'line-through' : 'none',
                        }}>
                          {v.message}
                        </span>

                        {isFixed && (
                          <span style={{
                            fontFamily: mono, fontSize: 9, color: T.green,
                            background: T.greenDim, padding: '2px 6px', borderRadius: 3,
                            border: `1px solid ${T.green}33`, letterSpacing: '0.06em',
                          }}>FIXED</span>
                        )}

                        {!v.autoFixAvailable && !isFixed && (
                          <span style={{
                            fontFamily: mono, fontSize: 9, color: T.amber,
                            background: T.amberDim, padding: '2px 6px', borderRadius: 3,
                            border: `1px solid ${T.amber}33`, letterSpacing: '0.06em',
                          }}>MANUAL</span>
                        )}
                      </div>

                      {isExp && (
                        <div style={{
                          padding: '8px 14px 12px 34px', borderTop: `1px solid ${T.border}`,
                          background: T.bg,
                        }}>
                          <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>
                            {v.nodePath}
                          </div>

                          {/* Current -> Suggested */}
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                            gap: 12, alignItems: 'center', margin: '8px 0',
                          }}>
                            <div>
                              <div style={{ fontFamily: mono, fontSize: 8, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>CURRENT</div>
                              {v.property.includes('color') || v.property.includes('contrast') ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {typeof v.currentValue === 'string' && v.currentValue.startsWith('#') && (
                                    <div style={{
                                      width: 24, height: 24, borderRadius: 4,
                                      backgroundColor: v.currentValue,
                                      border: `1px solid ${T.border2}`,
                                    }} />
                                  )}
                                  <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{String(v.currentValue)}</span>
                                </div>
                              ) : (
                                <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{String(v.currentValue)}</span>
                              )}
                            </div>
                            <span style={{ color: T.dim, fontSize: 14 }}>{'\u2192'}</span>
                            <div>
                              <div style={{ fontFamily: mono, fontSize: 8, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>SUGGESTED</div>
                              {v.property.includes('color') && typeof v.suggestedValue === 'string' && v.suggestedValue.startsWith('#') ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{
                                    width: 24, height: 24, borderRadius: 4,
                                    backgroundColor: v.suggestedValue,
                                    border: `1px solid ${T.border2}`,
                                  }} />
                                  <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>{v.suggestedValue}</span>
                                </div>
                              ) : (
                                <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>
                                  {v.suggestedValue != null ? String(v.suggestedValue) : 'N/A'}
                                </span>
                              )}
                            </div>
                          </div>

                          <p style={{
                            fontFamily: sans, fontSize: 11, color: T.muted, lineHeight: 1.5, margin: '6px 0 0',
                          }}>
                            {v.detail}
                          </p>

                          {!isFixed && v.autoFixAvailable && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setFixedRuleNodeKeys(prev => new Set(prev).add(key))
                              }}
                              disabled={phase === 'fixing'}
                              style={{
                                fontFamily: mono, fontSize: 9, letterSpacing: '0.06em',
                                padding: '4px 10px', borderRadius: 3, cursor: phase === 'fixing' ? 'not-allowed' : 'pointer',
                                background: phase === 'fixing' ? T.dim : T.green, color: T.bg, border: 'none',
                                marginTop: 8, transition: 'opacity 0.15s',
                                opacity: phase === 'fixing' ? 0.5 : 1,
                              }}
                            >
                              AUTO-FIX
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CTA Section ─── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px',
        textAlign: 'center',
      }}>
        <div style={{
          padding: '48px 24px',
          background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`,
          borderRadius: 16, border: `1px solid ${T.border}`,
        }}>
          <h2 style={{
            fontFamily: serif, fontSize: 28, fontWeight: 400,
            color: T.textBright, letterSpacing: '-0.02em', marginBottom: 8,
          }}>
            TypeScript for design. Enforced at generation.
          </h2>
          <p style={{
            fontFamily: mono, fontSize: 12, color: T.muted,
            marginBottom: 28, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto',
            lineHeight: 1.6,
          }}>
            Define your rules. AI generates, Muteform intercepts.
            Auto-fix, score, ship.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/playground" style={{
              display: 'inline-block', fontFamily: mono, fontSize: 13, fontWeight: 600,
              color: T.bg, background: T.green, padding: '12px 28px', borderRadius: 8,
              textDecoration: 'none', letterSpacing: '0.02em',
              boxShadow: `0 4px 24px ${T.green}33`, transition: 'opacity 0.15s',
            }}>
              Try the Playground {'\u2192'}
            </a>
            <a href="mailto:hello@muteform.com" style={{
              display: 'inline-block', fontFamily: mono, fontSize: 13, fontWeight: 600,
              color: T.green, background: 'transparent', padding: '12px 28px', borderRadius: 8,
              textDecoration: 'none', border: `1px solid ${T.green}44`,
              letterSpacing: '0.02em', transition: 'opacity 0.15s',
            }}>
              Join the Waitlist
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helper components ───────────────────────────────────────

function ScoreRingDemo({ score, size }: { score: number; size: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const col = score >= 90 ? '#00e087' : score >= 60 ? '#ffb830' : score > 0 ? '#ff4070' : '#3a3f4a'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1d24" strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={3}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: size * 0.22, fill: col, fontWeight: 700,
          transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`,
        }}>
        {score}
      </text>
    </svg>
  )
}

function btnStyle(color: string, bg: string): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
    padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
    background: color, color: bg, border: 'none',
    transition: 'opacity 0.15s, transform 0.1s',
  }
}

function yamlSyntaxColor(line: string): string {
  if (line.trimStart().startsWith('#')) return '#6b7280'
  if (line.trimStart().startsWith('-')) return '#ffb830'
  return '#e8eaf0'
}

function renderYamlLine(line: string) {
  const trimmed = line.trimStart()
  const indent = line.length - trimmed.length
  const indentStr = line.substring(0, indent)

  if (trimmed.startsWith('#')) {
    return <span style={{ color: '#6b7280' }}>{line}</span>
  }

  if (trimmed.startsWith('- ')) {
    const rest = trimmed.substring(2)
    const [key, ...vals] = rest.split(':')
    return (
      <span>
        <span style={{ color: '#3a3f4a' }}>{indentStr}</span>
        <span style={{ color: '#ffb830' }}>- </span>
        <span style={{ color: '#4090ff' }}>{key}</span>
        {vals.length > 0 && <span style={{ color: '#3a3f4a' }}>:</span>}
        {vals.length > 0 && <span style={{ color: colorForValue(vals.join(':').trim()) }}> {vals.join(':').trim()}</span>}
      </span>
    )
  }

  if (trimmed.includes(':')) {
    const colonIdx = trimmed.indexOf(':')
    const key = trimmed.substring(0, colonIdx)
    const val = trimmed.substring(colonIdx + 1).trim()
    return (
      <span>
        <span style={{ color: '#3a3f4a' }}>{indentStr}</span>
        <span style={{ color: '#4090ff' }}>{key}</span>
        <span style={{ color: '#3a3f4a' }}>:</span>
        {val && <span style={{ color: colorForValue(val) }}> {val}</span>}
      </span>
    )
  }

  return <span>{line}</span>
}

function colorForValue(val: string): string {
  const v = val.replace(/^["']|["']$/g, '')
  if (v.startsWith('#')) return v.length <= 8 ? '#00e087' : '#e8eaf0'
  if (v.startsWith('[')) return '#ffb830'
  if (/^\d/.test(v)) return '#ff9f43'
  if (v === 'true' || v === 'false') return '#ff4070'
  if (v.startsWith('"') || v.startsWith("'")) return '#00e087'
  return '#00e087'
}
