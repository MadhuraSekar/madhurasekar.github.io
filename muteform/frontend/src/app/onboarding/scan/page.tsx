'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
const serif = "'Instrument Serif', Georgia, serif"

type Severity = 'critical' | 'high' | 'medium' | 'low'

interface Violation {
  id: string
  severity: Severity
  rule: string
  message: string
  current: string
  suggested: string
  detail: string
  fixed: boolean
}

var SAMPLE_VIOLATIONS: Record<string, Violation[]> = {
  'ecommerce': [
    {
      id: 'v1', severity: 'critical', rule: 'color/token-only',
      message: 'Hardcoded color in checkout button',
      current: 'background: #2563eb', suggested: 'background: var(--color-primary)',
      detail: 'The checkout button uses a hardcoded hex value instead of referencing the primary color token. This will cause inconsistencies when the theme changes.',
      fixed: false,
    },
    {
      id: 'v2', severity: 'high', rule: 'spacing/scale-only',
      message: 'Non-standard padding in card component',
      current: 'padding: 13px', suggested: 'padding: var(--space-md) /* 16px */',
      detail: '13px is not on the spacing scale. The nearest value is 16px (--space-md). Using off-scale values creates visual inconsistency.',
      fixed: false,
    },
    {
      id: 'v3', severity: 'critical', rule: 'a11y/contrast-ratio',
      message: 'Insufficient contrast on price display',
      current: '#94a3b8 on #f8fafc (2.4:1)', suggested: '#475569 on #f8fafc (7.1:1)',
      detail: 'Price text fails WCAG AA contrast requirements. Current ratio is 2.4:1, minimum is 4.5:1 for normal text. Darkening to --color-text-secondary resolves this.',
      fixed: false,
    },
    {
      id: 'v4', severity: 'medium', rule: 'shape/radius-token',
      message: 'Arbitrary border-radius on input field',
      current: 'border-radius: 5px', suggested: 'border-radius: var(--radius-sm) /* 4px */',
      detail: '5px is not a defined radius token. Use --radius-sm (4px) or --radius-md (8px) to maintain consistency.',
      fixed: false,
    },
    {
      id: 'v5', severity: 'high', rule: 'typography/font-family',
      message: 'Unapproved font in product title',
      current: "font-family: 'Helvetica Neue'", suggested: "font-family: var(--font-heading)",
      detail: "'Helvetica Neue' is not in the approved font list. Use --font-heading (Inter) for headings.",
      fixed: false,
    },
  ],
  'saas': [
    {
      id: 'v1', severity: 'critical', rule: 'color/token-only',
      message: 'Hardcoded color in sidebar navigation',
      current: 'color: #334155', suggested: 'color: var(--color-text-muted)',
      detail: 'Navigation items use hardcoded colors. When switching between light and dark themes, these will not adapt correctly.',
      fixed: false,
    },
    {
      id: 'v2', severity: 'high', rule: 'spacing/scale-only',
      message: 'Inconsistent gap in metric cards grid',
      current: 'gap: 18px', suggested: 'gap: var(--space-md) /* 16px */',
      detail: '18px is not on the spacing scale. The dashboard grid should use consistent scale values for alignment.',
      fixed: false,
    },
    {
      id: 'v3', severity: 'medium', rule: 'elevation/shadow-approved',
      message: 'Custom box-shadow on dropdown menu',
      current: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15)', suggested: 'box-shadow: var(--shadow-lg)',
      detail: 'Custom shadows break the elevation system. Use --shadow-lg for floating elements like dropdowns.',
      fixed: false,
    },
    {
      id: 'v4', severity: 'high', rule: 'typography/size-scale',
      message: 'Off-scale font size in chart label',
      current: 'font-size: 11px', suggested: 'font-size: var(--text-xs) /* 12px */',
      detail: '11px is not on the type scale. Use --text-xs (12px) for the smallest readable text size.',
      fixed: false,
    },
  ],
  'mobile': [
    {
      id: 'v1', severity: 'critical', rule: 'a11y/contrast-ratio',
      message: 'Low contrast on step indicator text',
      current: '#cbd5e1 on #f1f5f9 (1.8:1)', suggested: '#64748b on #f1f5f9 (4.6:1)',
      detail: 'Step indicator labels are nearly invisible. Current ratio 1.8:1 is far below the 4.5:1 minimum.',
      fixed: false,
    },
    {
      id: 'v2', severity: 'high', rule: 'color/token-only',
      message: 'Hardcoded gradient in hero section',
      current: 'background: linear-gradient(#6366f1, #8b5cf6)', suggested: 'background: linear-gradient(var(--color-primary), var(--color-secondary))',
      detail: 'Gradient uses hardcoded hex values. Token references ensure the gradient adapts to theme changes.',
      fixed: false,
    },
    {
      id: 'v3', severity: 'medium', rule: 'spacing/scale-only',
      message: 'Non-standard margin on CTA button',
      current: 'margin-top: 22px', suggested: 'margin-top: var(--space-lg) /* 24px */',
      detail: '22px breaks the spatial rhythm. Use --space-lg (24px) for consistent vertical spacing.',
      fixed: false,
    },
    {
      id: 'v4', severity: 'medium', rule: 'shape/radius-token',
      message: 'Oversized radius on avatar component',
      current: 'border-radius: 999px', suggested: 'border-radius: var(--radius-full) /* 9999px */',
      detail: 'While visually equivalent, use the --radius-full token for semantic clarity and consistency.',
      fixed: false,
    },
    {
      id: 'v5', severity: 'low', rule: 'color/opacity-token',
      message: 'Hardcoded opacity on overlay',
      current: 'opacity: 0.6', suggested: 'opacity: var(--opacity-overlay) /* 0.6 */',
      detail: 'Use the opacity token for maintainability, even when the current value matches.',
      fixed: false,
    },
  ],
}

var PASTE_VIOLATIONS: Violation[] = [
  {
    id: 'v1', severity: 'critical', rule: 'color/token-only',
    message: 'Hardcoded color value detected',
    current: 'color: #333', suggested: 'color: var(--color-text)',
    detail: 'All color values should reference design tokens for consistency and theme support.',
    fixed: false,
  },
  {
    id: 'v2', severity: 'high', rule: 'spacing/scale-only',
    message: 'Arbitrary spacing value',
    current: 'padding: 15px', suggested: 'padding: var(--space-md) /* 16px */',
    detail: '15px is not on the spacing scale. Use the nearest scale value.',
    fixed: false,
  },
  {
    id: 'v3', severity: 'medium', rule: 'typography/font-family',
    message: 'Missing font stack',
    current: "font-family: Arial", suggested: "font-family: var(--font-body)",
    detail: 'Use the approved font token instead of system fonts directly.',
    fixed: false,
  },
]

function sevColor(sev: Severity): string {
  if (sev === 'critical') return T.red
  if (sev === 'high') return T.red
  if (sev === 'medium') return T.amber
  return T.muted
}

function sevBg(sev: Severity): string {
  if (sev === 'critical') return T.redDim
  if (sev === 'high') return T.redDim
  if (sev === 'medium') return T.amberDim
  return T.surface2
}

function calcScore(violations: Violation[]): number {
  if (violations.length === 0) return 100
  var total = violations.length
  var fixed = violations.filter(function(v) { return v.fixed }).length
  if (fixed === total) return 100
  var unfixed = total - fixed
  var penalty = 0
  violations.forEach(function(v) {
    if (!v.fixed) {
      if (v.severity === 'critical') penalty += 25
      else if (v.severity === 'high') penalty += 15
      else if (v.severity === 'medium') penalty += 8
      else penalty += 3
    }
  })
  return Math.max(0, Math.min(100, 100 - penalty))
}

function ProgressBar({ step }: { step: number }) {
  var steps = ['Connect', 'Rules', 'Scan']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 48, width: '100%', maxWidth: 480 }}>
      {steps.map(function(label, i) {
        var active = i + 1 === step
        var done = i + 1 < step
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? T.green : active ? T.greenDim : T.surface2,
                border: '2px solid ' + (done || active ? T.green : T.border),
                color: done ? T.bg : active ? T.green : T.muted,
                fontFamily: mono, fontSize: 13, fontWeight: 700,
                transition: 'all 0.3s ease',
              }}>
                {done ? '\u2713' : String(i + 1)}
              </div>
              <span style={{
                marginTop: 6, fontFamily: mono, fontSize: 11, letterSpacing: '0.05em',
                color: active ? T.green : done ? T.text : T.muted,
                textTransform: 'uppercase' as const,
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 2, flex: 1, background: done ? T.green : T.border,
                marginTop: -18, transition: 'background 0.3s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScoreRing({ score, size, animated }: { score: number; size: number; animated: boolean }) {
  var strokeWidth = 6
  var radius = (size - strokeWidth) / 2
  var circumference = 2 * Math.PI * radius
  var [displayScore, setDisplayScore] = useState(0)
  var [offset, setOffset] = useState(circumference)
  var animRef = useRef(false)

  useEffect(function() {
    if (!animated) {
      setDisplayScore(score)
      setOffset(circumference - (score / 100) * circumference)
      return
    }
    // Animate
    if (animRef.current) return
    animRef.current = true
    var start = 0
    var end = score
    var duration = 1200
    var startTime = Date.now()

    function tick() {
      var elapsed = Date.now() - startTime
      var progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3)
      var current = Math.round(start + (end - start) * eased)
      setDisplayScore(current)
      setOffset(circumference - (current / 100) * circumference)
      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        animRef.current = false
      }
    }
    requestAnimationFrame(tick)
  }, [score, animated, circumference])

  var color = displayScore >= 90 ? T.green : displayScore >= 60 ? T.amber : T.red

  return (
    <div style={{ position: 'relative' as const, width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={T.border} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={String(circumference)}
          strokeDashoffset={String(offset)}
          style={{ transition: animated ? 'none' : 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute' as const, inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: mono, fontSize: size * 0.28, fontWeight: 700, color: color }}>
          {displayScore}
        </span>
        <span style={{ fontFamily: mono, fontSize: size * 0.09, color: T.muted, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
          score
        </span>
      </div>
    </div>
  )
}

type Tab = 'sample' | 'paste'

export default function ScanPage() {
  var router = useRouter()
  var [tab, setTab] = useState<Tab>('sample')
  var [selectedSample, setSelectedSample] = useState('')
  var [pastedCode, setPastedCode] = useState('')
  var [scanning, setScanning] = useState(false)
  var [scanDone, setScanDone] = useState(false)
  var [violations, setViolations] = useState<Violation[]>([])
  var [expandedId, setExpandedId] = useState('')
  var [allFixed, setAllFixed] = useState(false)
  var [scoreAnimated, setScoreAnimated] = useState(false)

  var score = calcScore(violations)
  var canScan = tab === 'sample' ? selectedSample !== '' : pastedCode.trim() !== ''

  function runScan() {
    setScanning(true)
    setScanDone(false)
    setAllFixed(false)
    setExpandedId('')

    setTimeout(function() {
      var v: Violation[]
      if (tab === 'sample') {
        var key = selectedSample === 'E-commerce Checkout' ? 'ecommerce'
          : selectedSample === 'SaaS Dashboard' ? 'saas' : 'mobile'
        v = (SAMPLE_VIOLATIONS[key] || []).map(function(item) {
          return Object.assign({}, item, { fixed: false })
        })
      } else {
        v = PASTE_VIOLATIONS.map(function(item) {
          return Object.assign({}, item, { fixed: false })
        })
      }
      setViolations(v)
      setScanning(false)
      setScanDone(true)
      setScoreAnimated(true)
    }, 2000)
  }

  function fixAll() {
    setViolations(violations.map(function(v) {
      return Object.assign({}, v, { fixed: true })
    }))
    setAllFixed(true)
    setScoreAnimated(false)
    // Re-trigger animation for score jump
    setTimeout(function() {
      setScoreAnimated(true)
    }, 50)
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? '' : id)
  }

  var samples = ['E-commerce Checkout', 'SaaS Dashboard', 'Mobile Onboarding']

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.text, fontFamily: sans,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px',
    }}>
      <ProgressBar step={3} />

      <div style={{
        fontFamily: serif, fontSize: 36, color: T.textBright, marginBottom: 8,
        fontStyle: 'italic', letterSpacing: '-0.01em',
      }}>
        Run Your First Scan
      </div>
      <p style={{ fontFamily: mono, fontSize: 13, color: T.muted, marginBottom: 40, letterSpacing: '0.02em' }}>
        See Muteform in action on real interface code
      </p>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 32, padding: 4,
        background: T.surface, borderRadius: 10, border: '1px solid ' + T.border,
      }}>
        {[{ key: 'sample' as Tab, label: 'Scan a Sample' }, { key: 'paste' as Tab, label: 'Paste Your Code' }].map(function(t) {
          var active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={function() {
                setTab(t.key)
                setScanDone(false)
                setScanning(false)
                setViolations([])
                setAllFixed(false)
              }}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? T.surface2 : 'transparent',
                color: active ? T.textBright : T.muted,
                fontFamily: mono, fontSize: 12, letterSpacing: '0.02em',
                transition: 'all 0.2s ease',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Input area */}
      {!scanDone && !scanning && (
        <div style={{ width: '100%', maxWidth: 640, marginBottom: 24 }}>
          {tab === 'sample' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {samples.map(function(name) {
                var active = selectedSample === name
                var icon = name === 'E-commerce Checkout' ? '\uD83D\uDED2'
                  : name === 'SaaS Dashboard' ? '\uD83D\uDCCA' : '\uD83D\uDCF1'
                return (
                  <button
                    key={name}
                    onClick={function() { setSelectedSample(name) }}
                    style={{
                      padding: '16px 20px', borderRadius: 10,
                      border: '1px solid ' + (active ? T.green : T.border2),
                      background: active ? T.greenDim : T.surface,
                      color: active ? T.green : T.text,
                      fontFamily: mono, fontSize: 13, cursor: 'pointer',
                      textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span>{name}</span>
                    {active && <span style={{ marginLeft: 'auto', color: T.green }}>{'\u2713'}</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div>
              <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12, display: 'block' }}>
                PASTE HTML / CSS CODE
              </label>
              <textarea
                value={pastedCode}
                onChange={function(e) { setPastedCode(e.target.value) }}
                placeholder={'<div style="color: #333; padding: 15px; font-family: Arial;">\n  <h1 style="font-size: 28px; margin-bottom: 10px;">Hello</h1>\n  <button style="background: #2563eb; border-radius: 5px;">\n    Click me\n  </button>\n</div>'}
                style={{
                  width: '100%', minHeight: 200, padding: 16, borderRadius: 8,
                  background: T.bg, border: '1px solid ' + T.border2, color: T.text,
                  fontFamily: mono, fontSize: 13, lineHeight: 1.6, resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box' as const,
                }}
                onFocus={function(e) { e.currentTarget.style.borderColor = T.green }}
                onBlur={function(e) { e.currentTarget.style.borderColor = T.border2 }}
              />
            </div>
          )}

          {canScan && (
            <button
              onClick={runScan}
              style={{
                marginTop: 20, padding: '14px 36px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: T.green, color: T.bg,
                fontFamily: mono, fontSize: 14, fontWeight: 700,
                boxShadow: '0 0 24px ' + T.green + '30',
                display: 'block', width: '100%',
              }}
            >
              Run Scan
            </button>
          )}
        </div>
      )}

      {/* Scanning animation */}
      {scanning && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 80,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid ' + T.border,
            borderTopColor: T.green,
            animation: 'mf-spin 0.8s linear infinite',
          }} />
          <style>{'\n@keyframes mf-spin { to { transform: rotate(360deg); } }\n@keyframes mf-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }\n'}</style>
          <p style={{
            fontFamily: mono, fontSize: 14, color: T.green, marginTop: 20,
            letterSpacing: '0.15em', textTransform: 'uppercase' as const,
            animation: 'mf-pulse 1.2s ease-in-out infinite',
          }}>
            SCANNING...
          </p>
          <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginTop: 8 }}>
            Analyzing code against your ruleset
          </p>
        </div>
      )}

      {/* Results */}
      {scanDone && (
        <div style={{ width: '100%', maxWidth: 800 }}>
          {/* Score + Summary */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 32, marginBottom: 32,
            padding: 32, background: T.surface, borderRadius: 12, border: '1px solid ' + T.border,
            flexWrap: 'wrap' as const, justifyContent: 'center',
          }}>
            <ScoreRing score={score} size={140} animated={scoreAnimated} />
            <div style={{ flex: 1, minWidth: 200 }}>
              {allFixed ? (
                <div>
                  <div style={{
                    fontFamily: serif, fontSize: 24, color: T.green, fontStyle: 'italic', marginBottom: 8,
                  }}>
                    Your interface is now compliant.
                  </div>
                  <p style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                    Score: <strong style={{ color: T.green }}>100</strong> {'\u2014'} All violations resolved.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{
                    fontFamily: serif, fontSize: 24, color: T.textBright, fontStyle: 'italic', marginBottom: 8,
                  }}>
                    Scan Complete
                  </div>
                  <p style={{ fontFamily: mono, fontSize: 13, color: T.muted, marginBottom: 12 }}>
                    Found <strong style={{ color: T.red }}>{violations.length}</strong> violations in{' '}
                    <strong style={{ color: T.textBright }}>{tab === 'sample' ? selectedSample : 'pasted code'}</strong>
                  </p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {(['critical', 'high', 'medium', 'low'] as Severity[]).map(function(sev) {
                      var count = violations.filter(function(v) { return v.severity === sev && !v.fixed }).length
                      if (count === 0) return null
                      return (
                        <span key={sev} style={{
                          padding: '3px 10px', borderRadius: 4,
                          background: sevBg(sev), color: sevColor(sev),
                          fontFamily: mono, fontSize: 11, fontWeight: 700,
                          textTransform: 'uppercase' as const,
                        }}>
                          {count} {sev}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fix All button */}
          {!allFixed && (
            <button
              onClick={fixAll}
              style={{
                marginBottom: 24, padding: '12px 28px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: T.green, color: T.bg,
                fontFamily: mono, fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 0 24px ' + T.green + '30',
              }}
            >
              {'\u2713'} Fix All ({violations.filter(function(v) { return !v.fixed }).length} violations)
            </button>
          )}

          {/* Violation list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {violations.map(function(v) {
              var expanded = expandedId === v.id
              return (
                <div key={v.id} style={{
                  background: T.surface, borderRadius: 10,
                  border: '1px solid ' + (v.fixed ? T.green + '30' : T.border2),
                  overflow: 'hidden',
                  opacity: v.fixed ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}>
                  <button
                    onClick={function() { toggleExpand(v.id) }}
                    style={{
                      width: '100%', padding: '14px 20px', border: 'none', cursor: 'pointer',
                      background: 'transparent', color: T.text,
                      display: 'flex', alignItems: 'center', gap: 12,
                      textAlign: 'left' as const,
                    }}
                  >
                    {/* Severity badge */}
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                      background: v.fixed ? T.greenDim : sevBg(v.severity),
                      color: v.fixed ? T.green : sevColor(v.severity),
                      fontFamily: mono, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                    }}>
                      {v.fixed ? 'FIXED' : v.severity}
                    </span>

                    {/* Message */}
                    <span style={{
                      flex: 1, fontFamily: sans, fontSize: 13,
                      color: v.fixed ? T.muted : T.text,
                      textDecoration: v.fixed ? 'line-through' : 'none',
                    }}>
                      {v.message}
                    </span>

                    {/* Rule name */}
                    <span style={{ fontFamily: mono, fontSize: 11, color: T.dim, flexShrink: 0 }}>
                      {v.rule}
                    </span>

                    {/* Expand arrow */}
                    <span style={{
                      color: T.muted, fontSize: 12, transition: 'transform 0.2s ease',
                      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}>
                      {'\u25BC'}
                    </span>
                  </button>

                  {expanded && (
                    <div style={{
                      padding: '0 20px 16px 20px',
                      borderTop: '1px solid ' + T.border,
                    }}>
                      {/* Current vs Suggested */}
                      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' as const }}>
                        <div style={{
                          flex: '1 1 200px', padding: 12, borderRadius: 6,
                          background: T.redDim, border: '1px solid ' + T.red + '20',
                        }}>
                          <span style={{ fontFamily: mono, fontSize: 10, color: T.red, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>CURRENT</span>
                          <pre style={{ fontFamily: mono, fontSize: 12, color: T.text, margin: '6px 0 0', whiteSpace: 'pre-wrap' as const }}>
                            {v.current}
                          </pre>
                        </div>
                        <div style={{
                          flex: '1 1 200px', padding: 12, borderRadius: 6,
                          background: T.greenDim, border: '1px solid ' + T.green + '20',
                        }}>
                          <span style={{ fontFamily: mono, fontSize: 10, color: T.green, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>SUGGESTED</span>
                          <pre style={{ fontFamily: mono, fontSize: 12, color: T.text, margin: '6px 0 0', whiteSpace: 'pre-wrap' as const }}>
                            {v.suggested}
                          </pre>
                        </div>
                      </div>
                      {/* Detail */}
                      <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginTop: 12, lineHeight: 1.6 }}>
                        {v.detail}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* CTA after fix */}
          {allFixed && (
            <div style={{ textAlign: 'center' as const }}>
              <button
                onClick={function() { router.push('/dashboard') }}
                style={{
                  padding: '14px 36px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: T.green, color: T.bg,
                  fontFamily: mono, fontSize: 14, fontWeight: 700,
                  boxShadow: '0 0 24px ' + T.green + '30',
                }}
              >
                Go to Dashboard {'\u2192'}
              </button>
              <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginTop: 12 }}>
                Your design system is ready to enforce consistency
              </p>
            </div>
          )}

          {/* Rescan button */}
          {!allFixed && (
            <div style={{ textAlign: 'center' as const }}>
              <button
                onClick={function() {
                  setScanDone(false)
                  setViolations([])
                  setScoreAnimated(false)
                }}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: '1px solid ' + T.border2,
                  background: 'transparent', color: T.muted,
                  fontFamily: mono, fontSize: 12, cursor: 'pointer',
                }}
              >
                {'\u2190'} Choose Different Sample
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
