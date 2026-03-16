'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  loadDesignSystem,
  type ImportedDesignSystem,
  loadGovernanceRules,
  saveGovernanceRules,
  type GovernanceRule,
  DEFAULT_GOVERNANCE_RULES,
  loadPrinciples,
  savePrinciples,
  type DesignPrinciple,
  DEFAULT_PRINCIPLES,
} from '@/lib/design-system-store'
import { loadConfig, scanArtifact } from '@/lib/engine'
import { getFixture } from '@/lib/fixtures'

/* ---------- theme tokens ---------- */

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

/* ---------- severity helpers ---------- */

const sevColor: Record<string, string> = {
  critical: T.red,
  high: T.red,
  medium: T.amber,
  low: T.muted,
}

const sevBg: Record<string, string> = {
  critical: T.redDim,
  high: T.redDim,
  medium: T.amberDim,
  low: `${T.muted}18`,
}

/* ---------- helper components ---------- */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: syne,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: T.muted,
        marginBottom: 24,
        paddingBottom: 10,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {children}
    </h2>
  )
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: syne,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: T.dim,
        marginBottom: 12,
      }}
    >
      {children}
    </h3>
  )
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: checked ? T.green : T.dim,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: 8,
          background: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

function ProgressStepper({ current }: { current: number }) {
  const steps = [
    { label: 'Import', href: '/import' },
    { label: 'Governance Rules', href: '/governance' },
    { label: 'Connect MCP', href: '/integrate' },
    { label: 'Scan', href: '/demo' },
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32,
      overflowX: 'auto', padding: '4px 0',
    }}>
      {steps.map((step, i) => (
        <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <a href={step.href} style={{
            fontFamily: mono, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            color: i === current ? '#000' : i < current ? T.green : T.dim,
            background: i === current ? T.green : i < current ? T.greenDim : 'transparent',
            padding: '5px 12px', borderRadius: 6,
            border: i < current ? `1px solid ${T.green}33` : '1px solid transparent',
            whiteSpace: 'nowrap',
          }}>
            {i < current ? '✓ ' : ''}{step.label}
          </a>
          {i < steps.length - 1 && (
            <div style={{ width: 24, height: 1, background: i < current ? T.green : T.border, margin: '0 4px' }} />
          )}
        </div>
      ))}
    </div>
  )
}

function InputField({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: mono,
        fontSize: 12,
        color: T.text,
        background: T.surface2,
        border: `1px solid ${T.border2}`,
        borderRadius: 6,
        padding: '6px 10px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows ?? 2}
      style={{
        fontFamily: mono,
        fontSize: 12,
        color: T.text,
        background: T.surface2,
        border: `1px solid ${T.border2}`,
        borderRadius: 6,
        padding: '6px 10px',
        outline: 'none',
        width: '100%',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  )
}

/* ---------- violation count computation ---------- */

function buildYamlFromRules(rules: GovernanceRule[]): string {
  const ruleLines = rules
    .map((r) => {
      const autoFix = r.autoFix
        ? r.autoFixStrategy || 'auto'
        : 'false'
      return [
        `  - id: ${r.id}`,
        `    severity: ${r.severity}`,
        `    description: "${r.description.replace(/"/g, "'")}"`,
        `    check: "${r.id}"`,
        `    auto_fix: ${autoFix}`,
      ].join('\n')
    })
    .join('\n')

  return `name: muteform-governance
version: "1.0"
tokens:
  colors:
    blue-60: "#0f62fe"
    blue-70: "#0043ce"
    gray-100: "#161616"
    gray-90: "#262626"
    green-50: "#24a148"
    red-60: "#da1e28"
    yellow-30: "#f1c21b"
  spacing:
    scale: [2, 4, 8, 12, 16, 24, 32, 48, 64, 96]
  typography:
    allowed_styles:
      - heading-01
      - heading-02
      - heading-03
      - body-01
      - body-02
      - label-01
      - caption-01
  components:
    button:
      allowed_variants: [primary, secondary, tertiary, ghost, danger]
      allowed_sizes: [sm, md, lg, xl]
  layout:
    grid_columns: [2, 4, 8, 16]
rules:
${ruleLines}
`
}

function computeViolationCounts(rules: GovernanceRule[]): Record<string, number> {
  try {
    const fixture = getFixture('onboarding')
    if (!fixture) return {}
    const yaml = buildYamlFromRules(rules)
    const config = loadConfig(yaml)
    const result = scanArtifact(fixture.artifact, config)
    const counts: Record<string, number> = {}
    for (const rule of rules) counts[rule.id] = 0
    for (const v of result.violations) {
      if (counts[v.ruleId] !== undefined) {
        counts[v.ruleId]++
      }
    }
    return counts
  } catch {
    return {}
  }
}

/* ---------- id counter ---------- */

let idCounter = 200

/* ---------- main page ---------- */

export default function GovernancePage() {
  const [importedSystem, setImportedSystem] = useState<ImportedDesignSystem | null>(null)
  const [rules, setRules] = useState<GovernanceRule[]>(DEFAULT_GOVERNANCE_RULES)
  const [principles, setPrinciples] = useState<DesignPrinciple[]>(DEFAULT_PRINCIPLES)
  const [violationCounts, setViolationCounts] = useState<Record<string, number>>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  /* load from localStorage on mount */
  useEffect(() => {
    setImportedSystem(loadDesignSystem())
    setRules(loadGovernanceRules())
    setPrinciples(loadPrinciples())
  }, [])

  /* recompute violation counts whenever rules change */
  useEffect(() => {
    setViolationCounts(computeViolationCounts(rules))
  }, [rules])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  /* --- rule helpers --- */
  const updateRule = useCallback((id: string, patch: Partial<GovernanceRule>) => {
    setRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      saveGovernanceRules(next)
      return next
    })
  }, [])

  const addRule = useCallback(() => {
    idCounter++
    const newRule: GovernanceRule = {
      id: `custom-rule-${idCounter}`,
      name: '',
      description: '',
      severity: 'medium',
      autoFix: false,
      autoFixStrategy: '',
      blocked: false,
      violationCount: 0,
    }
    setRules((prev) => {
      const next = [...prev, newRule]
      saveGovernanceRules(next)
      return next
    })
  }, [])

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== id)
      saveGovernanceRules(next)
      return next
    })
  }, [])

  /* --- principle helpers --- */
  const updatePrinciple = useCallback((id: string, patch: Partial<DesignPrinciple>) => {
    setPrinciples((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      savePrinciples(next)
      return next
    })
  }, [])

  const addPrinciple = useCallback(() => {
    idCounter++
    const newPrinciple: DesignPrinciple = {
      id: `dp-new-${idCounter}`,
      title: '',
      description: '',
      whyItMatters: '',
      severity: 'medium',
      autoFix: false,
      autoFixBehavior: '',
    }
    setPrinciples((prev) => {
      const next = [...prev, newPrinciple]
      savePrinciples(next)
      return next
    })
  }, [])

  const deletePrinciple = useCallback((id: string) => {
    setPrinciples((prev) => {
      const next = prev.filter((p) => p.id !== id)
      savePrinciples(next)
      return next
    })
  }, [])

  /* --- nav --- */
  const navItems = [
    { label: 'Import', href: '/import' },
    { label: 'Demo', href: '/demo' },
    { label: 'Playground', href: '/playground' },
    { label: 'Governance', href: '/governance', active: true },
    { label: 'Integrate', href: '/integrate' },
  ]

  /* --- derived design system display data --- */
  const ds = importedSystem
  const colorEntries = ds ? Object.entries(ds.tokens.color) : []
  const spacingScale = ds ? ds.tokens.spacing : []
  const typoStyles = ds ? ds.typography.allowedStyles : []
  const componentEntries = ds ? Object.entries(ds.components) : []
  const gridColumns = ds ? ds.layout.allowedGridColumns : []

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>

      {/* toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: T.green,
            color: T.bg,
            fontFamily: mono,
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 24px',
            borderRadius: 8,
            zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}

      {/* nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: 52,
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontStyle: 'italic',
            fontSize: 17,
            fontWeight: 400,
            color: T.text,
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          muteform
        </a>

        <nav
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'center',
          }}
          className="nav-links"
        >
          {navItems.map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: l.active ? T.green : T.muted,
                textDecoration: 'none',
                letterSpacing: '0.02em',
                borderBottom: l.active
                  ? `2px solid ${T.green}`
                  : '2px solid transparent',
                paddingBottom: 2,
                transition: 'color 0.15s',
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <button
          className="nav-hamburger"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </header>

      {/* mobile overlay */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            style={{
              background: T.surface,
              width: 240,
              height: '100%',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderLeft: `1px solid ${T.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 22, alignSelf: 'flex-end', marginBottom: 16 }}
            >
              &times;
            </button>
            {navItems.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  fontFamily: syne,
                  fontSize: 14,
                  fontWeight: 700,
                  color: l.active ? T.green : T.text,
                  textDecoration: 'none',
                  padding: '8px 0',
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* page body */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 96px' }}>

        <ProgressStepper current={1} />

        {/* page title */}
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: syne,
              fontSize: 28,
              fontWeight: 700,
              color: T.text,
              marginBottom: 8,
            }}
          >
            Governance
          </h1>
          <p style={{ fontFamily: mono, fontSize: 13, color: T.muted, margin: 0 }}>
            Baseline from imported design system, rules engine, and design principles.
          </p>
        </div>

        {/* Baseline loaded banner */}
        {ds && (
          <div style={{
            marginBottom: 32, padding: '16px 20px',
            background: T.greenDim, border: `1px solid ${T.green}33`,
            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: '#000', fontWeight: 700, fontSize: 14 }}>✓</span>
            </div>
            <div style={{ fontFamily: syne, fontWeight: 700, fontSize: 14, color: T.green }}>
              Baseline: {ds.sourceLabel} — loaded
            </div>
          </div>
        )}

        {/* ======================================================
            SECTION A — Baseline (Imported Design System)
        ====================================================== */}
        <section style={{ marginBottom: 64 }}>
          <SectionHeader>Section A — Baseline</SectionHeader>

          {!ds ? (
            /* no system imported */
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: T.surface2,
                    border: `1px solid ${T.border2}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: syne, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                    No design system imported
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: T.muted, marginBottom: 20 }}>
                    Import a design system to populate the baseline.
                  </div>
                  <a
                    href="/import"
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.bg,
                      background: T.blue,
                      textDecoration: 'none',
                      padding: '9px 20px',
                      borderRadius: 7,
                      display: 'inline-block',
                    }}
                  >
                    Go to Import
                  </a>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 28,
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 11,
                      color: T.muted,
                    }}
                  >
                    Imported from:
                  </span>
                  <span
                    style={{
                      fontFamily: syne,
                      fontSize: 14,
                      fontWeight: 700,
                      color: T.text,
                    }}
                  >
                    {ds.sourceLabel}
                  </span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.green,
                      background: T.greenDim,
                      border: `1px solid ${T.green}30`,
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    {ds.source}
                  </span>
                </div>
                <a
                  href="/import"
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.blue,
                    background: T.blueDim,
                    border: `1px solid ${T.blue}30`,
                    textDecoration: 'none',
                    padding: '6px 16px',
                    borderRadius: 6,
                  }}
                >
                  Edit
                </a>
              </div>

              {/* Color swatches grid */}
              <SubHeader>Color Tokens ({colorEntries.length})</SubHeader>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 10,
                  marginBottom: 32,
                }}
              >
                {colorEntries.map(([name, hex]) => (
                  <div
                    key={name}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: '100%', height: 56, background: hex }} />
                    <div style={{ padding: '7px 9px' }}>
                      <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: T.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: T.muted }}>
                        {hex}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Spacing scale bars */}
              <SubHeader>Spacing Scale ({spacingScale.length} steps)</SubHeader>
              <Card style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {spacingScale.map((val) => (
                    <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: T.muted, width: 28, textAlign: 'right', flexShrink: 0 }}>
                        {val}
                      </span>
                      <div
                        style={{
                          height: 13,
                          width: Math.min(val * 3.5, 480),
                          borderRadius: 3,
                          background: `linear-gradient(90deg, ${T.blue}, ${T.blue}99)`,
                          transition: 'width 0.3s',
                        }}
                      />
                      <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>px</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Typography style badges */}
              <SubHeader>Typography Styles ({typoStyles.length})</SubHeader>
              <Card style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {typoStyles.map((style) => (
                    <span
                      key={style}
                      style={{
                        fontFamily: mono,
                        fontSize: 11,
                        color: T.blue,
                        background: T.blueDim,
                        border: `1px solid ${T.blue}30`,
                        padding: '4px 12px',
                        borderRadius: 5,
                      }}
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Component name + variant badges */}
              <SubHeader>Components ({componentEntries.length})</SubHeader>
              <Card style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {componentEntries.map(([name, def]) => (
                    <div key={name}>
                      <div style={{ fontFamily: syne, fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                        {name}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: def.allowedSizes.length ? 6 : 0 }}>
                        {def.allowedVariants.map((v) => (
                          <span
                            key={v}
                            style={{
                              fontFamily: mono,
                              fontSize: 10,
                              color: T.green,
                              background: T.greenDim,
                              border: `1px solid ${T.green}30`,
                              padding: '3px 10px',
                              borderRadius: 4,
                            }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                      {def.allowedSizes.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {def.allowedSizes.map((s) => (
                            <span
                              key={s}
                              style={{
                                fontFamily: mono,
                                fontSize: 10,
                                color: T.amber,
                                background: T.amberDim,
                                border: `1px solid ${T.amber}30`,
                                padding: '3px 10px',
                                borderRadius: 4,
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Grid column visualizer */}
              <SubHeader>Layout Grid</SubHeader>
              <Card style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {gridColumns.map((cols, ci) => {
                    const colors = [T.blue, T.green, T.amber, T.red]
                    const col = colors[ci % colors.length]
                    return (
                      <div key={cols}>
                        <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>
                          {cols}-column grid
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${cols}, 1fr)`,
                            gap: 3,
                          }}
                        >
                          {Array.from({ length: cols }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                height: 18,
                                borderRadius: 2,
                                background: col,
                                opacity: 0.25 + (i / cols) * 0.6,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </>
          )}
        </section>

        {/* ======================================================
            SECTION B — Governance Rules
        ====================================================== */}
        <section style={{ marginBottom: 64 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              paddingBottom: 10,
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <h2
              style={{
                fontFamily: syne,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: T.muted,
                margin: 0,
              }}
            >
              Section B — Governance Rules
            </h2>
            <span
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: T.muted,
              }}
            >
              {rules.length} rule{rules.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rules.map((rule) => {
              const vCount = violationCounts[rule.id] ?? 0
              return (
                <Card key={rule.id}>
                  {/* rule header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <InputField
                        value={rule.name}
                        onChange={(v) => updateRule(rule.id, { name: v })}
                        placeholder="Rule name"
                        style={{
                          fontFamily: syne,
                          fontSize: 14,
                          fontWeight: 700,
                          background: 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${T.border2}`,
                          borderRadius: 0,
                          padding: '2px 0',
                          marginBottom: 8,
                          color: T.text,
                        }}
                      />
                      <div
                        style={{
                          fontFamily: mono,
                          fontSize: 11,
                          color: T.muted,
                          lineHeight: 1.5,
                        }}
                      >
                        {rule.description || (
                          <span style={{ color: T.dim, fontStyle: 'italic' }}>No description</span>
                        )}
                      </div>
                    </div>

                    {/* violation count badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <div
                        style={{
                          minWidth: 36,
                          height: 36,
                          borderRadius: 8,
                          background: vCount > 0 ? sevBg[rule.severity] : T.surface2,
                          border: `1px solid ${vCount > 0 ? `${sevColor[rule.severity]}30` : T.border2}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 6px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: syne,
                            fontSize: 16,
                            fontWeight: 700,
                            color: vCount > 0 ? sevColor[rule.severity] : T.dim,
                          }}
                        >
                          {vCount}
                        </span>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: 9, color: T.dim }}>violations</span>
                    </div>
                  </div>

                  {/* rule controls row */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 16,
                      alignItems: 'center',
                    }}
                  >
                    {/* severity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>Severity</span>
                      <select
                        value={rule.severity}
                        onChange={(e) =>
                          updateRule(rule.id, { severity: e.target.value as GovernanceRule['severity'] })
                        }
                        style={{
                          fontFamily: mono,
                          fontSize: 11,
                          color: sevColor[rule.severity],
                          background: sevBg[rule.severity],
                          border: `1px solid ${sevColor[rule.severity]}30`,
                          borderRadius: 5,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* auto-fix toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Toggle
                        checked={rule.autoFix}
                        onChange={(v) => updateRule(rule.id, { autoFix: v })}
                      />
                      <span style={{ fontFamily: mono, fontSize: 11, color: rule.autoFix ? T.green : T.muted }}>
                        Auto-fix {rule.autoFix ? 'on' : 'off'}
                      </span>
                    </div>

                    {/* strategy — shown when auto-fix on */}
                    {rule.autoFix && (
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <InputField
                          value={rule.autoFixStrategy}
                          onChange={(v) => updateRule(rule.id, { autoFixStrategy: v })}
                          placeholder="Auto-fix strategy (e.g. snap_nearest)"
                          style={{ fontSize: 11 }}
                        />
                      </div>
                    )}

                    {/* blocked toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      <Toggle
                        checked={rule.blocked}
                        onChange={(v) => updateRule(rule.id, { blocked: v })}
                      />
                      <span
                        style={{
                          fontFamily: mono,
                          fontSize: 11,
                          color: rule.blocked ? T.red : T.muted,
                        }}
                      >
                        {rule.blocked ? 'Merge-blocking' : 'Non-blocking'}
                      </span>
                    </div>

                    {/* delete */}
                    <button
                      type="button"
                      onClick={() => deleteRule(rule.id)}
                      title="Remove rule"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: T.dim,
                        padding: 4,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Add Rule */}
          <button
            type="button"
            onClick={addRule}
            style={{
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 600,
              color: T.muted,
              background: 'transparent',
              border: `1px dashed ${T.border2}`,
              borderRadius: 8,
              padding: '10px 20px',
              cursor: 'pointer',
              marginTop: 14,
              width: '100%',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = T.blue
              e.currentTarget.style.color = T.blue
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border2
              e.currentTarget.style.color = T.muted
            }}
          >
            + Add Rule
          </button>
        </section>

        {/* ======================================================
            SECTION C — Design Principles
        ====================================================== */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              paddingBottom: 10,
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <h2
              style={{
                fontFamily: syne,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: T.muted,
                margin: 0,
              }}
            >
              Section C — Design Principles
            </h2>
            <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>
              {principles.length} principle{principles.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {principles.map((p) => (
              <Card key={p.id}>
                {/* principle title row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <InputField
                      value={p.title}
                      onChange={(v) => updatePrinciple(p.id, { title: v })}
                      placeholder="Principle title"
                      style={{
                        fontFamily: syne,
                        fontSize: 14,
                        fontWeight: 700,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${T.border2}`,
                        borderRadius: 0,
                        padding: '2px 0',
                        color: T.text,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePrinciple(p.id)}
                    title="Remove principle"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: T.dim,
                      padding: 4,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* description + why it matters */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        color: T.muted,
                        display: 'block',
                        marginBottom: 5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Description
                    </label>
                    <TextArea
                      value={p.description}
                      onChange={(v) => updatePrinciple(p.id, { description: v })}
                      placeholder="Plain English description of the principle..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        color: T.muted,
                        display: 'block',
                        marginBottom: 5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Why it matters
                    </label>
                    <TextArea
                      value={p.whyItMatters}
                      onChange={(v) => updatePrinciple(p.id, { whyItMatters: v })}
                      placeholder="Why does this principle matter to users and the product?"
                      rows={3}
                    />
                  </div>
                </div>

                {/* controls row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                  {/* severity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>Severity</span>
                    <select
                      value={p.severity}
                      onChange={(e) =>
                        updatePrinciple(p.id, { severity: e.target.value as DesignPrinciple['severity'] })
                      }
                      style={{
                        fontFamily: mono,
                        fontSize: 11,
                        color: sevColor[p.severity],
                        background: sevBg[p.severity],
                        border: `1px solid ${sevColor[p.severity]}30`,
                        borderRadius: 5,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* auto-fix toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Toggle
                      checked={p.autoFix}
                      onChange={(v) => updatePrinciple(p.id, { autoFix: v })}
                    />
                    <span style={{ fontFamily: mono, fontSize: 11, color: p.autoFix ? T.green : T.muted }}>
                      Auto-fix {p.autoFix ? 'on' : 'off'}
                    </span>
                  </div>

                  {/* auto-fix behavior text */}
                  {p.autoFix ? (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <InputField
                        value={p.autoFixBehavior}
                        onChange={(v) => updatePrinciple(p.id, { autoFixBehavior: v })}
                        placeholder="Auto-fix behavior (e.g. Change variant to primary)"
                        style={{ fontSize: 11 }}
                      />
                    </div>
                  ) : (
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 11,
                        color: T.dim,
                        background: T.surface2,
                        border: `1px solid ${T.border2}`,
                        padding: '4px 12px',
                        borderRadius: 5,
                      }}
                    >
                      {p.autoFixBehavior || 'Manual review required'}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Add Principle */}
          <button
            type="button"
            onClick={addPrinciple}
            style={{
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 600,
              color: T.muted,
              background: 'transparent',
              border: `1px dashed ${T.border2}`,
              borderRadius: 8,
              padding: '10px 20px',
              cursor: 'pointer',
              marginTop: 14,
              width: '100%',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = T.green
              e.currentTarget.style.color = T.green
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border2
              e.currentTarget.style.color = T.muted
            }}
          >
            + Add Principle
          </button>
        </section>

        {/* ======================================================
            CTA — Connect Claude Code
        ====================================================== */}
        <div style={{
          marginTop: 48, padding: '32px 24px',
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, textAlign: 'center',
        }}>
          <div style={{ fontFamily: syne, fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
            Rules configured. Connect Claude Code.
          </div>
          <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, marginBottom: 24 }}>
            Wire the MCP endpoint so every generated component is scanned and patched automatically.
          </p>
          <a
            href="/integrate"
            style={{
              fontFamily: mono, fontSize: 14, fontWeight: 700,
              color: '#000', background: T.green,
              padding: '14px 32px', borderRadius: 8,
              textDecoration: 'none', display: 'inline-block',
              letterSpacing: '0.02em',
            }}
          >
            Connect Claude Code →
          </a>
        </div>

      </main>
    </div>
  )
}
