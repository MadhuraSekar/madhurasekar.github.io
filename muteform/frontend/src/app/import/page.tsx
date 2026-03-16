'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Stepper from '@/components/Stepper'
import {
  type ImportedDesignSystem,
  SAMPLE_SYSTEMS,
  parseTokenJSON,
  getImportWarnings,
  saveDesignSystem,
  loadDesignSystem,
} from '@/lib/design-system-store'
import {
  loadSession, saveSession, syncUserToSupabase, syncImportedSystem, markStepComplete,
} from '@/lib/session'

// ─── Design tokens ────────────────────────────────────────────
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

// ─── Sample system visual identity ───────────────────────────
const SAMPLE_VISUALS: Record<string, { swatches: string[]; label: string }> = {
  acme: {
    swatches: ['#0055FF', '#111111', '#22c55e', '#f59e0b', '#9ca3af'],
    label: 'Acme Design System',
  },
  carbon: {
    swatches: ['#0F62FE'],
    label: 'Carbon (IBM)',
  },
  material: {
    swatches: ['#6750A4', '#625B71', '#7D5260'],
    label: 'Material Design 3',
  },
}

// ─── Category colors for success pills ──────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  colors: '#0055FF',
  spacing: '#22c55e',
  components: '#f59e0b',
  typography: '#a78bfa',
}

const SAMPLE_JSON = `{
  "colors": {
    "primary": "#0055FF",
    "secondary": "#111111",
    "success": "#22c55e",
    "error": "#ef4444"
  },
  "spacing": [4, 8, 12, 16, 24, 32, 48, 64],
  "typography": {
    "styles": ["h1","h2","h3","body","caption"]
  },
  "components": {
    "button": {
      "variants": ["primary","secondary","ghost"],
      "sizes": ["sm","md","lg"]
    }
  }
}`

// ─── Helpers ──────────────────────────────────────────────────
function hexToLuma(hex: string): number {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// ─── Color Swatches ──────────────────────────────────────────
function ColorSwatches({ colors }: { colors: Record<string, string> }) {
  const entries = Object.entries(colors)
  if (entries.length === 0) return null
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
      gap: 10,
    }}>
      {entries.map(([name, hex]) => {
        const luma = hexToLuma(hex)
        const labelColor = luma > 0.5 ? '#111' : '#fff'
        return (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              height: 52,
              borderRadius: 8,
              background: hex,
              border: `1px solid ${T.border2}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: mono,
                fontSize: 10,
                color: labelColor,
                opacity: 0.75,
              }}>
                {hex}
              </span>
            </div>
            <span style={{
              fontFamily: mono,
              fontSize: 11,
              color: T.muted,
              textAlign: 'center',
              wordBreak: 'break-word',
            }}>
              {name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Spacing Bars ────────────────────────────────────────────
function SpacingBars({ scale }: { scale: number[] }) {
  if (scale.length === 0) return null
  const max = Math.max(...scale)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {scale.map(val => (
        <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: mono,
            fontSize: 11,
            color: T.muted,
            width: 32,
            textAlign: 'right',
            flexShrink: 0,
          }}>
            {val}px
          </span>
          <div style={{
            height: 10,
            width: `${(val / max) * 100}%`,
            background: T.blue,
            borderRadius: 3,
            opacity: 0.7,
            minWidth: 4,
          }} />
        </div>
      ))}
    </div>
  )
}

// ─── Confirmation Panel ──────────────────────────────────────
function ConfirmationPanel({
  ds,
  warnings,
}: {
  ds: ImportedDesignSystem
  warnings: string[]
}) {
  const colorCount = Object.keys(ds.tokens.color).length
  const compCount = Object.keys(ds.components).length

  return (
    <div style={{
      marginTop: 24,
      border: `1px solid ${T.border2}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '16px 20px',
        background: T.surface,
        borderBottom: `1px solid ${T.border2}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 16, color: T.green }}>&#10003;</span>
        <div>
          <div style={{
            fontFamily: syne,
            fontWeight: 700,
            fontSize: 15,
            color: T.text,
          }}>
            Parsed: {ds.sourceLabel}
          </div>
          <div style={{
            fontFamily: mono,
            fontSize: 12,
            color: T.muted,
            marginTop: 2,
          }}>
            {colorCount} color tokens &middot; {ds.tokens.spacing.length} spacing values &middot; {ds.typography.allowedStyles.length} typography styles &middot; {compCount} components
          </div>
        </div>
      </div>

      <div style={{ padding: 20, background: T.bg, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warnings.map(w => (
              <div key={w} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px',
                background: T.amberDim,
                border: `1px solid ${T.amber}28`,
                borderRadius: 8,
                fontFamily: mono, fontSize: 12, color: T.amber,
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>&#9888;</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Color tokens */}
        {colorCount > 0 && (
          <div>
            <h3 style={{
              fontFamily: syne, fontWeight: 700, fontSize: 13,
              color: T.muted, textTransform: 'uppercase',
              letterSpacing: '0.08em', margin: '0 0 12px',
            }}>
              Color Tokens ({colorCount})
            </h3>
            <ColorSwatches colors={ds.tokens.color} />
          </div>
        )}

        {/* Spacing */}
        {ds.tokens.spacing.length > 0 && (
          <div>
            <h3 style={{
              fontFamily: syne, fontWeight: 700, fontSize: 13,
              color: T.muted, textTransform: 'uppercase',
              letterSpacing: '0.08em', margin: '0 0 12px',
            }}>
              Spacing Scale
            </h3>
            <SpacingBars scale={ds.tokens.spacing} />
          </div>
        )}

        {/* Typography */}
        {ds.typography.allowedStyles.length > 0 && (
          <div>
            <h3 style={{
              fontFamily: syne, fontWeight: 700, fontSize: 13,
              color: T.muted, textTransform: 'uppercase',
              letterSpacing: '0.08em', margin: '0 0 12px',
            }}>
              Typography Styles
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ds.typography.allowedStyles.map(s => (
                <span key={s} style={{
                  fontFamily: mono, fontSize: 12, color: T.text,
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 5, padding: '4px 10px',
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Components */}
        {compCount > 0 && (
          <div>
            <h3 style={{
              fontFamily: syne, fontWeight: 700, fontSize: 13,
              color: T.muted, textTransform: 'uppercase',
              letterSpacing: '0.08em', margin: '0 0 12px',
            }}>
              Components &amp; Variants
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(ds.components).map(([name, def]) => (
                <div key={name} style={{
                  background: T.surface2,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{
                    fontFamily: syne, fontWeight: 700, fontSize: 13,
                    color: T.text, textTransform: 'capitalize', marginBottom: 8,
                  }}>
                    {name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {def.allowedVariants.map(v => (
                      <span key={v} style={{
                        fontFamily: mono, fontSize: 11, color: T.blue,
                        background: T.blueDim, border: `1px solid ${T.blue}28`,
                        borderRadius: 4, padding: '2px 8px',
                      }}>
                        {v}
                      </span>
                    ))}
                    {def.allowedSizes.map(s => (
                      <span key={s} style={{
                        fontFamily: mono, fontSize: 11, color: T.muted,
                        background: T.surface, border: `1px solid ${T.border2}`,
                        borderRadius: 4, padding: '2px 8px',
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Name/Company Modal Overlay ──────────────────────────────
function IdentityModal({
  onSave,
}: {
  onSave: (name: string, company: string) => void
}) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const canSave = name.trim().length > 0 && company.trim().length > 0

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: T.surface,
        border: `1px solid ${T.border2}`,
        borderRadius: 16,
        padding: '36px 32px 32px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <h2 style={{
          fontFamily: syne,
          fontWeight: 700,
          fontSize: 22,
          color: T.text,
          margin: '0 0 8px',
          letterSpacing: '-0.3px',
        }}>
          Before we start &mdash; who are you?
        </h2>
        <p style={{
          fontFamily: mono,
          fontSize: 13,
          color: T.muted,
          margin: '0 0 28px',
          lineHeight: 1.5,
        }}>
          We&apos;ll save your progress so you can pick up where you left off.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
              style={{
                fontFamily: mono, fontSize: 14, color: T.text,
                background: T.bg, border: `1px solid ${T.border2}`,
                borderRadius: 8, padding: '12px 14px', outline: 'none',
                transition: 'border-color 0.15s',
                width: '100%', boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = T.blue)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border2)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>Company</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Acme Corp"
              onKeyDown={e => e.key === 'Enter' && canSave && onSave(name.trim(), company.trim())}
              style={{
                fontFamily: mono, fontSize: 14, color: T.text,
                background: T.bg, border: `1px solid ${T.border2}`,
                borderRadius: 8, padding: '12px 14px', outline: 'none',
                transition: 'border-color 0.15s',
                width: '100%', boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = T.blue)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border2)}
            />
          </div>

          <button
            onClick={() => canSave && onSave(name.trim(), company.trim())}
            disabled={!canSave}
            style={{
              fontFamily: mono, fontSize: 14, fontWeight: 700,
              color: '#000', background: T.green,
              border: 'none', borderRadius: 10,
              padding: '14px 24px', cursor: canSave ? 'pointer' : 'not-allowed',
              opacity: canSave ? 1 : 0.4,
              marginTop: 8,
              transition: 'transform 0.15s, opacity 0.15s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { if (canSave) e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            Save and continue
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Import Method Card ──────────────────────────────────────
function MethodCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 200,
        minHeight: 200,
        background: T.surface,
        border: `2px solid ${selected ? T.green : T.border}`,
        borderRadius: 14,
        padding: '28px 24px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 14,
        transition: 'border-color 0.2s, transform 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.borderColor = T.border2
        e.currentTarget.style.transform = 'scale(1.02)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.borderColor = T.border
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <div style={{
        fontSize: 32,
        lineHeight: 1,
        opacity: selected ? 1 : 0.6,
        transition: 'opacity 0.15s',
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontFamily: syne,
          fontWeight: 700,
          fontSize: 17,
          color: selected ? T.text : T.muted,
          marginBottom: 6,
          transition: 'color 0.15s',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: mono,
          fontSize: 13,
          color: T.dim,
          lineHeight: 1.5,
        }}>
          {description}
        </div>
      </div>
      {selected && (
        <div style={{
          marginTop: 'auto',
          fontFamily: mono,
          fontSize: 11,
          color: T.green,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: T.green, display: 'inline-block',
          }} />
          Selected
        </div>
      )}
    </button>
  )
}

// ─── Sample System Card ──────────────────────────────────────
function SampleCard({
  sample,
  onClick,
}: {
  sample: typeof SAMPLE_SYSTEMS[number]
  onClick: () => void
}) {
  const visuals = SAMPLE_VISUALS[sample.id]
  const isCarbonSingle = sample.id === 'carbon'

  return (
    <button
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: '22px 20px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'border-color 0.15s, transform 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = T.border2
        e.currentTarget.style.background = T.surface2
        e.currentTarget.style.transform = 'scale(1.02)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border
        e.currentTarget.style.background = T.surface
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {/* Color swatch row */}
      {visuals && (
        <div style={{ display: 'flex', gap: isCarbonSingle ? 0 : 8, alignItems: 'center' }}>
          {visuals.swatches.map((color, i) => (
            <div
              key={i}
              style={{
                width: isCarbonSingle ? 48 : 28,
                height: isCarbonSingle ? 48 : 28,
                borderRadius: '50%',
                background: color,
                border: `2px solid ${T.surface}`,
                boxShadow: `0 0 0 1px ${T.border2}`,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}

      <div style={{
        fontFamily: syne, fontWeight: 700, fontSize: 16,
        color: T.text,
      }}>
        {sample.name}
      </div>
      <div style={{
        fontFamily: mono, fontSize: 12, color: T.muted,
        lineHeight: 1.5,
      }}>
        {sample.description}
      </div>
      <div style={{
        fontFamily: mono, fontSize: 12, color: T.dim,
      }}>
        {sample.tokens} tokens &middot; {sample.components} components
      </div>
    </button>
  )
}

// ─── Success Screen ──────────────────────────────────────────
function SuccessScreen({
  ds,
  onContinue,
}: {
  ds: ImportedDesignSystem
  onContinue: () => void
}) {
  const colorCount = Object.keys(ds.tokens.color).length
  const spacingCount = ds.tokens.spacing.length
  const compCount = Object.keys(ds.components).length
  const typoCount = ds.typography.allowedStyles.length

  const colorSwatchList = Object.values(ds.tokens.color).slice(0, 8)

  const pills = [
    { label: `${colorCount} colors`, category: 'colors', swatches: colorSwatchList },
    { label: `${spacingCount} spacing values`, category: 'spacing', swatches: [] },
    { label: `${compCount} components`, category: 'components', swatches: [] },
    { label: `${typoCount} typography styles`, category: 'typography', swatches: [] },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      overflow: 'auto',
    }}>
      {/* Animated checkmark */}
      <div style={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        background: T.green,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        animation: 'checkPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path
            d="M12 22L19 29L32 15"
            stroke="#000"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: syne,
        fontWeight: 700,
        fontSize: 36,
        color: T.text,
        margin: '0 0 12px',
        textAlign: 'center',
        letterSpacing: '-0.5px',
        lineHeight: 1.2,
      }}>
        {ds.sourceLabel} imported successfully
      </h1>

      <p style={{
        fontFamily: mono,
        fontSize: 14,
        color: T.muted,
        margin: '0 0 40px',
        textAlign: 'center',
      }}>
        Your design system is ready. Here&apos;s what we found:
      </p>

      {/* Stats pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        justifyContent: 'center',
        marginBottom: 48,
        maxWidth: 640,
      }}>
        {pills.map(pill => (
          <div
            key={pill.category}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: T.surface,
              border: `1px solid ${T.border2}`,
              borderLeft: `4px solid ${CATEGORY_COLORS[pill.category]}`,
              borderRadius: 10,
              padding: '12px 18px',
              minWidth: 160,
            }}
          >
            {/* Inline color swatches for colors pill */}
            {pill.swatches.length > 0 && (
              <div style={{ display: 'flex', gap: 3, marginRight: 4 }}>
                {pill.swatches.map((hex, i) => (
                  <div
                    key={i}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: hex,
                      border: `1px solid ${T.border2}`,
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            )}
            <span style={{
              fontFamily: mono,
              fontSize: 13,
              color: T.text,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {pill.label}
            </span>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={onContinue}
        style={{
          fontFamily: mono, fontSize: 16, fontWeight: 700,
          color: '#000', background: T.green,
          border: 'none', borderRadius: 12,
          padding: '18px 40px', cursor: 'pointer',
          letterSpacing: '0.01em',
          transition: 'transform 0.15s, opacity 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        Set your governance rules &#8594;
      </button>

      <style>{`
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────
export default function ImportPage() {
  const router = useRouter()

  type ImportMethod = 'paste' | 'url' | 'sample'
  const [activeMethod, setActiveMethod] = useState<ImportMethod | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [pasteInput, setPasteInput] = useState(SAMPLE_JSON)
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [fetchError, setFetchError] = useState('')
  const [parsed, setParsed] = useState<ImportedDesignSystem | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [importSuccess, setImportSuccess] = useState(false)
  const [parseStatus, setParseStatus] = useState('')

  // User identity
  const [savedUser, setSavedUser] = useState<{ name: string; company: string } | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Existing system
  const [existingSystem, setExistingSystem] = useState<ImportedDesignSystem | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // Load session + existing system on mount
  useEffect(() => {
    const session = loadSession()
    if (session.user) {
      setSavedUser({ name: session.user.name, company: session.user.company })
    } else {
      setShowModal(true)
    }
    const existing = loadDesignSystem()
    if (existing) {
      setExistingSystem(existing)
    }
  }, [])

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  function showToast(msg: string) {
    setToast(msg)
  }

  const handleSaveUser = useCallback(async (name: string, company: string) => {
    const session = loadSession()
    const user = { name, company, createdAt: new Date().toISOString() }
    session.user = user
    saveSession(session)
    setSavedUser({ name, company })
    setShowModal(false)
    const id = await syncUserToSupabase(user)
    if (id) {
      session.user!.id = id
      saveSession(session)
    }
  }, [])

  function handleParsed(ds: ImportedDesignSystem) {
    setParsed(ds)
    setWarnings(getImportWarnings(ds))
    setImportSuccess(false)
    setParseStatus('')
    setTimeout(() => {
      document.getElementById('confirmation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  async function handleFetchUrl() {
    const url = urlInput.trim()
    if (!url) return
    setFetchStatus('loading')
    setFetchError('')
    setParsed(null)
    setImportSuccess(false)
    setParseStatus('Fetching token file from URL...')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      setParseStatus('Parsing token file...')
      const text = await res.text()
      const ds = parseTokenJSON(text, 'url', url)
      setFetchStatus('idle')
      handleParsed(ds)
    } catch (err: unknown) {
      setFetchStatus('error')
      setParseStatus('')
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS') || msg.includes('TypeError')) {
        setFetchError('This URL blocked the request. Try pasting the JSON directly.')
      } else {
        setFetchError(msg)
      }
    }
  }

  function handlePasteJson() {
    const text = pasteInput.trim()
    if (!text) return
    setFetchError('')
    setParsed(null)
    setImportSuccess(false)
    setParseStatus('Parsing token file...')
    try {
      const ds = parseTokenJSON(text, 'paste', 'Pasted JSON')
      handleParsed(ds)
    } catch (err: unknown) {
      setParseStatus('')
      const msg = err instanceof Error ? err.message : 'JSON parse error'
      if (msg.includes('Unexpected token') || msg.includes('JSON')) {
        setFetchError('Invalid JSON format. Check for missing commas, brackets, or quotes.')
      } else {
        setFetchError(msg)
      }
    }
  }

  function handleLoadSample(sample: typeof SAMPLE_SYSTEMS[number]) {
    setParsed(null)
    setFetchError('')
    setImportSuccess(false)
    setParseStatus('Loading sample system...')
    handleParsed(sample.data)
    showToast(`Loaded: ${sample.tokens} tokens, ${sample.components} components`)
  }

  async function handleConfirmImport() {
    if (!parsed) return
    saveDesignSystem(parsed)
    setExistingSystem(parsed)
    const session = loadSession()
    const testerId = session.user?.id ?? null
    await syncImportedSystem(testerId, parsed)
    markStepComplete(0)
    setImportSuccess(true)
  }

  function handleReImport() {
    setExistingSystem(null)
    setParsed(null)
    setImportSuccess(false)
    setFetchError('')
    setActiveMethod(null)
    setParseStatus('')
  }

  function selectMethod(method: ImportMethod) {
    setActiveMethod(method)
    setParsed(null)
    setFetchError('')
    setImportSuccess(false)
    setParseStatus('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      color: T.text,
      fontFamily: mono,
    }}>
      <Stepper />

      {/* Identity Modal */}
      {showModal && <IdentityModal onSave={handleSaveUser} />}

      {/* Success Screen (full screen) */}
      {importSuccess && parsed && (
        <SuccessScreen ds={parsed} onContinue={() => router.push('/rules')} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: T.surface2,
          border: `1px solid ${T.green}44`,
          borderRadius: 8,
          padding: '10px 20px',
          fontFamily: mono,
          fontSize: 13,
          color: T.green,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}

      <main style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}>

        {/* Page heading */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontFamily: syne, fontWeight: 700, fontSize: 32,
            color: T.text, margin: '0 0 10px', letterSpacing: '-0.5px',
          }}>
            Import Design System
          </h1>
          <p style={{
            fontFamily: mono, fontSize: 14, color: T.muted,
            margin: 0, lineHeight: 1.6,
          }}>
            Load your token file to generate governance rules automatically.
            Supports JSON formats, URL fetch, or use a sample system to get started.
          </p>
        </div>

        {/* Existing system banner */}
        {existingSystem && !importSuccess && !parsed && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.green}33`,
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{
                fontFamily: syne, fontWeight: 700, fontSize: 14, color: T.green,
              }}>
                Already imported: {existingSystem.sourceLabel}
              </div>
              <div style={{
                fontFamily: mono, fontSize: 12, color: T.muted, marginTop: 4,
              }}>
                {Object.keys(existingSystem.tokens.color).length} colors &middot; {existingSystem.tokens.spacing.length} spacing &middot; {Object.keys(existingSystem.components).length} components
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleReImport}
                style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600,
                  color: T.muted, background: T.surface2,
                  border: `1px solid ${T.border2}`, borderRadius: 8,
                  padding: '8px 16px', cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                Re-import
              </button>
              <button
                onClick={() => router.push('/rules')}
                style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600,
                  color: '#000', background: T.green,
                  border: 'none', borderRadius: 8,
                  padding: '8px 16px', cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                Set governance rules &#8594;
              </button>
            </div>
          </div>
        )}

        {/* Three Import Method Cards */}
        {(!existingSystem || parsed || importSuccess) && !importSuccess && (
          <>
            <div style={{
              display: 'flex',
              gap: 16,
              marginBottom: 32,
              flexWrap: 'wrap',
            }}>
              <MethodCard
                icon={<span style={{ fontFamily: mono }}>&#123;&#125;</span>}
                title="Paste JSON"
                description="Paste your design token JSON directly into the editor"
                selected={activeMethod === 'paste'}
                onClick={() => selectMethod('paste')}
              />
              <MethodCard
                icon={<span style={{ fontFamily: mono }}>&#8599;</span>}
                title="Fetch from URL"
                description="Provide a public URL to your JSON token file"
                selected={activeMethod === 'url'}
                onClick={() => selectMethod('url')}
              />
              <MethodCard
                icon={<span style={{ fontFamily: mono }}>&#9733;</span>}
                title="Sample Systems"
                description="Try with a pre-built design system to explore the tool"
                selected={activeMethod === 'sample'}
                onClick={() => selectMethod('sample')}
              />
            </div>

            {/* ── PATH A: Paste JSON ── */}
            {activeMethod === 'paste' && (
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: 24,
                marginBottom: 24,
              }}>
                <h2 style={{
                  fontFamily: syne, fontWeight: 700, fontSize: 16,
                  color: T.text, margin: '0 0 6px',
                }}>
                  Paste JSON
                </h2>
                <p style={{
                  fontFamily: mono, fontSize: 13, color: T.muted,
                  margin: '0 0 18px', lineHeight: 1.5,
                }}>
                  Paste your design token JSON below. A realistic example is pre-filled.
                </p>

                <textarea
                  value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                  rows={16}
                  style={{
                    width: '100%', fontFamily: mono, fontSize: 12,
                    color: T.text, background: T.bg,
                    border: `1px solid ${T.border2}`, borderRadius: 8,
                    padding: '12px 14px', resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box', lineHeight: 1.6,
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = T.blue)}
                  onBlur={e => (e.currentTarget.style.borderColor = T.border2)}
                />

                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                  {parseStatus && (
                    <span style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>
                      {parseStatus}
                    </span>
                  )}
                  <button
                    onClick={handlePasteJson}
                    disabled={!pasteInput.trim()}
                    style={{
                      fontFamily: mono, fontSize: 13, fontWeight: 600,
                      color: '#fff', background: T.blue,
                      border: 'none', borderRadius: 8,
                      padding: '10px 20px',
                      cursor: !pasteInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: !pasteInput.trim() ? 0.5 : 1,
                      transition: 'transform 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={e => { if (pasteInput.trim()) e.currentTarget.style.transform = 'scale(1.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    Parse
                  </button>
                </div>

                {fetchError && activeMethod === 'paste' && (
                  <div style={{
                    marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 14px', background: T.redDim,
                    border: `1px solid ${T.red}28`, borderRadius: 8,
                    fontFamily: mono, fontSize: 12, color: T.red,
                  }}>
                    <span style={{ flexShrink: 0 }}>&#10005;</span>
                    <span>{fetchError}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── PATH B: URL Fetch ── */}
            {activeMethod === 'url' && (
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: 24,
                marginBottom: 24,
              }}>
                <h2 style={{
                  fontFamily: syne, fontWeight: 700, fontSize: 16,
                  color: T.text, margin: '0 0 6px',
                }}>
                  Fetch from URL
                </h2>
                <p style={{
                  fontFamily: mono, fontSize: 13, color: T.muted,
                  margin: '0 0 18px', lineHeight: 1.5,
                }}>
                  Provide a publicly accessible URL to a JSON token file.
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                    placeholder="https://example.com/tokens.json"
                    style={{
                      flex: 1, minWidth: 200, fontFamily: mono, fontSize: 13,
                      color: T.text, background: T.bg,
                      border: `1px solid ${T.border2}`, borderRadius: 8,
                      padding: '10px 14px', outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = T.blue)}
                    onBlur={e => (e.currentTarget.style.borderColor = T.border2)}
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={fetchStatus === 'loading' || !urlInput.trim()}
                    style={{
                      fontFamily: mono, fontSize: 13, fontWeight: 600,
                      color: '#fff', background: T.blue,
                      border: 'none', borderRadius: 8,
                      padding: '10px 20px',
                      cursor: (fetchStatus === 'loading' || !urlInput.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (fetchStatus === 'loading' || !urlInput.trim()) ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                      transition: 'transform 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={e => { if (urlInput.trim() && fetchStatus !== 'loading') e.currentTarget.style.transform = 'scale(1.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    {fetchStatus === 'loading' ? 'Fetching...' : 'Fetch & Parse'}
                  </button>
                </div>

                {parseStatus && fetchStatus === 'loading' && (
                  <div style={{
                    marginTop: 12, fontFamily: mono, fontSize: 12, color: T.muted,
                  }}>
                    {parseStatus}
                  </div>
                )}

                {fetchError && activeMethod === 'url' && (
                  <div style={{
                    marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 14px', background: T.redDim,
                    border: `1px solid ${T.red}28`, borderRadius: 8,
                    fontFamily: mono, fontSize: 12, color: T.red,
                  }}>
                    <span style={{ flexShrink: 0 }}>&#10005;</span>
                    <span>{fetchError}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── PATH C: Sample Systems ── */}
            {activeMethod === 'sample' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}>
                {SAMPLE_SYSTEMS.map(sample => (
                  <SampleCard
                    key={sample.id}
                    sample={sample}
                    onClick={() => handleLoadSample(sample)}
                  />
                ))}
              </div>
            )}

            {/* ── Confirmation Panel ── */}
            {parsed && !importSuccess && (
              <div id="confirmation-panel">
                <ConfirmationPanel ds={parsed} warnings={warnings} />
                <div style={{
                  marginTop: 20, display: 'flex', alignItems: 'center',
                  justifyContent: 'flex-end', gap: 14,
                }}>
                  <button
                    onClick={handleConfirmImport}
                    style={{
                      fontFamily: mono, fontSize: 14, fontWeight: 600,
                      color: '#000', background: T.green,
                      border: 'none', borderRadius: 8,
                      padding: '12px 28px', cursor: 'pointer',
                      letterSpacing: '0.02em',
                      transition: 'transform 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '0.85'
                      e.currentTarget.style.transform = 'scale(1.02)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    Confirm &amp; Save Import
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      <style>{`
        @media (max-width: 700px) {
          main { padding: 32px 16px 60px !important; }
        }
        @media (max-width: 600px) {
          /* Stack method cards vertically on mobile */
        }
      `}</style>
    </div>
  )
}
