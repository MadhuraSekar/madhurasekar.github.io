'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import type { MuteformConfig, Violation, ScanResult, RewriteResult } from '@/lib/engine'
import { FIXTURES, getFixture, type FixtureEntry } from '@/lib/fixtures'

// ─── Design Tokens ───────────────────────────────────────────
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

// ─── Default YAML ────────────────────────────────────────────
const DEFAULT_YAML = `name: "Acme Design System"
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

// ─── Severity helpers ────────────────────────────────────────
function severityColor(s: string): string {
  switch (s) {
    case 'critical': return T.red
    case 'high': return T.red
    case 'medium': return T.amber
    case 'low': return T.muted
    default: return T.muted
  }
}

function severityBg(s: string): string {
  switch (s) {
    case 'critical': return T.redDim
    case 'high': return T.redDim
    case 'medium': return T.amberDim
    case 'low': return `${T.muted}18`
    default: return `${T.muted}18`
  }
}

function scoreColor(score: number): string {
  if (score < 50) return T.red
  if (score < 80) return T.amber
  return T.green
}

// ─── Animated Score Ring ─────────────────────────────────────
function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef<number>()

  useEffect(() => {
    setDisplayed(0)
    const start = performance.now()
    const duration = 1200
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(eased * score))
      if (t < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score])

  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * displayed) / 100
  const color = scoreColor(displayed)

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={T.border} strokeWidth={8} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke 0.3s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: mono, fontSize: size * 0.3, fontWeight: 700,
          color, lineHeight: 1,
        }}>{displayed}</span>
        <span style={{
          fontFamily: sans, fontSize: 11, color: T.muted,
          textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4,
        }}>health</span>
      </div>
    </div>
  )
}

// ─── Wireframe Visualizer ────────────────────────────────────
function WireframeView({
  wireframe,
  violationNodeIds,
  fixedNodeIds,
  label,
}: {
  wireframe: { id: string; label: string; x: number; y: number; w: number; h: number; color: string }[]
  violationNodeIds: Set<string>
  fixedNodeIds: Set<string>
  label: string
}) {
  return (
    <div style={{
      flex: 1, background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: 12, minWidth: 0,
    }}>
      <div style={{
        fontFamily: mono, fontSize: 10, color: T.muted,
        textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
      }}>{label}</div>
      <div style={{
        position: 'relative', width: '100%', paddingBottom: '85%',
        background: T.bg, borderRadius: 6, overflow: 'hidden',
      }}>
        {wireframe.map(block => {
          const isViolation = violationNodeIds.has(block.id)
          const isFixed = fixedNodeIds.has(block.id)
          let borderColor = 'transparent'
          if (isViolation) borderColor = T.red
          if (isFixed) borderColor = T.green
          return (
            <div key={block.id} style={{
              position: 'absolute',
              left: `${block.x}%`, top: `${block.y * 1.15}%`,
              width: `${block.w}%`, height: `${block.h * 1.15}%`,
              background: isFixed ? `${T.green}18` : isViolation ? `${T.red}18` : `${block.color}40`,
              border: `2px solid ${borderColor}`,
              borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s ease',
            }}>
              <span style={{
                fontFamily: mono, fontSize: 8, color: isFixed ? T.green : isViolation ? T.red : T.muted,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                padding: '0 2px',
              }}>{block.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Value Preview (colors, spacing, text) ───────────────────
function ValuePreview({ property, value }: { property: string; value: any }) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  // Color swatch
  if (property.startsWith('colors.') && typeof value === 'string' && value.startsWith('#')) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 14, height: 14,
          background: value, borderRadius: 3,
          border: `1px solid ${T.border2}`,
        }} />
        <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{value}</span>
      </span>
    )
  }
  // Spacing bar
  if (property.startsWith('spacing.')) {
    const num = parseInt(str, 10)
    if (!isNaN(num)) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: Math.min(num * 1.5, 80), height: 8,
            background: T.blue, borderRadius: 2, opacity: 0.7,
          }} />
          <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{str}</span>
        </span>
      )
    }
  }
  return <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>{str}</span>
}

// ─── Main Page Component ─────────────────────────────────────
export default function PlaygroundPage() {
  const [yamlText, setYamlText] = useState(DEFAULT_YAML)
  const [selectedFixture, setSelectedFixture] = useState<string>('checkout')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [apiResponse, setApiResponse] = useState<string | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiExpanded, setApiExpanded] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleScan = useCallback(() => {
    setScanning(true)
    setError(null)
    setRewriteResult(null)
    setScanResult(null)

    // Use setTimeout to let UI update before blocking
    setTimeout(() => {
      try {
        const policy = loadConfig(yamlText)
        const fixture = getFixture(selectedFixture)
        if (!fixture) {
          setError(`Fixture "${selectedFixture}" not found.`)
          setScanning(false)
          return
        }
        const result = scanArtifact(fixture.artifact, policy)
        setScanResult(result)
      } catch (e: any) {
        setError(e.message || 'Failed to parse YAML or run scan.')
      } finally {
        setScanning(false)
      }
    }, 50)
  }, [yamlText, selectedFixture])

  const handleApplyGovernance = useCallback(() => {
    if (!scanResult) return
    setFixing(true)

    setTimeout(() => {
      try {
        const policy = loadConfig(yamlText)
        const fixture = getFixture(selectedFixture)
        if (!fixture) return
        const result = rewriteArtifact(fixture.artifact, scanResult.violations, policy)
        setRewriteResult(result)
      } catch (e: any) {
        setError(e.message || 'Failed to apply fixes.')
      } finally {
        setFixing(false)
      }
    }, 50)
  }, [scanResult, yamlText, selectedFixture])

  const handleCopyGoverned = useCallback(() => {
    if (!rewriteResult) return
    navigator.clipboard.writeText(JSON.stringify(rewriteResult.rewrittenArtifact, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [rewriteResult])

  const handleApiCall = useCallback(async () => {
    setApiLoading(true)
    setApiResponse(null)
    const fixture = getFixture(selectedFixture)
    if (!fixture) return
    try {
      const res = await fetch('https://muteform-production.up.railway.app/v1/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifact: fixture.artifact,
          config: yamlText,
        }),
      })
      const json = await res.json()
      setApiResponse(JSON.stringify(json, null, 2))
      setApiExpanded(true)
    } catch (e: any) {
      setApiResponse(`Error: ${e.message || 'Network request failed'}`)
      setApiExpanded(true)
    } finally {
      setApiLoading(false)
    }
  }, [selectedFixture, yamlText])

  const fixture = getFixture(selectedFixture)
  const violationNodeIds = new Set(scanResult?.violations.map(v => v.nodeId) || [])
  const fixedNodeIds = new Set(rewriteResult?.appliedFixes.map(f => f.nodeId) || [])
  const autoFixCount = rewriteResult?.appliedFixes.length ?? 0
  const manualCount = scanResult
    ? scanResult.violations.filter(v => !v.autoFixAvailable).length
    : 0

  // Nav items
  const navItems = [
    { label: 'Demo', href: '/demo' },
    { label: 'Playground', href: '/playground' },
    { label: 'Rules', href: '/rules' },
    { label: 'Governance', href: '/governance' },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.text,
      fontFamily: sans,
    }}>
      {/* ─── Top Nav ─────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 56,
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
      }}>
        <a href="/" style={{
          fontFamily: serif, fontStyle: 'italic', fontSize: 22,
          color: T.textBright, textDecoration: 'none', fontWeight: 400,
        }}>muteform</a>
        <div className="nav-links" style={{ display: 'flex', gap: 28 }}>
          {navItems.map(n => (
            <a key={n.label} href={n.href} style={{
              fontFamily: sans, fontSize: 14, fontWeight: 500,
              color: n.label === 'Playground' ? T.green : T.muted,
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}>{n.label}</a>
          ))}
        </div>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </nav>

      {/* mobile menu */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        {navItems.map(n => (
          <a key={n.label} href={n.href} onClick={() => setMobileMenuOpen(false)}
            style={{ fontFamily: sans, color: n.label === 'Playground' ? T.green : undefined }}>{n.label}</a>
        ))}
      </div>

      {/* ─── Two-column Layout ───────────────────────────────── */}
      <div className="two-col" style={{
        display: 'flex', gap: 0,
        maxWidth: 1440, margin: '0 auto',
        minHeight: 'calc(100vh - 56px)',
      }}>
        {/* ─── LEFT COLUMN: Editor + Fixtures ─────────────── */}
        <div className="two-col-left" style={{
          width: '60%', padding: '28px 24px 28px 32px',
          borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', gap: 20,
          overflow: 'auto',
        }}>
          {/* Section label */}
          <div style={{
            fontFamily: mono, fontSize: 11, color: T.muted,
            textTransform: 'uppercase', letterSpacing: 2,
          }}>Policy Editor</div>

          {/* YAML Editor */}
          <div style={{
            position: 'relative', borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.surface,
          }}>
            <textarea
              value={yamlText}
              onChange={e => setYamlText(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 420,
                background: 'transparent', color: T.text,
                fontFamily: mono, fontSize: 13, lineHeight: 1.7,
                border: 'none', outline: 'none',
                padding: '16px 20px',
                resize: 'vertical',
                caretColor: T.green,
              }}
            />
          </div>

          {/* Fixture Selector */}
          <div>
            <div style={{
              fontFamily: mono, fontSize: 11, color: T.muted,
              textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10,
            }}>Select Fixture</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {FIXTURES.map(f => {
                const active = f.id === selectedFixture
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setSelectedFixture(f.id)
                      setScanResult(null)
                      setRewriteResult(null)
                      setError(null)
                    }}
                    style={{
                      flex: 1, padding: '12px 16px',
                      background: active ? T.greenDim : T.surface,
                      border: `1px solid ${active ? T.green : T.border}`,
                      borderRadius: 8, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 4,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{
                      fontFamily: sans, fontSize: 13, fontWeight: 600,
                      color: active ? T.green : T.text,
                    }}>{f.name}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{
                        fontFamily: mono, fontSize: 10,
                        background: active ? `${T.green}22` : T.surface2,
                        color: active ? T.green : T.muted,
                        padding: '2px 6px', borderRadius: 4,
                        border: `1px solid ${active ? `${T.green}44` : T.border}`,
                      }}>{f.nodeCount} nodes</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* RUN SCAN button */}
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{
              width: '100%', padding: '14px 0',
              background: scanning
                ? T.dim
                : `linear-gradient(135deg, ${T.green}, #00c070)`,
              border: 'none', borderRadius: 8,
              fontFamily: mono, fontSize: 14, fontWeight: 700,
              color: scanning ? T.muted : T.bg,
              cursor: scanning ? 'wait' : 'pointer',
              letterSpacing: 1.5, textTransform: 'uppercase',
              transition: 'all 0.2s',
              boxShadow: scanning ? 'none' : `0 0 24px ${T.greenGlow}`,
            }}
          >{scanning ? 'Scanning...' : 'Run Scan'}</button>

          {/* Error display */}
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 8,
              background: T.redDim,
              border: `1px solid ${T.red}44`,
              fontFamily: mono, fontSize: 12, color: T.red,
              whiteSpace: 'pre-wrap',
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN: Results ─────────────────────── */}
        <div className="two-col-right" style={{
          width: '40%', padding: '28px 32px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
          overflow: 'auto',
        }}>
          <div style={{
            fontFamily: mono, fontSize: 11, color: T.muted,
            textTransform: 'uppercase', letterSpacing: 2,
          }}>Results</div>

          {!scanResult && !error && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12, minHeight: 300,
            }}>
              <div style={{
                fontFamily: serif, fontStyle: 'italic', fontSize: 28,
                color: T.dim, opacity: 0.5,
              }}>muteform</div>
              <div style={{
                fontFamily: mono, fontSize: 12, color: T.dim,
              }}>Edit policy, select fixture, then run scan</div>
            </div>
          )}

          {scanResult && (
            <>
              {/* Stats bar */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
              }}>
                {[
                  { label: 'Nodes', value: scanResult.nodesScanned },
                  { label: 'Rules', value: scanResult.rulesEvaluated },
                  { label: 'Violations', value: scanResult.violations.length },
                  { label: 'Time', value: `${scanResult.scanDurationMs}ms` },
                ].map(s => (
                  <div key={s.label} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: '10px 12px', textAlign: 'center',
                  }}>
                    <div style={{
                      fontFamily: mono, fontSize: 18, fontWeight: 700,
                      color: T.textBright,
                    }}>{s.value}</div>
                    <div style={{
                      fontFamily: mono, fontSize: 9, color: T.muted,
                      textTransform: 'uppercase', letterSpacing: 1,
                    }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Health Score */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 10, padding: '16px 0',
              }}>
                <ScoreRing
                  score={rewriteResult ? rewriteResult.afterScore : scanResult.score}
                />
                {/* Deterministic badge */}
                <div style={{
                  fontFamily: mono, fontSize: 10,
                  color: T.green, border: `1px solid ${T.green}44`,
                  borderRadius: 20, padding: '4px 14px',
                  background: T.greenDim,
                  letterSpacing: 0.5,
                }}>Deterministic evaluation &middot; No AI in the loop</div>
              </div>

              {/* Violations list */}
              {scanResult.violations.length > 0 && !rewriteResult && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{
                    fontFamily: mono, fontSize: 11, color: T.muted,
                    textTransform: 'uppercase', letterSpacing: 2,
                  }}>Violations ({scanResult.violations.length})</div>
                  {scanResult.violations.map((v, i) => (
                    <div key={`${v.ruleId}-${v.nodeId}-${i}`} style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 8, padding: '12px 14px',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`,
                    }}>
                      {/* Top row: severity + rule + auto-fix badge */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        flexWrap: 'wrap',
                      }}>
                        <span style={{
                          fontFamily: mono, fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase',
                          color: severityColor(v.severity),
                          background: severityBg(v.severity),
                          padding: '2px 8px', borderRadius: 4,
                        }}>{v.severity}</span>
                        <span style={{
                          fontFamily: mono, fontSize: 10,
                          color: T.blue, background: T.blueDim,
                          padding: '2px 8px', borderRadius: 4,
                        }}>{v.ruleId}</span>
                        <span style={{ flex: 1 }} />
                        {v.autoFixAvailable ? (
                          <span style={{
                            fontFamily: mono, fontSize: 9, fontWeight: 700,
                            color: T.green, background: T.greenDim,
                            padding: '2px 8px', borderRadius: 4,
                            border: `1px solid ${T.green}33`,
                          }}>AUTO-FIX</span>
                        ) : (
                          <span style={{
                            fontFamily: mono, fontSize: 9, fontWeight: 700,
                            color: T.amber, background: T.amberDim,
                            padding: '2px 8px', borderRadius: 4,
                            border: `1px solid ${T.amber}33`,
                          }}>MANUAL REVIEW</span>
                        )}
                      </div>
                      {/* Node path */}
                      <div style={{
                        fontFamily: mono, fontSize: 11, color: T.muted,
                      }}>{v.nodePath}</div>
                      {/* Current → Suggested */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        flexWrap: 'wrap',
                      }}>
                        <ValuePreview property={v.property} value={v.currentValue} />
                        {v.suggestedValue != null && (
                          <>
                            <span style={{
                              fontFamily: mono, fontSize: 12, color: T.dim,
                            }}>&rarr;</span>
                            <ValuePreview property={v.property} value={v.suggestedValue} />
                          </>
                        )}
                      </div>
                      {/* Message */}
                      <div style={{
                        fontFamily: sans, fontSize: 12, color: T.muted,
                        lineHeight: 1.4,
                      }}>{v.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* APPLY GOVERNANCE button */}
              {scanResult.violations.length > 0 && !rewriteResult && (
                <button
                  onClick={handleApplyGovernance}
                  disabled={fixing}
                  style={{
                    width: '100%', padding: '14px 0',
                    background: fixing ? T.dim : `linear-gradient(135deg, ${T.green}, #00c070)`,
                    border: 'none', borderRadius: 8,
                    fontFamily: mono, fontSize: 14, fontWeight: 700,
                    color: fixing ? T.muted : T.bg,
                    cursor: fixing ? 'wait' : 'pointer',
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    transition: 'all 0.2s',
                    boxShadow: fixing ? 'none' : `0 0 24px ${T.greenGlow}`,
                  }}
                >{fixing ? 'Applying governance...' : 'Apply Governance'}</button>
              )}

              {/* Governance result: visual before/after cards */}
              {rewriteResult && fixture && (() => {
                // Group violations by category for visual cards
                const colorViolations = scanResult.violations.filter(v => v.property.startsWith('colors.'))
                const spacingViolations = scanResult.violations.filter(v => v.property.startsWith('spacing.'))
                const typographyViolations = scanResult.violations.filter(v => v.property.startsWith('typography.') || v.property === 'contrast.ratio')
                const componentViolations = scanResult.violations.filter(v => v.property.startsWith('component.'))
                const layoutViolations = scanResult.violations.filter(v => v.property.startsWith('layout.'))

                const cardStyle: React.CSSProperties = {
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
                }
                const labelStyle: React.CSSProperties = {
                  fontFamily: mono, fontSize: 10, textTransform: 'uppercase' as const,
                  letterSpacing: 1.5, color: T.muted,
                }
                const beforeAfterRow: React.CSSProperties = {
                  display: 'flex', alignItems: 'center', gap: 10,
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Summary */}
                    <div style={{
                      fontFamily: mono, fontSize: 12, color: T.text,
                      background: T.greenDim, border: `1px solid ${T.green}33`,
                      borderRadius: 8, padding: '12px 16px', lineHeight: 1.6,
                    }}>
                      <strong style={{ color: T.green }}>{autoFixCount}</strong> violation{autoFixCount !== 1 ? 's' : ''} governed
                      {manualCount > 0 && (
                        <>, <strong style={{ color: T.amber }}>{manualCount}</strong> require human review</>
                      )}
                    </div>

                    {/* Color Card */}
                    {colorViolations.length > 0 && (
                      <div style={cardStyle}>
                        <div style={labelStyle}>Color Governance</div>
                        {colorViolations.map((v, i) => (
                          <div key={i} style={beforeAfterRow}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 6,
                              background: typeof v.currentValue === 'string' ? v.currentValue : T.red,
                              border: `2px solid ${T.red}`,
                              flexShrink: 0,
                            }} />
                            <span style={{ fontFamily: mono, fontSize: 18, color: T.dim }}>&rarr;</span>
                            <div style={{
                              width: 32, height: 32, borderRadius: 6,
                              background: typeof v.suggestedValue === 'string' ? v.suggestedValue : T.green,
                              border: `2px solid ${T.green}`,
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {String(v.currentValue)} &rarr; {String(v.suggestedValue)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Spacing Card */}
                    {spacingViolations.length > 0 && (
                      <div style={cardStyle}>
                        <div style={labelStyle}>Spacing Governance</div>
                        {spacingViolations.map((v, i) => {
                          const curNum = parseInt(String(v.currentValue), 10) || 10
                          const sugNum = parseInt(String(v.suggestedValue), 10) || 10
                          return (
                            <div key={i} style={beforeAfterRow}>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{
                                  height: 10, borderRadius: 3,
                                  width: `${Math.min(curNum * 2, 100)}%`,
                                  background: T.red, border: `1px solid ${T.red}`,
                                  transition: 'width 0.3s',
                                }} />
                                <div style={{
                                  height: 10, borderRadius: 3,
                                  width: `${Math.min(sugNum * 2, 100)}%`,
                                  background: T.green, border: `1px solid ${T.green}`,
                                  transition: 'width 0.3s',
                                }} />
                              </div>
                              <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>
                                {String(v.currentValue)} &rarr; {String(v.suggestedValue)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Typography Card */}
                    {typographyViolations.length > 0 && (
                      <div style={cardStyle}>
                        <div style={labelStyle}>Typography Governance</div>
                        {typographyViolations.map((v, i) => (
                          <div key={i} style={beforeAfterRow}>
                            <div style={{
                              padding: '4px 10px', borderRadius: 6,
                              background: T.redDim, border: `1px solid ${T.red}44`,
                            }}>
                              <span style={{ fontFamily: sans, fontSize: 18, fontWeight: 600, color: T.red }}>Aa</span>
                              <div style={{ fontFamily: mono, fontSize: 9, color: T.red, marginTop: 2 }}>{String(v.currentValue)}</div>
                            </div>
                            <span style={{ fontFamily: mono, fontSize: 18, color: T.dim }}>&rarr;</span>
                            <div style={{
                              padding: '4px 10px', borderRadius: 6,
                              background: T.greenDim, border: `1px solid ${T.green}44`,
                            }}>
                              <span style={{ fontFamily: sans, fontSize: 18, fontWeight: 600, color: T.green }}>Aa</span>
                              <div style={{ fontFamily: mono, fontSize: 9, color: T.green, marginTop: 2 }}>{String(v.suggestedValue)}</div>
                            </div>
                            <div style={{ flex: 1, fontFamily: mono, fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {v.ruleId}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Component Card */}
                    {componentViolations.length > 0 && (
                      <div style={cardStyle}>
                        <div style={labelStyle}>Component Governance</div>
                        {componentViolations.map((v, i) => (
                          <div key={i} style={beforeAfterRow}>
                            <span style={{
                              fontFamily: mono, fontSize: 11, fontWeight: 700,
                              padding: '4px 12px', borderRadius: 6,
                              background: T.redDim, color: T.red,
                              border: `1px solid ${T.red}44`,
                            }}>{String(v.currentValue)}</span>
                            <span style={{ fontFamily: mono, fontSize: 18, color: T.dim }}>&rarr;</span>
                            <span style={{
                              fontFamily: mono, fontSize: 11, fontWeight: 700,
                              padding: '4px 12px', borderRadius: 6,
                              background: T.greenDim, color: T.green,
                              border: `1px solid ${T.green}44`,
                            }}>{String(v.suggestedValue)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Layout Card */}
                    {layoutViolations.length > 0 && (
                      <div style={cardStyle}>
                        <div style={labelStyle}>Layout Governance</div>
                        {layoutViolations.map((v, i) => {
                          const curCols = parseInt(String(v.currentValue), 10) || 5
                          const sugCols = parseInt(String(v.suggestedValue), 10) || 12
                          return (
                            <div key={i} style={beforeAfterRow}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${curCols}, 1fr)`, gap: 2, marginBottom: 4 }}>
                                  {Array.from({ length: curCols }).map((_, j) => (
                                    <div key={j} style={{ height: 12, borderRadius: 2, background: T.red, opacity: 0.6 }} />
                                  ))}
                                </div>
                                <div style={{ fontFamily: mono, fontSize: 9, color: T.red }}>{String(v.currentValue)}</div>
                              </div>
                              <span style={{ fontFamily: mono, fontSize: 18, color: T.dim }}>&rarr;</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sugCols}, 1fr)`, gap: 2, marginBottom: 4 }}>
                                  {Array.from({ length: sugCols }).map((_, j) => (
                                    <div key={j} style={{ height: 12, borderRadius: 2, background: T.green, opacity: 0.6 }} />
                                  ))}
                                </div>
                                <div style={{ fontFamily: mono, fontSize: 9, color: T.green }}>{String(v.suggestedValue)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Manual review items */}
                    {manualCount > 0 && (
                      <div style={{
                        fontFamily: mono, fontSize: 11, color: T.amber,
                        background: T.amberDim, border: `1px solid ${T.amber}33`,
                        borderRadius: 8, padding: '10px 14px',
                      }}>
                        {manualCount} violation{manualCount !== 1 ? 's' : ''} require human review (layout grid)
                      </div>
                    )}

                    {/* Copy governed output button */}
                    <button
                      onClick={handleCopyGoverned}
                      style={{
                        width: '100%', padding: '12px 0',
                        background: copied ? T.green : T.surface,
                        border: `1px solid ${copied ? T.green : T.border}`,
                        borderRadius: 8,
                        fontFamily: mono, fontSize: 12, fontWeight: 700,
                        color: copied ? T.bg : T.text,
                        cursor: 'pointer',
                        letterSpacing: 1, textTransform: 'uppercase',
                        transition: 'all 0.2s',
                      }}
                    >{copied ? 'Copied!' : 'Copy Governed Output'}</button>
                  </div>
                )
              })()}

              {/* Railway API panel */}
              {scanResult && (
                <div style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 8, overflow: 'hidden',
                }}>
                  <button
                    onClick={apiResponse ? () => setApiExpanded(!apiExpanded) : handleApiCall}
                    disabled={apiLoading}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: apiLoading ? 'wait' : 'pointer',
                    }}
                  >
                    <span style={{
                      fontFamily: mono, fontSize: 9, width: 12, textAlign: 'center' as const,
                      color: T.dim, transform: apiExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s', display: 'inline-block',
                    }}>{'\u25B6'}</span>
                    <span style={{
                      fontFamily: mono, fontSize: 10, color: T.blue,
                      letterSpacing: 1, textTransform: 'uppercase' as const,
                    }}>
                      {apiLoading ? 'Calling Railway API...' : apiResponse ? 'MCP Response \u2014 what Claude Code receives' : 'Call Railway API (POST /v1/validate)'}
                    </span>
                  </button>
                  {apiExpanded && apiResponse && (
                    <div style={{
                      padding: '0 14px 14px',
                      borderTop: `1px solid ${T.border}`,
                    }}>
                      <pre style={{
                        fontFamily: mono, fontSize: 10, color: T.text,
                        background: T.bg, padding: 12, borderRadius: 6,
                        overflow: 'auto', maxHeight: 300, margin: '10px 0 0',
                        lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      }}>{apiResponse}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* No violations */}
              {scanResult.violations.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '32px 0',
                }}>
                  <div style={{
                    fontFamily: sans, fontSize: 16, color: T.green,
                    fontWeight: 600, marginBottom: 6,
                  }}>All clear</div>
                  <div style={{
                    fontFamily: mono, fontSize: 12, color: T.muted,
                  }}>No violations found. Design is fully compliant.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Animation keyframes ─────────────────────────────── */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .two-col-left, .two-col-right {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  )
}
