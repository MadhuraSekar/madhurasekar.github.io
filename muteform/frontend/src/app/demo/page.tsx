'use client'

import { useEffect, useState } from 'react'
import { scanArtifact, type Artifact, type Ruleset, type ScanResult, type Violation } from '@/lib/scanner'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ViolationRow } from '@/components/ui/ViolationRow'
import { C, mono, syne, VMETA, SEVC } from '@/components/ui/tokens'

// ─── Sample Ruleset ─────────────────────────────────────────────
const SAMPLE_RULESET: Ruleset = {
  id: 'demo-ruleset',
  name: 'Acme Design System v2',
  tokens: {
    color: {
      'primary': '#0055FF',
      'primary-light': '#3377FF',
      'surface': '#0c0d0f',
      'surface-alt': '#101214',
      'text-primary': '#f0f1f3',
      'text-secondary': '#6b7280',
      'success': '#22c55e',
      'warning': '#f59e0b',
      'error': '#ef4444',
      'border': '#161819',
    },
    spacing: [4, 8, 12, 16, 24, 32, 48, 64],
  },
  typography: {
    allowedStyles: ['heading-xl', 'heading-lg', 'heading-md', 'body-lg', 'body-md', 'body-sm', 'caption', 'label'],
  },
  components: {
    Button: { allowedVariants: ['primary', 'secondary', 'ghost', 'danger'], allowedSizes: ['sm', 'md', 'lg'] },
    Card: { allowedVariants: ['default', 'elevated', 'outlined'] },
    Input: { allowedVariants: ['default', 'error', 'success'] },
    Badge: { allowedVariants: ['default', 'success', 'warning', 'error'] },
    Avatar: { allowedVariants: ['circle', 'rounded'] },
  },
  layout: {
    allowedGridColumns: [1, 2, 3, 4, 6, 12],
  },
}

// ─── Demo Artifact (hardcoded for /demo) ─────────────────────────
const demoArtifact: Artifact = {
  id: "demo_artifact",
  name: "Checkout Flow",
  source: "generic-json",
  nodes: [{
    id: "node_1",
    type: "button",
    name: "Primary CTA",
    parentName: "Payment Form",
    styles: {
      color: "#3478F6",
      spacing: 22,
      typographyStyle: "display-xl"
    },
    component: {
      name: "Button",
      variant: "ghost",
      size: "md"
    },
    layout: {
      gridColumns: 10
    }
  }]
}

// ─── Design Principles ─────────────────────────────────────────
interface DesignPrinciple {
  icon: string
  principle: string
  check: string
  result: 'PASS' | 'FAIL'
  explanation: string
  severity: 'HIGH' | 'MEDIUM' | 'N/A'
  whyItMatters: string
}

const DESIGN_PRINCIPLES: DesignPrinciple[] = [
  {
    icon: '◇',
    principle: 'Visual Hierarchy',
    check: 'Primary action must be the most visually dominant element on screen',
    result: 'FAIL',
    explanation: 'Button uses ghost variant. Ghost buttons recede visually. Primary actions require filled variants to establish correct hierarchy.',
    severity: 'HIGH',
    whyItMatters: 'This weakens the user\'s sense of what action to take next.',
  },
  {
    icon: '◉',
    principle: 'Accessibility',
    check: 'All interactive elements must meet WCAG AA contrast ratio (4.5:1 minimum)',
    result: 'FAIL',
    explanation: 'Color #3478F6 on white background achieves 3.1:1 contrast ratio. Minimum required: 4.5:1',
    severity: 'HIGH',
    whyItMatters: 'This reduces readability and increases accessibility risk.',
  },
  {
    icon: '⊡',
    principle: 'Cognitive Load',
    check: 'Each screen section should have one primary action maximum',
    result: 'PASS',
    explanation: 'Single primary action detected in payment form',
    severity: 'N/A',
    whyItMatters: 'Keeping one primary action per section helps users decide faster.',
  },
  {
    icon: '⊞',
    principle: 'Spacing Consistency',
    check: 'All spacing must follow the 8pt grid system',
    result: 'FAIL',
    explanation: 'Spacing 22px does not align to 8pt grid. Nearest grid value: 24px',
    severity: 'MEDIUM',
    whyItMatters: 'This introduces subtle inconsistency that makes the interface feel less trustworthy.',
  },
]

export default function DemoPage() {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [fixed, setFixed] = useState<Set<string>>(new Set())
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    // Run scan locally — no API call, completes instantly
    const timer = setTimeout(() => {
      const scanResult = scanArtifact(demoArtifact, SAMPLE_RULESET)
      setResult(scanResult)
      setScanning(false)
      setExpanded(new Set([0]))
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleFix = (v: Violation) => {
    setFixed(prev => new Set(prev).add(v.id))
  }

  const handleFixAll = () => {
    if (!result) return
    const allIds = new Set(result.violations.map(v => v.id))
    setFixed(allIds)
  }

  const handleIgnore = (id: string) => {
    // no-op in demo
  }

  const typeCount = (violations: Violation[]) => {
    const counts: Record<string, number> = {}
    for (const v of violations) {
      counts[v.type] = (counts[v.type] || 0) + 1
    }
    return counts
  }

  const activeViolations = result ? result.violations.filter(v => !fixed.has(v.id)).length : 0
  const allFixed = result ? result.violations.length > 0 && fixed.size >= result.violations.length : false

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 56,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: `linear-gradient(135deg, ${C.blue}, ${C.blue}99)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontFamily: syne, fontSize: 13, fontWeight: 800, color: '#fff' }}>M</span>
          </div>
          <span style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            muteform
          </span>
          <span style={{
            fontFamily: mono,
            fontSize: 10,
            color: C.blue,
            background: C.blueDim,
            padding: '3px 8px',
            borderRadius: 4,
            border: `1px solid ${C.blue}33`,
            letterSpacing: '0.06em',
          }}>
            LIVE DEMO
          </span>
        </div>

        <span style={{
            fontFamily: mono,
            fontSize: 11,
            color: C.green,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: C.green,
              boxShadow: `0 0 8px ${C.green}66`,
            }} />
            ENGINE READY
          </span>
      </div>

      {/* Hero — two lines of context */}
      <div style={{
        padding: '48px 24px 32px',
        maxWidth: 960,
        margin: '0 auto',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: syne,
          fontSize: 36,
          fontWeight: 700,
          color: C.text,
          letterSpacing: '-0.03em',
          lineHeight: 1.2,
          margin: 0,
        }}>
          Design governance for<br />AI-generated interfaces
        </h1>
        <p style={{
          fontFamily: mono,
          fontSize: 13,
          color: C.muted,
          marginTop: 12,
          marginBottom: 0,
          lineHeight: 1.6,
        }}>
          Token rules + Design principles. Enforced at the point of AI generation.
        </p>
      </div>

      {/* Scan results */}
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '0 24px 80px',
      }}>
        {scanning ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 80,
            gap: 16,
          }}>
            <div style={{
              width: 32,
              height: 32,
              border: `2px solid ${C.border}`,
              borderTopColor: C.blue,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontFamily: mono, fontSize: 12, color: C.muted, letterSpacing: '0.05em' }}>
              SCANNING ARTIFACT...
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : result && (
          <>
            {/* Summary bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              padding: '20px 24px',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              marginBottom: 16,
            }}>
              <ScoreRing score={allFixed ? 100 : result.health_score} size={72} />

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: syne, fontSize: 22, fontWeight: 700, color: C.text }}>
                    Health Score
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>
                    {demoArtifact.name}
                  </span>
                </div>
                <div style={{
                  fontFamily: mono,
                  fontSize: 11,
                  color: C.dim,
                  marginTop: 4,
                  letterSpacing: '0.02em',
                }}>
                  Source: {demoArtifact.source} · Ruleset: {SAMPLE_RULESET.name}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'TOTAL', value: result.violation_count, color: C.text },
                  { label: 'HIGH', value: result.high_count, color: SEVC.high },
                  { label: 'MEDIUM', value: result.medium_count, color: SEVC.medium },
                  { label: 'LOW', value: result.low_count, color: SEVC.low },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: s.color }}>
                      {s.value}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: C.dim, letterSpacing: '0.08em' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Type breakdown pills + FIX ALL */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              {Object.entries(typeCount(result.violations)).map(([type, count]) => {
                const meta = VMETA[type] || { short: type, icon: '!', color: C.muted }
                return (
                  <div key={type} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    fontFamily: mono,
                    fontSize: 11,
                  }}>
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span style={{ color: C.muted }}>{meta.short}</span>
                    <span style={{
                      color: C.text,
                      fontWeight: 600,
                      background: C.surface2,
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: 10,
                    }}>{count}</span>
                  </div>
                )
              })}

              <div style={{ flex: 1 }} />

              {!allFixed && (
                <button
                  onClick={handleFixAll}
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    padding: '7px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: C.green,
                    color: '#fff',
                    border: 'none',
                    transition: 'opacity 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  FIX ALL ({activeViolations})
                </button>
              )}
              {allFixed && (
                <span style={{
                  fontFamily: mono, fontSize: 11, letterSpacing: '0.06em',
                  color: C.green, padding: '7px 16px', borderRadius: 6,
                  background: C.greenDim, border: `1px solid ${C.greenBorder}`,
                }}>
                  ALL FIXED ✓
                </span>
              )}
            </div>

            {/* Violations list */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: syne, fontSize: 13, fontWeight: 600, color: C.text }}>
                  Violations
                </span>
                <span style={{ fontFamily: mono, fontSize: 10, color: C.dim }}>
                  {result.violations.length} found
                </span>
              </div>

              {result.violations.map((v, i) => (
                <ViolationRow
                  key={v.id}
                  violation={v}
                  index={i}
                  isExpanded={expanded.has(i)}
                  onToggle={() => toggleExpand(i)}
                  onApplyFix={() => handleFix(v)}
                  onIgnore={handleIgnore}
                  isFixed={fixed.has(v.id)}
                  showPath={true}
                />
              ))}
            </div>

            {/* ─── Design Principles Analysis ─── */}
            <div style={{ marginTop: 32 }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                marginBottom: 16,
              }}>
                <h2 style={{
                  fontFamily: syne,
                  fontSize: 20,
                  fontWeight: 700,
                  color: C.text,
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}>
                  Design Principles Analysis
                </h2>
                <span style={{
                  fontFamily: mono,
                  fontSize: 10,
                  color: C.purple,
                  background: `${C.purple}15`,
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: `1px solid ${C.purple}33`,
                  letterSpacing: '0.06em',
                }}>
                  HIGHER-ORDER
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}>
                {DESIGN_PRINCIPLES.map((p, i) => {
                  const isFail = p.result === 'FAIL'
                  const sevColor = p.severity === 'HIGH' ? SEVC.high : p.severity === 'MEDIUM' ? SEVC.medium : C.green
                  const borderColor = isFail ? `${sevColor}44` : `${C.green}44`
                  const accentGrad = isFail
                    ? `linear-gradient(135deg, ${sevColor}08, transparent)`
                    : `linear-gradient(135deg, ${C.green}08, transparent)`

                  return (
                    <div key={i} style={{
                      padding: '20px',
                      borderRadius: 12,
                      background: accentGrad,
                      border: `1px solid ${borderColor}`,
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {/* Left accent bar */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: isFail ? sevColor : C.green,
                        borderRadius: '12px 0 0 12px',
                      }} />

                      {/* Header: icon + principle + result */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                      }}>
                        <span style={{
                          fontFamily: mono,
                          fontSize: 16,
                          color: isFail ? sevColor : C.green,
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 6,
                          background: isFail ? `${sevColor}15` : `${C.green}15`,
                          flexShrink: 0,
                        }}>
                          {p.icon}
                        </span>
                        <span style={{
                          fontFamily: syne,
                          fontSize: 14,
                          fontWeight: 700,
                          color: C.text,
                          flex: 1,
                        }}>
                          {p.principle}
                        </span>
                        <span style={{
                          fontFamily: mono,
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          padding: '3px 8px',
                          borderRadius: 4,
                          color: isFail ? sevColor : C.green,
                          background: isFail ? `${sevColor}18` : `${C.green}18`,
                          border: `1px solid ${isFail ? `${sevColor}33` : `${C.green}33`}`,
                        }}>
                          {p.result}
                        </span>
                        {p.severity !== 'N/A' && (
                          <span style={{
                            fontFamily: mono,
                            fontSize: 9,
                            letterSpacing: '0.06em',
                            padding: '2px 6px',
                            borderRadius: 3,
                            color: sevColor,
                            background: `${sevColor}12`,
                          }}>
                            {p.severity}
                          </span>
                        )}
                      </div>

                      {/* Rule */}
                      <div style={{
                        fontFamily: mono,
                        fontSize: 11,
                        color: C.muted,
                        lineHeight: 1.5,
                        marginBottom: 8,
                        paddingLeft: 36,
                      }}>
                        &ldquo;{p.check}&rdquo;
                      </div>

                      {/* Explanation */}
                      <div style={{
                        fontFamily: syne,
                        fontSize: 12,
                        color: C.text,
                        lineHeight: 1.5,
                        paddingLeft: 36,
                        marginBottom: 8,
                      }}>
                        {p.explanation}
                      </div>

                      {/* Why it matters */}
                      <div style={{
                        fontFamily: syne,
                        fontSize: 11,
                        color: isFail ? sevColor : C.green,
                        lineHeight: 1.4,
                        paddingLeft: 36,
                        fontStyle: 'italic',
                        opacity: 0.85,
                      }}>
                        Why it matters: {p.whyItMatters}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ruleset preview */}
            <div style={{
              marginTop: 16,
              padding: '20px 24px',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <span style={{ fontFamily: syne, fontSize: 14, fontWeight: 600, color: C.text }}>
                  Ruleset: {SAMPLE_RULESET.name}
                </span>
                <span style={{ fontFamily: mono, fontSize: 10, color: C.dim }}>
                  sample
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {/* Colors */}
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
                    COLOR TOKENS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(SAMPLE_RULESET.tokens.color || {}).map(([name, hex]) => (
                      <div key={name} style={{
                        width: 20, height: 20, borderRadius: 4,
                        backgroundColor: hex,
                        border: `1px solid ${C.border}`,
                      }} title={`${name}: ${hex}`} />
                    ))}
                  </div>
                </div>

                {/* Spacing */}
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
                    SPACING SCALE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                    {SAMPLE_RULESET.tokens.spacing?.map(s => (
                      <div key={s} style={{
                        width: 8,
                        height: Math.max(4, s * 0.6),
                        borderRadius: 2,
                        backgroundColor: C.blue,
                        opacity: 0.5,
                      }} title={`${s}px`} />
                    ))}
                  </div>
                </div>

                {/* Components */}
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: '0.06em', marginBottom: 8 }}>
                    COMPONENTS
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: C.dim, lineHeight: 1.8 }}>
                    {Object.keys(SAMPLE_RULESET.components || {}).map(name => (
                      <span key={name} style={{
                        display: 'inline-block',
                        marginRight: 6,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: C.surface2,
                        border: `1px solid ${C.border}`,
                        fontSize: 10,
                      }}>{name}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{
              marginTop: 32,
              textAlign: 'center',
              padding: '40px 24px',
              background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
              borderRadius: 16,
              border: `1px solid ${C.border}`,
            }}>
              <h2 style={{
                fontFamily: syne,
                fontSize: 24,
                fontWeight: 700,
                color: C.text,
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}>
                Set up your own ruleset
              </h2>
              <p style={{
                fontFamily: mono,
                fontSize: 13,
                color: C.muted,
                marginBottom: 24,
                maxWidth: 400,
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.6,
              }}>
                Define your design tokens, components, and rules.
                Scan every AI-generated interface automatically.
              </p>
              <a
                href="mailto:hello@muteform.com"
                style={{
                  display: 'inline-block',
                  fontFamily: mono,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  background: `linear-gradient(135deg, ${C.blue}, #0044cc)`,
                  padding: '14px 32px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                  boxShadow: `0 4px 24px ${C.blue}33`,
                  transition: 'opacity 0.15s, transform 0.1s',
                }}
              >
                Get early access →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
