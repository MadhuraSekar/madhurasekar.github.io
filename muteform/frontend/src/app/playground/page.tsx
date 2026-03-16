'use client'

import { useState, useEffect, useCallback } from 'react'
import { validate, calculateScore, remediate } from '@/lib/engine'
import type { MuteformConfig, InterfaceDefinition, Violation, ValidationResult } from '@/lib/engine'
import {
  ORIGINAL_ARTIFACT,
  GOVERNED_ARTIFACT,
  DESIGN_PRINCIPLES,
  type DesignPrinciple,
} from '@/lib/engine/hardcoded-scan'

// ─── Design Tokens ───────────────────────────────────────────
const C = {
  bg: '#080909', surface: '#0c0d0f', surface2: '#101214',
  border: '#161819', border2: '#1e2226',
  blue: '#0055FF', blueDim: '#0a1428',
  green: '#22c55e', greenDim: '#061a0c', greenBorder: '#0d3018',
  red: '#ef4444', redDim: '#1a0505',
  amber: '#f59e0b', amberDim: '#1a1000',
  text: '#f0f1f3', muted: '#6b7280', dim: '#374151', dim2: '#252b33',
  textBright: '#f8f9fb',
}
const syne = "'Syne', sans-serif"
const mono = "'DM Mono', monospace"

// ─── Hardcoded YAML (visual only) ───────────────────────────
const RULESET_YAML = `name: "Acme Design System"
version: "1.0.0"

tokens:
  colors:
    primary: "#0055FF"
    neutral900: "#111111"
    success: "#22c55e"
    warning: "#f59e0b"
  spacing:
    scale: [4, 8, 12, 16, 24, 32, 48, 64]
  typography:
    allowedStyles: [h1, h2, h3, body, body-sm, caption, label]
  components:
    button:
      allowedVariants: [primary, secondary]
      allowedSizes: [sm, md, lg]
  layout:
    allowedGridColumns: [4, 8, 12]

rules:
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
  - id: "layout-grid-compliance"
    severity: medium
    description: "Grid columns must use approved column counts"
    check: "layout.columns IN tokens.layout.*"
    auto_fix: false
  - id: "typography-style-compliance"
    severity: high
    description: "Typography styles must use approved styles"
    check: "typography.style IN tokens.typography.allowedStyles"
    auto_fix: "snap_nearest"
  - id: "component-variant-compliance"
    severity: critical
    description: "Component variants must be approved"
    check: "component.variant IN tokens.components.*.allowedVariants"
    auto_fix: "snap_nearest"`

// ─── Config (JS object — source of truth) ────────────────────
const BASE_CONFIG: MuteformConfig = {
  name: 'Acme Design System',
  version: '1.0.0',
  tokens: {
    colors: {
      primary: '#0055FF',
      neutral900: '#111111',
      success: '#22c55e',
      warning: '#f59e0b',
    },
    spacing: { scale: [4, 8, 12, 16, 24, 32, 48, 64] },
    layout: { grid_columns: [4, 8, 12] },
  },
  rules: [
    { id: 'color-token-compliance', severity: 'high', description: 'All colors must reference approved design tokens', check: 'color.value IN tokens.colors.*', auto_fix: 'snap_nearest_delta_e' },
    { id: 'spacing-scale-compliance', severity: 'medium', description: 'Spacing values must use the approved scale', check: 'spacing.value IN tokens.spacing.scale', auto_fix: 'snap_nearest' },
    { id: 'layout-grid-compliance', severity: 'medium', description: 'Grid columns must use approved column counts', check: 'layout.columns IN tokens.layout.grid_columns', auto_fix: false },
  ],
}

// ─── Sample Interfaces ───────────────────────────────────────
const SAMPLE_INTERFACES: Record<string, { label: string; def: InterfaceDefinition }> = {
  checkout: {
    label: 'Checkout Flow',
    def: {
      nodes: [
        {
          id: 'node_1', type: 'interactive', path: 'Checkout Flow / Payment Form / Primary CTA',
          properties: {
            colors: { color: '#3478F6' },
            spacing: { margin: 22 },
            layout: { columns: 10 },
          },
        },
      ],
      metadata: { source: 'generic-json', platform: 'web', generatedAt: new Date().toISOString() },
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
          id: 'onboard-next-btn', type: 'interactive', path: 'Onboarding > NextButton',
          properties: {
            colors: { color: '#ffffff', 'background-color': '#22c55e' },
            spacing: { padding: 16, margin: 24 },
          },
        },
      ],
      metadata: { source: 'playground', platform: 'mobile', generatedAt: new Date().toISOString() },
    },
  },
}

// ─── Manual violations for typography + component (engine can't catch) ──
function getManualViolations(): Violation[] {
  return [
    {
      ruleId: 'typography-style-compliance',
      severity: 'high',
      nodeId: 'node_1',
      nodePath: 'Checkout Flow / Payment Form / Primary CTA',
      property: 'typographyStyle',
      currentValue: 'display-xl',
      suggestedValue: 'body',
      message: 'Typography style "display-xl" is not in allowed styles',
      autoFixAvailable: true,
      detail: 'The typographyStyle "display-xl" does not exist in the design system. Allowed: [h1, h2, h3, body, body-sm, caption, label].',
    },
    {
      ruleId: 'component-variant-compliance',
      severity: 'critical',
      nodeId: 'node_1',
      nodePath: 'Checkout Flow / Payment Form / Primary CTA',
      property: 'component.variant',
      currentValue: 'ghost',
      suggestedValue: 'primary',
      message: 'Button variant "ghost" is not allowed',
      autoFixAvailable: true,
      detail: 'The button uses variant "ghost" which is not approved. Allowed: [primary, secondary].',
    },
  ]
}

// ─── Principle Icons ──────────────────────────────────────────
const PRINCIPLE_ICONS: Record<string, string> = {
  hierarchy: '\u25B2',
  contrast: '\u25D0',
  brain: '\u2609',
  grid: '\u2588',
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

  const color = score >= 80 ? C.green : score >= 50 ? C.amber : C.red

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={C.border2} strokeWidth={stroke} />
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
        <span style={{ fontFamily: mono, fontSize: 10, color: C.muted, marginTop: 4, letterSpacing: '0.1em' }}>
          HEALTH
        </span>
      </div>
    </div>
  )
}

// ─── Visual Violation Card ───────────────────────────────────
function ViolationCard({ v, isFixed, onFix }: { v: Violation; isFixed: boolean; onFix: () => void }) {
  const prop = (v.property || v.ruleId || '').toLowerCase()
  const isColor = prop.includes('color')
  const isSpacing = prop.includes('spacing') || prop.includes('margin') || prop.includes('padding')
  const isTypo = prop.includes('typography') || prop.includes('typographystyle')
  const isComponent = prop.includes('component') || prop.includes('variant')
  const isLayout = prop.includes('layout') || prop.includes('grid') || prop.includes('column')

  const sevColors: Record<string, string> = { critical: C.red, high: C.red, medium: C.amber, low: C.muted }
  const sevCol = sevColors[v.severity] || C.muted

  return (
    <div style={{
      background: C.surface, border: `1px solid ${isFixed ? C.greenBorder : C.border}`,
      borderRadius: 10, padding: 20, transition: 'all 0.3s',
      opacity: isFixed ? 0.6 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px',
            borderRadius: 3, color: sevCol, background: `${sevCol}18`, border: `1px solid ${sevCol}33`,
            textTransform: 'uppercase',
          }}>
            {v.severity}
          </span>
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px',
            borderRadius: 3, color: C.green, background: C.greenDim, border: `1px solid ${C.greenBorder}`,
          }}>
            {v.autoFixAvailable ? 'HIGH' : 'MANUAL REVIEW'}
          </span>
        </div>
        {isFixed && (
          <span style={{
            fontFamily: mono, fontSize: 10, color: C.green, fontWeight: 600,
          }}>
            &#10003; FIXED
          </span>
        )}
      </div>

      {/* Node path */}
      <div style={{
        fontFamily: mono, fontSize: 10, color: C.dim, marginBottom: 12,
        padding: '4px 8px', background: C.bg, borderRadius: 4, border: `1px solid ${C.border}`,
      }}>
        {v.nodePath}
      </div>

      {/* Visual comparison */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12,
        alignItems: 'center', marginBottom: 12,
      }}>
        {/* Left: wrong value */}
        <div style={{
          padding: 12, borderRadius: 8,
          background: `${C.red}08`, border: `1px solid ${C.red}22`,
        }}>
          {isColor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 6, backgroundColor: String(v.currentValue),
                border: `2px solid ${C.red}`, boxShadow: `0 0 8px ${C.red}22`,
              }} />
              <div>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.red, fontWeight: 600 }}>{String(v.currentValue)}</div>
              </div>
            </div>
          )}
          {isSpacing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                width: Math.min(Number(v.currentValue) * 3, 140), height: 16, borderRadius: 3,
                backgroundColor: C.red, opacity: 0.8,
              }} />
              <span style={{
                fontFamily: mono, fontSize: 11, color: C.red, fontWeight: 600,
                textDecoration: 'line-through',
              }}>
                {String(v.currentValue)}px
              </span>
            </div>
          )}
          {isTypo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: syne, fontSize: 28, color: C.red, fontWeight: 700, lineHeight: 1.1 }}>Aa</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.red, fontWeight: 600 }}>{String(v.currentValue)}</span>
            </div>
          )}
          {isComponent && (
            <div style={{
              display: 'inline-flex', padding: '6px 14px', borderRadius: 20,
              border: `2px solid ${C.red}`, background: 'transparent',
            }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: C.red, fontWeight: 600 }}>{String(v.currentValue)}</span>
            </div>
          )}
          {isLayout && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: Math.min(Number(v.currentValue), 12) }).map((_, i) => (
                  <div key={i} style={{ width: 8, height: 24, borderRadius: 2, backgroundColor: C.red, opacity: 0.6 }} />
                ))}
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.red, fontWeight: 600 }}>
                {String(v.currentValue)} cols
              </span>
            </div>
          )}
        </div>

        {/* Arrow */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: C.surface2, border: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.muted, fontSize: 16, fontWeight: 700,
        }}>
          {'\u2192'}
        </div>

        {/* Right: correct value */}
        <div style={{
          padding: 12, borderRadius: 8,
          background: `${C.green}08`, border: `1px solid ${C.green}22`,
        }}>
          {isColor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 6, backgroundColor: String(v.suggestedValue),
                border: `2px solid ${C.green}`, boxShadow: `0 0 8px ${C.green}22`,
              }} />
              <div>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.green, fontWeight: 600 }}>{String(v.suggestedValue)}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: C.muted }}>token: primary</div>
              </div>
            </div>
          )}
          {isSpacing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                width: Math.min(Number(v.suggestedValue) * 3, 140), height: 16, borderRadius: 3,
                backgroundColor: C.green, opacity: 0.8,
              }} />
              <span style={{ fontFamily: mono, fontSize: 11, color: C.green, fontWeight: 600 }}>
                {String(v.suggestedValue)}px (token)
              </span>
            </div>
          )}
          {isTypo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: syne, fontSize: 20, color: C.green, fontWeight: 700, lineHeight: 1.1 }}>Aa</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.green, fontWeight: 600 }}>{String(v.suggestedValue)}</span>
            </div>
          )}
          {isComponent && (
            <div style={{
              display: 'inline-flex', padding: '6px 14px', borderRadius: 20,
              border: `2px solid ${C.green}`, background: `${C.green}18`,
              boxShadow: `0 0 8px ${C.green}22`,
            }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: C.green, fontWeight: 600 }}>{String(v.suggestedValue)}</span>
            </div>
          )}
          {isLayout && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: Math.min(Number(v.suggestedValue), 12) }).map((_, i) => (
                  <div key={i} style={{ width: 8, height: 24, borderRadius: 2, backgroundColor: C.green, opacity: 0.6 }} />
                ))}
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.green, fontWeight: 600 }}>
                {String(v.suggestedValue)} cols
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      <p style={{ fontFamily: mono, fontSize: 11, color: C.muted, lineHeight: 1.5, margin: 0 }}>
        {v.message}
      </p>

      {/* Fix button */}
      {v.autoFixAvailable && !isFixed && (
        <button onClick={onFix} style={{
          marginTop: 12, padding: '6px 16px', borderRadius: 4,
          background: C.greenDim, color: C.green,
          fontFamily: mono, fontSize: 10, fontWeight: 600,
          border: `1px solid ${C.greenBorder}`,
          cursor: 'pointer', letterSpacing: '0.06em',
        }}>
          AUTO-FIX
        </button>
      )}
    </div>
  )
}

// ─── Before/After Fix Card ───────────────────────────────────
function BeforeAfterCard({ v }: { v: Violation }) {
  const prop = (v.property || '').toLowerCase()
  const isColor = prop.includes('color')

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.greenBorder}`,
      borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <span style={{ color: C.green, fontSize: 18 }}>&#10003;</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, marginBottom: 4 }}>
          {v.nodePath}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Before */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isColor && (
              <div style={{ width: 18, height: 18, borderRadius: 3, backgroundColor: String(v.currentValue), border: `1px solid ${C.red}` }} />
            )}
            <span style={{ fontFamily: mono, fontSize: 11, color: C.red, textDecoration: 'line-through' }}>
              {String(v.currentValue)}
            </span>
          </div>
          <span style={{ color: C.dim, fontSize: 12 }}>{'\u2192'}</span>
          {/* After */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isColor && (
              <div style={{ width: 18, height: 18, borderRadius: 3, backgroundColor: String(v.suggestedValue), border: `1px solid ${C.green}` }} />
            )}
            <span style={{ fontFamily: mono, fontSize: 11, color: C.green, fontWeight: 600 }}>
              {String(v.suggestedValue)}
            </span>
          </div>
        </div>
      </div>
      <span style={{
        fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px',
        borderRadius: 3, color: C.green, background: C.greenDim, border: `1px solid ${C.greenBorder}`,
      }}>
        {v.autoFixAvailable ? 'HIGH' : 'MANUAL REVIEW'}
      </span>
    </div>
  )
}

// ─── Design Principle Card ───────────────────────────────────
function PrincipleCard({ p }: { p: DesignPrinciple }) {
  const sevColors: Record<string, string> = { high: C.red, medium: C.amber, low: C.green }
  const sevCol = sevColors[p.severity] || C.muted
  const icon = PRINCIPLE_ICONS[p.icon] || '\u2731'

  return (
    <div style={{
      background: p.passed ? `${C.green}06` : `${C.blue}06`,
      border: `1px solid ${p.passed ? C.greenBorder : `${C.blue}22`}`,
      borderRadius: 10, padding: 20,
      borderLeft: `3px solid ${p.passed ? C.green : sevCol}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 8,
          background: p.passed ? C.greenDim : `${C.blue}12`,
          border: `1px solid ${p.passed ? C.greenBorder : `${C.blue}33`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: p.passed ? C.green : C.blue,
        }}>
          {icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: syne, fontSize: 14, fontWeight: 700, color: C.text }}>
            {p.title}
          </div>
        </div>
        <span style={{
          fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 4,
          color: p.passed ? C.green : C.red,
          background: p.passed ? C.greenDim : C.redDim,
          border: `1px solid ${p.passed ? C.greenBorder : `${C.red}33`}`,
        }}>
          {p.passed ? 'PASS' : 'FAIL'}
        </span>
        {!p.passed && (
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '2px 8px',
            borderRadius: 3, color: sevCol, background: `${sevCol}18`, border: `1px solid ${sevCol}33`,
            textTransform: 'uppercase',
          }}>
            {p.severity}
          </span>
        )}
      </div>

      {/* Rule */}
      <div style={{
        fontFamily: mono, fontSize: 12, color: C.text, lineHeight: 1.5,
        padding: '8px 12px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}`,
        marginBottom: 10,
      }}>
        {p.rule}
      </div>

      {/* Reason — WHY it matters */}
      <p style={{ fontFamily: mono, fontSize: 11, color: C.muted, lineHeight: 1.6, margin: '0 0 8px 0' }}>
        {p.reason}
      </p>

      {/* Contrast meter bar (for contrast principle) */}
      {p.contrastRatio && p.contrastRequired && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>Contrast Ratio</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: C.red }}>
              {p.contrastRatio}:1 / {p.contrastRequired}:1 required
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 4, background: C.border, overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Required threshold marker */}
            <div style={{
              position: 'absolute', left: `${(parseFloat(p.contrastRequired) / 7) * 100}%`,
              top: 0, bottom: 0, width: 2, background: C.amber, zIndex: 2,
            }} />
            {/* Current ratio fill */}
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${Math.min((parseFloat(p.contrastRatio) / 7) * 100, 100)}%`,
              background: parseFloat(p.contrastRatio) >= parseFloat(p.contrastRequired) ? C.green : C.red,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Fix suggestion */}
      {!p.passed && p.fix && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 4,
          background: `${C.green}08`, border: `1px solid ${C.greenBorder}`,
        }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: C.green, fontWeight: 600 }}>FIX:</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: C.green }}>{p.fix}</span>
        </div>
      )}
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
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [governed, setGoverned] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Build effective config
  const getEffectiveConfig = useCallback((): MuteformConfig => {
    var filtered = BASE_CONFIG.rules.filter(function (r) {
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
    setGoverned(false)
    setCopied(false)

    setTimeout(function () {
      var config = getEffectiveConfig()
      var iface = SAMPLE_INTERFACES[activePreset].def
      var res = validate(iface, config)

      // Add manual violations for checkout preset
      var allViolations = res.violations.slice()
      if (activePreset === 'checkout') {
        var manual = getManualViolations()
        for (var i = 0; i < manual.length; i++) {
          allViolations.push(manual[i])
        }
      }

      var combinedResult: ValidationResult = {
        passed: allViolations.length === 0,
        violations: allViolations,
        nodesScanned: res.nodesScanned,
        rulesEvaluated: res.rulesEvaluated + (activePreset === 'checkout' ? 2 : 0),
        scanDurationMs: res.scanDurationMs,
      }

      var scoreData = calculateScore(combinedResult)
      setResult(combinedResult)
      setViolations(allViolations)
      setScore(scoreData.overall)
      setScanning(false)
      setScanDone(true)
    }, 500)
  }, [getEffectiveConfig, activePreset])

  // Fix one violation
  function fixOne(violation: Violation) {
    var key = violation.nodeId + ':' + violation.ruleId
    var newFixed: Record<string, boolean> = {}
    var keys = Object.keys(fixedIds)
    for (var i = 0; i < keys.length; i++) {
      newFixed[keys[i]] = fixedIds[keys[i]]
    }
    newFixed[key] = true
    setFixedIds(newFixed)

    var remaining = violations.filter(function (v) {
      return !newFixed[v.nodeId + ':' + v.ruleId]
    })
    if (remaining.length === 0) {
      setScore(100)
    } else {
      var fakeResult: ValidationResult = {
        passed: false, violations: remaining,
        nodesScanned: result ? result.nodesScanned : 0,
        rulesEvaluated: result ? result.rulesEvaluated : 0,
        scanDurationMs: 0,
      }
      var s = calculateScore(fakeResult)
      setScore(s.overall)
    }
  }

  // APPLY GOVERNANCE — fix all at once
  function applyGovernance() {
    var newFixed: Record<string, boolean> = {}
    for (var i = 0; i < violations.length; i++) {
      newFixed[violations[i].nodeId + ':' + violations[i].ruleId] = true
    }
    setFixedIds(newFixed)
    setScore(100)
    setGoverned(true)
  }

  // Copy governed output
  function copyGoverned() {
    var output = JSON.stringify(GOVERNED_ARTIFACT, null, 2)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(output).catch(function () {})
    }
    setCopied(true)
    setTimeout(function () { setCopied(false) }, 2000)
  }

  // Toggle rule
  function toggleRule(ruleId: string) {
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
  }

  var presetKeys = Object.keys(SAMPLE_INTERFACES)
  var unfixedCount = violations.filter(function (v) {
    return !fixedIds[v.nodeId + ':' + v.ruleId]
  }).length

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* ─── Top Bar ─── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, color: C.textBright, fontStyle: 'italic', letterSpacing: '-0.02em', textDecoration: 'none' }}>
            muteform
          </a>
          <span style={{
            fontFamily: mono, fontSize: 10, padding: '3px 8px', borderRadius: 4,
            background: C.greenDim, color: C.green, fontWeight: 600,
            letterSpacing: '0.1em',
          }}>
            PLAYGROUND
          </span>
        </div>
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {[
            { label: 'Demo', href: '/demo' },
            { label: 'Governance', href: '/governance' },
            { label: 'Dashboard', href: '/dashboard' },
          ].map(function (l) {
            return (
              <a key={l.label} href={l.href} style={{
                fontFamily: mono, fontSize: 11, color: C.muted, textDecoration: 'none',
                padding: '4px 8px', borderRadius: 4, transition: 'color 0.2s',
              }}>
                {l.label}
              </a>
            )
          })}
        </nav>
      </header>

      {/* ─── Two-Column Layout ─── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        minHeight: 'calc(100vh - 53px)',
      }}>
        {/* ══════════ LEFT COLUMN ══════════ */}
        <div style={{
          borderRight: `1px solid ${C.border}`,
          padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 53px)',
        }}>
          {/* Ruleset Editor */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{
                fontFamily: syne, fontSize: 13, fontWeight: 700, color: C.muted, margin: 0,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Ruleset Editor
              </h2>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>YAML (visual)</span>
            </div>
            <textarea
              value={yamlText}
              onChange={function (e) { setYamlText(e.target.value) }}
              spellCheck={false}
              style={{
                width: '100%', height: 360, padding: 16, borderRadius: 8,
                background: C.surface, border: `1px solid ${C.border}`,
                color: C.text, fontFamily: mono, fontSize: 12, lineHeight: 1.6,
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Rules List */}
          <div>
            <h2 style={{
              fontFamily: syne, fontSize: 13, fontWeight: 700, color: C.muted, margin: '0 0 12px 0',
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
                    background: disabled ? C.bg : C.surface,
                    border: `1px solid ${disabled ? C.dim : C.border}`,
                    opacity: disabled ? 0.5 : 1, transition: 'all 0.2s', cursor: 'pointer',
                  }}
                    onClick={function () { toggleRule(rule.id) }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 32, height: 18, borderRadius: 9,
                          background: disabled ? C.dim : C.green,
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', background: C.textBright,
                            position: 'absolute', top: 2, left: disabled ? 2 : 16, transition: 'left 0.2s',
                          }} />
                        </div>
                        <code style={{ fontFamily: mono, fontSize: 12, color: C.textBright }}>{rule.id}</code>
                      </div>
                      <span style={{
                        fontFamily: mono, fontSize: 10, padding: '2px 8px', borderRadius: 4,
                        background: `${C.red}18`, color: C.red, letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}>
                        {rule.severity}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 4px 40px', fontSize: 12, fontFamily: mono, color: C.muted, lineHeight: 1.4 }}>
                      {rule.description}
                    </p>
                    <div style={{ marginLeft: 40, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: rule.auto_fix ? C.green : C.dim }}>
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
        <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 53px)' }}>
          {/* Interface Preset Selector */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{
              fontFamily: syne, fontSize: 13, fontWeight: 700, color: C.muted, margin: '0 0 12px 0',
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
                    setGoverned(false)
                    setCopied(false)
                  }}
                    style={{
                      fontFamily: mono, fontSize: 12, padding: '8px 16px',
                      borderRadius: 6, border: `1px solid ${active ? C.green : C.border}`,
                      background: active ? C.greenDim : C.surface,
                      color: active ? C.green : C.muted,
                      cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
                    }}
                  >
                    {SAMPLE_INTERFACES[key].label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interface summary */}
          <div style={{
            padding: 12, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`,
            marginBottom: 20, fontFamily: mono, fontSize: 11, color: C.dim,
          }}>
            <span style={{ color: C.muted }}>nodes:</span>{' '}
            {SAMPLE_INTERFACES[activePreset].def.nodes.length}{' | '}
            <span style={{ color: C.muted }}>platform:</span>{' '}
            {SAMPLE_INTERFACES[activePreset].def.metadata.platform}{' | '}
            <span style={{ color: C.muted }}>source:</span>{' '}
            {SAMPLE_INTERFACES[activePreset].def.metadata.source}
          </div>

          {/* RUN SCAN button */}
          <button onClick={runScan} disabled={scanning}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 8,
              background: scanning ? C.surface2 : C.blue,
              color: '#fff',
              fontFamily: mono, fontSize: 14, fontWeight: 700,
              border: 'none', cursor: scanning ? 'wait' : 'pointer',
              letterSpacing: '0.08em', transition: 'all 0.2s',
              marginBottom: 24,
              boxShadow: scanning ? 'none' : `0 4px 20px ${C.blue}33`,
            }}
          >
            {scanning ? 'SCANNING...' : 'RUN SCAN'}
          </button>

          {/* ─── Results ─── */}
          {scanDone && result && (
            <div>
              {/* ═══ GOVERNANCE SUCCESS BANNER ═══ */}
              {governed && (
                <div style={{
                  padding: '20px 24px', borderRadius: 10, marginBottom: 24,
                  background: `linear-gradient(135deg, ${C.green}18, ${C.green}08)`,
                  border: `1px solid ${C.greenBorder}`,
                  boxShadow: `0 4px 24px ${C.green}15`,
                }}>
                  <div style={{
                    fontFamily: syne, fontSize: 18, fontWeight: 700, color: C.green,
                    marginBottom: 4,
                  }}>
                    {violations.length} violations auto-corrected.
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: C.green, opacity: 0.8 }}>
                    Interface is now design system compliant.
                  </div>
                </div>
              )}

              {/* Stats bar */}
              <div style={{
                display: 'flex', gap: 16, marginBottom: 20, fontFamily: mono, fontSize: 11,
              }}>
                <span style={{ color: C.muted }}>
                  Nodes: <span style={{ color: C.textBright }}>{result.nodesScanned}</span>
                </span>
                <span style={{ color: C.muted }}>
                  Rules: <span style={{ color: C.textBright }}>{result.rulesEvaluated}</span>
                </span>
                <span style={{ color: C.muted }}>
                  Violations: <span style={{ color: violations.length > 0 ? C.red : C.green }}>{violations.length}</span>
                </span>
                <span style={{ color: C.muted }}>
                  Time: <span style={{ color: C.textBright }}>{result.scanDurationMs}ms</span>
                </span>
              </div>

              {/* Score + APPLY GOVERNANCE row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24,
                padding: 20, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`,
              }}>
                <ScoreRing score={score !== null ? score : 0} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: mono, fontSize: 13, color: C.muted, marginBottom: 10 }}>
                    {governed
                      ? 'All violations resolved!'
                      : unfixedCount + ' violation' + (unfixedCount === 1 ? '' : 's') + ' remaining'}
                  </div>
                  {!governed && unfixedCount > 0 && (
                    <button onClick={applyGovernance} style={{
                      padding: '12px 28px', borderRadius: 8,
                      background: `linear-gradient(135deg, ${C.green}, #1aad4a)`,
                      color: '#fff',
                      fontFamily: syne, fontSize: 15, fontWeight: 700,
                      border: 'none', cursor: 'pointer',
                      letterSpacing: '0.04em',
                      boxShadow: `0 4px 24px ${C.green}33`,
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}>
                      APPLY GOVERNANCE
                    </button>
                  )}
                  {governed && (
                    <div style={{
                      fontFamily: mono, fontSize: 12, color: C.green,
                      padding: '8px 16px', borderRadius: 6,
                      background: C.greenDim, display: 'inline-block',
                      border: `1px solid ${C.greenBorder}`,
                    }}>
                      COMPLIANT
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ BEFORE / AFTER CARDS (post-governance) ═══ */}
              {governed && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{
                    fontFamily: syne, fontSize: 13, fontWeight: 700, color: C.muted, margin: '0 0 12px 0',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Applied Fixes
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {violations.map(function (v, idx) {
                      return <BeforeAfterCard key={idx} v={v} />
                    })}
                  </div>
                </div>
              )}

              {/* ═══ COPY GOVERNED OUTPUT ═══ */}
              {governed && (
                <div style={{
                  marginBottom: 24, padding: 20, borderRadius: 10,
                  background: C.surface, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{
                      fontFamily: syne, fontSize: 13, fontWeight: 700, color: C.muted, margin: 0,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      Governed Output
                    </h3>
                    <button onClick={copyGoverned} style={{
                      padding: '8px 20px', borderRadius: 6,
                      background: copied ? C.greenDim : C.blue,
                      color: copied ? C.green : '#fff',
                      fontFamily: mono, fontSize: 11, fontWeight: 600,
                      border: copied ? `1px solid ${C.greenBorder}` : 'none',
                      cursor: 'pointer', letterSpacing: '0.06em',
                      transition: 'all 0.2s',
                    }}>
                      {copied ? 'COPIED ✓' : 'COPY GOVERNED OUTPUT'}
                    </button>
                  </div>
                  <pre style={{
                    fontFamily: mono, fontSize: 11, color: C.green, lineHeight: 1.6,
                    padding: 16, borderRadius: 8, background: C.bg,
                    border: `1px solid ${C.greenBorder}`, overflow: 'auto',
                    maxHeight: 240, margin: 0,
                  }}>
                    {JSON.stringify(GOVERNED_ARTIFACT, null, 2)}
                  </pre>
                  <div style={{
                    fontFamily: mono, fontSize: 12, color: C.muted,
                    marginTop: 14, textAlign: 'center', letterSpacing: '0.02em',
                  }}>
                    This is what Muteform returns to Claude Code.
                  </div>
                </div>
              )}

              {/* ═══ VIOLATION CARDS (pre-governance) ═══ */}
              {!governed && violations.length > 0 && (
                <>
                  <h3 style={{
                    fontFamily: syne, fontSize: 13, fontWeight: 700, color: C.muted, margin: '0 0 12px 0',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Token Violations
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {violations.map(function (v, idx) {
                      var vKey = v.nodeId + ':' + v.ruleId
                      return (
                        <ViolationCard
                          key={vKey + '-' + String(idx)}
                          v={v}
                          isFixed={!!fixedIds[vKey]}
                          onFix={function () { fixOne(v) }}
                        />
                      )
                    })}
                  </div>
                </>
              )}

              {violations.length === 0 && !governed && (
                <div style={{
                  padding: 32, borderRadius: 8, background: C.surface,
                  border: `1px solid ${C.border}`, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: mono, fontSize: 14, color: C.green, marginBottom: 4 }}>
                    No violations found
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>
                    All nodes pass the active ruleset.
                  </div>
                </div>
              )}

              {/* ═══ PART 4: DESIGN PRINCIPLES ANALYSIS ═══ */}
              {activePreset === 'checkout' && (
                <div style={{ marginTop: 32 }}>
                  <h3 style={{
                    fontFamily: syne, fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 4px 0',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Design Principles Analysis
                  </h3>
                  <p style={{
                    fontFamily: mono, fontSize: 11, color: C.muted, margin: '0 0 16px 0',
                  }}>
                    Beyond token compliance — evaluating design intent and accessibility.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {DESIGN_PRINCIPLES.map(function (p) {
                      return <PrincipleCard key={p.id} p={p} />
                    })}
                  </div>
                </div>
              )}

              {/* ═══ LINK TO GOVERNANCE ═══ */}
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <a href="/governance" style={{
                  fontFamily: mono, fontSize: 12, color: C.blue,
                  textDecoration: 'none', padding: '8px 16px', borderRadius: 6,
                  border: `1px solid ${C.blue}33`, transition: 'all 0.2s',
                  display: 'inline-block',
                }}>
                  Customize your governance rules &rarr;
                </a>
              </div>
            </div>
          )}

          {/* Empty state before scan */}
          {!scanDone && !scanning && (
            <div style={{
              padding: 48, borderRadius: 8, border: `1px dashed ${C.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: mono, fontSize: 14, color: C.dim, marginBottom: 8 }}>
                Select an interface and run scan
              </div>
              <div style={{ fontFamily: mono, fontSize: 12, color: C.dim }}>
                Toggle rules on the left, choose a preset above, then hit RUN SCAN.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
