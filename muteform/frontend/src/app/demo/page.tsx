'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  DEMO_YAML_LINES,
  DEMO_LOG_ENTRIES,
  DEMO_VIOLATIONS,
  DEMO_SCORE_PROGRESSION,
  WIREFRAME_BLOCKS,
  type DemoViolation,
} from '@/lib/engine/demo-data'

// ─── Design tokens ───────────────────────────────────────────
const T = {
  bg: '#08090d',
  surface: '#0c0e12',
  surface2: '#111318',
  border: '#1a1d24',
  border2: '#252830',
  green: '#00e087',
  greenDim: '#00e08718',
  greenGlow: '#00e08733',
  red: '#ff4070',
  redDim: '#ff407018',
  amber: '#ffb830',
  amberDim: '#ffb83018',
  blue: '#4090ff',
  blueDim: '#4090ff18',
  muted: '#6b7280',
  dim: '#3a3f4a',
  text: '#e8eaf0',
  textBright: '#f8f9fb',
}

const mono = "'JetBrains Mono', 'DM Mono', 'Fira Code', monospace"
const sans = "'DM Sans', 'Inter', system-ui, sans-serif"
const serif = "'Instrument Serif', Georgia, serif"

// ─── Severity colors ─────────────────────────────────────────
const SEV: Record<string, { color: string; dim: string; label: string }> = {
  critical: { color: T.red, dim: T.redDim, label: 'CRITICAL' },
  high: { color: T.red, dim: T.redDim, label: 'HIGH' },
  medium: { color: T.amber, dim: T.amberDim, label: 'MEDIUM' },
  low: { color: T.muted, dim: `${T.muted}18`, label: 'LOW' },
}

// ─── Demo phases ─────────────────────────────────────────────
type Phase = 'idle' | 'typing' | 'intercept' | 'generate' | 'scanning' | 'violations' | 'fixing' | 'done'

export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [yamlLine, setYamlLine] = useState(0)
  const [logIndex, setLogIndex] = useState(0)
  const [scanY, setScanY] = useState(0)
  const [violations, setViolations] = useState<DemoViolation[]>([])
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set())
  const [score, setScore] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [shipIt, setShipIt] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [stepQueue, setStepQueue] = useState<(() => void)[]>([])

  const logRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRunning = useRef(false)

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
  }, [logIndex])

  // ─── Auto-play orchestrator ────────────────────────────────
  const delay = (ms: number) => new Promise<void>(r => { timerRef.current = setTimeout(r, ms) })

  const runDemo = useCallback(async () => {
    if (isRunning.current) return
    isRunning.current = true
    setPhase('idle')
    setYamlLine(0)
    setLogIndex(0)
    setScanY(0)
    setViolations([])
    setFixedIds(new Set())
    setScore(0)
    setExpanded(null)
    setShipIt(false)

    await delay(300)

    // Phase 1: Type out YAML
    setPhase('typing')
    for (let i = 0; i <= DEMO_YAML_LINES.length && isRunning.current; i++) {
      setYamlLine(i)
      // Log first 4 entries during typing
      if (i === 2) setLogIndex(1)
      if (i === 8) setLogIndex(2)
      if (i === 15) setLogIndex(3)
      if (i === 25) setLogIndex(4)
      await delay(35)
    }
    if (!isRunning.current) return

    // Phase 2: Intercept
    setPhase('intercept')
    setLogIndex(5)
    await delay(400)
    setLogIndex(6)
    await delay(300)
    setLogIndex(7)
    await delay(300)

    // Phase 3: Generate
    setPhase('generate')
    setLogIndex(8)
    await delay(600)
    setLogIndex(9)
    await delay(400)

    // Phase 4: Scanning
    setPhase('scanning')
    setLogIndex(10)
    for (let y = 0; y <= 100 && isRunning.current; y += 2) {
      setScanY(y)
      // Fire log entries at scan positions
      if (y === 5) setLogIndex(11)
      if (y === 15) setLogIndex(12)
      if (y === 30) { setLogIndex(13); setViolations(v => [...v, DEMO_VIOLATIONS[0]]) }
      if (y === 42) setLogIndex(14)
      if (y === 50) {
        setLogIndex(15)
        setViolations(v => [...v, DEMO_VIOLATIONS[1]])
      }
      if (y === 55) {
        setLogIndex(16)
        setViolations(v => [...v, DEMO_VIOLATIONS[2]])
      }
      if (y === 58) {
        setLogIndex(17)
        setViolations(v => [...v, DEMO_VIOLATIONS[3]])
      }
      if (y === 68) setLogIndex(18)
      if (y === 78) setLogIndex(19)
      if (y === 88) setLogIndex(20)
      await delay(25)
    }
    if (!isRunning.current) return

    // Phase 5: Violations revealed
    setPhase('violations')
    setLogIndex(21)
    setScore(42)
    await delay(1200)

    // Phase 6: Auto-fix
    setPhase('fixing')
    setLogIndex(22)
    await delay(400)

    for (let i = 0; i < DEMO_VIOLATIONS.length && isRunning.current; i++) {
      setLogIndex(23 + i)
      setFixedIds(prev => new Set(prev).add(DEMO_VIOLATIONS[i].id))
      setScore(DEMO_SCORE_PROGRESSION[i + 1] || 100)
      await delay(500)
    }
    if (!isRunning.current) return

    setLogIndex(27)
    await delay(500)
    setLogIndex(28)

    // Phase 7: Done
    setPhase('done')
    setScore(100)
    setShipIt(true)
    isRunning.current = false
  }, [])

  const handleRestart = () => {
    cleanup()
    setShipIt(false)
    setTimeout(runDemo, 100)
  }

  const handleStepThrough = () => {
    setManualMode(true)
    // In manual mode, run the demo but pause at each phase
    runDemo()
  }

  // Visible log entries
  const visibleLogs = DEMO_LOG_ENTRIES.slice(0, logIndex + 1)

  const logColor = (phase: string) => {
    if (phase === 'fix') return T.green
    if (phase === 'scan') return T.blue
    if (phase === 'intercept') return T.amber
    if (phase === 'done') return T.green
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
              ▶ RUN DEMO
            </button>
          ) : phase === 'done' ? (
            <button onClick={handleRestart} style={btnStyle(T.green, T.bg)}>
              ↻ RESTART
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
          {/* Rules Panel */}
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
                <span style={{ color: T.green, animation: 'pulse 0.6s infinite' }}>▌</span>
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
              {visibleLogs.map((entry, i) => (
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
            {/* Fake browser chrome */}
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
              {(phase !== 'idle' && phase !== 'typing') && WIREFRAME_BLOCKS.map(block => {
                const isViolation = block.violation && violations.some(v => v.nodeId === block.id)
                const isFixed = block.violation && DEMO_VIOLATIONS.some(dv =>
                  fixedIds.has(dv.id) && dv.nodeId === block.id
                )

                return (
                  <div key={block.id} style={{
                    position: 'absolute',
                    left: `${block.x}%`, top: `${block.y}%`,
                    width: `${block.w}%`, height: `${block.h}%`,
                    background: block.color,
                    borderRadius: 3,
                    border: isViolation && !isFixed
                      ? `2px solid ${T.red}`
                      : `1px solid ${T.border}`,
                    animation: isViolation && !isFixed ? 'pulse 1.5s infinite' : 'fadeIn 0.3s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border 0.3s, box-shadow 0.3s',
                    boxShadow: isViolation && !isFixed ? `0 0 12px ${T.red}33` : 'none',
                  }}>
                    <span style={{
                      fontFamily: mono, fontSize: 8, color: T.muted,
                      letterSpacing: '0.04em', opacity: 0.7,
                    }}>
                      {block.label}
                    </span>
                    {isViolation && !isFixed && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: T.red, fontSize: 8, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: mono, fontWeight: 700,
                      }}>!</span>
                    )}
                    {isFixed && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: T.green, fontSize: 8, color: T.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: mono, fontWeight: 700,
                      }}>✓</span>
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
                {phase === 'done' ? '4/4 auto-remediated · 0 human intervention · 1.4s total' :
                 violations.length > 0 ? `${violations.length} violations found` :
                 'Waiting for scan...'}
              </div>
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
          {violations.length > 0 && (
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
                  {fixedIds.size}/{violations.length} fixed
                </span>
              </div>

              {violations.map(v => {
                const sev = SEV[v.severity]
                const isFixed = fixedIds.has(v.id)
                const isExp = expanded === v.id

                return (
                  <div key={v.id} style={{
                    borderBottom: `1px solid ${T.border}`,
                    opacity: isFixed ? 0.5 : 1,
                    transition: 'opacity 0.3s',
                    animation: 'slideIn 0.2s ease',
                  }}>
                    <div
                      onClick={() => setExpanded(isExp ? null : v.id)}
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
                      }}>▶</span>

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
                    </div>

                    {isExp && (
                      <div style={{
                        padding: '8px 14px 12px 34px', borderTop: `1px solid ${T.border}`,
                        background: T.bg,
                      }}>
                        <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>
                          {v.nodePath}
                        </div>

                        {/* Current → Suggested */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                          gap: 12, alignItems: 'center', margin: '8px 0',
                        }}>
                          <div>
                            <div style={{ fontFamily: mono, fontSize: 8, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>CURRENT</div>
                            {v.property.includes('color') || v.property.includes('contrast') ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {v.currentValue.startsWith('#') && (
                                  <div style={{
                                    width: 24, height: 24, borderRadius: 4,
                                    backgroundColor: v.currentValue.split(':')[0],
                                    border: `1px solid ${T.border2}`,
                                  }} />
                                )}
                                <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{v.currentValue}</span>
                              </div>
                            ) : (
                              <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{v.currentValue}</span>
                            )}
                          </div>
                          <span style={{ color: T.dim, fontSize: 14 }}>→</span>
                          <div>
                            <div style={{ fontFamily: mono, fontSize: 8, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>SUGGESTED</div>
                            {v.property.includes('color') && v.suggestedValue.startsWith('#') ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: 4,
                                  backgroundColor: v.suggestedValue,
                                  border: `1px solid ${T.border2}`,
                                }} />
                                <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>{v.suggestedValue}</span>
                              </div>
                            ) : (
                              <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>{v.suggestedValue}</span>
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
                            onClick={e => { e.stopPropagation(); setFixedIds(prev => new Set(prev).add(v.id)) }}
                            style={{
                              fontFamily: mono, fontSize: 9, letterSpacing: '0.06em',
                              padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                              background: T.green, color: T.bg, border: 'none',
                              marginTop: 8, transition: 'opacity 0.15s',
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
          )}
        </div>
      </div>

      {/* ─── CTA ─── */}
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
              Try the Playground →
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
  // Simple syntax highlighting
  const parts: JSX.Element[] = []
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
