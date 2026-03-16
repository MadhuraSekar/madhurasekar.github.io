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
  { id: 'color', label: 'Color Tokens', icon: '\u25CF', ruleId: 'color-token-compliance', description: 'All colors must reference approved design tokens', hasAutoFix: false },
  { id: 'spacing', label: 'Spacing Scale', icon: '\u2194', ruleId: 'spacing-scale-compliance', description: 'Spacing values must use the approved scale', hasAutoFix: true },
  { id: 'typography', label: 'Typography', icon: 'Aa', ruleId: 'typography-style-compliance', description: 'Typography styles must be from approved list', hasAutoFix: false },
  { id: 'components', label: 'Components', icon: '\u25A1', ruleId: 'component-variant-compliance', description: 'Component variants must be from approved list', hasAutoFix: false },
  { id: 'layout', label: 'Layout Grid', icon: '\u2591', ruleId: 'layout-grid-compliance', description: 'Grid columns must use approved column counts', hasAutoFix: false },
  { id: 'accessibility', label: 'Accessibility (WCAG AA)', icon: '\u2714', ruleId: 'contrast-wcag-aa', description: 'All text must meet WCAG AA contrast requirements (4.5:1)', hasAutoFix: false, severityLocked: 'critical' },
]

const CATEGORY_OPTIONS: { value: CategoryId; label: string }[] = [
  { value: 'color', label: 'Color' },
  { value: 'spacing', label: 'Spacing' },
  { value: 'typography', label: 'Typography' },
  { value: 'components', label: 'Components' },
  { value: 'layout', label: 'Layout' },
  { value: 'accessibility', label: 'Accessibility' },
]

// ─── Component ──────────────────────────────────────────────
export default function RulesPage() {
  const router = useRouter()
  const [ds, setDs] = useState<ImportedDesignSystem | null>(null)
  const [rules, setRules] = useState<GovernanceRule[]>(DEFAULT_GOVERNANCE_RULES)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [violationCount, setViolationCount] = useState<number | null>(null)
  const [companyName, setCompanyName] = useState<string>('your')

  // Custom rule form
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
        setViolationCount((result as any)?.violations?.length ?? (result as any)?.totalViolations ?? 0)
      }
    } catch {
      setViolationCount(null)
    }
  }, [])

  // Run scan whenever rules change
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

  // ─── Add custom rule ──────────────────────────────────
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
    // Also save to main rules list
    setRules(prev => {
      const next = [...prev, newRule]
      saveGovernanceRules(next)
      return next
    })
    // Sync to Supabase
    const session = loadSession()
    syncCustomRule(session.user?.id ?? null, newRule)
    // Reset form
    setCustomName('')
    setCustomDescription('')
    setCustomSeverity('medium')
    setCustomAutoFix(false)
    setCustomCategory('color')
  }

  // ─── Toggle switch component ──────────────────────────
  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <div
      onClick={onToggle}
      style={{
        width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
        background: on ? T.green : T.dim,
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2,
        left: on ? 18 : 2, transition: 'left 0.2s',
      }} />
    </div>
  )

  // ─── Render ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <Stepper />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 100px' }}>
        {/* Header */}
        <h1 style={{
          fontFamily: syne, fontSize: 28, fontWeight: 700, color: T.text,
          marginBottom: 8, lineHeight: 1.3,
        }}>
          Governance rules for {companyName} design system
        </h1>
        <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, marginBottom: 32 }}>
          Configure which rules run during scans, set severity levels, and add custom rules.
        </p>

        {/* ─── Design System Summary ─────────────────────── */}
        {ds && (
          <div style={{
            padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, marginBottom: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
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
              background: T.blueDim,
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

        {/* ─── Rule Categories ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
          {CATEGORIES.map(cat => {
            const rule = findRule(cat.ruleId)
            const enabled = isEnabled(cat.ruleId)
            const expanded = expandedCard === cat.id
            const sev = rule?.severity || 'medium'
            const sevStyle = SEV_COLORS[sev] || SEV_COLORS.medium

            return (
              <div key={cat.id} style={{
                background: T.surface, border: `1px solid ${expanded ? T.border2 : T.border}`,
                borderRadius: 10, overflow: 'hidden',
                opacity: enabled ? 1 : 0.5, transition: 'opacity 0.2s',
              }}>
                {/* Card header */}
                <div
                  onClick={() => setExpandedCard(expanded ? null : cat.id)}
                  style={{
                    padding: '16px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <span style={{
                    fontFamily: mono, fontSize: 16, color: enabled ? T.text : T.dim,
                    width: 28, textAlign: 'center', flexShrink: 0,
                  }}>
                    {cat.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: syne, fontSize: 15, fontWeight: 700, color: T.text }}>
                        {cat.label}
                      </span>
                      <span style={{
                        fontFamily: mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: sevStyle.color, background: sevStyle.dim,
                        padding: '2px 8px', borderRadius: 3, border: `1px solid ${sevStyle.color}33`,
                      }}>
                        {sev}
                      </span>
                      {rule?.autoFix && (
                        <span style={{
                          fontFamily: mono, fontSize: 9, color: T.green, background: T.greenDim,
                          padding: '2px 8px', borderRadius: 3, border: `1px solid ${T.green}33`,
                        }}>
                          AUTO-FIX
                        </span>
                      )}
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>
                      {cat.description}
                    </span>
                  </div>
                  <Toggle on={enabled} onToggle={() => toggleEnabled(cat.ruleId)} />
                  <span style={{
                    fontFamily: mono, fontSize: 14, color: T.dim, transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s', flexShrink: 0,
                  }}>
                    {'\u25BC'}
                  </span>
                </div>

                {/* Expanded content */}
                {expanded && (
                  <div style={{
                    padding: '0 20px 20px', borderTop: `1px solid ${T.border}`,
                    paddingTop: 16,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Severity selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontFamily: mono, fontSize: 11, color: T.muted, width: 80 }}>Severity</span>
                        {cat.severityLocked ? (
                          <span style={{
                            fontFamily: mono, fontSize: 11, color: SEV_COLORS[cat.severityLocked].color,
                            background: SEV_COLORS[cat.severityLocked].dim,
                            padding: '4px 12px', borderRadius: 4,
                            border: `1px solid ${SEV_COLORS[cat.severityLocked].color}33`,
                          }}>
                            {cat.severityLocked.toUpperCase()} (locked)
                          </span>
                        ) : (
                          <select
                            value={sev}
                            onChange={e => updateRule(cat.ruleId, { severity: e.target.value as GovernanceRule['severity'] })}
                            style={{
                              fontFamily: mono, fontSize: 11, color: sevStyle.color,
                              background: T.surface2, border: `1px solid ${T.border2}`,
                              borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            {SEVERITIES.map(s => (
                              <option key={s} value={s}>{s.toUpperCase()}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Auto-fix toggle (only for spacing) */}
                      {cat.hasAutoFix && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: mono, fontSize: 11, color: T.muted, width: 80 }}>Auto-fix</span>
                          <Toggle
                            on={rule?.autoFix ?? false}
                            onToggle={() => updateRule(cat.ruleId, { autoFix: !rule?.autoFix })}
                          />
                          <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>
                            {rule?.autoFix ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      )}

                      {/* Rule status */}
                      <div style={{
                        fontFamily: mono, fontSize: 10, color: T.dim,
                        padding: '8px 12px', background: T.surface2, borderRadius: 6,
                        border: `1px solid ${T.border}`,
                      }}>
                        Rule ID: {cat.ruleId} | Strategy: {rule?.autoFixStrategy || 'none'} | Blocked: {rule?.blocked ? 'yes' : 'no'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ─── Custom Rules List ─────────────────────────── */}
        {customRules.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12 }}>
              Custom Rules
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customRules.map(cr => {
                const sevC = SEV_COLORS[cr.severity] || SEV_COLORS.medium
                return (
                  <div key={cr.id} style={{
                    padding: '12px 16px', background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
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
                        <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>{cr.category}</span>
                      </div>
                      {cr.description && (
                        <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{cr.description}</span>
                      )}
                    </div>
                    {cr.autoFix && (
                      <span style={{
                        fontFamily: mono, fontSize: 9, color: T.green, background: T.greenDim,
                        padding: '2px 8px', borderRadius: 3, border: `1px solid ${T.green}33`,
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

        {/* ─── Add Custom Rule ───────────────────────────── */}
        <div style={{
          padding: '24px', background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 10, marginBottom: 32,
        }}>
          <h3 style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>
            Add custom rule
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  }}
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
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
                    width: '100%', fontFamily: mono, fontSize: 12, color: T.text,
                    background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 6,
                    padding: '10px 14px', outline: 'none', cursor: 'pointer',
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
                fontFamily: mono, fontSize: 12, fontWeight: 600, color: T.text,
                background: customName.trim() ? T.blue : T.dim,
                border: 'none', borderRadius: 6, padding: '10px 20px',
                cursor: customName.trim() ? 'pointer' : 'not-allowed',
                alignSelf: 'flex-start', transition: 'background 0.2s',
              }}
            >
              Add rule
            </button>
          </div>
        </div>

        {/* ─── Violation Preview ─────────────────────────── */}
        {violationCount !== null && (
          <div style={{
            padding: '12px 20px', background: T.amberDim, border: `1px solid ${T.amber}33`,
            borderRadius: 8, marginBottom: 28,
            fontFamily: mono, fontSize: 12, color: T.amber,
          }}>
            This will affect {violationCount} violation{violationCount !== 1 ? 's' : ''} in your scan
          </div>
        )}

        {/* ─── CTA ───────────────────────────────────────── */}
        <button
          onClick={() => {
            markStepComplete(1)
            router.push('/scan')
          }}
          style={{
            width: '100%', padding: '18px 24px', borderRadius: 10,
            background: T.green, color: '#000',
            fontFamily: syne, fontSize: 18, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Run scan
          <span style={{ fontSize: 20 }}>{'\u2192'}</span>
        </button>
      </div>
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
