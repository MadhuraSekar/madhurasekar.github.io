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

// ─── Severity helpers ───────────────────────────────────────
const SEV_COLORS: Record<string, { color: string; dim: string }> = {
  critical: { color: 'var(--error)', dim: 'var(--error-dim)' },
  high:     { color: 'var(--error)', dim: 'var(--error-dim)' },
  medium:   { color: 'var(--warning)', dim: 'var(--warning-dim)' },
  low:      { color: 'var(--text-muted)', dim: 'var(--surface-elevated)' },
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
  { id: 'spacing', label: 'Spacing Scale', icon: '\u2194', ruleId: 'spacing-scale-compliance', description: 'Spacing values must use the approved scale', hasAutoFix: true },
  { id: 'typography', label: 'Typography', icon: 'Aa', ruleId: 'typography-style-compliance', description: 'Typography styles must be from approved list', hasAutoFix: false },
  { id: 'components', label: 'Components', icon: '\u25A1', ruleId: 'component-variant-compliance', description: 'Component variants must be from approved list', hasAutoFix: false, severityLocked: 'critical' },
  { id: 'layout', label: 'Layout Grid', icon: '\u2591', ruleId: 'layout-grid-compliance', description: 'Grid columns must use approved column counts', hasAutoFix: false },
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

        const perRule: Record<string, number> = {}
        for (const v of violations) {
          const rId = v.ruleId ?? v.rule ?? 'unknown'
          perRule[rId] = (perRule[rId] || 0) + 1
        }
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
        width: 36, height: 20, borderRadius: 4, cursor: 'pointer',
        background: on ? 'var(--accent)' : 'var(--border-strong)',
        position: 'relative', transition: 'background 200ms ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: 'var(--text-primary)',
        position: 'absolute', top: 3,
        left: on ? 19 : 3, transition: 'left 200ms ease',
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
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
        color: value ? 'var(--accent)' : 'var(--text-muted)',
        background: value ? 'var(--accent-dim)' : 'var(--surface-elevated)',
        border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 4, padding: '6px 12px', cursor: 'pointer',
        outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 28,
        transition: 'all 200ms ease',
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <Stepper />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 20px 120px' }}>
        {/* ─── Page Header ──────────────────────────────── */}
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 700,
          color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.15,
          letterSpacing: '-0.025em',
        }}>
          Governance Rules
        </h1>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--text-secondary)',
          marginBottom: 40, lineHeight: 1.6,
        }}>
          Configure rules for {companyName} design system
        </p>

        {/* ─── Design System Summary ─────────────────────── */}
        {ds && (
          <div style={{
            padding: '14px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 4, marginBottom: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <StatBadge label="Colors" count={colorCount} />
              <StatBadge label="Spacing" count={spacingCount} />
              <StatBadge label="Typography" count={typographyCount} />
              <StatBadge label="Components" count={componentCount} />
            </div>
            <a href="/import" style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--accent)',
              textDecoration: 'none', padding: '4px 12px', borderRadius: 4,
              border: '1px solid var(--accent)', background: 'var(--accent-dim)',
              transition: 'all 200ms ease',
            }}>
              Edit
            </a>
          </div>
        )}

        {!ds && (
          <div style={{
            padding: '14px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 4, marginBottom: 28,
          }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)' }}>
              No design system imported yet.{' '}
              <a href="/import" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Import one</a>
            </span>
          </div>
        )}

        {/* ─── Violation Preview Banner ──────────────────── */}
        {violationCount !== null && (
          <div style={{
            padding: '14px 20px', background: 'var(--warning-dim)', border: '1px solid var(--warning)',
            borderRadius: 4, marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--warning)', fontWeight: 700 }}>!</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--warning)', fontWeight: 600 }}>
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
                  background: 'var(--surface)',
                  border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border)'}`,
                  borderRadius: 4, padding: '20px 24px',
                  transition: 'all 200ms ease',
                  opacity: enabled ? 1 : 0.5,
                }}
              >
                {/* Card top row: icon, name, toggle */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 20,
                    color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: enabled ? 'var(--surface-elevated)' : 'transparent',
                    borderRadius: 4, flexShrink: 0,
                    border: enabled ? '1px solid var(--border-strong)' : '1px solid transparent',
                    transition: 'all 200ms ease',
                  }}>
                    {cat.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
                      color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3,
                    }}>
                      {cat.label}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)',
                      lineHeight: 1.5,
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
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      Severity
                    </span>
                    {cat.severityLocked ? (
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        color: SEV_COLORS[cat.severityLocked].color,
                        background: SEV_COLORS[cat.severityLocked].dim,
                        padding: '3px 10px', borderRadius: 4,
                        letterSpacing: '0.04em',
                      }}>
                        {cat.severityLocked} (locked)
                      </span>
                    ) : (
                      <select
                        value={sev}
                        onChange={e => updateRule(cat.ruleId, { severity: e.target.value as GovernanceRule['severity'] })}
                        style={{
                          fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
                          color: sevStyle.color,
                          background: sevStyle.dim,
                          border: '1px solid var(--border)',
                          borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                          outline: 'none', textTransform: 'uppercase', letterSpacing: '0.04em',
                          transition: 'all 200ms ease',
                        }}
                      >
                        {SEVERITIES.map(s => (
                          <option key={s} value={s} style={{ color: 'var(--text-primary)', background: 'var(--surface-elevated)' }}>
                            {s.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Auto-fix toggle */}
                  {cat.hasAutoFix && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
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
                      fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                      color: 'var(--success)', background: 'var(--success-dim)',
                      padding: '2px 8px', borderRadius: 4,
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
                    fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--warning)',
                    animation: 'fadeIn 400ms ease',
                    opacity: 1,
                  }}>
                    This rule catches {ruleViolations} violation{ruleViolations !== 1 ? 's' : ''} in sample scan
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ─── Custom Rule Builder — Sentence Style ─────── */}
        <div style={{
          padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 4, marginBottom: 16,
        }}>
          <h3 style={{
            fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: 6,
          }}>
            Custom Rule Builder
          </h3>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 24,
          }}>
            Describe what should happen in plain language.
          </p>

          {/* Sentence builder */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 2.4,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>When a</span>
            <SentenceDropdown value={sbComponent} onChange={setSbComponent} options={SB_COMPONENTS} placeholder="component &#9662;" />
            <span style={{ color: 'var(--text-muted)' }}>uses</span>
            <SentenceDropdown value={sbProperty} onChange={setSbProperty} options={SB_PROPERTIES} placeholder="property &#9662;" />
            <span style={{ color: 'var(--text-muted)' }}>that is</span>
            <SentenceDropdown value={sbCondition} onChange={setSbCondition} options={SB_CONDITIONS} placeholder="condition &#9662;" />
            <span style={{ color: 'var(--text-muted)' }}>then</span>
            <SentenceDropdown value={sbAction} onChange={setSbAction} options={SB_ACTIONS} placeholder="action &#9662;" />
          </div>

          {/* Preview + Add when complete */}
          {sbComplete && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                padding: '14px 18px', background: 'var(--surface-elevated)', borderRadius: 4,
                border: '1px solid var(--border-strong)', marginBottom: 14,
              }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  Rule preview
                </div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6,
                }}>
                  {sbToRule().description}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    color: SEV_COLORS[sbToRule().severity].color,
                    background: SEV_COLORS[sbToRule().severity].dim,
                    padding: '2px 8px', borderRadius: 4,
                  }}>
                    {sbToRule().severity}
                  </span>
                  {sbToRule().autoFix && (
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                      color: 'var(--success)', background: 'var(--success-dim)',
                      padding: '2px 8px', borderRadius: 4,
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
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                  color: 'var(--bg)', background: 'var(--accent)',
                  border: 'none', borderRadius: 4, padding: '10px 24px', cursor: 'pointer',
                  transition: 'background 200ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
              >
                Add rule
              </button>
            </div>
          )}
        </div>

        {/* ─── Advanced form (collapsible) ───────────────── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 4, marginBottom: 32, overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%', padding: '14px 24px', background: 'transparent',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 200ms ease',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)' }}>
              Advanced: add rule with form
            </span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)',
              transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 200ms ease', display: 'inline-block',
            }}>
              {'\u25BC'}
            </span>
          </button>

          {showAdvanced && (
            <div style={{ padding: '0 24px 24px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
                {/* Rule name */}
                <div>
                  <label style={{
                    fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)',
                    display: 'block', marginBottom: 6,
                  }}>
                    Rule name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="e.g. Brand color only in headers"
                    style={{
                      width: '100%', fontFamily: 'var(--font-sans)', fontSize: 13,
                      color: 'var(--text-primary)', background: 'var(--surface-elevated)',
                      border: '1px solid var(--border-strong)', borderRadius: 4,
                      padding: '10px 14px', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 200ms ease',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
                  />
                </div>

                {/* Category + Severity row */}
                <div className="stack-mobile" style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)',
                      display: 'block', marginBottom: 6,
                    }}>
                      Category
                    </label>
                    <select
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value as CategoryId)}
                      style={{
                        width: '100%', fontFamily: 'var(--font-sans)', fontSize: 13,
                        color: 'var(--text-primary)', background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-strong)', borderRadius: 4,
                        padding: '10px 14px', outline: 'none', cursor: 'pointer',
                        transition: 'border-color 200ms ease',
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
                    <label style={{
                      fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)',
                      display: 'block', marginBottom: 6,
                    }}>
                      Severity
                    </label>
                    <select
                      value={customSeverity}
                      onChange={e => setCustomSeverity(e.target.value as GovernanceRule['severity'])}
                      style={{
                        width: '100%', fontFamily: 'var(--font-sans)', fontSize: 13,
                        color: SEV_COLORS[customSeverity].color,
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border-strong)', borderRadius: 4,
                        padding: '10px 14px', outline: 'none', cursor: 'pointer',
                        transition: 'all 200ms ease',
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
                  <label style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>
                    Auto-fix
                  </label>
                  <Toggle on={customAutoFix} onToggle={() => setCustomAutoFix(!customAutoFix)} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {customAutoFix ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <label style={{
                    fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)',
                    display: 'block', marginBottom: 6,
                  }}>
                    Description
                  </label>
                  <textarea
                    value={customDescription}
                    onChange={e => setCustomDescription(e.target.value)}
                    placeholder="Describe what this rule enforces..."
                    rows={3}
                    style={{
                      width: '100%', fontFamily: 'var(--font-sans)', fontSize: 13,
                      color: 'var(--text-primary)', background: 'var(--surface-elevated)',
                      border: '1px solid var(--border-strong)', borderRadius: 4,
                      padding: '10px 14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                      transition: 'border-color 200ms ease',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
                  />
                </div>

                {/* Add button */}
                <button
                  onClick={handleAddCustomRule}
                  disabled={!customName.trim()}
                  style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
                    color: 'var(--bg)',
                    background: customName.trim() ? 'var(--accent)' : 'var(--border-strong)',
                    border: 'none', borderRadius: 4, padding: '10px 20px',
                    cursor: customName.trim() ? 'pointer' : 'not-allowed',
                    alignSelf: 'flex-start', transition: 'all 200ms ease',
                  }}
                  onMouseEnter={e => { if (customName.trim()) e.currentTarget.style.background = 'var(--accent-hover)' }}
                  onMouseLeave={e => { if (customName.trim()) e.currentTarget.style.background = 'var(--accent)' }}
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
            <h3 style={{
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
              color: 'var(--text-primary)', marginBottom: 12,
            }}>
              Your custom rules
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customRules.map(cr => {
                const sevC = SEV_COLORS[cr.severity] || SEV_COLORS.medium
                return (
                  <div key={cr.id} style={{
                    padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'border-color 200ms ease',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}>
                          {cr.name}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                          color: sevC.color, background: sevC.dim,
                          padding: '1px 6px', borderRadius: 4,
                        }}>
                          {cr.severity}
                        </span>
                      </div>
                      {cr.description && (
                        <span style={{
                          fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)',
                        }}>
                          {cr.description}
                        </span>
                      )}
                    </div>
                    {cr.autoFix && (
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                        color: 'var(--success)', background: 'var(--success-dim)',
                        padding: '2px 8px', borderRadius: 4,
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
            width: '100%', padding: '18px 24px', borderRadius: 4,
            background: 'var(--accent)', color: 'var(--bg)',
            fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background 200ms ease, transform 200ms ease',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'scale(1.01)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1)' }}
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
function StatBadge({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
        color: 'var(--accent)', background: 'var(--accent-dim)',
        padding: '2px 8px', borderRadius: 4,
        minWidth: 24, textAlign: 'center',
      }}>
        {count}
      </span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  )
}
