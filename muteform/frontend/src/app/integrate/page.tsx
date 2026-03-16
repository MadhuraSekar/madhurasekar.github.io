'use client'

import { useState, useEffect } from 'react'
import Stepper from '@/components/Stepper'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'
import { getFixture } from '@/lib/fixtures'
import { buildGovernanceReport, reportToJSON } from '@/lib/governance'
import { getOrCreateMcpToken, loadSession, syncMcpToken } from '@/lib/session'

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
const ENDPOINT = 'https://madhurasekar-github-io.vercel.app'

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
function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Glow keyframes (injected once) ──────────────────────────
const glowKeyframes = `
@keyframes glow-green {
  0%, 100% { box-shadow: 0 0 6px ${T.green}88; }
  50% { box-shadow: 0 0 14px ${T.green}cc; }
}
@keyframes glow-amber {
  0%, 100% { box-shadow: 0 0 6px ${T.amber}88; }
  50% { box-shadow: 0 0 14px ${T.amber}cc; }
}
@keyframes pulse-amber {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

// ─── Page ─────────────────────────────────────────────────────
export default function IntegratePage() {
  const [apiKey] = useState(() => getOrCreateMcpToken())
  const [masked, setMasked] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [jsonCollapsed, setJsonCollapsed] = useState(true)

  // Sync token to Supabase on mount
  useEffect(() => {
    const session = loadSession()
    syncMcpToken(session.user?.id ?? null, apiKey)
  }, [apiKey])

  // Live test
  const fixture = getFixture('onboarding')
  const [artifactInput, setArtifactInput] = useState(
    () => JSON.stringify(fixture?.artifact ?? {}, null, 2)
  )
  const [liveResult, setLiveResult] = useState<string | null>(null)
  const [liveReport, setLiveReport] = useState<{ score: number; violations: number; fixed: number } | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  // Log
  const [log, setLog] = useState<LogEntry[]>([])

  // Steps completion tracking
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const claudeSnippet = `## Design Governance

Before completing any UI task:
POST the generated code to:
${ENDPOINT}/api/validate
x-muteform-token: ${apiKey}

Apply every patch in the response.
Only return code where health_score >= 85.`

  const handleRunTest = async () => {
    setRunning(true)
    setRunError(null)
    setLiveResult(null)
    setLiveReport(null)
    setJsonCollapsed(true)
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
      setLiveReport({
        score: rewriteResult.afterScore,
        violations: report.violations.length,
        fixed: report.autoFixedCount,
      })

      const entry: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source: 'live-test',
        violations: report.violations.length,
        fixed: report.autoFixedCount,
        score: rewriteResult.afterScore,
        report: json,
        expanded: false,
      }
      setLog(prev => [entry, ...prev])
    } catch (e: any) {
      setRunError(e?.message ? `Parse error — ${e.message}` : 'Parse error — check your JSON')
    } finally {
      setRunning(false)
    }
  }

  const toggleRow = (id: string) => {
    setLog(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e))
  }

  const markStepComplete = (step: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      next.add(step)
      return next
    })
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: mono }}>
      <style dangerouslySetInnerHTML={{ __html: glowKeyframes }} />
      <Stepper />

      {/* ── Content ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 100px' }}>

        {/* Page heading */}
        <h1 style={{ fontFamily: syne, fontSize: 28, fontWeight: 700, color: T.text, margin: '0 0 6px' }}>
          MCP Runtime Console
        </h1>
        <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, margin: '0 0 40px', lineHeight: 1.6, maxWidth: 600 }}>
          Connect Claude Code to the Muteform validation engine. Every generated component is scanned and patched before delivery.
        </p>

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION A — YOUR ENDPOINT                            */}
        {/* ══════════════════════════════════════════════════════ */}
        <Section label="01" title="Your Endpoint">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Status indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px',
              background: T.greenDim, border: `1px solid ${T.green}33`,
              borderRadius: 8,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: T.green,
                animation: 'glow-green 2s ease-in-out infinite',
              }} />
              <span style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                Your governance endpoint is live.
              </span>
            </div>

            {/* Endpoint URL display */}
            <div style={{
              padding: '16px 18px', background: T.surface2,
              border: `1px solid ${T.border}`, borderRadius: 8,
            }}>
              <div style={{
                fontFamily: mono, fontSize: 12, color: T.muted, marginBottom: 6,
                letterSpacing: '0.02em',
              }}>
                Endpoint
              </div>
              <div style={{
                fontFamily: mono, fontSize: 13, color: T.text,
                padding: '10px 14px', background: T.bg,
                borderRadius: 6, border: `1px solid ${T.border}`,
                lineHeight: 1.8, marginBottom: 12,
              }}>
                <span style={{ color: T.green }}>POST</span>{' '}
                <span style={{ color: T.text }}>{ENDPOINT}/api/validate</span>
                <br />
                <span style={{ color: T.muted }}>x-muteform-token:</span>{' '}
                <span style={{ color: T.amber }}>{masked ? `${apiKey.substring(0, 12)}${'*'.repeat(20)}` : apiKey}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SmallButton
                  onClick={() => copyText(`${ENDPOINT}/api/validate`, 'endpoint')}
                  label={copied === 'endpoint' ? 'COPIED \u2713' : 'COPY ENDPOINT'}
                  active={copied === 'endpoint'}
                  activeColor={T.green}
                />
                <SmallButton
                  onClick={() => copyText(apiKey, 'token')}
                  label={copied === 'token' ? 'COPIED \u2713' : 'COPY TOKEN'}
                  active={copied === 'token'}
                  activeColor={T.green}
                />
                <SmallButton
                  onClick={() => setMasked(!masked)}
                  label={masked ? 'REVEAL TOKEN' : 'HIDE TOKEN'}
                />
              </div>
            </div>

            {/* API Token card */}
            <div style={{
              padding: '14px 18px', background: T.surface2,
              border: `1px solid ${T.border}`, borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: syne, fontSize: 12, fontWeight: 700, color: T.text, letterSpacing: '0.08em' }}>
                  API TOKEN
                </span>
                <SmallButton
                  onClick={() => copyText(apiKey, 'key')}
                  label={copied === 'key' ? 'COPIED \u2713' : 'COPY'}
                  active={copied === 'key'}
                  activeColor={T.green}
                />
              </div>
              <div style={{
                fontFamily: mono, fontSize: 12, color: T.text,
                padding: '8px 12px', background: T.bg,
                borderRadius: 6, border: `1px solid ${T.border}`,
                letterSpacing: '0.04em', wordBreak: 'break-all',
              }}>
                {masked ? `${apiKey.substring(0, 12)}${'*'.repeat(28)}` : apiKey}
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION B — CONNECT CLAUDE CODE                      */}
        {/* ══════════════════════════════════════════════════════ */}
        <Section label="02" title="Connect Claude Code">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Step 1 */}
            <StepRow
              num={1}
              completed={completedSteps.has(1)}
              onComplete={() => markStepComplete(1)}
            >
              <span style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                Open your project in Claude Code.
              </span>
            </StepRow>

            {/* Step 2 */}
            <StepRow
              num={2}
              completed={completedSteps.has(2)}
              onComplete={() => markStepComplete(2)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                  Create or open{' '}
                  <code style={{ color: T.blue, background: T.blueDim, padding: '1px 6px', borderRadius: 3, fontSize: 12 }}>
                    CLAUDE.md
                  </code>{' '}
                  in your project root.
                </span>
              </div>
            </StepRow>

            {/* Step 3 */}
            <StepRow
              num={3}
              completed={completedSteps.has(3)}
              onComplete={() => markStepComplete(3)}
              last={false}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                <span style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                  Paste this at the top:
                </span>
                <CodeBlock
                  code={claudeSnippet}
                  copyId="snippet"
                  copied={copied}
                  onCopy={(text, id) => {
                    copyText(text, id)
                    markStepComplete(3)
                  }}
                  filename="CLAUDE.md"
                  copyLabel="COPY SNIPPET"
                  copyActiveColor={T.green}
                />
              </div>
            </StepRow>

            {/* Step 4 */}
            <StepRow
              num={4}
              completed={completedSteps.has(4)}
              onComplete={() => markStepComplete(4)}
            >
              <span style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                Generate any UI component.
              </span>
            </StepRow>

            {/* Step 5 */}
            <StepRow
              num={5}
              completed={completedSteps.has(5)}
              onComplete={() => markStepComplete(5)}
              last
            >
              <span style={{ fontFamily: mono, fontSize: 13, color: T.text }}>
                Come back here to see it governed.
              </span>
            </StepRow>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION C — LIVE CALL LOG                            */}
        {/* ══════════════════════════════════════════════════════ */}
        <Section label="03" title="Live Call Log">
          {log.length === 0 ? (
            <div style={{
              padding: '36px 20px', textAlign: 'center',
              background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: 8,
            }}>
              <div style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: T.amber, marginBottom: 14,
                animation: 'pulse-amber 2s ease-in-out infinite',
                boxShadow: `0 0 8px ${T.amber}`,
              }} />
              <p style={{ fontFamily: mono, fontSize: 13, color: T.muted, margin: '0 0 8px' }}>
                No calls yet.
              </p>
              <p style={{ fontFamily: mono, fontSize: 11, color: T.dim, margin: 0, lineHeight: 1.6 }}>
                Add the snippet to CLAUDE.md and generate your first component.
              </p>
            </div>
          ) : (
            <div style={{
              border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden',
              overflowX: 'auto',
            }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 90px 70px 70px',
                minWidth: 480,
                padding: '10px 16px',
                background: T.surface2,
                borderBottom: `1px solid ${T.border}`,
              }}>
                {['Time', 'Source', 'Violations', 'Fixed', 'Score'].map(h => (
                  <span key={h} style={{
                    fontFamily: mono, fontSize: 9, color: T.dim,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {log.map((entry, idx) => (
                <div key={entry.id}>
                  <div
                    onClick={() => toggleRow(entry.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.surface2 }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = entry.expanded ? T.surface2 : 'transparent' }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 90px 70px 70px',
                      minWidth: 480,
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
                    <span style={{
                      fontFamily: mono, fontSize: 11,
                      color: entry.score >= 80 ? T.green : entry.score >= 50 ? T.amber : T.red,
                    }}>
                      {entry.score}
                    </span>
                  </div>
                  {entry.expanded && (
                    <div style={{
                      padding: '14px 16px',
                      borderBottom: idx < log.length - 1 ? `1px solid ${T.border}` : 'none',
                      background: T.bg,
                      transition: 'all 0.2s ease',
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

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION D — LIVE TEST                                */}
        {/* ══════════════════════════════════════════════════════ */}
        <Section label="04" title="Live Test">
          <p style={{ fontFamily: mono, fontSize: 11, color: T.muted, margin: '0 0 14px', lineHeight: 1.6 }}>
            Paste an artifact JSON and run it through the engine locally. The raw JSON response below is exactly what Claude Code receives.
          </p>

          <div style={{ marginBottom: 14 }}>
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
              marginBottom: 14, padding: '12px 14px',
              background: T.redDim, border: `1px solid ${T.red}33`,
              borderRadius: 6, fontFamily: mono, fontSize: 12, color: T.red,
              lineHeight: 1.5,
            }}>
              {runError}
            </div>
          )}

          <button
            onClick={handleRunTest}
            disabled={running}
            onMouseEnter={e => {
              if (!running) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
            }}
            style={{
              width: '100%', padding: '14px 0',
              fontFamily: syne, fontSize: 14, fontWeight: 700,
              letterSpacing: '0.08em', color: '#fff',
              background: running ? T.dim : T.blue,
              border: 'none', borderRadius: 8, cursor: running ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {running ? 'RUNNING...' : 'TEST GOVERNANCE NOW'}
          </button>

          {/* Summary stat cards */}
          {liveReport && (
            <div style={{ marginTop: 18 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16,
              }}>
                <StatCard value={liveReport.score} label="HEALTH SCORE" color={T.green} bg={T.greenDim} />
                <StatCard value={liveReport.violations} label="VIOLATIONS" color={T.amber} bg={T.amberDim} />
                <StatCard value={liveReport.fixed} label="AUTO-FIXED" color={T.blue} bg={T.blueDim} />
              </div>

              <a
                href="/report"
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.02)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)' }}
                style={{
                  display: 'block', textAlign: 'center',
                  fontFamily: syne, fontSize: 13, fontWeight: 700,
                  color: '#000', background: T.green,
                  padding: '14px 0', borderRadius: 8,
                  textDecoration: 'none', letterSpacing: '0.02em',
                  transition: 'all 0.15s ease',
                }}
              >
                View Full Report &rarr;
              </a>
            </div>
          )}

          {/* Raw JSON response (collapsible) */}
          {liveResult && (
            <div style={{ marginTop: 16 }}>
              <div
                onClick={() => setJsonCollapsed(!jsonCollapsed)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: T.surface2, border: `1px solid ${T.border}`,
                  borderRadius: jsonCollapsed ? 8 : '8px 8px 0 0',
                  cursor: 'pointer',
                  transition: 'border-radius 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: mono, fontSize: 10, color: T.green,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Raw JSON Response
                  </span>
                  <span style={{
                    fontFamily: mono, fontSize: 10, color: T.dim,
                    transform: jsonCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 0.15s',
                    display: 'inline-block',
                  }}>
                    &#9654;
                  </span>
                </div>
                <SmallButton
                  onClick={(e?: React.MouseEvent) => {
                    if (e) e.stopPropagation()
                    copyText(liveResult, 'result')
                  }}
                  label={copied === 'result' ? 'COPIED \u2713' : 'COPY'}
                  active={copied === 'result'}
                  activeColor={T.green}
                />
              </div>
              {!jsonCollapsed && (
                <div style={{
                  background: T.bg, border: `1px solid ${T.border}`,
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px', overflow: 'hidden',
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
              )}
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
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
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
  onClick: (e?: React.MouseEvent) => void
  label: string
  active?: boolean
  activeColor?: string
}) {
  return (
    <button
      onClick={(e) => onClick(e)}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      style={{
        fontFamily: mono, fontSize: 9, padding: '4px 10px', borderRadius: 4,
        background: active ? `${activeColor}18` : T.surface2,
        color: active ? activeColor : T.muted,
        border: `1px solid ${active ? activeColor + '33' : T.border}`,
        cursor: 'pointer', letterSpacing: '0.06em',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}

function CodeBlock({
  code, copyId, copied, onCopy, filename, copyLabel, copyActiveColor,
}: {
  code: string
  copyId: string
  copied: string | null
  onCopy: (text: string, id: string) => void
  filename?: string
  copyLabel?: string
  copyActiveColor?: string
}) {
  const isCopied = copied === copyId
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
          label={isCopied ? 'COPIED \u2713' : (copyLabel ?? 'COPY')}
          active={isCopied}
          activeColor={copyActiveColor ?? T.green}
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

function StepRow({
  num, completed, onComplete, children, last = false,
}: {
  num: number
  completed: boolean
  onComplete: () => void
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div style={{
      display: 'flex', gap: 16, position: 'relative',
      paddingBottom: last ? 0 : 24,
    }}>
      {/* Vertical connector line */}
      {!last && (
        <div style={{
          position: 'absolute', left: 15, top: 32, bottom: 0,
          width: 1, background: T.border,
        }} />
      )}

      {/* Step number circle */}
      <div
        onClick={onComplete}
        style={{
          width: 30, height: 30, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          background: completed ? T.greenDim : T.surface2,
          border: `1px solid ${completed ? T.green + '44' : T.border}`,
          fontFamily: mono, fontSize: 12, fontWeight: 700,
          color: completed ? T.green : T.muted,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {completed ? '\u2713' : num}
      </div>

      {/* Step content */}
      <div style={{ paddingTop: 5, flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}

function StatCard({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <div style={{
      padding: '16px 14px', textAlign: 'center',
      background: bg, border: `1px solid ${color}33`, borderRadius: 8,
    }}>
      <div style={{ fontFamily: syne, fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color, letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
    </div>
  )
}
