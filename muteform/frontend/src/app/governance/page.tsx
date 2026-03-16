'use client'

import { useState } from 'react'

const T = {
  bg: '#080909',
  surface: '#0c0d0f',
  surface2: '#101214',
  border: '#161819',
  border2: '#1e2226',
  blue: '#0055FF',
  text: '#f0f1f3',
  muted: '#6b7280',
  dim: '#374151',
  green: '#22c55e',
  greenDim: '#22c55e18',
  amber: '#f59e0b',
  amberDim: '#f59e0b18',
  red: '#ef4444',
  redDim: '#ef444418',
  blueDim: '#0055FF18',
}

const syne = "'Syne', sans-serif"
const mono = "'DM Mono', monospace"

/* ---------- types ---------- */

interface ColorToken {
  name: string
  hex: string
}

interface Principle {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  fix: string | null
  enabled: boolean
}

interface ContextRule {
  id: string
  feature: string
  condition: string
  override: string
  reason: string
}

/* ---------- severity helpers ---------- */

const severityColor: Record<string, string> = {
  critical: T.red,
  high: T.red,
  medium: T.amber,
  low: T.muted,
}

const severityBg: Record<string, string> = {
  critical: T.redDim,
  high: T.redDim,
  medium: T.amberDim,
  low: `${T.muted}18`,
}

/* ---------- initial data ---------- */

const INITIAL_COLORS: ColorToken[] = [
  { name: 'primary', hex: '#0055FF' },
  { name: 'neutral900', hex: '#111111' },
  { name: 'success', hex: '#22c55e' },
  { name: 'warning', hex: '#f59e0b' },
]

const SPACING_SCALE = [4, 8, 12, 16, 24, 32, 48, 64]

const TYPO_STYLES: { label: string; size: number; weight: number; family: string }[] = [
  { label: 'h1', size: 36, weight: 700, family: syne },
  { label: 'h2', size: 28, weight: 700, family: syne },
  { label: 'h3', size: 22, weight: 700, family: syne },
  { label: 'body', size: 15, weight: 400, family: mono },
  { label: 'body-sm', size: 13, weight: 400, family: mono },
  { label: 'caption', size: 11, weight: 400, family: mono },
  { label: 'label', size: 10, weight: 600, family: mono },
]

const COLUMN_COUNTS = [4, 8, 12]

const INITIAL_PRINCIPLES: Principle[] = [
  {
    id: 'p1',
    title: 'Visual Hierarchy',
    description: 'Primary action must be most visually dominant',
    severity: 'high',
    fix: 'Change variant to primary',
    enabled: true,
  },
  {
    id: 'p2',
    title: 'WCAG AA Contrast',
    description: 'All interactive elements must meet 4.5:1 contrast ratio minimum',
    severity: 'high',
    fix: 'Adjust foreground color',
    enabled: true,
  },
  {
    id: 'p3',
    title: 'Cognitive Load',
    description: 'Maximum one primary action per screen section',
    severity: 'low',
    fix: null,
    enabled: true,
  },
  {
    id: 'p4',
    title: 'Spacing Grid Alignment',
    description: 'All spacing must align to 8pt grid system',
    severity: 'medium',
    fix: 'Snap to nearest grid value',
    enabled: true,
  },
]

const INITIAL_RULES: ContextRule[] = [
  {
    id: 'r1',
    feature: 'Elderly Care Module',
    condition: 'when feature = elderly-care',
    override: 'min font size: 18px',
    reason: 'Larger text improves readability for elderly users',
  },
  {
    id: 'r2',
    feature: 'Kiosk Mode',
    condition: 'when platform = kiosk',
    override: 'min touch target: 48px',
    reason: 'Kiosk displays require larger touch targets',
  },
]

/* ---------- reusable micro-components ---------- */

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
      }}
    />
  )
}

/* ---------- main component ---------- */

let idCounter = 100

export default function GovernancePage() {
  const [colors] = useState<ColorToken[]>(INITIAL_COLORS)
  const [principles, setPrinciples] = useState<Principle[]>(INITIAL_PRINCIPLES)
  const [contextRules, setContextRules] = useState<ContextRule[]>(INITIAL_RULES)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  /* principle helpers */
  const updatePrinciple = (id: string, patch: Partial<Principle>) => {
    setPrinciples((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  }

  const addPrinciple = () => {
    idCounter++
    setPrinciples((prev) => [
      ...prev,
      {
        id: `p-new-${idCounter}`,
        title: '',
        description: '',
        severity: 'medium',
        fix: null,
        enabled: true,
      },
    ])
  }

  /* context rule helpers */
  const updateRule = (id: string, patch: Partial<ContextRule>) => {
    setContextRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
  }

  const addContextRule = () => {
    idCounter++
    setContextRules((prev) => [
      ...prev,
      {
        id: `r-new-${idCounter}`,
        feature: '',
        condition: '',
        override: '',
        reason: '',
      },
    ])
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      {/* --- toast --- */}
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

      {/* --- top nav bar --- */}
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
          href="/dashboard"
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
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Scan', href: '/scan' },
            { label: 'Rules', href: '/rules' },
            { label: 'Governance', href: '/governance', active: true },
            { label: 'Integrate', href: '/integrate' },
            { label: 'Team', href: '/team' },
          ].map((l) => (
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
      </header>

      {/* --- page body --- */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 96px' }}>
        {/* ============================== SECTION 1: DESIGN SYSTEM ============================== */}
        <section style={{ marginBottom: 56 }}>
          <SectionHeader>Design System</SectionHeader>

          {/* Color tokens */}
          <SubHeader>Color Tokens</SubHeader>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 12,
              marginBottom: 32,
            }}
          >
            {colors.map((c) => (
              <div
                key={c.name}
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 64,
                    background: c.hex,
                  }}
                />
                <div style={{ padding: '8px 10px' }}>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.text,
                      marginBottom: 2,
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.muted,
                    }}
                  >
                    {c.hex}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Spacing scale */}
          <SubHeader>Spacing Scale</SubHeader>
          <Card style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SPACING_SCALE.map((val) => (
                <div
                  key={val}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.muted,
                      width: 28,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {val}
                  </span>
                  <div
                    style={{
                      height: 14,
                      width: val * 4,
                      borderRadius: 3,
                      background: `linear-gradient(90deg, ${T.blue}, ${T.blue}99)`,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Typography */}
          <SubHeader>Typography</SubHeader>
          <Card style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TYPO_STYLES.map((t) => (
                <div
                  key={t.label}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.muted,
                      width: 60,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {t.label}
                  </span>
                  <span
                    style={{
                      fontFamily: t.family,
                      fontSize: t.size,
                      fontWeight: t.weight,
                      color: T.text,
                      lineHeight: 1.2,
                    }}
                  >
                    Aa
                  </span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.dim,
                    }}
                  >
                    {t.size}px / {t.weight}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Components */}
          <SubHeader>Components</SubHeader>
          <Card style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.bg,
                  background: T.green,
                  padding: '5px 14px',
                  borderRadius: 6,
                }}
              >
                primary
              </span>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.text,
                  background: 'transparent',
                  padding: '5px 14px',
                  borderRadius: 6,
                  border: `1px solid ${T.border2}`,
                }}
              >
                secondary
              </span>
            </div>
          </Card>

          {/* Layout grid visualizer */}
          <SubHeader>Layout</SubHeader>
          <Card style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {COLUMN_COUNTS.map((cols) => (
                <div key={cols}>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.muted,
                      marginBottom: 6,
                    }}
                  >
                    {cols}-column
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
                          background:
                            cols === 4
                              ? T.blue
                              : cols === 8
                                ? T.green
                                : T.amber,
                          opacity: 0.5 + (i / cols) * 0.5,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Save to Supabase */}
          <button
            type="button"
            onClick={() => showToast('Design system saved to Supabase')}
            style={{
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: T.blue,
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLButtonElement).style.opacity = '0.85'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.opacity = '1'
            }}
          >
            Save to Supabase
          </button>
        </section>

        {/* ============================== SECTION 2: DESIGN PRINCIPLES ============================== */}
        <section style={{ marginBottom: 56 }}>
          <SectionHeader>Design Principles</SectionHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {principles.map((p) => (
              <Card
                key={p.id}
                style={{
                  opacity: p.enabled ? 1 : 0.5,
                  transition: 'opacity 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 16,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <InputField
                      value={p.title}
                      onChange={(v) => updatePrinciple(p.id, { title: v })}
                      placeholder="Principle title"
                      style={{
                        fontFamily: syne,
                        fontSize: 14,
                        fontWeight: 700,
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        marginBottom: 6,
                        color: T.text,
                      }}
                    />
                    <TextArea
                      value={p.description}
                      onChange={(v) =>
                        updatePrinciple(p.id, { description: v })
                      }
                      placeholder="Why does this principle matter?"
                      rows={2}
                    />
                  </div>
                  <Toggle
                    checked={p.enabled}
                    onChange={(v) => updatePrinciple(p.id, { enabled: v })}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* severity */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        color: T.muted,
                      }}
                    >
                      Severity
                    </span>
                    <select
                      value={p.severity}
                      onChange={(e) =>
                        updatePrinciple(p.id, {
                          severity: e.target.value as Principle['severity'],
                        })
                      }
                      style={{
                        fontFamily: mono,
                        fontSize: 11,
                        color: severityColor[p.severity],
                        background: severityBg[p.severity],
                        border: `1px solid ${T.border2}`,
                        borderRadius: 5,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      {['critical', 'high', 'medium', 'low'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* auto-fix */}
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      padding: '3px 10px',
                      borderRadius: 5,
                      background: p.fix ? T.greenDim : T.surface2,
                      color: p.fix ? T.green : T.muted,
                      border: `1px solid ${p.fix ? `${T.green}30` : T.border2}`,
                    }}
                  >
                    {p.fix ? `auto-fix: ${p.fix}` : 'manual review'}
                  </span>
                </div>
              </Card>
            ))}
          </div>

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
              marginTop: 16,
              width: '100%',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.borderColor = T.green
              el.style.color = T.green
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.borderColor = T.border2
              el.style.color = T.muted
            }}
          >
            + Add Principle
          </button>
        </section>

        {/* ============================== SECTION 3: CONTEXT RULES ============================== */}
        <section>
          <SectionHeader>Context Rules</SectionHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {contextRules.map((r) => (
              <Card key={r.id}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        color: T.muted,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Feature
                    </label>
                    <InputField
                      value={r.feature}
                      onChange={(v) => updateRule(r.id, { feature: v })}
                      placeholder="Feature name"
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        color: T.muted,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Condition
                    </label>
                    <InputField
                      value={r.condition}
                      onChange={(v) => updateRule(r.id, { condition: v })}
                      placeholder="when feature = ..."
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.muted,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Override
                  </label>
                  <InputField
                    value={r.override}
                    onChange={(v) => updateRule(r.id, { override: v })}
                    placeholder="CSS override value"
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: T.muted,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Reason
                  </label>
                  <TextArea
                    value={r.reason}
                    onChange={(v) => updateRule(r.id, { reason: v })}
                    placeholder="Why is this override necessary?"
                    rows={2}
                  />
                </div>
              </Card>
            ))}
          </div>

          <button
            type="button"
            onClick={addContextRule}
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
              marginTop: 16,
              width: '100%',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.borderColor = T.green
              el.style.color = T.green
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.borderColor = T.border2
              el.style.color = T.muted
            }}
          >
            + Add Context Rule
          </button>
        </section>
      </main>
    </div>
  )
}
