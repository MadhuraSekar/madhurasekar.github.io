'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Stepper from '@/components/Stepper'
import {
  loadDesignSystem, type ImportedDesignSystem,
  loadGovernanceRules, saveGovernanceRules,
  type GovernanceRule, DEFAULT_GOVERNANCE_RULES,
} from '@/lib/design-system-store'
import { loadConfig, scanArtifact } from '@/lib/engine'
import { getFixture } from '@/lib/fixtures'
import { loadSession, markStepComplete, syncCustomRule } from '@/lib/session'

// ─── Design Tokens ──────────────────────────────────────────
const T = {
  bg: '#080909', surface: '#0c0d0f', surface2: '#101214',
  border: '#161819', border2: '#1e2226',
  blue: '#0055FF', text: '#f0f1f3', muted: '#6b7280', dim: '#374151',
  green: '#22c55e', greenDim: '#22c55e18',
  amber: '#f59e0b', amberDim: '#f59e0b18',
  red: '#ef4444', redDim: '#ef444418',
  blueDim: '#0055FF18',
}
const syne = "'Syne', sans-serif"
const mono = "'DM Mono', monospace"

// ─── Severity helpers ───────────────────────────────────────
const SEV_COLORS: Record<string, { color: string; dim: string }> = {
  critical: { color: T.red, dim: T.redDim },
  high: { color: T.red, dim: T.redDim },
  medium: { color: T.amber, dim: T.amberDim },
  low: { color: T.muted, dim: `${T.muted}18` },
}
const SEVERITIES: Array<GovernanceRule['severity']> = ['critical', 'high', 'medium', 'low']

// ─── Rule category mapping ──────────────────────────────────
type CategoryId = 'color' | 'spacing' | 'typography' | 'components' | 'layout' | 'accessibility'

interface CategoryMeta {
  id: CategoryId
  label: string
  icon: string
  ruleId: string
  description: string
  hasAutoFix: boolean
  severityLocked?: GovernanceRule['severity']
}

const CATEGORIES: CategoryMeta[] = [
  { id: 'color', label: 'Color Token Compliance', icon: '\u25CF', ruleId: 'color-token-compliance', description: 'All colors must reference approved design tokens', hasAutoFix: true },
  { id: 'spacing', label: 'Spacing Scale Compliance', icon: '\u2194', ruleId: 'spacing-scale-compliance', description: 'Spacing values must use the approved scale', hasAutoFix: true },
  { id: 'typography', label: 'Typography Style Compliance', icon: 'Aa', ruleId: 'typography-style-compliance', description: 'Typography styles must be from approved list', hasAutoFix: false },
  { id: 'components', label: 'Component Variant Compliance', icon: '\u25A1', ruleId: 'component-variant-compliance', description: 'Component variants must be from approved list', hasAutoFix: false, severityLocked: 'critical' },
  { id: 'layout', label: 'Layout Grid Compliance', icon: '\u2591', ruleId: 'layout-grid-compliance', description: 'Grid columns must use approved column counts', hasAutoFix: false },
  { id: 'accessibility', label: 'Accessibility (WCAG AA)', icon: '\u2713', ruleId: 'contrast-wcag-aa', description: 'All text must meet WCAG AA contrast requirements (4.5:1)', hasAutoFix: false, severityLocked: 'critical' },
]

// ─── Sentence builder options ───────────────────────────────
const SB_COMPONENTS = ['any component', 'button', 'input', 'card', 'text', 'layout'] as const
const SB_PROPERTIES = ['color', 'spacing', 'font-size', 'variant', 'contrast', 'grid-columns'] as const
const SB_CONDITIONS = ['not a token', 'not in scale', 'not in system', 'below AA contrast', 'not approved'] as const
const SB_ACTIONS = ['auto-fix to nearest', 'warn designer', 'block deployment', 'flag for review'] as const

// ─── Component ──────────────────────────────────────────────
export default function RulesPage() {
  const router = useRouter()
  const [ds, setDs] = useState<ImportedDesignSystem | null>(null)
  const [rules, setRules] = useState<GovernanceRule[]>(DEFAULT_GOVERNANCE_RULES)
  const [violationCount, setViolationCount] = useState<number | null>(null)
  const [companyName, setCompanyName] = useState<string>('your')
  const [perRuleViolations, setPerRuleViolations] = useState<Record<string, number>>({})
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  // Sentence builder state
  const [sbComponent, setSbComponent] = useState<string>('')
  const [sbProperty, setSbProperty] = useState<string>('')
  const [sbCondition, setSbCondition] = useState<string>('')
  const [sbAction, setSbAction] = useState<string>('')

  // Advanced custom rule form
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState<CategoryId>('color')
  const [customSeverity, setCustomSeverity] = useState<GovernanceRule['severity']>('medium')
  const [customAutoFix, setCustomAutoFix] = useState(false)
  const [customDescription, setCustomDescription] = useState('')
  const [customRules, setCustomRules] = useState<(GovernanceRule & { category: CategoryId })[]>([])

  // ─── Load persisted state ───────────────────────────────
  useEffect(() => {
    const loaded = loadDesignSystem()
    if (loaded) setDs(loaded)
    const savedRules = loadGovernanceRules()
    setRules(savedRules)
    const session = loadSession()
    if (session.user?.company) setCompanyName(session.user.company)
  }, [])

  // ─── Background scan ────────────────────────────────────
  const runBackgroundScan = useCallback(() => {
    try {
      const fixture = getFixture('onboarding')
      if (fixture) {
        const DEMO_YAML = `name: "Custom Rules"\nversion: "1.0.0"\ntokens:\n  colors:\n    primary: "#0055FF"\n  spacing:\n    scale: [4, 8, 12, 16, 24, 32, 48, 64]\nrules: []`
        const config = loadConfig(DEMO_YAML)
        const result = scanArtifact(fixture.artifact, config)
        const violations = (result as any)?.violations ?? []
        const total = violations.length ?? (result as any)?.totalViolations ?? 0
        setViolationCount(total)

        // Build per-rule violation map
        const perRule: Record<string, number> = {}
        for (const v of violations) {
          const rId = v.ruleId ?? v.rule ?? 'unknown'
          perRule[rId] = (perRule[rId] || 0) + 1
        }
        // Distribute total across categories if no per-rule data
        if (Object.keys(perRule).length === 0 && total > 0) {
          const perCat = Math.max(1, Math.floor(total / CATEGORIES.length))
          for (const cat of CATEGORIES) {
            perRule[cat.ruleId] = perCat
          }
        }
        setPerRuleViolations(perRule)
      }
    } catch {
      setViolationCount(null)
    }
  }, [])

  useEffect(() => {
    runBackgroundScan()
  }, [rules, runBackgroundScan])

  // ─── Rule helpers ───────────────────────────────────────
  const findRule = (ruleId: string) => rules.find(r => r.id === ruleId)

  const updateRule = (ruleId: string, patch: Partial<GovernanceRule>) => {
    setRules(prev => {
      const next = prev.map(r => r.id === ruleId ? { ...r, ...patch } : r)
      saveGovernanceRules(next)
      return next
    })
  }

  const toggleEnabled = (ruleId: string) => {
    const rule = findRule(ruleId)
    if (rule) updateRule(ruleId, { blocked: !rule.blocked })
  }

  const isEnabled = (ruleId: string) => {
    const rule = findRule(ruleId)
    return rule ? !rule.blocked : true
  }

  // ─── Design system summary ─────────────────────────────
  const colorCount = ds ? Object.keys(ds.tokens.color).length : 0
  const spacingCount = ds ? ds.tokens.spacing.length : 0
  const typographyCount = ds ? ds.typography.allowedStyles.length : 0
  const componentCount = ds ? Object.keys(ds.components).length : 0

  // ─── Sentence builder helpers ──────────────────────────
  const sbComplete = sbComponent && sbProperty && sbCondition && sbAction

  const sbToRule = (): { name: string; description: string; severity: GovernanceRule['severity']; autoFix: boolean } => {
    const name = `${sbComponent}: ${sbProperty} ${sbCondition}`
    const description = `When a ${sbComponent} uses ${sbProperty} that is ${sbCondition} then ${sbAction}`
    const autoFix = sbAction === 'auto-fix to nearest'
    const severity: GovernanceRule['severity'] = sbAction === 'block deployment' ? 'critical' : sbAction === 'warn designer' ? 'high' : 'medium'
    return { name, description, severity, autoFix }
  }

  const handleAddSentenceRule = () => {
    if (!sbComplete) return
    const { name, description, severity, autoFix } = sbToRule()
    const newRule: GovernanceRule & { category: CategoryId } = {
      id: `custom-${Date.now()}`,
      name,
      description,
      severity,
      autoFix,
      autoFixStrategy: autoFix ? 'snap_nearest' : '',
      blocked: false,
      category: 'color',
    }
    setCustomRules(prev => [...prev, newRule])
    setRules(prev => {
      const next = [...prev, newRule]
      saveGovernanceRules(next)
      return next
    })
    const session = loadSession()
    syncCustomRule(session.user?.id ?? null, newRule)
    setSbComponent('')
    setSbProperty('')
    setSbCondition('')
    setSbAction('')
  }

  // ─── Add custom rule (advanced form) ───────────────────
  const handleAddCustomRule = () => {
    if (!customName.trim()) return
    const newRule: GovernanceRule & { category: CategoryId } = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      description: customDescription.trim(),
      severity: customSeverity,
      autoFix: customAutoFix,
      autoFixStrategy: customAutoFix ? 'manual' : '',
      blocked: false,
      category: customCategory,
    }
    setCustomRules(prev => [...prev, newRule])
    setRules(prev => {
      const next = [...prev, newRule]
      saveGovernanceRules(next)
      return next
    })
    const session = loadSession()
    syncCustomRule(session.user?.id ?? null, newRule)
    setCustomName('')
    setCustomDescription('')
    setCustomSeverity('medium')
    setCustomAutoFix(false)
    setCustomCategory('color')
  }

  // ─── Toggle switch component ──────────────────────────
  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <div
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
        background: on ? T.green : T.dim,
        position: 'relative', transition: 'background 200ms ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2,
        left: on ? 20 : 2, transition: 'left 200ms ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  )

  // ─── Sentence dropdown component ──────────────────────
  const SentenceDropdown = ({ value, onChange, options, placeholder }: {
    value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string
  }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: mono, fontSize: 14, fontWeight: 600,
        color: value ? T.blue : T.muted,
        background: value ? T.blueDim : T.surface2,
        border: `1px solid ${value ? `${T.blue}55` : T.border2}`,
        borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
        outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 28,
        transition: 'all 150ms ease',
      }}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )

  // ─── Render ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <Stepper />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 100px' }}>
        {/* Header */}
        <h1 style={{
          fontFamily: syne, fontSize: 32, fontWeight: 700, color: T.text,
          marginBottom: 6, lineHeight: 1.2, letterSpacing: '-0.02em',
        }}>
          Design the rules for {companyName}
        </h1>
        <p style={{ fontFamily: mono, fontSize: 13, color: T.muted, marginBottom: 36, lineHeight: 1.6 }}>
          Each rule protects a decision your design system already made. Toggle what matters, set how strictly it enforces, and see violations before they ship.
        </p>

        {/* ─── Design System Summary ─────────────────────── */}
        {ds && (
          <div style={{
            padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, marginBottom: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            transition: 'border-color 150ms ease',
          }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <StatBadge label="Colors" count={colorCount} color={T.blue} dim={T.blueDim} />
              <StatBadge label="Spacing" count={spacingCount} color={T.green} dim={T.greenDim} />
              <StatBadge label="Typography" count={typographyCount} color={T.amber} dim={T.amberDim} />
              <StatBadge label="Components" count={componentCount} color={T.red} dim={T.redDim} />
            </div>
            <a href="/import" style={{
              fontFamily: mono, fontSize: 11, color: T.blue, textDecoration: 'none',
              padding: '4px 12px', borderRadius: 6, border: `1px solid ${T.blue}33`,
              background: T.blueDim, transition: 'all 150ms ease',
            }}>
              Edit
            </a>
          </div>
        )}

        {!ds && (
          <div style={{
            padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, marginBottom: 28,
          }}>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>
              No design system imported yet.{' '}
              <a href="/import" style={{ color: T.blue, textDecoration: 'none' }}>Import one</a>
            </span>
          </div>
        )}

        {/* ─── Violation Preview Banner ──────────────────── */}
        {violationCount !== null && (
          <div style={{
            padding: '14px 20px', background: T.amberDim, border: `1px solid ${T.amber}44`,
            borderRadius: 10, marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontFamily: mono, fontSize: 18, color: T.amber }}>!</span>
            <span style={{ fontFamily: mono, fontSize: 13, color: T.amber, fontWeight: 600 }}>
              These rules will catch {violationCount} violation{violationCount !== 1 ? 's' : ''} in a sample scan
            </span>
          </div>
        )}

        {/* ─── Rule Category Cards ───────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
          {CATEGORIES.map(cat => {
            const rule = findRule(cat.ruleId)
            const enabled = isEnabled(cat.ruleId)
            const sev = rule?.severity || 'medium'
            const sevStyle = SEV_COLORS[sev] || SEV_COLORS.medium
            const isHovered = hoveredCard === cat.id
            const ruleViolations = perRuleViolations[cat.ruleId] ?? 0

            return (
              <div
                key={cat.id}
                onMouseEnter={() => setHoveredCard(cat.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: T.surface,
                  border: `1px solid ${isHovered ? T.border2 : T.border}`,
                  borderRadius: 12, padding: '20px 24px',
                  transition: 'all 150ms ease',
                  opacity: enabled ? 1 : 0.5,
                }}
              >
                {/* Card top row: icon, name, toggle */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
                  <span style={{
                    fontFamily: mono, fontSize: 20, color: enabled ? T.text : T.dim,
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: enabled ? T.surface2 : 'transparent',
                    borderRadius: 8, flexShrink: 0,
                    border: `1px solid ${enabled ? T.border2 : 'transparent'}`,
                    transition: 'all 150ms ease',
                  }}>
                    {cat.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text,
                      marginBottom: 4, lineHeight: 1.3,
                    }}>
                      {cat.label}
                    </div>
                    <div style={{
                      fontFamily: mono, fontSize: 12, color: T.muted, lineHeight: 1.5,
                    }}>
                      {cat.description}
                    </div>
                  </div>
                  <Toggle on={enabled} onToggle={() => toggleEnabled(cat.ruleId)} />
                </div>

                {/* Card controls row: severity + autofix */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16, marginLeft: 46,
                  flexWrap: 'wrap',
                }}>
                  {/* Severity selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Severity
                    </span>
                    {cat.severityLocked ? (
                      <span style={{
                        fontFamily: mono, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        color: SEV_COLORS[cat.severityLocked].color,
                        background: SEV_COLORS[cat.severityLocked].dim,
                        padding: '3px 10px', borderRadius: 4,
                        border: `1px solid ${SEV_COLORS[cat.severityLocked].color}33`,
                        letterSpacing: '0.04em',
                      }}>
                        {cat.severityLocked} (locked)
                      </span>
                    ) : (
                      <select
                        value={sev}
                        onChange={e => updateRule(cat.ruleId, { severity: e.target.value as GovernanceRule['severity'] })}
                        style={{
                          fontFamily: mono, fontSize: 11, fontWeight: 600, color: sevStyle.color,
                          background: sevStyle.dim, border: `1px solid ${sevStyle.color}33`,
                          borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                          outline: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
                          transition: 'all 150ms ease',
                        }}
                      >
                        {SEVERITIES.map(s => (
                          <option key={s} value={s} style={{ color: T.text, background: T.surface2 }}>
                            {s.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Auto-fix toggle */}
                  {cat.hasAutoFix && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Auto-fix
                      </span>
                      <Toggle
                        on={rule?.autoFix ?? false}
                        onToggle={() => updateRule(cat.ruleId, { autoFix: !rule?.autoFix })}
                      />
                    </div>
                  )}

                  {rule?.autoFix && (
                    <span style={{
                      fontFamily: mono, fontSize: 9, color: T.green, background: T.greenDim,
                      padding: '2px 8px', borderRadius: 3, border: `1px solid ${T.green}33`,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      AUTO-FIX ON
                    </span>
                  )}
                </div>

                {/* Violation count fade-in */}
                {enabled && ruleViolations > 0 && (
                  <div style={{
                    marginLeft: 46, marginTop: 12,
                    fontFamily: mono, fontSize: 11, color: T.amber,
                    animation: 'fadeIn 400ms ease',
                    opacity: 1,
                  }}>
                    This rule will catch {ruleViolations} violation{ruleViolations !== 1 ? 's' : ''} in the sample scan
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ─── Custom Rule Builder — Sentence Style ─────── */}
        <div style={{
          padding: '28px', background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, marginBottom: 16,
        }}>
          <h3 style={{
            fontFamily: syne, fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6,
          }}>
            Custom rule builder
          </h3>
          <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginBottom: 24 }}>
            Describe what should happen in plain language.
          </p>

          {/* Sentence builder */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
            fontFamily: mono, fontSize: 14, color: T.muted, lineHeight: 2.4,
          }}>
            <span style={{ color: T.dim }}>When a</span>
            <SentenceDropdown value={sbComponent} onChange={setSbComponent} options={SB_COMPONENTS} placeholder="component \u25BE" />
            <span style={{ color: T.dim }}>uses</span>
            <SentenceDropdown value={sbProperty} onChange={setSbProperty} options={SB_PROPERTIES} placeholder="property \u25BE" />
            <span style={{ color: T.dim }}>that is</span>
            <SentenceDropdown value={sbCondition} onChange={setSbCondition} options={SB_CONDITIONS} placeholder="condition \u25BE" />
            <span style={{ color: T.dim }}>then</span>
            <SentenceDropdown value={sbAction} onChange={setSbAction} options={SB_ACTIONS} placeholder="action \u25BE" />
          </div>

          {/* Preview + Add when complete */}
          {sbComplete && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                padding: '14px 18px', background: T.surface2, borderRadius: 8,
                border: `1px solid ${T.border2}`, marginBottom: 14,
              }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Rule preview
                </div>
                <div style={{ fontFamily: mono, fontSize: 13, color: T.text, lineHeight: 1.6 }}>
                  {sbToRule().description}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span style={{
                    fontFamily: mono, fontSize: 9, textTransform: 'uppercase',
                    color: SEV_COLORS[sbToRule().severity].color,
                    background: SEV_COLORS[sbToRule().severity].dim,
                    padding: '2px 8px', borderRadius: 3,
                    border: `1px solid ${SEV_COLORS[sbToRule().severity].color}33`,
                  }}>
                    {sbToRule().severity}
                  </span>
                  {sbToRule().autoFix && (
                    <span style={{
                      fontFamily: mono, fontSize: 9, color: T.green, background: T.greenDim,
                      padding: '2px 8px', borderRadius: 3, border: `1px solid ${T.green}33`,
                      textTransform: 'uppercase',
                    }}>
                      AUTO-FIX
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleAddSentenceRule}
                style={{
                  fontFamily: syne, fontSize: 14, fontWeight: 700, color: '#fff',
                  background: T.blue, border: 'none', borderRadius: 8,
                  padding: '10px 24px', cursor: 'pointer',
                  transition: 'transform 150ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Add rule
              </button>
            </div>
          )}
        </div>

        {/* ─── Advanced form (collapsible) ───────────────── */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, marginBottom: 32, overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%', padding: '14px 24px', background: 'transparent',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 150ms ease',
            }}
          >
            <span style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>
              Advanced: add rule with form
            </span>
            <span style={{
              fontFamily: mono, fontSize: 12, color: T.dim,
              transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 200ms ease',
            }}>
              {'\u25BC'}
            </span>
          </button>

          {showAdvanced && (
            <div style={{ padding: '0 24px 24px', borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
                {/* Rule name */}
                <div>
                  <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, display: 'block', marginBottom: 6 }}>
                    Rule name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="e.g. Brand color only in headers"
                    style={{
                      width: '100%', fontFamily: mono, fontSize: 12, color: T.text,
                      background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6,
                      padding: '10px 14px', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 150ms ease',
                    }}
                    onFocus={e => (e.target.style.borderColor = T.blue)}
                    onBlur={e => (e.target.style.borderColor = T.border2)}
                  />
                </div>

                {/* Category + Severity row */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, display: 'block', marginBottom: 6 }}>
                      Category
                    </label>
                    <select
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value as CategoryId)}
                      style={{
                        width: '100%', fontFamily: mono, fontSize: 12, color: T.text,
                        background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6,
                        padding: '10px 14px', outline: 'none', cursor: 'pointer',
                        transition: 'border-color 150ms ease',
                      }}
                    >
                      <option value="color">Color</option>
                      <option value="spacing">Spacing</option>
                      <option value="typography">Typography</option>
                      <option value="components">Components</option>
                      <option value="layout">Layout</option>
                      <option value="accessibility">Accessibility</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, display: 'block', marginBottom: 6 }}>
                      Severity
                    </label>
                    <select
                      value={customSeverity}
                      onChange={e => setCustomSeverity(e.target.value as GovernanceRule['severity'])}
                      style={{
                        width: '100%', fontFamily: mono, fontSize: 12,
                        color: SEV_COLORS[customSeverity].color,
                        background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6,
                        padding: '10px 14px', outline: 'none', cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {SEVERITIES.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-fix toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>Auto-fix</label>
                  <Toggle on={customAutoFix} onToggle={() => setCustomAutoFix(!customAutoFix)} />
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>
                    {customAutoFix ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, display: 'block', marginBottom: 6 }}>
                    Description
                  </label>
                  <textarea
                    value={customDescription}
                    onChange={e => setCustomDescription(e.target.value)}
                    placeholder="Describe what this rule enforces..."
                    rows={3}
                    style={{
                      width: '100%', fontFamily: mono, fontSize: 12, color: T.text,
                      background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6,
                      padding: '10px 14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                      transition: 'border-color 150ms ease',
                    }}
                    onFocus={e => (e.target.style.borderColor = T.blue)}
                    onBlur={e => (e.target.style.borderColor = T.border2)}
                  />
                </div>

                {/* Add button */}
                <button
                  onClick={handleAddCustomRule}
                  disabled={!customName.trim()}
                  style={{
                    fontFamily: syne, fontSize: 13, fontWeight: 700, color: '#fff',
                    background: customName.trim() ? T.blue : T.dim,
                    border: 'none', borderRadius: 6, padding: '10px 20px',
                    cursor: customName.trim() ? 'pointer' : 'not-allowed',
                    alignSelf: 'flex-start', transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { if (customName.trim()) e.currentTarget.style.transform = 'scale(1.02)' }}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  Add rule
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Custom Rules List ─────────────────────────── */}
        {customRules.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12 }}>
              Your custom rules
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customRules.map(cr => {
                const sevC = SEV_COLORS[cr.severity] || SEV_COLORS.medium
                return (
                  <div key={cr.id} style={{
                    padding: '14px 18px', background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'border-color 150ms ease',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: syne, fontSize: 13, fontWeight: 600, color: T.text }}>{cr.name}</span>
                        <span style={{
                          fontFamily: mono, fontSize: 9, textTransform: 'uppercase',
                          color: sevC.color, background: sevC.dim,
                          padding: '1px 6px', borderRadius: 3, border: `1px solid ${sevC.color}33`,
                        }}>
                          {cr.severity}
                        </span>
                      </div>
                      {cr.description && (
                        <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{cr.description}</span>
                      )}
                    </div>
                    {cr.autoFix && (
                      <span style={{
                        fontFamily: mono, fontSize: 9, color: T.green, background: T.greenDim,
                        padding: '2px 8px', borderRadius: 3, border: `1px solid ${T.green}33`,
                        textTransform: 'uppercase',
                      }}>
                        AUTO-FIX
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── CTA ───────────────────────────────────────── */}
        <button
          onClick={() => {
            markStepComplete(1)
            router.push('/scan')
          }}
          style={{
            width: '100%', padding: '20px 24px', borderRadius: 12,
            background: T.green, color: '#000',
            fontFamily: syne, fontSize: 18, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'transform 150ms ease, opacity 150ms ease',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.opacity = '0.95' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1' }}
        >
          Run scan
          <span style={{ fontSize: 22 }}>{'\u2192'}</span>
        </button>
      </div>

      {/* Global keyframe for fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Stat Badge sub-component ─────────────────────────────
function StatBadge({ label, count, color, dim }: { label: string; count: number; color: string; dim: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color,
        background: dim, padding: '2px 8px', borderRadius: 4,
        border: `1px solid ${color}33`, minWidth: 24, textAlign: 'center',
      }}>
        {count}
      </span>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6b7280' }}>
        {label}
      </span>
    </div>
  )
}
