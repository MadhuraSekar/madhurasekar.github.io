'use client'

import { useState } from 'react'
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

interface Rule {
  id: string
  name: string
  description: string
  severity: Severity
  autofix: boolean
  enabled: boolean
  checks: string
}

var DEFAULT_RULES: Rule[] = [
  {
    id: 'color-token-only',
    name: 'color/token-only',
    description: 'All color values must reference design tokens',
    severity: 'critical',
    autofix: true,
    enabled: true,
    checks: 'Flags any hardcoded hex, rgb, or hsl color values that do not map to a defined token. Suggests the nearest matching token.',
  },
  {
    id: 'spacing-scale',
    name: 'spacing/scale-only',
    description: 'Spacing values must use the defined scale',
    severity: 'high',
    autofix: true,
    enabled: true,
    checks: 'Ensures all margin, padding, and gap values match your spacing scale. Rejects arbitrary pixel values.',
  },
  {
    id: 'font-family-approved',
    name: 'typography/font-family',
    description: 'Only approved font families are allowed',
    severity: 'high',
    autofix: false,
    enabled: true,
    checks: 'Validates that all font-family declarations use one of the approved typefaces defined in your token set.',
  },
  {
    id: 'contrast-ratio',
    name: 'a11y/contrast-ratio',
    description: 'Text must meet WCAG 2.1 AA contrast requirements',
    severity: 'critical',
    autofix: false,
    enabled: true,
    checks: 'Calculates contrast ratio between text color and background color. Requires 4.5:1 for normal text, 3:1 for large text.',
  },
  {
    id: 'border-radius-token',
    name: 'shape/radius-token',
    description: 'Border radius values must use tokens',
    severity: 'medium',
    autofix: true,
    enabled: true,
    checks: 'Flags arbitrary border-radius values. Suggests the closest matching radius token from your design system.',
  },
  {
    id: 'shadow-approved',
    name: 'elevation/shadow-approved',
    description: 'Box shadows must match approved elevation tokens',
    severity: 'medium',
    autofix: true,
    enabled: true,
    checks: 'Ensures box-shadow values come from approved elevation levels. Prevents custom shadow definitions.',
  },
  {
    id: 'font-size-scale',
    name: 'typography/size-scale',
    description: 'Font sizes must follow the type scale',
    severity: 'high',
    autofix: true,
    enabled: true,
    checks: 'Validates that font-size declarations match your defined typographic scale. Rejects arbitrary sizes.',
  },
  {
    id: 'opacity-token',
    name: 'color/opacity-token',
    description: 'Opacity values should use defined tokens',
    severity: 'low',
    autofix: true,
    enabled: false,
    checks: 'Flags hardcoded opacity values and suggests using named opacity tokens instead.',
  },
]

var YAML_TEMPLATE = "# .muteform.yml \u2014 Acme Core v8\n# Auto-generated from your design tokens\n\nversion: 2\nname: acme-core-v8\n\ntokens:\n  source: ./tokens.json\n  format: style-dictionary\n\nrules:\n  color/token-only:\n    severity: critical\n    autofix: true\n    description: All colors must reference tokens\n\n  spacing/scale-only:\n    severity: high\n    autofix: true\n    description: Spacing must use the scale\n\n  typography/font-family:\n    severity: high\n    autofix: false\n    description: Only approved fonts allowed\n\n  a11y/contrast-ratio:\n    severity: critical\n    autofix: false\n    description: WCAG 2.1 AA contrast required\n\n  shape/radius-token:\n    severity: medium\n    autofix: true\n    description: Border radius must use tokens\n\n  elevation/shadow-approved:\n    severity: medium\n    autofix: true\n    description: Shadows must match elevation tokens\n\n  typography/size-scale:\n    severity: high\n    autofix: true\n    description: Font sizes must follow type scale\n\n  color/opacity-token:\n    severity: low\n    autofix: true\n    enabled: false\n    description: Opacity values should use tokens\n\nscan:\n  include:\n    - \"src/**/*.tsx\"\n    - \"src/**/*.css\"\n  exclude:\n    - \"node_modules/**\"\n    - \"dist/**\"\n\noutput:\n  format: json\n  file: .muteform-report.json"

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

export default function RulesPage() {
  var router = useRouter()
  var [rules, setRules] = useState<Rule[]>(DEFAULT_RULES)

  var activeCount = rules.filter(function(r) { return r.enabled }).length

  function toggleRule(id: string) {
    setRules(rules.map(function(r) {
      if (r.id === id) {
        return Object.assign({}, r, { enabled: !r.enabled })
      }
      return r
    }))
  }

  function toggleAutofix(id: string) {
    setRules(rules.map(function(r) {
      if (r.id === id) {
        return Object.assign({}, r, { autofix: !r.autofix })
      }
      return r
    }))
  }

  function changeSeverity(id: string, sev: Severity) {
    setRules(rules.map(function(r) {
      if (r.id === id) {
        return Object.assign({}, r, { severity: sev })
      }
      return r
    }))
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.text, fontFamily: sans,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px',
    }}>
      <ProgressBar step={2} />

      <div style={{
        fontFamily: serif, fontSize: 36, color: T.textBright, marginBottom: 8,
        fontStyle: 'italic', letterSpacing: '-0.01em',
      }}>
        Review Your Ruleset
      </div>
      <p style={{ fontFamily: mono, fontSize: 13, color: T.muted, marginBottom: 40, letterSpacing: '0.02em' }}>
        Customize rules before running your first scan
      </p>

      {/* Two-column layout */}
      <div style={{
        display: 'flex', gap: 24, width: '100%', maxWidth: 1100,
        flexWrap: 'wrap' as const,
      }}>
        {/* LEFT: YAML view */}
        <div style={{
          flex: '1 1 380px', minWidth: 340, maxWidth: 440,
        }}>
          <div style={{
            background: T.surface, borderRadius: 12, border: '1px solid ' + T.border,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', background: T.surface2, borderBottom: '1px solid ' + T.border,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.red + '80' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.amber + '80' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.green + '80' }} />
              </div>
              <span style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginLeft: 8 }}>
                .muteform.yml
              </span>
            </div>
            <pre style={{
              padding: 20, margin: 0, fontFamily: mono, fontSize: 12, lineHeight: 1.7,
              color: T.text, overflowX: 'auto', maxHeight: 600,
              background: T.bg,
            }}>
              {YAML_TEMPLATE.split('\n').map(function(line, i) {
                var isComment = line.trim().indexOf('#') === 0
                var isKey = !isComment && line.indexOf(':') !== -1
                var keyPart = isKey ? line.substring(0, line.indexOf(':')) : ''
                var valPart = isKey ? line.substring(line.indexOf(':')) : ''

                return (
                  <div key={i} style={{ display: 'flex' }}>
                    <span style={{
                      display: 'inline-block', width: 32, textAlign: 'right' as const,
                      color: T.dim, marginRight: 16, userSelect: 'none' as const, flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    {isComment ? (
                      <span style={{ color: T.muted }}>{line}</span>
                    ) : isKey ? (
                      <span>
                        <span style={{ color: T.blue }}>{keyPart}</span>
                        <span style={{ color: T.muted }}>{valPart}</span>
                      </span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                )
              })}
            </pre>
          </div>
        </div>

        {/* RIGHT: Rule cards */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rules.map(function(rule) {
            return (
              <div key={rule.id} style={{
                background: T.surface, borderRadius: 10, border: '1px solid ' + (rule.enabled ? T.border2 : T.border),
                padding: '16px 20px',
                opacity: rule.enabled ? 1 : 0.5,
                transition: 'all 0.2s ease',
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Enable toggle */}
                    <button
                      onClick={function() { toggleRule(rule.id) }}
                      style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: rule.enabled ? T.green : T.dim,
                        position: 'relative' as const, transition: 'background 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        position: 'absolute' as const, top: 2,
                        left: rule.enabled ? 18 : 2,
                        transition: 'left 0.2s ease',
                      }} />
                    </button>
                    <span style={{ fontFamily: mono, fontSize: 13, color: T.textBright, fontWeight: 600 }}>
                      {rule.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Severity dropdown */}
                    <select
                      value={rule.severity}
                      onChange={function(e) { changeSeverity(rule.id, e.target.value as Severity) }}
                      style={{
                        padding: '3px 8px', borderRadius: 4,
                        background: sevBg(rule.severity), border: '1px solid ' + sevColor(rule.severity) + '40',
                        color: sevColor(rule.severity),
                        fontFamily: mono, fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                        cursor: 'pointer', outline: 'none',
                        appearance: 'none' as const, WebkitAppearance: 'none' as any,
                      }}
                    >
                      <option value="critical">critical</option>
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontFamily: sans, fontSize: 13, color: T.text, margin: '0 0 8px 46px', lineHeight: 1.4 }}>
                  {rule.description}
                </p>

                {/* Checks + Autofix */}
                <div style={{ marginLeft: 46, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, margin: 0, lineHeight: 1.5 }}>
                    {rule.checks}
                  </p>
                  {rule.enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <button
                        onClick={function() { toggleAutofix(rule.id) }}
                        style={{
                          padding: '2px 8px', borderRadius: 4, border: '1px solid ' + (rule.autofix ? T.green + '40' : T.border),
                          background: rule.autofix ? T.greenDim : 'transparent',
                          color: rule.autofix ? T.green : T.muted,
                          fontFamily: mono, fontSize: 10, cursor: 'pointer',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {rule.autofix ? '\u2713 auto-fix' : 'auto-fix off'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'fixed' as const, bottom: 0, left: 0, right: 0,
        background: T.surface, borderTop: '1px solid ' + T.border,
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', gap: 24, fontFamily: mono, fontSize: 12 }}>
          <span style={{ color: T.text }}>
            <strong style={{ color: T.green }}>{activeCount}</strong> rules active
          </span>
          <span style={{ color: T.dim }}>{'\u00B7'}</span>
          <span style={{ color: T.text }}>
            <strong style={{ color: T.textBright }}>24</strong> color tokens
          </span>
          <span style={{ color: T.dim }}>{'\u00B7'}</span>
          <span style={{ color: T.text }}>
            <strong style={{ color: T.textBright }}>8</strong> spacing values
          </span>
          <span style={{ color: T.dim }}>{'\u00B7'}</span>
          <span style={{ color: T.text }}>
            <strong style={{ color: T.textBright }}>3</strong> font families
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={function() { router.push('/onboarding/connect') }}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid ' + T.border2,
              background: 'transparent', color: T.muted, fontFamily: mono, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {'\u2190'} Back
          </button>
          <button
            onClick={function() { router.push('/onboarding/scan') }}
            style={{
              padding: '10px 28px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: T.green, color: T.bg,
              fontFamily: mono, fontSize: 13, fontWeight: 700,
              boxShadow: '0 0 24px ' + T.green + '30',
            }}
          >
            Run Your First Scan {'\u2192'}
          </button>
        </div>
      </div>

      {/* Bottom spacer for fixed bar */}
      <div style={{ height: 80 }} />
    </div>
  )
}
