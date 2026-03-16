'use client'

import { useState, useEffect } from 'react'
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

// ─── Confirmation Panel ───────────────────────────────────────
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

// ─── Main Page ────────────────────────────────────────────────
export default function ImportPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'paste' | 'url' | 'sample'>('paste')
  const [urlInput, setUrlInput] = useState('')
  const [pasteInput, setPasteInput] = useState(SAMPLE_JSON)
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [fetchError, setFetchError] = useState('')
  const [parsed, setParsed] = useState<ImportedDesignSystem | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [importSuccess, setImportSuccess] = useState(false)

  // Welcome prompt state
  const [userName, setUserName] = useState('')
  const [userCompany, setUserCompany] = useState('')
  const [savedUser, setSavedUser] = useState<{ name: string; company: string } | null>(null)

  // Existing system
  const [existingSystem, setExistingSystem] = useState<ImportedDesignSystem | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // Load session + existing system on mount
  useEffect(() => {
    const session = loadSession()
    if (session.user) {
      setSavedUser({ name: session.user.name, company: session.user.company })
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

  async function handleSaveUser() {
    const name = userName.trim()
    const company = userCompany.trim()
    if (!name || !company) return
    const session = loadSession()
    const user = { name, company, createdAt: new Date().toISOString() }
    session.user = user
    saveSession(session)
    setSavedUser({ name, company })
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
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const text = await res.text()
      const ds = parseTokenJSON(text, 'url', url)
      setFetchStatus('idle')
      handleParsed(ds)
    } catch (err: unknown) {
      setFetchStatus('error')
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
    try {
      const ds = parseTokenJSON(text, 'paste', 'Pasted JSON')
      handleParsed(ds)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'JSON parse error')
    }
  }

  function handleLoadSample(sample: typeof SAMPLE_SYSTEMS[number]) {
    setParsed(null)
    setFetchError('')
    setImportSuccess(false)
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
    setTimeout(() => {
      document.getElementById('success-banner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  function handleReImport() {
    setExistingSystem(null)
    setParsed(null)
    setImportSuccess(false)
    setFetchError('')
  }

  function tabStyle(tab: 'paste' | 'url' | 'sample') {
    const isActive = activeTab === tab
    return {
      fontFamily: mono,
      fontSize: 13,
      color: isActive ? T.text : T.muted,
      background: isActive ? T.surface2 : 'transparent',
      border: `1px solid ${isActive ? T.border2 : 'transparent'}`,
      borderRadius: 7,
      padding: '7px 16px',
      cursor: 'pointer' as const,
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
      <Stepper />

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
        maxWidth: 800,
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}>

        {/* Welcome prompt or greeting */}
        {!savedUser ? (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '20px 24px',
            marginBottom: 32,
          }}>
            <div style={{
              fontFamily: syne, fontWeight: 700, fontSize: 15,
              color: T.text, marginBottom: 4,
            }}>
              Welcome
            </div>
            <p style={{
              fontFamily: mono, fontSize: 13, color: T.muted,
              margin: '0 0 16px', lineHeight: 1.5,
            }}>
              What&apos;s your name and company? We&apos;ll save your progress.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
                <label style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="Jane Doe"
                  style={{
                    fontFamily: mono, fontSize: 13, color: T.text,
                    background: T.bg, border: `1px solid ${T.border2}`,
                    borderRadius: 8, padding: '9px 12px', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
                <label style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>Company</label>
                <input
                  type="text"
                  value={userCompany}
                  onChange={e => setUserCompany(e.target.value)}
                  placeholder="Acme Corp"
                  onKeyDown={e => e.key === 'Enter' && handleSaveUser()}
                  style={{
                    fontFamily: mono, fontSize: 13, color: T.text,
                    background: T.bg, border: `1px solid ${T.border2}`,
                    borderRadius: 8, padding: '9px 12px', outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={handleSaveUser}
                disabled={!userName.trim() || !userCompany.trim()}
                style={{
                  fontFamily: mono, fontSize: 13, fontWeight: 600,
                  color: '#fff', background: T.blue,
                  border: 'none', borderRadius: 8,
                  padding: '10px 20px', cursor: (!userName.trim() || !userCompany.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (!userName.trim() || !userCompany.trim()) ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            fontFamily: mono, fontSize: 13, color: T.muted,
            marginBottom: 32, padding: '12px 0',
          }}>
            Welcome, <span style={{ color: T.text, fontWeight: 600 }}>{savedUser.name}</span> from <span style={{ color: T.text, fontWeight: 600 }}>{savedUser.company}</span>
          </div>
        )}

        {/* Page heading */}
        <div style={{ marginBottom: 36 }}>
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
            marginBottom: 28,
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
                }}
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
                }}
              >
                Set governance rules &#8594;
              </button>
            </div>
          </div>
        )}

        {/* Tab bar */}
        {(!existingSystem || parsed || importSuccess) && (
          <>
            <div style={{
              display: 'flex', gap: 4, padding: 6,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, marginBottom: 28, overflowX: 'auto',
            }}>
              <button onClick={() => { setActiveTab('paste'); setParsed(null); setFetchError(''); setImportSuccess(false) }} style={tabStyle('paste')}>
                Paste JSON
              </button>
              <button onClick={() => { setActiveTab('url'); setParsed(null); setFetchError(''); setImportSuccess(false) }} style={tabStyle('url')}>
                URL Fetch
              </button>
              <button onClick={() => { setActiveTab('sample'); setParsed(null); setFetchError(''); setImportSuccess(false) }} style={tabStyle('sample')}>
                Sample Systems
              </button>
            </div>

            {/* ── PATH A: Paste JSON ── */}
            {activeTab === 'paste' && !importSuccess && (
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: 24,
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
                  }}
                />

                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
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
                      transition: 'opacity 0.15s',
                    }}
                  >
                    Parse
                  </button>
                </div>

                {fetchError && activeTab === 'paste' && (
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
            {activeTab === 'url' && !importSuccess && (
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: 24,
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
                    }}
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
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {fetchStatus === 'loading' ? 'Fetching...' : 'Fetch & Parse'}
                  </button>
                </div>

                {fetchError && activeTab === 'url' && (
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
            {activeTab === 'sample' && !importSuccess && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: 16,
              }}>
                {SAMPLE_SYSTEMS.map(sample => (
                  <button
                    key={sample.id}
                    onClick={() => handleLoadSample(sample)}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: '20px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.15s, background 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = T.border2
                      e.currentTarget.style.background = T.surface2
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = T.border
                      e.currentTarget.style.background = T.surface
                    }}
                  >
                    <div style={{
                      fontFamily: syne, fontWeight: 700, fontSize: 15,
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
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: mono, fontSize: 11, color: T.blue,
                        background: T.blueDim, border: `1px solid ${T.blue}28`,
                        borderRadius: 5, padding: '3px 9px',
                      }}>
                        {sample.tokens} tokens
                      </span>
                      <span style={{
                        fontFamily: mono, fontSize: 11, color: T.green,
                        background: T.greenDim, border: `1px solid ${T.green}28`,
                        borderRadius: 5, padding: '3px 9px',
                      }}>
                        {sample.components} components
                      </span>
                    </div>
                  </button>
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
                      letterSpacing: '0.02em', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Confirm &amp; Save Import
                  </button>
                </div>
              </div>
            )}

            {/* ── Success State ── */}
            {importSuccess && parsed && (
              <div id="success-banner" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{
                  padding: '20px 24px',
                  background: T.greenDim,
                  border: `1px solid ${T.green}33`,
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: T.green,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ color: '#000', fontWeight: 700, fontSize: 18 }}>&#10003;</span>
                  </div>
                  <div>
                    <div style={{
                      fontFamily: syne, fontWeight: 700, fontSize: 16, color: T.green,
                    }}>
                      Import successful
                    </div>
                    <div style={{
                      fontFamily: mono, fontSize: 13, color: T.green, marginTop: 3, opacity: 0.85,
                    }}>
                      {parsed.sourceLabel} &mdash; {Object.keys(parsed.tokens.color).length + parsed.tokens.spacing.length + parsed.typography.allowedStyles.length + parsed.layout.allowedGridColumns.length} tokens, {Object.keys(parsed.components).length} components saved
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/rules')}
                  style={{
                    fontFamily: mono, fontSize: 15, fontWeight: 700,
                    color: '#000', background: T.green,
                    border: 'none', borderRadius: 10,
                    padding: '16px 32px', cursor: 'pointer',
                    letterSpacing: '0.02em', transition: 'opacity 0.15s',
                    alignSelf: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Set governance rules &#8594;
                </button>
              </div>
            )}
          </>
        )}

      </main>

      <style>{`
        @media (max-width: 600px) {
          main { padding: 32px 16px 60px !important; }
        }
      `}</style>
    </div>
  )
}
