'use client'

import { useState, useEffect, useRef } from 'react'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import { getFixture } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON } from '@/lib/governance'

// ─── Design Tokens ────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────
const ENDPOINT = 'https://muteform-production.up.railway.app'

const DEMO_YAML = `name: "Acme Design System"
version: "1.0.0"
tokens:
  colors:
    primary: "#0055FF"
    neutral900: "#111111"
    success: "#22c55e"
    warning: "#f59e0b"
    accent: "#9ca3af"
  spacing:
    scale: [4, 8, 12, 16, 24, 32, 48, 64]
  typography:
    families:
      display: "Instrument Serif"
      body: "DM Sans"
      mono: "JetBrains Mono"
    allowed_styles: [h1, h2, h3, body, body-sm, caption, label]
  components:
    button:
      allowed_variants: [primary, secondary]
      allowed_sizes: [sm, md, lg]
  layout:
    grid_columns: [4, 8, 12]
rules:
  - id: "color-token-compliance"
    severity: high
    description: "All colors must reference approved design tokens"
    check: "color.value IN tokens.colors.*"
    auto_fix: "snap_nearest_delta_e"
  - id: "spacing-scale-compliance"
    severity: medium
    description: "Spacing values must use the approved scale"
    check: "spacing.value IN tokens.spacing.scale"
    auto_fix: "snap_nearest"
  - id: "contrast-wcag-aa"
    severity: critical
    description: "All text must meet WCAG AA contrast requirements"
    check: "contrast.ratio >= 4.5"
    auto_fix: "adjust_foreground"
  - id: "typography-style-compliance"
    severity: high
    description: "Typography styles must be from approved list"
    check: "typography.style IN tokens.typography.allowed_styles"
    auto_fix: "snap_nearest_category"
  - id: "component-variant-compliance"
    severity: critical
    description: "Component variants must be from approved list"
    check: "component.variant IN tokens.components.*.allowed_variants"
    auto_fix: "snap_nearest_category"
  - id: "layout-grid-compliance"
    severity: medium
    description: "Grid columns must use approved column counts"
    check: "layout.columns IN tokens.layout.grid_columns"
    auto_fix: false`

// ─── Types ────────────────────────────────────────────────────
interface LogEntry {
  id: string
  timestamp: string
  source: string
  violations: number
  fixed: number
  score: number
  report: string
  expanded: boolean
}

// ─── Helpers ──────────────────────────────────────────────────
function randomKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return 'mf_live_' + result
}

function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Page ─────────────────────────────────────────────────────
export default function IntegratePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [apiKey] = useState(randomKey)
  const [masked, setMasked] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  // Connection status
  const [connStatus, setConnStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  // Live test
  const fixture = getFixture('onboarding')
  const [artifactInput, setArtifactInput] = useState(
    () => JSON.stringify(fixture?.artifact ?? {}, null, 2)
  )
  const [liveResult, setLiveResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  // Log
  const [log, setLog] = useState<LogEntry[]>([])

  // Check connection on mount
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    fetch(ENDPOINT, { signal: controller.signal, mode: 'no-cors' })
      .then(() => setConnStatus('connected'))
      .catch(() => setConnStatus('disconnected'))
      .finally(() => clearTimeout(timeout))
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const claudeSnippet = `Add to CLAUDE.md

Before generating any UI component:
POST ${ENDPOINT}/v1/validate
Headers: x-muteform-token: ${apiKey}
Body: { artifact: <generated-component> }

Apply all patches from the response before completing the task.`

  const handleRunTest = async () => {
    setRunning(true)
    setRunError(null)
    setLiveResult(null)
    try {
      const artifact = JSON.parse(artifactInput)
      const config = loadConfig(DEMO_YAML)
      const scanResult = scanArtifact(artifact, config)
      const rewriteResult = rewriteArtifact(artifact, scanResult.violations, config)
      const report = buildGovernanceReport(
        fixture?.name ?? 'Custom Artifact',
        fixture?.source ?? 'live-test',
        artifact,
        scanResult,
        rewriteResult,
        config,
      )
      const json = reportToJSON(report)
      setLiveResult(json)

      const entry: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source: 'live-test',
        violations: report.violations.length,
        fixed: report.autoFixedCount,
        score: report.afterScore,
        report: json,
        expanded: false,
      }
      setLog(prev => [entry, ...prev])
    } catch (e: any) {
      setRunError(e?.message ?? 'Parse error — check your JSON')
    } finally {
      setRunning(false)
    }
  }

  const toggleRow = (id: string) => {
    setLog(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e))
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: mono }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
      }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: T.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: '#fff' }}>M</span>
          </div>
          <span style={{ fontFamily: syne, fontSize: 15, fontWeight: 700, color: T.text }}>muteform</span>
        </a>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} className="nav-desktop">
          {[
            { label: 'Import', href: '/import' },
            { label: 'Demo', href: '/demo' },
            { label: 'Playground', href: '/playground' },
            { label: 'Governance', href: '/governance' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              fontFamily: mono, fontSize: 11, color: T.muted,
              padding: '5px 12px', borderRadius: 6, textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>{link.label}</a>
          ))}
          <a href="/integrate" style={{
            fontFamily: mono, fontSize: 11, color: T.green,
            padding: '5px 12px', borderRadius: 6, textDecoration: 'none',
            letterSpacing: '0.04em',
            background: T.greenDim, border: `1px solid ${T.green}33`,
          }}>Integrate</a>
        </div>

        {/* Hamburger */}
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
      </nav>

      {/* Mobile menu */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        {[
          { label: 'Import', href: '/import' },
          { label: 'Demo', href: '/demo' },
          { label: 'Playground', href: '/playground' },
          { label: 'Governance', href: '/governance' },
          { label: 'Integrate', href: '/integrate', active: true },
        ].map(link => (
          <a key={link.href} href={link.href} style={{
            fontFamily: mono, color: link.active ? T.green : T.text,
          }}>{link.label}</a>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 100px' }}>

        {/* Page heading */}
        <h1 style={{ fontFamily: syne, fontSize: 28, fontWeight: 700, color: T.text, margin: '0 0 6px' }}>
          MCP Runtime Console
        </h1>
        <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, margin: '0 0 36px', lineHeight: 1.6 }}>
          Connect Claude Code to the Muteform validation engine. Every generated component is scanned and patched before delivery.
        </p>

        {/* ── Section 1: Connection Status ── */}
        <Section label="01" title="Connection Status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Status row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              background: connStatus === 'connected' ? T.greenDim : connStatus === 'disconnected' ? T.redDim : T.surface2,
              border: `1px solid ${connStatus === 'connected' ? T.green + '33' : connStatus === 'disconnected' ? T.red + '33' : T.border}`,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: connStatus === 'connected' ? T.green : connStatus === 'disconnected' ? T.red : T.amber,
                  boxShadow: connStatus === 'connected' ? `0 0 8px ${T.green}` : connStatus === 'disconnected' ? `0 0 8px ${T.red}` : `0 0 8px ${T.amber}`,
                }} />
                <span style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                  {connStatus === 'connected' ? 'MCP Active' : connStatus === 'disconnected' ? 'Not connected' : 'Checking…'}
                </span>
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>{ENDPOINT}</span>
            </div>

            {/* API Token */}
            <div style={{
              padding: '14px 18px', background: T.surface2,
              border: `1px solid ${T.border}`, borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: syne, fontSize: 12, fontWeight: 700, color: T.text, letterSpacing: '0.08em' }}>
                  API TOKEN
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <SmallButton onClick={() => setMasked(!masked)} label={masked ? 'REVEAL' : 'HIDE'} />
                  <SmallButton
                    onClick={() => copyText(apiKey, 'key')}
                    label={copied === 'key' ? 'COPIED ✓' : 'COPY'}
                    active={copied === 'key'}
                    activeColor={T.green}
                  />
                </div>
              </div>
              <div style={{
                fontFamily: mono, fontSize: 12, color: T.text,
                padding: '8px 12px', background: T.bg,
                borderRadius: 6, border: `1px solid ${T.border}`,
                letterSpacing: '0.04em', wordBreak: 'break-all',
              }}>
                {masked ? `${apiKey.substring(0, 12)}${'•'.repeat(28)}` : apiKey}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Claude Code Snippet ── */}
        <Section label="02" title="Claude Code Snippet">
          <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, margin: '0 0 12px', lineHeight: 1.6 }}>
            Add this to <code style={{ color: T.blue, background: T.blueDim, padding: '1px 5px', borderRadius: 3 }}>CLAUDE.md</code> in your project root. Claude Code will call the endpoint before finalizing any UI component.
          </p>
          <CodeBlock
            code={claudeSnippet}
            copyId="snippet"
            copied={copied}
            onCopy={copyText}
            filename="CLAUDE.md"
          />
        </Section>

        {/* ── Section 3: Runtime Log ── */}
        <Section label="03" title="Runtime Log">
          {log.length === 0 ? (
            <div style={{
              padding: '28px 20px', textAlign: 'center',
              background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: 8,
            }}>
              <div style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: T.amber, marginBottom: 12,
                boxShadow: `0 0 8px ${T.amber}`,
              }} />
              <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, margin: '0 0 6px' }}>
                Waiting for first MCP call…
              </p>
              <p style={{ fontFamily: mono, fontSize: 11, color: T.dim, margin: 0 }}>
                Add the snippet above to CLAUDE.md to begin
              </p>
            </div>
          ) : (
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 80px 60px 70px',
                padding: '8px 16px',
                background: T.surface2,
                borderBottom: `1px solid ${T.border}`,
              }}>
                {['Timestamp', 'Source', 'Violations', 'Fixed', 'Score'].map(h => (
                  <span key={h} style={{ fontFamily: mono, fontSize: 9, color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {log.map((entry, idx) => (
                <div key={entry.id}>
                  <div
                    onClick={() => toggleRow(entry.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr 80px 60px 70px',
                      padding: '10px 16px',
                      borderBottom: idx < log.length - 1 || entry.expanded ? `1px solid ${T.border}` : 'none',
                      cursor: 'pointer',
                      background: entry.expanded ? T.surface2 : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontFamily: mono, fontSize: 11, color: T.muted }}>{fmtTs(entry.timestamp)}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: T.text }}>{entry.source}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: entry.violations > 0 ? T.amber : T.green }}>{entry.violations}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>{entry.fixed}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: entry.score >= 80 ? T.green : entry.score >= 50 ? T.amber : T.red }}>
                      {entry.score}
                    </span>
                  </div>
                  {entry.expanded && (
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: idx < log.length - 1 ? `1px solid ${T.border}` : 'none',
                      background: T.bg,
                    }}>
                      <pre style={{
                        fontFamily: mono, fontSize: 10, color: T.muted,
                        overflowX: 'auto', margin: 0, lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      }}>
                        {entry.report}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Section 4: Live Test ── */}
        <Section label="04" title="Live Test">
          <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, margin: '0 0 12px', lineHeight: 1.6 }}>
            Paste an artifact JSON and run it through the engine locally. The raw JSON response below is exactly what Claude Code receives.
          </p>

          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: T.dim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Artifact JSON
              </span>
              <span style={{ fontFamily: mono, fontSize: 10, color: T.muted }}>
                Pre-filled: Onboarding Flow (Cursor AI output)
              </span>
            </div>
            <textarea
              value={artifactInput}
              onChange={e => setArtifactInput(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 180,
                fontFamily: mono, fontSize: 11, color: T.text,
                background: T.surface2, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: '12px 14px',
                resize: 'vertical', outline: 'none', lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {runError && (
            <div style={{
              marginBottom: 12, padding: '10px 14px',
              background: T.redDim, border: `1px solid ${T.red}33`,
              borderRadius: 6, fontFamily: mono, fontSize: 11, color: T.red,
            }}>
              {runError}
            </div>
          )}

          <button
            onClick={handleRunTest}
            disabled={running}
            style={{
              width: '100%', padding: '12px 0',
              fontFamily: syne, fontSize: 13, fontWeight: 700,
              letterSpacing: '0.08em', color: '#fff',
              background: running ? T.dim : T.blue,
              border: 'none', borderRadius: 8, cursor: running ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {running ? 'RUNNING…' : 'VALIDATE NOW'}
          </button>

          {liveResult && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: T.green, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Raw JSON Response
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>
                    This is what Claude Code receives
                  </span>
                  <SmallButton
                    onClick={() => copyText(liveResult, 'result')}
                    label={copied === 'result' ? 'COPIED ✓' : 'COPY'}
                    active={copied === 'result'}
                    activeColor={T.green}
                  />
                </div>
              </div>
              <div style={{
                background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 8, overflow: 'hidden',
              }}>
                <pre style={{
                  padding: '14px 16px', fontFamily: mono, fontSize: 10,
                  color: T.muted, overflowX: 'auto', margin: 0, lineHeight: 1.7,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  maxHeight: 400, overflowY: 'auto',
                }}>
                  {liveResult}
                </pre>
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.blue, letterSpacing: '0.1em' }}>{label}</span>
        <h2 style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
      {children}
    </div>
  )
}

function SmallButton({
  onClick, label, active = false, activeColor = T.blue,
}: {
  onClick: () => void
  label: string
  active?: boolean
  activeColor?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: mono, fontSize: 9, padding: '3px 9px', borderRadius: 4,
        background: active ? `${activeColor}18` : T.surface2,
        color: active ? activeColor : T.muted,
        border: `1px solid ${active ? activeColor + '33' : T.border}`,
        cursor: 'pointer', letterSpacing: '0.06em',
      }}
    >
      {label}
    </button>
  )
}

function CodeBlock({
  code, copyId, copied, onCopy, filename,
}: {
  code: string
  copyId: string
  copied: string | null
  onCopy: (text: string, id: string) => void
  filename?: string
}) {
  return (
    <div style={{
      background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
        background: T.surface2,
      }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>{filename ?? 'snippet'}</span>
        <SmallButton
          onClick={() => onCopy(code, copyId)}
          label={copied === copyId ? 'COPIED ✓' : 'COPY'}
          active={copied === copyId}
          activeColor={T.green}
        />
      </div>
      <pre style={{
        padding: '14px 16px', fontFamily: mono, fontSize: 11,
        color: T.text, overflowX: 'auto', margin: 0, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>
        {code}
      </pre>
    </div>
  )
}
