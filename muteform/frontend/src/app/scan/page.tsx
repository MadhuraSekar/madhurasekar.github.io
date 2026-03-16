'use client'

import { useState, useCallback } from 'react'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', redDim: '#ff407018',
  amber: '#ffb830', amberDim: '#ffb83018',
  blue: '#4090ff', blueDim: '#4090ff18',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"

interface ScanViolation {
  id: string; severity: string; message: string; nodePath: string
  currentValue: string; suggestedValue: string; detail: string
}

const MOCK_VIOLATIONS: ScanViolation[] = [
  { id: 'sv1', severity: 'critical', message: 'Contrast ratio 3.1:1 on body text (needs 4.5:1)', nodePath: 'div > p.description', currentValue: '3.1:1', suggestedValue: '≥4.5:1', detail: 'Darken text color or lighten background to meet WCAG AA.' },
  { id: 'sv2', severity: 'high', message: '#3478F6 not in approved color palette', nodePath: 'button.primary', currentValue: '#3478F6', suggestedValue: '#4090ff', detail: 'Nearest approved token: semantic.info #4090ff (ΔE=5.2)' },
  { id: 'sv3', severity: 'medium', message: '18px padding not on spacing scale', nodePath: 'div.card', currentValue: '18px', suggestedValue: '16px', detail: 'Nearest scale value: 16px. Approved scale: [4, 8, 12, 16, 24, 32]' },
  { id: 'sv4', severity: 'low', message: 'Transition 500ms exceeds 300ms max', nodePath: 'button.cta', currentValue: '500ms', suggestedValue: '300ms', detail: 'Clamped to maximum allowed duration.' },
]

const SEV: Record<string, { color: string; dim: string; label: string }> = {
  critical: { color: T.red, dim: T.redDim, label: 'CRITICAL' },
  high: { color: T.red, dim: T.redDim, label: 'HIGH' },
  medium: { color: T.amber, dim: T.amberDim, label: 'MEDIUM' },
  low: { color: T.muted, dim: `${T.muted}18`, label: 'LOW' },
}

export default function ScanPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [violations, setViolations] = useState<ScanViolation[]>([])
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)

  const score = scanned ? Math.max(0, 100 - violations.filter(v => !fixedIds.has(v.id)).reduce((s, v) =>
    s + (v.severity === 'critical' ? 15 : v.severity === 'high' ? 8 : v.severity === 'medium' ? 3 : 1), 0)) : 0

  const allFixed = scanned && violations.every(v => fixedIds.has(v.id))

  const handleScan = useCallback(() => {
    if (!code.trim()) return
    setScanning(true)
    setFixedIds(new Set())
    setTimeout(() => {
      setViolations(MOCK_VIOLATIONS)
      setScanning(false)
      setScanned(true)
    }, 600)
  }, [code])

  const handleFixAll = () => {
    const ids = new Set<string>()
    violations.forEach(v => ids.add(v.id))
    setFixedIds(ids)
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
        <a href="/dashboard" style={{ fontFamily: mono, fontSize: 11, color: T.muted, textDecoration: 'none' }}>← Dashboard</a>
          <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg></button>
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
          <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: T.textBright }}>
            Paste AI-Generated Code
          </div>
          <p style={{ fontFamily: sans, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
            Paste HTML, CSS, or JSX from Claude, GPT, v0, Cursor, or any AI tool.
          </p>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={'<div class="checkout">\n  <button style="background: #3478F6; padding: 18px; transition: 0.5s">\n    Pay Now\n  </button>\n  <p style="color: #999">Secure checkout</p>\n</div>'}
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
                Paste code and run scan to see results
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
              {/* Score */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
              }}>
                <div style={{ fontFamily: mono, fontSize: 32, fontWeight: 700, color: score >= 90 ? T.green : score >= 60 ? T.amber : T.red }}>
                  {score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.textBright }}>Health Score</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>
                    {allFixed ? 'All violations resolved' : `${violations.length} violations found`}
                  </div>
                </div>
                {!allFixed && (
                  <button onClick={handleFixAll} style={{
                    fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                    padding: '6px 14px', borderRadius: 5, cursor: 'pointer',
                    background: T.green, color: T.bg, border: 'none',
                  }}>FIX ALL</button>
                )}
                {allFixed && (
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.green, letterSpacing: '0.06em' }}>ALL FIXED ✓</span>
                )}
              </div>

              {/* Violations */}
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.textBright }}>Violations</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>{violations.length} found</span>
                </div>
                {violations.map(v => {
                  const sev = SEV[v.severity] || SEV.low
                  const isFixed = fixedIds.has(v.id)
                  const isExp = expanded === v.id
                  return (
                    <div key={v.id} style={{ borderBottom: `1px solid ${T.border}`, opacity: isFixed ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                      <div
                        onClick={() => setExpanded(isExp ? null : v.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer' }}
                      >
                        <span style={{ fontFamily: mono, fontSize: 9, width: 12, color: T.dim, transform: isExp ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: sev.color, background: sev.dim, padding: '2px 6px', borderRadius: 3, border: `1px solid ${sev.color}33`, letterSpacing: '0.06em' }}>{sev.label}</span>
                        <span style={{ fontFamily: sans, fontSize: 11, color: T.text, flex: 1, textDecoration: isFixed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.message}</span>
                        {isFixed && <span style={{ fontFamily: mono, fontSize: 9, color: T.green, letterSpacing: '0.06em' }}>FIXED</span>}
                      </div>
                      {isExp && (
                        <div style={{ padding: '8px 14px 12px 34px', borderTop: `1px solid ${T.border}`, background: T.bg }}>
                          <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginBottom: 6 }}>{v.nodePath}</div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{v.currentValue}</span>
                            <span style={{ color: T.dim }}>→</span>
                            <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>{v.suggestedValue}</span>
                          </div>
                          <p style={{ fontFamily: sans, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{v.detail}</p>
                          {!isFixed && (
                            <button onClick={e => { e.stopPropagation(); setFixedIds(prev => new Set(prev).add(v.id)) }} style={{ fontFamily: mono, fontSize: 9, padding: '4px 10px', borderRadius: 3, background: T.green, color: T.bg, border: 'none', cursor: 'pointer', marginTop: 6 }}>
                              AUTO-FIX
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {allFixed && (
                <div style={{ textAlign: 'center', padding: '24px', background: T.surface, borderRadius: 10, border: `1px solid ${T.green}33` }}>
                  <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 4 }}>Interface is compliant</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>Score: 100 · All violations auto-fixed</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
