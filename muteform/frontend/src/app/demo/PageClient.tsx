'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useCallback, useEffect } from 'react'
import Header from '@/components/Header'
import { tokens } from '@/lib/design-tokens'

const T = tokens
const mono = T.fontMono
const syne = T.fontDisplay

/* ─── ScoreRing ─── */
function ScoreRing({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef<number>()
  useEffect(() => {
    setDisplayed(0)
    const start = performance.now()
    const run = (now: number) => {
      const t = Math.min((now - start) / 1200, 1)
      setDisplayed(Math.round((1 - Math.pow(1 - t, 3)) * score))
      if (t < 1) animRef.current = requestAnimationFrame(run)
    }
    animRef.current = requestAnimationFrame(run)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score])
  const r = (size - 12) / 2, circ = 2 * Math.PI * r
  const offset = circ - (circ * displayed) / 100
  const col = displayed >= 90 ? T.green : displayed >= 60 ? T.amber : displayed > 0 ? T.red : T.textDim
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.border} strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={6} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke 0.3s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.28, fontWeight: 700, color: col, lineHeight: 1 }}>{displayed}</span>
        <span style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 3 }}>{label || 'health'}</span>
      </div>
    </div>
  )
}

/* ─── Log line types ─── */
type LogLine = {
  time: string
  text: string
  type: 'info' | 'violation' | 'fix' | 'success' | 'header'
}

const LOG_COLORS: Record<LogLine['type'], string> = {
  info: T.textMuted,
  violation: T.red,
  fix: T.green,
  success: T.green,
  header: T.blue,
}

/* ─── Demo beats ─── */
const DEMO_BEATS: { delay: number; lines: LogLine[]; score?: number; phase?: string }[] = [
  // Beat 1: Initialize
  {
    delay: 0,
    phase: 'initializing',
    lines: [
      { time: '00:00', text: 'Muteform Engine initialized', type: 'header' },
      { time: '00:00', text: '.muteform.yml loaded — 5 rules active', type: 'info' },
    ],
    score: 0,
  },
  // Beat 2: Interface loads
  {
    delay: 1200,
    phase: 'scanning',
    lines: [
      { time: '00:01', text: 'Scanning acme.com/checkout... 47 nodes detected', type: 'info' },
    ],
  },
  // Beat 3: Violations found
  {
    delay: 2400,
    phase: 'violations',
    lines: [
      { time: '00:02', text: '✗ CRITICAL  component.variant "tertiary" not in allowed [primary, secondary]', type: 'violation' },
    ],
  },
  {
    delay: 2900,
    lines: [
      { time: '00:02', text: '✗ HIGH      color #1a73e8 not a registered token (ΔE 12.4 from #0055FF)', type: 'violation' },
    ],
  },
  {
    delay: 3400,
    lines: [
      { time: '00:03', text: '✗ HIGH      typography "subtitle" not in allowed styles', type: 'violation' },
    ],
  },
  {
    delay: 3800,
    lines: [
      { time: '00:03', text: '✗ MEDIUM    spacing 18px not on scale [4, 8, 12, 16, 24, 32, 48, 64]', type: 'violation' },
    ],
  },
  {
    delay: 4200,
    lines: [
      { time: '00:03', text: '✗ MEDIUM    grid 5-col not in allowed [4, 8, 12]', type: 'violation' },
    ],
    score: 34,
  },
  // Beat 4: Auto-fix
  {
    delay: 5500,
    phase: 'fixing',
    lines: [
      { time: '00:04', text: 'Running auto-fix on 4 fixable violations...', type: 'info' },
    ],
  },
  {
    delay: 6200,
    lines: [
      { time: '00:04', text: '✓ FIXED  component.variant → "primary"', type: 'fix' },
    ],
  },
  {
    delay: 6700,
    lines: [
      { time: '00:05', text: '✓ FIXED  color → #0055FF (ΔE corrected)', type: 'fix' },
    ],
  },
  {
    delay: 7200,
    lines: [
      { time: '00:05', text: '✓ FIXED  typography → "body"', type: 'fix' },
    ],
  },
  {
    delay: 7700,
    lines: [
      { time: '00:05', text: '✓ FIXED  spacing → 16px', type: 'fix' },
    ],
    score: 96,
  },
  // Beat 5: Summary
  {
    delay: 9000,
    phase: 'complete',
    lines: [
      { time: '00:06', text: 'Scan complete. 4/5 violations auto-fixed. 1 requires manual review.', type: 'success' },
    ],
  },
]

/* ─── Checkout wireframe ─── */
function CheckoutPreview({ phase, scanLine }: { phase: string; scanLine: number }) {
  const rows = [
    { label: 'header', blocks: [{ flex: 1, h: 10 }, { flex: 3, h: 10 }, { flex: 1, h: 10 }] },
    { label: 'title', blocks: [{ flex: 2, h: 14 }] },
    { label: 'form', blocks: [{ flex: 1, h: 32 }] },
    { label: 'card-inputs', blocks: [{ flex: 1, h: 12 }, { flex: 1, h: 12 }] },
    { label: 'card-number', blocks: [{ flex: 1, h: 12 }] },
    { label: 'summary', blocks: [{ flex: 2, h: 8 }, { flex: 1, h: 8 }] },
    { label: 'total', blocks: [{ flex: 1, h: 8 }, { flex: 1, h: 10 }] },
    { label: 'cta', blocks: [{ flex: 1, h: 16 }] },
  ]

  const isScanning = phase === 'scanning'
  const isViolations = phase === 'violations' || phase === 'fixing'
  const isFixed = phase === 'complete'

  // Violation highlighting - specific rows for the checkout violations
  const violationRows = [0, 2, 3, 5, 7] // header, form, card-inputs, summary, cta
  const fixedRows = [0, 2, 3, 5] // all except cta (grid is manual)

  return (
    <div style={{ position: 'relative', background: '#0a0b0d', border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        <div style={{ flex: 1, fontFamily: mono, fontSize: 9, color: T.textDim, textAlign: 'center', background: T.surface, padding: '3px 12px', borderRadius: 4 }}>acme.com/checkout</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row, i) => (
          <div key={i} style={{
            display: 'flex', gap: 6, alignItems: 'center',
            opacity: isScanning ? (scanLine > i ? 1 : 0.3) : 1,
            transition: 'opacity 0.3s ease',
          }}>
            {row.blocks.map((block, j) => {
              const isViolated = isViolations && violationRows.includes(i) && !isFixed
              const wasFixed = isFixed && fixedRows.includes(i)
              const isUnfixed = isFixed && i === 7 // grid violation - manual review
              return (
                <div key={j} style={{
                  flex: block.flex || 1,
                  height: block.h || 12,
                  background: wasFixed ? `${T.green}30` : isUnfixed ? `${T.amber}30` : isViolated ? `${T.red}30` : `${T.textDim}20`,
                  borderRadius: 3,
                  transition: 'background 0.5s ease',
                  border: wasFixed ? `1px solid ${T.green}22` : isViolated ? `1px solid ${T.red}22` : isUnfixed ? `1px solid ${T.amber}22` : '1px solid transparent',
                }} />
              )
            })}
          </div>
        ))}
      </div>
      {isScanning && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${T.green}, transparent)`,
          top: `${(scanLine / rows.length) * 100}%`,
          transition: 'top 0.15s linear',
          boxShadow: `0 0 12px ${T.green}`,
        }} />
      )}
    </div>
  )
}

export default function DemoPage() {
  const [running, setRunning] = useState(false)
  const [logLines, setLogLines] = useState<LogLine[]>([])
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [scanLine, setScanLine] = useState(0)
  const [complete, setComplete] = useState(false)
  const timeoutsRef = useRef<number[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    timeoutsRef.current.forEach(t => clearTimeout(t))
    timeoutsRef.current = []
    setLogLines([])
    setScore(0)
    setPhase('idle')
    setScanLine(0)
    setComplete(false)
    setRunning(false)
  }, [])

  const runDemo = useCallback(() => {
    reset()
    setRunning(true)

    // Scan line animation
    let sl = 0
    const scanInterval = window.setInterval(() => {
      sl++
      setScanLine(sl)
      if (sl >= 8) clearInterval(scanInterval)
    }, 250)
    timeoutsRef.current.push(scanInterval as unknown as number)

    DEMO_BEATS.forEach((beat) => {
      const t = window.setTimeout(() => {
        if (beat.phase) setPhase(beat.phase)
        if (beat.score !== undefined) setScore(beat.score)
        setLogLines(prev => [...prev, ...beat.lines])
        // Auto-scroll log
        setTimeout(() => {
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
        }, 50)
        if (beat.phase === 'complete') {
          setComplete(true)
          setRunning(false)
        }
      }, beat.delay)
      timeoutsRef.current.push(t as unknown as number)
    })
  }, [reset])

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 16px ${T.greenDim}; } 50% { box-shadow: 0 0 32px ${T.greenDim}; } }
        @media (max-width: 900px) { .demo-split { flex-direction: column !important; } .demo-left, .demo-right { width: 100% !important; } }
      `}</style>

      <Header />

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '32px 20px 24px', maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ fontFamily: syne, fontSize: 32, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
          Live governance demo
        </h1>
        <p style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, marginTop: 8, lineHeight: 1.6 }}>
          Watch Muteform scan an AI-generated checkout flow, detect violations, and auto-fix in real time.
        </p>
      </div>

      {/* Demo content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 60px' }}>

        {/* Run Demo button */}
        {!running && !complete && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <button onClick={runDemo} style={{
              padding: '14px 48px', background: `linear-gradient(135deg, ${T.green}, #00c070)`,
              border: 'none', borderRadius: 8, fontFamily: mono, fontSize: 14, fontWeight: 700,
              color: T.bg, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase',
              boxShadow: `0 0 24px ${T.greenDim}`,
            }}>▶ Run Demo</button>
          </div>
        )}

        {(running || complete) && (
          <div className="demo-split" style={{ display: 'flex', gap: 16 }}>
            {/* Left: Terminal log */}
            <div className="demo-left" style={{ width: '55%' }}>
              <div style={{ background: '#0a0b0c', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {/* Terminal chrome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, flex: 1, textAlign: 'center' }}>Muteform Engine</span>
                </div>
                {/* Log lines */}
                <div ref={logRef} style={{ padding: '12px 14px', minHeight: 300, maxHeight: 420, overflow: 'auto', fontFamily: mono, fontSize: 12, lineHeight: 1.8 }}>
                  {logLines.map((line, i) => (
                    <div key={i} style={{ animation: 'fadeSlideIn 0.2s ease both', display: 'flex', gap: 10 }}>
                      <span style={{ color: T.textDim, flexShrink: 0 }}>[{line.time}]</span>
                      <span style={{ color: LOG_COLORS[line.type] }}>{line.text}</span>
                    </div>
                  ))}
                  {running && (
                    <span style={{ color: T.green, animation: 'blink 1s step-end infinite' }}>▌</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Preview + Score */}
            <div className="demo-right" style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Score ring */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <ScoreRing score={score} size={90} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.text }}>acme.com/checkout</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, marginTop: 4 }}>47 nodes · 5 rules · Acme Design System</div>
                  {complete && (
                    <div style={{ fontFamily: mono, fontSize: 10, color: T.green, marginTop: 6 }}>4/5 violations auto-fixed</div>
                  )}
                </div>
              </div>

              {/* Interface preview */}
              <CheckoutPreview phase={phase} scanLine={scanLine} />

              {/* Violation summary (after violations appear) */}
              {(phase === 'violations' || phase === 'fixing' || phase === 'complete') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, animation: 'fadeSlideIn 0.3s ease both' }}>
                  <div style={{ padding: '10px', textAlign: 'center', background: T.redDim, borderRadius: 6, border: `1px solid ${T.red}22` }}>
                    <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: T.red }}>5</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: T.red }}>FOUND</div>
                  </div>
                  <div style={{ padding: '10px', textAlign: 'center', background: T.greenDim, borderRadius: 6, border: `1px solid ${T.green}22` }}>
                    <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: T.green }}>{phase === 'complete' ? 4 : phase === 'fixing' ? '...' : 0}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: T.green }}>FIXED</div>
                  </div>
                  <div style={{ padding: '10px', textAlign: 'center', background: T.amberDim, borderRadius: 6, border: `1px solid ${T.amber}22` }}>
                    <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: T.amber }}>{phase === 'complete' ? 1 : '-'}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: T.amber }}>MANUAL</div>
                  </div>
                </div>
              )}

              {/* CTA after complete */}
              {complete && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeSlideIn 0.4s ease both' }}>
                  <a href="/playground" style={{
                    display: 'block', textAlign: 'center', padding: '12px 0',
                    background: `linear-gradient(135deg, ${T.green}, #00c070)`,
                    borderRadius: 8, fontFamily: mono, fontSize: 12, fontWeight: 700,
                    color: T.bg, textDecoration: 'none', letterSpacing: 1,
                    animation: 'glow 2s ease-in-out infinite',
                  }}>Try it yourself →</a>
                  <button onClick={() => { reset(); setTimeout(runDemo, 100) }} style={{
                    width: '100%', padding: '10px 0', background: T.surface,
                    border: `1px solid ${T.border}`, borderRadius: 8,
                    fontFamily: mono, fontSize: 11, color: T.textMuted, cursor: 'pointer',
                  }}>▶ Replay demo</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SSR-visible demo summary (shown before demo runs) */}
        {!running && !complete && (
          <div style={{ padding: '24px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 24 }}>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>acme.com/checkout</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, marginBottom: 16 }}>47 nodes · 5 rules · Acme Design System · Health score: 34 → 96</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: T.textMuted, lineHeight: 2 }}>
              <div style={{ color: T.red }}>✗ CRITICAL component.variant &quot;tertiary&quot; not in allowed [primary, secondary]</div>
              <div style={{ color: T.red }}>✗ HIGH color #1a73e8 not a registered token (ΔE 12.4 from #0055FF)</div>
              <div style={{ color: T.red }}>✗ HIGH typography &quot;subtitle&quot; not in allowed styles</div>
              <div style={{ color: T.red }}>✗ MEDIUM spacing 18px not on scale [4, 8, 12, 16, 24, 32, 48, 64]</div>
              <div style={{ color: T.red }}>✗ MEDIUM grid 5-col not in allowed [4, 8, 12]</div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>4 auto-fixed</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: T.amber }}>1 manual review</span>
            </div>
          </div>
        )}

        {/* Bottom CTA (when idle) */}
        {!running && !complete && (
          <div style={{ textAlign: 'center', padding: '40px 24px', marginTop: 24, background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`, borderRadius: 12, border: `1px solid ${T.border}` }}>
            <h2 style={{ fontFamily: syne, fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginBottom: 8 }}>Ready to govern your own system?</h2>
            <p style={{ fontFamily: mono, fontSize: 11, color: T.textMuted, marginBottom: 20, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>Import your tokens, define rules, scan any AI output.</p>
            <a href="/playground" style={{
              display: 'inline-block', fontFamily: mono, fontSize: 12, fontWeight: 600, color: '#fff',
              background: T.blue, padding: '10px 24px', borderRadius: 6, textDecoration: 'none',
            }}>Open Playground →</a>
          </div>
        )}
      </div>
    </div>
  )
}
