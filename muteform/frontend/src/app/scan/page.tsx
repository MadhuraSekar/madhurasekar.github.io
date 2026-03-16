'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', redDim: '#ff407018',
  amber: '#ffb830', amberDim: '#ffb83018',
  blue: '#4090ff', blueDim: '#4090ff18',
  purple: '#a855f7', purpleDim: '#a855f718',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"

const PRELOADED_CODE = `// AI-generated checkout button (from Claude Code)
const CheckoutButton = () => (
  <Button
    color="#3478F6"
    padding="22px"
    variant="ghost"
    fontStyle="display-xl"
    gridColumns={10}
  >
    Complete Purchase
  </Button>
)`

const GOVERNED_CODE = `// Governed by muteform — all violations fixed
const CheckoutButton = () => (
  <Button
    color="semantic.primary"
    padding="spacing.24"
    variant="filled"
    fontStyle="heading.lg"
    gridColumns={12}
  >
    Complete Purchase
  </Button>
)`

interface Violation {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  rule: string
  message: string
  current: string
  fixed: string
  type: 'color' | 'spacing' | 'component' | 'typography'
}

const VIOLATIONS: Violation[] = [
  {
    id: 'v1', severity: 'critical', rule: 'color-token-compliance',
    message: '#3478F6 is not in the approved color palette',
    current: '#3478F6', fixed: 'semantic.primary',
    type: 'color',
  },
  {
    id: 'v2', severity: 'high', rule: 'spacing-scale-compliance',
    message: '22px padding is not on the 8px spacing scale',
    current: '22px', fixed: 'spacing.24',
    type: 'spacing',
  },
  {
    id: 'v3', severity: 'high', rule: 'variant-allowlist',
    message: '"ghost" variant not allowed for primary actions',
    current: 'ghost', fixed: 'filled',
    type: 'component',
  },
  {
    id: 'v4', severity: 'medium', rule: 'grid-column-snap',
    message: 'gridColumns={10} does not align to 12-column grid',
    current: '10', fixed: '12',
    type: 'typography',
  },
]

const SEV_STYLE: Record<string, { color: string; dim: string; label: string }> = {
  critical: { color: T.red, dim: T.redDim, label: 'CRITICAL' },
  high: { color: T.red, dim: T.redDim, label: 'HIGH' },
  medium: { color: T.amber, dim: T.amberDim, label: 'MEDIUM' },
  low: { color: T.muted, dim: `${T.muted}18`, label: 'LOW' },
}

function ScoreRing({ score, size = 90, animating }: { score: number; size?: number; animating?: boolean }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const col = score >= 90 ? T.green : score >= 60 ? T.amber : T.red
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border2} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={5}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: animating ? 'stroke-dasharray 1.2s ease-out, stroke 0.5s' : 'none' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{
          fontFamily: mono, fontSize: size * 0.3, fill: col, fontWeight: 700,
          transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`,
          transition: animating ? 'fill 0.5s' : 'none',
        }}>
        {score}
      </text>
    </svg>
  )
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4, background: color,
        border: `1px solid ${T.border2}`,
      }} />
      <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{label}</span>
    </div>
  )
}

function SpacingBar({ px, label }: { px: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: Math.min(px * 1.5, 40), height: 8, borderRadius: 2,
        background: `${T.amber}60`, border: `1px solid ${T.amber}33`,
      }} />
      <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{label}</span>
    </div>
  )
}

function ComponentBadge({ name }: { name: string }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: 9, fontWeight: 600,
      padding: '2px 8px', borderRadius: 4,
      color: T.purple, background: T.purpleDim,
      border: `1px solid ${T.purple}33`, letterSpacing: '0.04em',
    }}>{name}</span>
  )
}

export default function ScanPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [code, setCode] = useState(PRELOADED_CODE)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [governed, setGoverned] = useState(false)
  const [score, setScore] = useState(0)
  const [copied, setCopied] = useState(false)
  const autoTriggered = useRef(false)

  const handleScan = useCallback(() => {
    setScanning(true)
    setGoverned(false)
    setScore(0)
    setTimeout(() => {
      setScanning(false)
      setScanned(true)
      setScore(58)
    }, 800)
  }, [])

  // Auto-trigger scan 1 second after page load
  useEffect(() => {
    if (autoTriggered.current) return
    autoTriggered.current = true
    const timer = setTimeout(handleScan, 1000)
    return () => clearTimeout(timer)
  }, [handleScan])

  const handleGovernance = () => {
    setGoverned(true)
    // Animate score to 100 after a brief delay
    setTimeout(() => setScore(100), 300)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(GOVERNED_CODE).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const ViolationVisual = ({ v }: { v: Violation }) => {
    if (v.type === 'color') return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <ColorSwatch color={v.current} label={v.current} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
        <ColorSwatch color="#4090ff" label={v.fixed} />
      </div>
    )
    if (v.type === 'spacing') return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <SpacingBar px={22} label={v.current} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
        <SpacingBar px={24} label={v.fixed} />
      </div>
    )
    if (v.type === 'component') return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <ComponentBadge name={v.current} />
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
        <ComponentBadge name={v.fixed} />
      </div>
    )
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{v.current}</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>→</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>{v.fixed}</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>muteform</span>
          </a>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.blue, background: T.blueDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.blue}33`, letterSpacing: '0.06em' }}>
            PASTE & SCAN
          </span>
        </div>
        <a href="/dashboard" className="nav-links" style={{ fontFamily: mono, fontSize: 11, color: T.muted, textDecoration: 'none' }}>← Dashboard</a>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        <a href="/dashboard" style={{ fontFamily: sans }}>Dashboard</a>
        <a href="/scan" style={{ fontFamily: sans, color: T.green }}>Scan</a>
        <a href="/rules" style={{ fontFamily: sans }}>Rules</a>
        <a href="/governance" style={{ fontFamily: sans }}>Governance</a>
        <a href="/integrate" style={{ fontFamily: sans }}>Integrate</a>
        <a href="/team" style={{ fontFamily: sans }}>Team</a>
      </div>

      <div className="page-container grid-2" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Code editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.amber,
            background: T.amberDim, padding: '6px 12px', borderRadius: 6,
            border: `1px solid ${T.amber}33`,
          }}>
            AI-generated code from Claude Code — 4 violations detected
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            style={{
              flex: 1, minHeight: 350, fontFamily: mono, fontSize: 12, lineHeight: 1.7,
              background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: 16, resize: 'vertical', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = T.green)}
            onBlur={e => (e.target.style.borderColor = T.border)}
          />
          <button
            onClick={handleScan}
            disabled={!code.trim() || scanning}
            style={{
              fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
              padding: '12px 24px', borderRadius: 8, cursor: code.trim() ? 'pointer' : 'not-allowed',
              background: code.trim() ? T.green : T.dim, color: T.bg, border: 'none',
              opacity: scanning ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {scanning ? 'SCANNING...' : 'RUN SCAN'}
          </button>
        </div>

        {/* Right: Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!scanned && !scanning && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px dashed ${T.border}`, borderRadius: 10, minHeight: 350,
            }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: T.dim }}>
                Scan will auto-run in a moment...
              </span>
            </div>
          )}

          {scanning && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${T.border}`, borderRadius: 10, minHeight: 350, gap: 12,
            }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${T.border}`, borderTopColor: T.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: mono, fontSize: 11, color: T.green, letterSpacing: '0.06em' }}>SCANNING...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {scanned && !scanning && (
            <>
              {/* Health Score Ring */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
              }}>
                <ScoreRing score={score} size={70} animating />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.textBright }}>Health Score</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>
                    {governed ? 'All violations resolved' : `${VIOLATIONS.length} violations found`}
                  </div>
                </div>
              </div>

              {/* Violation Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {VIOLATIONS.map(v => {
                  const sev = SEV_STYLE[v.severity]
                  return (
                    <div key={v.id} style={{
                      padding: '12px 16px', background: T.surface,
                      border: `1px solid ${governed ? T.green + '33' : T.border}`,
                      borderRadius: 10, opacity: governed ? 0.6 : 1,
                      transition: 'opacity 0.5s, border-color 0.5s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          fontFamily: mono, fontSize: 9, fontWeight: 600,
                          color: sev.color, background: sev.dim,
                          padding: '2px 6px', borderRadius: 3,
                          border: `1px solid ${sev.color}33`, letterSpacing: '0.06em',
                        }}>{sev.label}</span>
                        <span style={{ fontFamily: sans, fontSize: 11, color: T.text, flex: 1 }}>{v.message}</span>
                        {governed && <span style={{ fontFamily: mono, fontSize: 9, color: T.green }}>FIXED</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ViolationVisual v={v} />
                        <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>{v.rule}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* APPLY GOVERNANCE / Governed Code */}
              {!governed ? (
                <button onClick={handleGovernance} style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
                  padding: '14px 24px', borderRadius: 8, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${T.green}, ${T.green}cc)`,
                  color: T.bg, border: 'none',
                  boxShadow: `0 0 20px ${T.green}33`,
                }}>
                  APPLY GOVERNANCE
                </button>
              ) : (
                <div style={{
                  background: T.surface, border: `1px solid ${T.green}33`, borderRadius: 10,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.green }}>
                      Governed Output
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 9, color: T.green, letterSpacing: '0.06em' }}>
                      SCORE 100 ✓
                    </span>
                  </div>
                  <pre style={{
                    fontFamily: mono, fontSize: 11, lineHeight: 1.7,
                    color: T.text, padding: 16, margin: 0,
                    background: T.bg, overflow: 'auto',
                  }}>{GOVERNED_CODE}</pre>
                  <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.border}` }}>
                    <button onClick={handleCopy} style={{
                      fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                      padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                      background: copied ? T.greenDim : T.surface2,
                      color: copied ? T.green : T.textBright,
                      border: `1px solid ${copied ? T.green + '33' : T.border}`,
                      transition: 'all 0.2s',
                    }}>
                      {copied ? 'COPIED ✓' : 'Copy governed code'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
