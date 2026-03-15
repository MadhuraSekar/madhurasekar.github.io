'use client'

import { useState, useEffect, useCallback } from 'react'
import { validate, calculateScore, remediate } from '@/lib/engine'
import type { MuteformConfig, InterfaceDefinition, Violation, ValidationResult } from '@/lib/engine'

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
const sans = "'DM Sans', system-ui, sans-serif"
const serif = "'Instrument Serif', Georgia, serif"

// ─── Hardcoded YAML (visual only) ───────────────────────────
const RULESET_YAML = `name: "Acme Core v8"
version: "8.0.0"

tokens:
  colors:
    brand:
      primary: "#00e087"
      secondary: "#0a1628"
    semantic:
      success: "#00e087"
      warning: "#ffb830"
      error: "#ff4070"
      info: "#4090ff"
    neutral:
      white: "#ffffff"
      gray-100: "#f0f1f3"
      gray-400: "#9ca3af"
      gray-900: "#111827"
      black: "#000000"
  spacing:
    scale: [4, 8, 12, 16, 24, 32, 48, 64]
    tolerance: 0
  typography:
    families:
      display: "Instrument Serif"
      body: "DM Sans"
      mono: "JetBrains Mono"
    scale_ratio: 1.25
    min_body_size: 14
  motion:
    max_duration: 300
    easing_allowed: ["ease-out", "ease-in-out"]
  layout:
    grid_columns: [1, 2, 3, 4, 6, 12]

rules:
  - id: "contrast-wcag-aa"
    severity: critical
    description: "Interactive elements must meet WCAG AA"
    check: "contrast.ratio >= 4.5"
    auto_fix: "adjust_foreground"
  - id: "color-token-compliance"
    severity: high
    description: "All colors must reference approved tokens"
    check: "color.value IN tokens.colors.*"
    auto_fix: "snap_nearest_delta_e"
  - id: "spacing-scale-compliance"
    severity: medium
    description: "Spacing values must use approved scale"
    check: "spacing.value IN tokens.spacing.scale"
    auto_fix: "snap_nearest"
  - id: "motion-performance"
    severity: low
    description: "Transitions must not exceed max duration"
    check: "motion.duration <= tokens.motion.max_duration"
    auto_fix: "clamp"
  - id: "typography-family-compliance"
    severity: high
    description: "Fonts must use approved type families"
    check: "typography.family IN tokens.typography.families.*"
    auto_fix: "snap_nearest_category"`

// ─── Config (JS object — source of truth) ────────────────────
const BASE_CONFIG: MuteformConfig = {
  name: 'Acme Core v8',
  version: '8.0.0',
  tokens: {
    colors: {
      brand: { primary: '#00e087', secondary: '#0a1628' },
      semantic: { success: '#00e087', warning: '#ffb830', error: '#ff4070', info: '#4090ff' },
      neutral: { white: '#ffffff', 'gray-100': '#f0f1f3', 'gray-400': '#9ca3af', 'gray-900': '#111827', black: '#000000' },
    },
    spacing: { scale: [4, 8, 12, 16, 24, 32, 48, 64], tolerance: 0 },
    typography: {
      families: { display: 'Instrument Serif', body: 'DM Sans', mono: 'JetBrains Mono' },
      scale_ratio: 1.25,
      min_body_size: 14,
    },
    motion: { max_duration: 300, easing_allowed: ['ease-out', 'ease-in-out'] },
    layout: { grid_columns: [1, 2, 3, 4, 6, 12] },
  },
  rules: [
    { id: 'contrast-wcag-aa', severity: 'critical', description: 'Interactive elements must meet WCAG AA', check: 'contrast.ratio >= 4.5', auto_fix: 'adjust_foreground' },
    { id: 'color-token-compliance', severity: 'high', description: 'All colors must reference approved tokens', check: 'color.value IN tokens.colors.*', auto_fix: 'snap_nearest_delta_e' },
    { id: 'spacing-scale-compliance', severity: 'medium', description: 'Spacing values must use approved scale', check: 'spacing.value IN tokens.spacing.scale', auto_fix: 'snap_nearest' },
    { id: 'motion-performance', severity: 'low', description: 'Transitions must not exceed max duration', check: 'motion.duration <= tokens.motion.max_duration', auto_fix: 'clamp' },
    { id: 'typography-family-compliance', severity: 'high', description: 'Fonts must use approved type families', check: 'typography.family IN tokens.typography.families.*', auto_fix: 'snap_nearest_category' },
  ],
}

// ─── Sample Interfaces ───────────────────────────────────────
const SAMPLE_INTERFACES: Record<string, { label: string; def: InterfaceDefinition }> = {
  checkout: {
    label: 'Checkout Flow',
    def: {
      nodes: [
        {
          id: 'checkout-header', type: 'container', path: 'Checkout > Header',
          properties: { colors: { 'background-color': '#0a1628' }, spacing: { padding: 16 } },
        },
        {
          id: 'checkout-helper', type: 'text', path: 'Checkout > PaymentForm > HelperText',
          properties: {
            colors: { color: '#6b7280', 'background-color': '#f0f1f3' },
            contrast: { foreground: '#6b7280', background: '#f0f1f3' },
            typography: { family: 'DM Sans', size: 13, weight: 400 },
          },
        },
        {
          id: 'checkout-cta', type: 'interactive', path: 'Checkout > PaymentForm > PrimaryCTA',
          properties: {
            colors: { color: '#ffffff', 'background-color': '#3478F6' },
            spacing: { padding: 16, margin: 22 },
            motion: { duration: 450, easing: 'ease-out' },
          },
        },
        {
          id: 'checkout-footer', type: 'container', path: 'Checkout > Footer',
          properties: { colors: { 'background-color': '#0a1628' }, spacing: { padding: 24 } },
        },
      ],
      metadata: { source: 'playground', platform: 'web', generatedAt: new Date().toISOString() },
    },
  },
  dashboard: {
    label: 'SaaS Dashboard',
    def: {
      nodes: [
        {
          id: 'dash-sidebar', type: 'container', path: 'Dashboard > Sidebar',
          properties: {
            colors: { 'background-color': '#1e2230', color: '#c8ccd4' },
            spacing: { padding: 20, gap: 14 },
          },
        },
        {
          id: 'dash-chart-card', type: 'container', path: 'Dashboard > Main > ChartCard',
          properties: {
            colors: { 'background-color': '#15171f', 'border-color': '#2d3140' },
            spacing: { padding: 18, gap: 10 },
          },
        },
        {
          id: 'dash-metric', type: 'text', path: 'Dashboard > Main > MetricLabel',
          properties: {
            colors: { color: '#8b92a0' },
            spacing: { margin: 6 },
          },
        },
        {
          id: 'dash-action-btn', type: 'interactive', path: 'Dashboard > Header > ActionBtn',
          properties: {
            colors: { color: '#ffffff', 'background-color': '#2563EB' },
            spacing: { padding: 12, margin: 16 },
          },
        },
      ],
      metadata: { source: 'playground', platform: 'web', generatedAt: new Date().toISOString() },
    },
  },
  onboarding: {
    label: 'Mobile Onboarding',
    def: {
      nodes: [
        {
          id: 'onboard-hero', type: 'container', path: 'Onboarding > HeroScreen',
          properties: {
            colors: { 'background-color': '#0a1628' },
            spacing: { padding: 32, gap: 24 },
          },
        },
        {
          id: 'onboard-title', type: 'text', path: 'Onboarding > HeroScreen > Title',
          properties: {
            typography: { family: 'Playfair Display', size: 32, weight: 700 },
            colors: { color: '#ffffff' },
          },
        },
        {
          id: 'onboard-subtitle', type: 'text', path: 'Onboarding > HeroScreen > Subtitle',
          properties: {
            colors: { color: '#7a8194', 'background-color': '#e8eaf0' },
            contrast: { foreground: '#7a8194', background: '#e8eaf0' },
            typography: { family: 'DM Sans', size: 16, weight: 400 },
          },
        },
        {
          id: 'onboard-next-btn', type: 'interactive', path: 'Onboarding > NextButton',
          properties: {
            colors: { color: '#ffffff', 'background-color': '#00e087' },
            spacing: { padding: 16, margin: 24 },
          },
        },
      ],
      metadata: { source: 'playground', platform: 'mobile', generatedAt: new Date().toISOString() },
    },
  },
}

// ─── Severity helpers ────────────────────────────────────────
const SEV_COLORS: Record<string, { fg: string; bg: string }> = {
  critical: { fg: T.red, bg: T.redDim },
  high: { fg: T.amber, bg: T.amberDim },
  medium: { fg: T.blue, bg: T.blueDim },
  low: { fg: T.muted, bg: '#6b728018' },
}

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEV_COLORS[severity] || SEV_COLORS.low
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: c.bg, color: c.fg, fontSize: 11, fontFamily: mono,
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {severity}
    </span>
  )
}

// ─── Health Score Ring ────────────────────────────────────────
function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const stroke = 8
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const [animatedScore, setAnimatedScore] = useState(0)
  const [offset, setOffset] = useState(circ)

  useEffect(() => {
    const target = circ - (circ * score) / 100
    const timer = setTimeout(() => {
      setOffset(target)
      setAnimatedScore(score)
    }, 50)
    return () => clearTimeout(timer)
  }, [score, circ])

  const color = score >= 80 ? T.green : score >= 50 ? T.amber : T.red

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={T.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: mono, fontSize: 36, fontWeight: 700, color: color, lineHeight: 1 }}>
          {animatedScore}
        </span>
        <span style={{ fontFamily: sans, fontSize: 11, color: T.muted, marginTop: 4 }}>
          HEALTH
        </span>
      </div>
    </div>
  )
}

// ─── Main Page Component ─────────────────────────────────────
export default function PlaygroundPage() {
  // State
  const [yamlText, setYamlText] = useState(RULESET_YAML)
  const [disabledRules, setDisabledRules] = useState<Record<string, boolean>>({})
  const [activePreset, setActivePreset] = useState<string>('checkout')
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [fixedIds, setFixedIds] = useState<Record<string, boolean>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)

  // Build effective config by filtering out disabled rules
  const getEffectiveConfig = useCallback((): MuteformConfig => {
    const filtered = BASE_CONFIG.rules.filter(function (r) {
      return !disabledRules[r.id]
    })
    return {
      name: BASE_CONFIG.name,
      version: BASE_CONFIG.version,
      tokens: BASE_CONFIG.tokens,
      rules: filtered,
    }
  }, [disabledRules])

  // Run scan
  const runScan = useCallback(function () {
    setScanning(true)
    setScanDone(false)
    setFixedIds({})
    setExpandedId(null)

    // Small delay for visual effect
    setTimeout(function () {
      var config = getEffectiveConfig()
      var iface = SAMPLE_INTERFACES[activePreset].def
      var res = validate(iface, config)
      var scoreData = calculateScore(res)
      setResult(res)
      setViolations(res.violations)
      setScore(scoreData.overall)
      setScanning(false)
      setScanDone(true)
    }, 600)
  }, [getEffectiveConfig, activePreset])

  // Auto-fix a single violation
  const fixOne = useCallback(function (violation: Violation) {
    var config = getEffectiveConfig()
    var res = remediate([violation], config)
    if (res.totalFixed > 0) {
      var newFixed: Record<string, boolean> = {}
      var keys = Object.keys(fixedIds)
      for (var i = 0; i < keys.length; i++) {
        newFixed[keys[i]] = fixedIds[keys[i]]
      }
      newFixed[violation.nodeId + ':' + violation.ruleId] = true
      setFixedIds(newFixed)

      // Recalculate score based on remaining unfixed violations
      var remaining = violations.filter(function (v) {
        return !newFixed[v.nodeId + ':' + v.ruleId]
      })
      if (remaining.length === 0) {
        setScore(100)
      } else {
        var fakeResult: ValidationResult = {
          passed: remaining.length === 0,
          violations: remaining,
          nodesScanned: result ? result.nodesScanned : 0,
          rulesEvaluated: result ? result.rulesEvaluated : 0,
          scanDurationMs: 0,
        }
        var s = calculateScore(fakeResult)
        setScore(s.overall)
      }
    }
  }, [getEffectiveConfig, fixedIds, violations, result])

  // Fix all
  const fixAll = useCallback(function () {
    var newFixed: Record<string, boolean> = {}
    for (var i = 0; i < violations.length; i++) {
      var v = violations[i]
      if (v.autoFixAvailable) {
        newFixed[v.nodeId + ':' + v.ruleId] = true
      }
    }
    setFixedIds(newFixed)
    setScore(100)
  }, [violations])

  // Toggle rule
  const toggleRule = useCallback(function (ruleId: string) {
    var next: Record<string, boolean> = {}
    var keys = Object.keys(disabledRules)
    for (var i = 0; i < keys.length; i++) {
      next[keys[i]] = disabledRules[keys[i]]
    }
    if (next[ruleId]) {
      delete next[ruleId]
    } else {
      next[ruleId] = true
    }
    setDisabledRules(next)
  }, [disabledRules])

  // Presets
  var presetKeys = Object.keys(SAMPLE_INTERFACES)

  // Count unfixed violations
  var unfixedCount = violations.filter(function (v) {
    return !fixedIds[v.nodeId + ':' + v.ruleId]
  }).length

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.text, fontFamily: sans,
    }}>
      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid ' + T.border,
        background: T.surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Logo */}
          <span style={{ fontFamily: serif, fontSize: 22, color: T.textBright, fontStyle: 'italic', letterSpacing: '-0.02em' }}>
            muteform
          </span>
          <span style={{
            fontFamily: mono, fontSize: 10, padding: '3px 8px', borderRadius: 4,
            background: T.greenDim, color: T.green, fontWeight: 600,
            letterSpacing: '0.1em',
          }}>
            PLAYGROUND
          </span>
        </div>
        <a href="/demo" style={{
          fontFamily: mono, fontSize: 12, color: T.muted, textDecoration: 'none',
          padding: '6px 12px', borderRadius: 6, border: '1px solid ' + T.border,
          transition: 'all 0.2s',
        }}
          onMouseEnter={function (e) { (e.target as HTMLElement).style.borderColor = T.green; (e.target as HTMLElement).style.color = T.green }}
          onMouseLeave={function (e) { (e.target as HTMLElement).style.borderColor = T.border; (e.target as HTMLElement).style.color = T.muted }}
        >
          &larr; Back to Demo
        </a>
      </header>

      {/* ─── Two-Column Layout ───────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        minHeight: 'calc(100vh - 53px)',
      }}>
        {/* ══════════ LEFT COLUMN ══════════ */}
        <div style={{
          borderRight: '1px solid ' + T.border,
          padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 53px)',
        }}>
          {/* Ruleset Editor */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <h2 style={{
                fontFamily: mono, fontSize: 13, color: T.muted, margin: 0,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Ruleset Editor
              </h2>
              <span style={{
                fontFamily: mono, fontSize: 11, color: T.dim,
              }}>
                YAML (visual)
              </span>
            </div>
            <textarea
              value={yamlText}
              onChange={function (e) { setYamlText(e.target.value) }}
              spellCheck={false}
              style={{
                width: '100%', height: 360, padding: 16, borderRadius: 8,
                background: T.surface, border: '1px solid ' + T.border,
                color: T.text, fontFamily: mono, fontSize: 12.5, lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={function (e) { e.target.style.borderColor = T.border2 }}
              onBlur={function (e) { e.target.style.borderColor = T.border }}
            />
          </div>

          {/* Rules List */}
          <div>
            <h2 style={{
              fontFamily: mono, fontSize: 13, color: T.muted, margin: '0 0 12px 0',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Rules ({BASE_CONFIG.rules.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BASE_CONFIG.rules.map(function (rule) {
                var disabled = !!disabledRules[rule.id]
                return (
                  <div key={rule.id} style={{
                    padding: '12px 16px', borderRadius: 8,
                    background: disabled ? T.bg : T.surface,
                    border: '1px solid ' + (disabled ? T.dim : T.border),
                    opacity: disabled ? 0.5 : 1,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                    onClick={function () { toggleRule(rule.id) }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Toggle indicator */}
                        <div style={{
                          width: 32, height: 18, borderRadius: 9,
                          background: disabled ? T.dim : T.green,
                          position: 'relative', transition: 'background 0.2s',
                          flexShrink: 0,
                        }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: T.textBright,
                            position: 'absolute', top: 2,
                            left: disabled ? 2 : 16,
                            transition: 'left 0.2s',
                          }} />
                        </div>
                        <code style={{ fontFamily: mono, fontSize: 12, color: T.textBright }}>
                          {rule.id}
                        </code>
                      </div>
                      <SeverityBadge severity={rule.severity} />
                    </div>
                    <p style={{ margin: '0 0 4px 40px', fontSize: 12.5, color: T.muted, lineHeight: 1.4 }}>
                      {rule.description}
                    </p>
                    <div style={{ marginLeft: 40, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: mono, fontSize: 10, color: rule.auto_fix ? T.green : T.dim,
                      }}>
                        {rule.auto_fix ? 'AUTO-FIX: ' + rule.auto_fix : 'NO AUTO-FIX'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ══════════ RIGHT COLUMN ══════════ */}
        <div style={{
          padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 53px)',
        }}>
          {/* Interface Preset Selector */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{
              fontFamily: mono, fontSize: 13, color: T.muted, margin: '0 0 12px 0',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Interface Under Test
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {presetKeys.map(function (key) {
                var active = key === activePreset
                return (
                  <button key={key} onClick={function () {
                    setActivePreset(key)
                    setScanDone(false)
                    setResult(null)
                    setViolations([])
                    setScore(null)
                    setFixedIds({})
                  }}
                    style={{
                      fontFamily: mono, fontSize: 12, padding: '8px 16px',
                      borderRadius: 6, border: '1px solid ' + (active ? T.green : T.border),
                      background: active ? T.greenDim : T.surface,
                      color: active ? T.green : T.muted,
                      cursor: 'pointer', transition: 'all 0.2s',
                      outline: 'none',
                    }}
                  >
                    {SAMPLE_INTERFACES[key].label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interface preview summary */}
          <div style={{
            padding: 12, borderRadius: 8, background: T.surface, border: '1px solid ' + T.border,
            marginBottom: 20, fontFamily: mono, fontSize: 11, color: T.dim,
          }}>
            <span style={{ color: T.muted }}>nodes:</span>{' '}
            {SAMPLE_INTERFACES[activePreset].def.nodes.length}{' | '}
            <span style={{ color: T.muted }}>platform:</span>{' '}
            {SAMPLE_INTERFACES[activePreset].def.metadata.platform}{' | '}
            <span style={{ color: T.muted }}>source:</span>{' '}
            {SAMPLE_INTERFACES[activePreset].def.metadata.source}
          </div>

          {/* RUN SCAN button */}
          <button onClick={runScan} disabled={scanning}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 8,
              background: scanning ? T.surface2 : T.green,
              color: scanning ? T.muted : T.bg,
              fontFamily: mono, fontSize: 14, fontWeight: 700,
              border: 'none', cursor: scanning ? 'wait' : 'pointer',
              letterSpacing: '0.08em', transition: 'all 0.2s',
              marginBottom: 24,
            }}
          >
            {scanning ? 'SCANNING...' : 'RUN SCAN'}
          </button>

          {/* ─── Results ─────────────────────────────────────── */}
          {scanDone && result && (
            <div>
              {/* Stats bar */}
              <div style={{
                display: 'flex', gap: 16, marginBottom: 20, fontFamily: mono, fontSize: 11,
              }}>
                <span style={{ color: T.muted }}>
                  Nodes: <span style={{ color: T.textBright }}>{result.nodesScanned}</span>
                </span>
                <span style={{ color: T.muted }}>
                  Rules: <span style={{ color: T.textBright }}>{result.rulesEvaluated}</span>
                </span>
                <span style={{ color: T.muted }}>
                  Violations: <span style={{ color: violations.length > 0 ? T.red : T.green }}>{violations.length}</span>
                </span>
                <span style={{ color: T.muted }}>
                  Time: <span style={{ color: T.textBright }}>{result.scanDurationMs}ms</span>
                </span>
              </div>

              {/* Score + Fix All row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24,
                padding: 20, borderRadius: 12, background: T.surface, border: '1px solid ' + T.border,
              }}>
                <ScoreRing score={score !== null ? score : 0} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: sans, fontSize: 14, color: T.muted, marginBottom: 8 }}>
                    {unfixedCount === 0
                      ? 'All violations resolved!'
                      : unfixedCount + ' violation' + (unfixedCount === 1 ? '' : 's') + ' remaining'}
                  </div>
                  {unfixedCount > 0 && (
                    <button onClick={fixAll} style={{
                      padding: '10px 24px', borderRadius: 6,
                      background: T.green, color: T.bg,
                      fontFamily: mono, fontSize: 12, fontWeight: 700,
                      border: 'none', cursor: 'pointer',
                      letterSpacing: '0.06em',
                    }}>
                      FIX ALL ({unfixedCount})
                    </button>
                  )}
                  {unfixedCount === 0 && (
                    <div style={{
                      fontFamily: mono, fontSize: 12, color: T.green,
                      padding: '8px 16px', borderRadius: 6,
                      background: T.greenDim, display: 'inline-block',
                    }}>
                      SHIP IT
                    </div>
                  )}
                </div>
              </div>

              {/* Violations list */}
              <h3 style={{
                fontFamily: mono, fontSize: 13, color: T.muted, margin: '0 0 12px 0',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Violations
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {violations.map(function (v, idx) {
                  var vKey = v.nodeId + ':' + v.ruleId
                  var isFixed = !!fixedIds[vKey]
                  var isExpanded = expandedId === vKey

                  return (
                    <div key={vKey + '-' + String(idx)} style={{
                      borderRadius: 8, background: T.surface,
                      border: '1px solid ' + (isFixed ? T.greenDim : T.border),
                      opacity: isFixed ? 0.55 : 1,
                      transition: 'all 0.3s',
                      overflow: 'hidden',
                    }}>
                      {/* Violation header */}
                      <div
                        style={{
                          padding: '12px 16px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                        onClick={function () {
                          setExpandedId(isExpanded ? null : vKey)
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <SeverityBadge severity={v.severity} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontFamily: mono, fontSize: 12, color: isFixed ? T.green : T.textBright,
                              textDecoration: isFixed ? 'line-through' : 'none',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {v.ruleId}
                            </div>
                            <div style={{ fontFamily: mono, fontSize: 11, color: T.dim, marginTop: 2 }}>
                              {v.nodePath}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {/* Current → Suggested */}
                          <div style={{ fontFamily: mono, fontSize: 11, textAlign: 'right' }}>
                            <span style={{ color: T.red }}>{v.currentValue}</span>
                            <span style={{ color: T.dim }}>{' \u2192 '}</span>
                            <span style={{ color: T.green }}>{v.suggestedValue || '?'}</span>
                          </div>
                          {/* Expand arrow */}
                          <span style={{
                            color: T.dim, fontSize: 14,
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s', display: 'inline-block',
                          }}>
                            &#9654;
                          </span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{
                          padding: '0 16px 14px 16px',
                          borderTop: '1px solid ' + T.border,
                          paddingTop: 12,
                        }}>
                          <p style={{
                            margin: '0 0 8px 0', fontFamily: sans, fontSize: 12.5,
                            color: T.muted, lineHeight: 1.5,
                          }}>
                            {v.message}
                          </p>
                          <div style={{
                            fontFamily: mono, fontSize: 11, color: T.dim,
                            marginBottom: 10, lineHeight: 1.6,
                          }}>
                            <div>Property: <span style={{ color: T.text }}>{v.property}</span></div>
                            <div>Node: <span style={{ color: T.text }}>{v.nodeId}</span></div>
                            <div>Detail: <span style={{ color: T.text }}>{v.detail}</span></div>
                          </div>
                          {v.autoFixAvailable && !isFixed && (
                            <button onClick={function (e) {
                              e.stopPropagation()
                              fixOne(v)
                            }}
                              style={{
                                padding: '6px 16px', borderRadius: 4,
                                background: T.greenDim, color: T.green,
                                fontFamily: mono, fontSize: 11, fontWeight: 600,
                                border: '1px solid ' + T.greenGlow,
                                cursor: 'pointer', letterSpacing: '0.04em',
                              }}
                            >
                              AUTO-FIX
                            </button>
                          )}
                          {isFixed && (
                            <span style={{
                              fontFamily: mono, fontSize: 11, color: T.green,
                            }}>
                              Fixed
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {violations.length === 0 && (
                <div style={{
                  padding: 32, borderRadius: 8, background: T.surface,
                  border: '1px solid ' + T.border, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: mono, fontSize: 14, color: T.green, marginBottom: 4 }}>
                    No violations found
                  </div>
                  <div style={{ fontFamily: sans, fontSize: 12, color: T.muted }}>
                    All nodes pass the active ruleset.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state before scan */}
          {!scanDone && !scanning && (
            <div style={{
              padding: 48, borderRadius: 8, border: '1px dashed ' + T.border,
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: mono, fontSize: 14, color: T.dim, marginBottom: 8 }}>
                Select an interface and run scan
              </div>
              <div style={{ fontFamily: sans, fontSize: 12, color: T.dim }}>
                Toggle rules on the left, choose a preset above, then hit RUN SCAN.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
