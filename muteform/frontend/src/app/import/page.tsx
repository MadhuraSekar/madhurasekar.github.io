'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
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

// ─── Font shorthands ─────────────────────────────────────────
const serif = 'var(--font-heading)'
const sans = 'var(--font-mono)'
const mono = 'var(--font-mono)'

// ─── Sample system visual identity ───────────────────────────
// These are actual design system brand colors (data, not UI chrome).
// They render as swatches to visually identify each sample system.
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

// ─── Helpers ─────────────────────────────────────────────────
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
      gap: 8,
    }}>
      {entries.map(([name, hex]) => {
        const luma = hexToLuma(hex)
        return (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              height: 48,
              borderRadius: 4,
              background: hex,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              padding: 6,
            }}>
              <span style={{
                fontFamily: mono,
                fontSize: 10,
                color: luma > 0.5 ? 'var(--text-primary)' : 'var(--surface)',
                opacity: 0.8,
              }}>
                {hex}
              </span>
            </div>
            <span style={{
              fontFamily: mono,
              fontSize: 11,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
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
  const max = Math.max(...scale, 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {scale.map((v, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: mono,
            fontSize: 11,
            color: 'var(--text-muted)',
            width: 32,
            textAlign: 'right',
            flexShrink: 0,
          }}>
            {v}
          </span>
          <div style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--accent)',
            opacity: 0.5,
            width: `${(v / max) * 100}%`,
            minWidth: 4,
            transition: 'width 0.3s ease',
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
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        <h2 style={{
          fontFamily: serif,
          fontWeight: 400,
          fontSize: 24,
          color: 'var(--text-primary)',
          margin: '0 0 6px',
        }}>
          {ds.sourceLabel}
        </h2>
        <div style={{
          fontFamily: mono,
          fontSize: 12,
          color: 'var(--text-muted)',
          marginTop: 4,
        }}>
          {colorCount} color tokens &middot; {ds.tokens.spacing.length} spacing values &middot; {ds.typography.allowedStyles.length} typography styles &middot; {compCount} components
        </div>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warnings.map(w => (
              <div key={w} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px',
                background: 'var(--warning-dim)',
                border: '1px solid var(--warning)',
                borderRadius: 4,
                fontFamily: sans, fontSize: 13, color: 'var(--warning)',
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
              fontFamily: sans, fontWeight: 500, fontSize: 12,
              color: 'var(--text-muted)', textTransform: 'uppercase',
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
              fontFamily: sans, fontWeight: 500, fontSize: 12,
              color: 'var(--text-muted)', textTransform: 'uppercase',
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
              fontFamily: sans, fontWeight: 500, fontSize: 12,
              color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.08em', margin: '0 0 12px',
            }}>
              Typography Styles
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ds.typography.allowedStyles.map(s => (
                <span key={s} style={{
                  fontFamily: mono, fontSize: 12, color: 'var(--text-primary)',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 4, padding: '4px 10px',
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
              fontFamily: sans, fontWeight: 500, fontSize: 12,
              color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.08em', margin: '0 0 12px',
            }}>
              Components &amp; Variants
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(ds.components).map(([name, def]) => (
                <div key={name} style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 4, padding: '12px 14px',
                }}>
                  <div style={{
                    fontFamily: sans, fontWeight: 600, fontSize: 13,
                    color: 'var(--text-primary)', textTransform: 'capitalize', marginBottom: 8,
                  }}>
                    {name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {def.allowedVariants.map(v => (
                      <span key={v} style={{
                        fontFamily: mono, fontSize: 11, color: 'var(--accent)',
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent)',
                        borderRadius: 4, padding: '2px 8px',
                      }}>
                        {v}
                      </span>
                    ))}
                    {def.allowedSizes.map(s => (
                      <span key={s} style={{
                        fontFamily: mono, fontSize: 11, color: 'var(--text-muted)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
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

// ─── Identity Modal ──────────────────────────────────────────
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
      zIndex: 300,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'modalIn 0.3s ease',
    }}>
      <div style={{
        maxWidth: 420,
        width: 'calc(100% - 32px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '40px 36px',
        animation: 'modalCardIn 0.3s ease',
      }}>
        <h2 style={{
          fontFamily: serif,
          fontWeight: 400,
          fontSize: 28,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
          lineHeight: 1.2,
        }}>
          Welcome to Muteform
        </h2>
        <p style={{
          fontFamily: sans,
          fontSize: 14,
          color: 'var(--text-muted)',
          margin: '0 0 32px',
          lineHeight: 1.6,
        }}>
          Help us personalize your experience
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: sans, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
              style={{
                fontFamily: sans, fontSize: 14, color: 'var(--text-primary)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 12px', outline: 'none',
                transition: 'border-color 0.15s',
                width: '100%', boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: sans, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Company</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Acme Corp"
              onKeyDown={e => e.key === 'Enter' && canSave && onSave(name.trim(), company.trim())}
              style={{
                fontFamily: sans, fontSize: 14, color: 'var(--text-primary)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 12px', outline: 'none',
                transition: 'border-color 0.15s',
                width: '100%', boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <button
            onClick={() => canSave && onSave(name.trim(), company.trim())}
            disabled={!canSave}
            style={{
              fontFamily: sans, fontSize: 14, fontWeight: 600,
              color: 'var(--bg)', background: 'var(--accent)',
              border: 'none', borderRadius: 4,
              padding: '12px 24px', cursor: canSave ? 'pointer' : 'not-allowed',
              opacity: canSave ? 1 : 0.4,
              marginTop: 8,
              width: '100%',
              transition: 'opacity 0.15s',
            }}
          >
            Save and continue &rarr;
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
        background: 'var(--surface)',
        border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 4,
        padding: '24px 20px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div style={{
        fontSize: 28,
        lineHeight: 1,
        color: selected ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'color 0.15s',
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 15,
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          marginBottom: 4,
          transition: 'color 0.15s',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: sans,
          fontSize: 13,
          color: 'var(--text-muted)',
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
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)', display: 'inline-block',
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
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '20px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Color swatch row — these are design system brand colors (data), not UI chrome */}
      {visuals && (
        <div style={{ display: 'flex', gap: isCarbonSingle ? 0 : 8, alignItems: 'center' }}>
          {visuals.swatches.map((color, i) => (
            <div
              key={i}
              style={{
                width: isCarbonSingle ? 40 : 24,
                height: isCarbonSingle ? 40 : 24,
                borderRadius: '50%',
                background: color,
                border: '1px solid var(--border)',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}

      <div style={{
        fontFamily: sans, fontWeight: 600, fontSize: 15,
        color: 'var(--text-primary)',
      }}>
        {sample.name}
      </div>
      <div style={{
        fontFamily: sans, fontSize: 13, color: 'var(--text-muted)',
        lineHeight: 1.5,
      }}>
        {sample.description}
      </div>
      <div style={{
        fontFamily: mono, fontSize: 12, color: 'var(--text-muted)',
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

  const pills = [
    { label: `${colorCount} colors`, category: 'colors' },
    { label: `${spacingCount} spacing values`, category: 'spacing' },
    { label: `${compCount} components`, category: 'components' },
    { label: `${typoCount} typography styles`, category: 'typography' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      overflow: 'auto',
    }}>
      {/* Animated checkmark */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'var(--success)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        animation: 'checkPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M11 20L17 26L29 14"
            stroke="var(--bg)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: serif,
        fontWeight: 400,
        fontSize: 40,
        color: 'var(--text-primary)',
        margin: '0 0 12px',
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        {ds.sourceLabel} is live in Muteform.
      </h1>

      <p style={{
        fontFamily: sans,
        fontSize: 15,
        color: 'var(--text-secondary)',
        margin: '0 0 40px',
        textAlign: 'center',
      }}>
        Your design system is ready. Here&apos;s what we found:
      </p>

      {/* Category pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
        marginBottom: 48,
        maxWidth: 600,
      }}>
        {pills.map(pill => (
          <div
            key={pill.category}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '10px 16px',
            }}
          >
            <span style={{
              fontFamily: mono,
              fontSize: 13,
              color: 'var(--text-primary)',
              fontWeight: 500,
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
          fontFamily: sans, fontSize: 16, fontWeight: 600,
          color: 'var(--bg)', background: 'var(--accent)',
          border: 'none', borderRadius: 4,
          padding: '16px 40px', cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
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
    } else if (typeof window !== 'undefined' && !localStorage.getItem('muteform-welcomed')) {
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

  async function handleSaveUser(name: string, company: string) {
    const session = loadSession()
    const user = { name, company, createdAt: new Date().toISOString() }
    session.user = user
    saveSession(session)
    setSavedUser({ name, company })
    setShowModal(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('muteform-welcomed', '1')
    }
    const id = await syncUserToSupabase(user)
    if (id) {
      session.user!.id = id
      saveSession(session)
    }
  }

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
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: sans,
    }}>
      <Header />

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
          background: 'var(--surface-elevated)',
          border: '1px solid var(--success)',
          borderRadius: 4,
          padding: '10px 20px',
          fontFamily: sans,
          fontSize: 13,
          color: 'var(--success)',
        }}>
          {toast}
        </div>
      )}

      <main style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}>

        {/* Page heading */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontFamily: serif, fontWeight: 400, fontSize: 40,
            color: 'var(--text-primary)', margin: '0 0 8px',
            lineHeight: 1.15,
          }}>
            Import Design System
          </h1>
          <p style={{
            fontFamily: sans, fontSize: 15, color: 'var(--text-secondary)',
            margin: 0, lineHeight: 1.6,
          }}>
            Load your token file to generate governance rules automatically.
            Supports JSON formats, URL fetch, or use a sample system to get started.
          </p>
        </div>

        {/* Existing system banner */}
        {existingSystem && !importSuccess && !parsed && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '16px 20px',
            marginBottom: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{
                fontFamily: sans, fontWeight: 600, fontSize: 14, color: 'var(--success)',
              }}>
                Already imported: {existingSystem.sourceLabel}
              </div>
              <div style={{
                fontFamily: mono, fontSize: 12, color: 'var(--text-muted)', marginTop: 4,
              }}>
                {Object.keys(existingSystem.tokens.color).length} colors &middot; {existingSystem.tokens.spacing.length} spacing &middot; {Object.keys(existingSystem.components).length} components
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleReImport}
                style={{
                  fontFamily: sans, fontSize: 13, fontWeight: 500,
                  color: 'var(--text-secondary)', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 4,
                  padding: '8px 16px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                Re-import
              </button>
              <button
                onClick={() => router.push('/rules')}
                style={{
                  fontFamily: sans, fontSize: 13, fontWeight: 600,
                  color: 'var(--bg)', background: 'var(--accent)',
                  border: 'none', borderRadius: 4,
                  padding: '8px 16px', cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
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
                icon={<span style={{ fontFamily: mono }}>&#9633;</span>}
                title="Sample Systems"
                description="Try with a pre-built design system to explore the tool"
                selected={activeMethod === 'sample'}
                onClick={() => selectMethod('sample')}
              />
            </div>

            {/* ── PATH A: Paste JSON ── */}
            {activeMethod === 'paste' && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 4, padding: 24,
                marginBottom: 24,
              }}>
                <h2 style={{
                  fontFamily: serif, fontWeight: 400, fontSize: 22,
                  color: 'var(--text-primary)', margin: '0 0 4px',
                }}>
                  Paste JSON
                </h2>
                <p style={{
                  fontFamily: sans, fontSize: 14, color: 'var(--text-secondary)',
                  margin: '0 0 16px', lineHeight: 1.5,
                }}>
                  Paste your design token JSON below. A realistic example is pre-filled.
                </p>

                <textarea
                  value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                  rows={16}
                  style={{
                    width: '100%', fontFamily: mono, fontSize: 13,
                    color: 'var(--text-primary)', background: 'var(--code-bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    padding: '12px 14px', resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box', lineHeight: 1.6,
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                  {parseStatus && (
                    <span style={{ fontFamily: sans, fontSize: 13, color: 'var(--text-muted)' }}>
                      {parseStatus}
                    </span>
                  )}
                  <button
                    onClick={handlePasteJson}
                    disabled={!pasteInput.trim()}
                    style={{
                      fontFamily: sans, fontSize: 14, fontWeight: 600,
                      color: 'var(--bg)', background: 'var(--accent)',
                      border: 'none', borderRadius: 4,
                      padding: '10px 20px',
                      cursor: !pasteInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: !pasteInput.trim() ? 0.4 : 1,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { if (pasteInput.trim()) e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = pasteInput.trim() ? '1' : '0.4' }}
                  >
                    Parse
                  </button>
                </div>

                {fetchError && activeMethod === 'paste' && (
                  <div style={{
                    marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 14px', background: 'var(--error-dim)',
                    border: '1px solid var(--error)', borderRadius: 4,
                    fontFamily: sans, fontSize: 13, color: 'var(--error)',
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
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 4, padding: 24,
                marginBottom: 24,
              }}>
                <h2 style={{
                  fontFamily: serif, fontWeight: 400, fontSize: 22,
                  color: 'var(--text-primary)', margin: '0 0 4px',
                }}>
                  Fetch from URL
                </h2>
                <p style={{
                  fontFamily: sans, fontSize: 14, color: 'var(--text-secondary)',
                  margin: '0 0 16px', lineHeight: 1.5,
                }}>
                  Provide a publicly accessible URL to a JSON token file.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                    placeholder="https://example.com/tokens.json"
                    style={{
                      flex: 1, minWidth: 200, fontFamily: mono, fontSize: 13,
                      color: 'var(--text-primary)', background: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      padding: '10px 12px', outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={fetchStatus === 'loading' || !urlInput.trim()}
                    style={{
                      fontFamily: sans, fontSize: 14, fontWeight: 600,
                      color: 'var(--bg)', background: 'var(--accent)',
                      border: 'none', borderRadius: 4,
                      padding: '10px 20px',
                      cursor: (fetchStatus === 'loading' || !urlInput.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (fetchStatus === 'loading' || !urlInput.trim()) ? 0.4 : 1,
                      whiteSpace: 'nowrap',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { if (urlInput.trim() && fetchStatus !== 'loading') e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = (urlInput.trim() && fetchStatus !== 'loading') ? '1' : '0.4' }}
                  >
                    {fetchStatus === 'loading' ? 'Fetching...' : 'Fetch & Parse'}
                  </button>
                </div>

                {parseStatus && fetchStatus === 'loading' && (
                  <div style={{
                    marginTop: 12, fontFamily: sans, fontSize: 13, color: 'var(--text-muted)',
                  }}>
                    {parseStatus}
                  </div>
                )}

                {fetchError && activeMethod === 'url' && (
                  <div style={{
                    marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 14px', background: 'var(--error-dim)',
                    border: '1px solid var(--error)', borderRadius: 4,
                    fontFamily: sans, fontSize: 13, color: 'var(--error)',
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
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
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
                  justifyContent: 'flex-end', gap: 12,
                }}>
                  <button
                    onClick={handleConfirmImport}
                    style={{
                      fontFamily: sans, fontSize: 14, fontWeight: 600,
                      color: 'var(--bg)', background: 'var(--accent)',
                      border: 'none', borderRadius: 4,
                      padding: '12px 28px', cursor: 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
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
      `}</style>
    </div>
  )
}
