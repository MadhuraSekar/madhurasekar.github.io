'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  type ImportedDesignSystem,
  CARBON_SAMPLE,
  parseTokenJSON,
  getImportWarnings,
  saveDesignSystem,
} from '@/lib/design-system-store'

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

// ─── Nav links ────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Import',     href: '/import' },
  { label: 'Demo',       href: '/demo' },
  { label: 'Playground', href: '/playground' },
  { label: 'Governance', href: '/governance' },
  { label: 'Integrate',  href: '/integrate' },
]

// ─── Helpers ──────────────────────────────────────────────────
function hexToLuma(hex: string): number {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// ─── Sub-components ───────────────────────────────────────────

function NavBar({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: T.bg,
      borderBottom: `1px solid ${T.border}`,
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        {/* Logo */}
        <a href="/" style={{
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 20,
          color: T.text,
          textDecoration: 'none',
          letterSpacing: '-0.5px',
        }}>
          muteform
        </a>

        {/* Desktop nav */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}
          className="desktop-nav">
          {NAV_LINKS.map(link => {
            const isActive = link.label === 'Import'
            return (
              <a
                key={link.label}
                href={link.href}
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  color: isActive ? T.green : T.muted,
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: isActive ? T.greenDim : 'transparent',
                  border: isActive ? `1px solid ${T.green}28` : '1px solid transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = T.text
                    ;(e.currentTarget as HTMLAnchorElement).style.background = T.surface
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = T.muted
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                  }
                }}
              >
                {link.label}
              </a>
            )
          })}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          style={{
            display: 'none',
            background: 'none',
            border: `1px solid ${T.border2}`,
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            color: T.muted,
            fontFamily: mono,
            fontSize: 18,
            lineHeight: 1,
          }}
          className="hamburger-btn"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          borderTop: `1px solid ${T.border}`,
          padding: '8px 0 12px',
        }}>
          {NAV_LINKS.map(link => {
            const isActive = link.label === 'Import'
            return (
              <a
                key={link.label}
                href={link.href}
                style={{
                  display: 'block',
                  fontFamily: mono,
                  fontSize: 14,
                  color: isActive ? T.green : T.muted,
                  textDecoration: 'none',
                  padding: '10px 24px',
                  background: isActive ? T.greenDim : 'transparent',
                }}
              >
                {link.label}
              </a>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger-btn { display: block !important; }
        }
      `}</style>
    </nav>
  )
}

// ─── Color Swatches ───────────────────────────────────────────
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

// ─── Spacing Bars ─────────────────────────────────────────────
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

// ─── Typography List ──────────────────────────────────────────
function TypographyList({ styles }: { styles: string[] }) {
  if (styles.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {styles.map(s => (
        <span key={s} style={{
          fontFamily: mono,
          fontSize: 12,
          color: T.text,
          background: T.surface2,
          border: `1px solid ${T.border2}`,
          borderRadius: 5,
          padding: '4px 10px',
        }}>
          {s}
        </span>
      ))}
    </div>
  )
}

// ─── Component List ───────────────────────────────────────────
function ComponentList({ components }: { components: Record<string, { allowedVariants: string[]; allowedSizes: string[] }> }) {
  const entries = Object.entries(components)
  if (entries.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {entries.map(([name, def]) => (
        <div key={name} style={{
          background: T.surface2,
          border: `1px solid ${T.border2}`,
          borderRadius: 8,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              fontFamily: syne,
              fontWeight: 700,
              fontSize: 13,
              color: T.text,
              textTransform: 'capitalize',
            }}>
              {name}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {def.allowedVariants.map(v => (
              <span key={v} style={{
                fontFamily: mono,
                fontSize: 11,
                color: T.blue,
                background: T.blueDim,
                border: `1px solid ${T.blue}28`,
                borderRadius: 4,
                padding: '2px 8px',
              }}>
                {v}
              </span>
            ))}
            {def.allowedSizes.map(s => (
              <span key={s} style={{
                fontFamily: mono,
                fontSize: 11,
                color: T.muted,
                background: T.surface,
                border: `1px solid ${T.border2}`,
                borderRadius: 4,
                padding: '2px 8px',
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Grid Visualizer ──────────────────────────────────────────
function GridVisualizer({ columns }: { columns: number[] }) {
  if (columns.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {columns.map(cols => (
        <div key={cols} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: mono,
            fontSize: 11,
            color: T.muted,
            width: 40,
            flexShrink: 0,
          }}>
            {cols} col
          </span>
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 3,
          }}>
            {Array.from({ length: cols }).map((_, i) => (
              <div key={i} style={{
                height: 18,
                background: T.blueDim,
                border: `1px solid ${T.blue}28`,
                borderRadius: 2,
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Warning Banner ───────────────────────────────────────────
function WarningBanner({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 14px',
      background: T.amberDim,
      border: `1px solid ${T.amber}28`,
      borderRadius: 8,
      fontFamily: mono,
      fontSize: 12,
      color: T.amber,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
      <span>{message}</span>
    </div>
  )
}

// ─── Progress Stepper ────────────────────────────────────────────
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

// ─── Section heading ──────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: syne,
      fontWeight: 700,
      fontSize: 13,
      color: T.muted,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      margin: '0 0 12px',
    }}>
      {children}
    </h3>
  )
}

// ─── Confirmation Panel ───────────────────────────────────────
function ConfirmationPanel({
  ds,
  warnings,
  onConfirm,
}: {
  ds: ImportedDesignSystem
  warnings: string[]
  onConfirm: () => void
}) {
  const colorCount = Object.keys(ds.tokens.color).length
  const compCount = Object.keys(ds.components).length

  return (
    <div style={{
      marginTop: 32,
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
        <span style={{ fontSize: 16 }}>✓</span>
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
            {colorCount} color tokens · {ds.tokens.spacing.length} spacing values · {ds.typography.allowedStyles.length} typography styles · {compCount} components
          </div>
        </div>
      </div>

      <div style={{ padding: '20px', background: T.bg, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warnings.map(w => <WarningBanner key={w} message={w} />)}
          </div>
        )}

        {/* Color tokens */}
        {colorCount > 0 && (
          <div>
            <SectionHeading>Color Tokens ({colorCount})</SectionHeading>
            <ColorSwatches colors={ds.tokens.color} />
          </div>
        )}

        {/* Spacing */}
        {ds.tokens.spacing.length > 0 && (
          <div>
            <SectionHeading>Spacing Scale</SectionHeading>
            <SpacingBars scale={ds.tokens.spacing} />
          </div>
        )}

        {/* Typography */}
        {ds.typography.allowedStyles.length > 0 && (
          <div>
            <SectionHeading>Typography Styles</SectionHeading>
            <TypographyList styles={ds.typography.allowedStyles} />
          </div>
        )}

        {/* Components */}
        {compCount > 0 && (
          <div>
            <SectionHeading>Components & Variants</SectionHeading>
            <ComponentList components={ds.components} />
          </div>
        )}

        {/* Layout grid */}
        {ds.layout.allowedGridColumns.length > 0 && (
          <div>
            <SectionHeading>Layout Grid Columns</SectionHeading>
            <GridVisualizer columns={ds.layout.allowedGridColumns} />
          </div>
        )}

        {/* Confirm row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          paddingTop: 8,
          borderTop: `1px solid ${T.border}`,
        }}>
          <span style={{
            fontFamily: mono,
            fontSize: 14,
            color: T.muted,
          }}>
            Looks right?
          </span>
          <button
            onClick={onConfirm}
            style={{
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 600,
              color: '#000',
              background: T.green,
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              cursor: 'pointer',
              letterSpacing: '0.02em',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Add Governance Rules →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function ImportPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'url' | 'paste' | 'sample'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [pasteInput, setPasteInput] = useState('')
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [fetchError, setFetchError] = useState('')
  const [parsed, setParsed] = useState<ImportedDesignSystem | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleParsed(ds: ImportedDesignSystem) {
    setParsed(ds)
    setWarnings(getImportWarnings(ds))
    // Scroll to confirmation panel
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
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const text = await res.text()
      const ds = parseTokenJSON(text, 'url', url)
      setFetchStatus('idle')
      handleParsed(ds)
    } catch (err: unknown) {
      setFetchStatus('error')
      setFetchError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  function handlePasteJson() {
    const text = pasteInput.trim()
    if (!text) return
    setFetchError('')
    setParsed(null)
    try {
      const ds = parseTokenJSON(text, 'paste', 'Pasted JSON')
      handleParsed(ds)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'JSON parse error')
    }
  }

  function handleLoadCarbon() {
    setParsed(null)
    setFetchError('')
    handleParsed(CARBON_SAMPLE)
  }

  function handleConfirm() {
    if (!parsed) return
    saveDesignSystem(parsed)
    router.push('/governance')
  }

  // ── Tab styles helper
  function tabStyle(tab: 'url' | 'paste' | 'sample') {
    const isActive = activeTab === tab
    return {
      fontFamily: mono,
      fontSize: 13,
      color: isActive ? T.text : T.muted,
      background: isActive ? T.surface2 : 'transparent',
      border: `1px solid ${isActive ? T.border2 : 'transparent'}`,
      borderRadius: 7,
      padding: '7px 16px',
      cursor: 'pointer',
      transition: 'color 0.15s, background 0.15s',
      whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      color: T.text,
      fontFamily: mono,
    }}>
      <NavBar menuOpen={mobileMenuOpen} setMenuOpen={setMobileMenuOpen} />

      <main style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}>

        <ProgressStepper current={0} />

        {/* Page heading */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontFamily: syne,
            fontWeight: 700,
            fontSize: 32,
            color: T.text,
            margin: '0 0 10px',
            letterSpacing: '-0.5px',
          }}>
            Import Design System
          </h1>
          <p style={{
            fontFamily: mono,
            fontSize: 14,
            color: T.muted,
            margin: 0,
            lineHeight: 1.6,
          }}>
            Load your token file to generate governance rules automatically.
            Supports JSON, Carbon-compatible formats, or use the IBM Carbon v11 sample.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '6px',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          marginBottom: 28,
          overflowX: 'auto',
        }}>
          <button onClick={() => { setActiveTab('url'); setParsed(null); setFetchError('') }} style={tabStyle('url')}>
            JSON/YAML URL
          </button>
          <button onClick={() => { setActiveTab('paste'); setParsed(null); setFetchError('') }} style={tabStyle('paste')}>
            Paste JSON
          </button>
          <button onClick={() => { setActiveTab('sample'); setParsed(null); setFetchError('') }} style={tabStyle('sample')}>
            Carbon Sample
          </button>
        </div>

        {/* ── PATH A: URL ── */}
        {activeTab === 'url' && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '24px',
          }}>
            <h2 style={{
              fontFamily: syne,
              fontWeight: 700,
              fontSize: 16,
              color: T.text,
              margin: '0 0 6px',
            }}>
              Fetch from URL
            </h2>
            <p style={{
              fontFamily: mono,
              fontSize: 13,
              color: T.muted,
              margin: '0 0 18px',
              lineHeight: 1.5,
            }}>
              Provide a publicly accessible URL to a JSON token file. The URL must support CORS.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                placeholder="https://example.com/tokens.json"
                style={{
                  flex: 1,
                  minWidth: 200,
                  fontFamily: mono,
                  fontSize: 13,
                  color: T.text,
                  background: T.bg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleFetchUrl}
                disabled={fetchStatus === 'loading' || !urlInput.trim()}
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  background: T.blue,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  cursor: fetchStatus === 'loading' || !urlInput.trim() ? 'not-allowed' : 'pointer',
                  opacity: fetchStatus === 'loading' || !urlInput.trim() ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                  transition: 'opacity 0.15s',
                }}
              >
                {fetchStatus === 'loading' ? 'Fetching…' : 'Fetch & Parse'}
              </button>
            </div>

            {fetchStatus === 'error' && fetchError && (
              <div style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 14px',
                background: T.redDim,
                border: `1px solid ${T.red}28`,
                borderRadius: 8,
                fontFamily: mono,
                fontSize: 12,
                color: T.red,
              }}>
                <span style={{ flexShrink: 0 }}>✕</span>
                <span>{fetchError}</span>
              </div>
            )}
          </div>
        )}

        {/* ── PATH B: Paste ── */}
        {activeTab === 'paste' && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '24px',
          }}>
            <h2 style={{
              fontFamily: syne,
              fontWeight: 700,
              fontSize: 16,
              color: T.text,
              margin: '0 0 6px',
            }}>
              Paste JSON
            </h2>
            <p style={{
              fontFamily: mono,
              fontSize: 13,
              color: T.muted,
              margin: '0 0 18px',
              lineHeight: 1.5,
            }}>
              Paste your token JSON directly. Use the same schema as the{' '}
              <a href="/demo" style={{ color: T.blue, textDecoration: 'none' }}>Demo YAML</a>.
            </p>

            <textarea
              value={pasteInput}
              onChange={e => setPasteInput(e.target.value)}
              placeholder={`{\n  "tokens": {\n    "colors": {\n      "primary": "#0055FF"\n    },\n    "spacing": { "scale": [4, 8, 16, 32] }\n  }\n}`}
              rows={14}
              style={{
                width: '100%',
                fontFamily: mono,
                fontSize: 12,
                color: T.text,
                background: T.bg,
                border: `1px solid ${T.border2}`,
                borderRadius: 8,
                padding: '12px 14px',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                lineHeight: 1.6,
              }}
            />

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handlePasteJson}
                disabled={!pasteInput.trim()}
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  background: T.blue,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  cursor: !pasteInput.trim() ? 'not-allowed' : 'pointer',
                  opacity: !pasteInput.trim() ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                Parse
              </button>
            </div>

            {fetchError && activeTab === 'paste' && (
              <div style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 14px',
                background: T.redDim,
                border: `1px solid ${T.red}28`,
                borderRadius: 8,
                fontFamily: mono,
                fontSize: 12,
                color: T.red,
              }}>
                <span style={{ flexShrink: 0 }}>✕</span>
                <span>{fetchError}</span>
              </div>
            )}
          </div>
        )}

        {/* ── PATH C: Carbon Sample ── */}
        {activeTab === 'sample' && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '28px 24px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
              <div>
                <h2 style={{
                  fontFamily: syne,
                  fontWeight: 700,
                  fontSize: 16,
                  color: T.text,
                  margin: '0 0 6px',
                }}>
                  IBM Carbon Design System v11
                </h2>
                <p style={{
                  fontFamily: mono,
                  fontSize: 13,
                  color: T.muted,
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  Load a pre-populated set of Carbon tokens to get started immediately.
                  Includes 22 color tokens, 10 spacing values, 17 typography styles, 6 components, and 4 grid columns.
                </p>
              </div>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {[
                  { label: '22 color tokens', color: T.blue },
                  { label: '10 spacing values', color: T.green },
                  { label: '17 typography styles', color: T.amber },
                  { label: '6 components', color: T.muted },
                  { label: '4 grid columns', color: T.muted },
                ].map(badge => (
                  <span key={badge.label} style={{
                    fontFamily: mono,
                    fontSize: 11,
                    color: badge.color,
                    background: `${badge.color}18`,
                    border: `1px solid ${badge.color}28`,
                    borderRadius: 5,
                    padding: '3px 9px',
                  }}>
                    {badge.label}
                  </span>
                ))}
              </div>

              <div style={{
                padding: '10px 14px',
                background: T.amberDim,
                border: `1px solid ${T.amber}28`,
                borderRadius: 8,
                fontFamily: mono,
                fontSize: 12,
                color: T.amber,
              }}>
                Sample baseline — replace with your system
              </div>

              <button
                onClick={handleLoadCarbon}
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  background: T.blue,
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Load IBM Carbon v11
              </button>
            </div>
          </div>
        )}

        {/* ── Success Banner + Confirmation Panel ── */}
        {parsed && (
          <div id="confirmation-panel">
            {/* Green success banner */}
            <div style={{
              marginTop: 28, marginBottom: 4,
              padding: '16px 20px',
              background: T.greenDim,
              border: `1px solid ${T.green}33`,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#000', fontWeight: 700, fontSize: 16 }}>✓</span>
              </div>
              <div>
                <div style={{ fontFamily: syne, fontWeight: 700, fontSize: 15, color: T.green }}>
                  {parsed.sourceLabel} loaded
                </div>
                <div style={{ fontFamily: mono, fontSize: 12, color: T.green, marginTop: 2 }}>
                  System loaded — {Object.keys(parsed.tokens.color).length + parsed.tokens.spacing.length + parsed.typography.allowedStyles.length + parsed.layout.allowedGridColumns.length} tokens, {Object.keys(parsed.components).length} components
                </div>
              </div>
            </div>
            <ConfirmationPanel ds={parsed} warnings={warnings} onConfirm={handleConfirm} />
          </div>
        )}

      </main>
    </div>
  )
}
