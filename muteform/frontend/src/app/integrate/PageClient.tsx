'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { getFixture } from '@/lib/fixtures'
import { getOrCreateMcpToken, loadSession, syncMcpToken } from '@/lib/session'

// ─── Constants ────────────────────────────────────────────────
const ENDPOINT = 'https://madhurasekar-github-io.vercel.app'

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

// ─── Keyframes (injected once) ───────────────────────────────
const glowKeyframes = `
@keyframes glow-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
@keyframes pulse-amber {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes fadeInSection {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
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
      const payload = JSON.parse(artifactInput)

      // Call the real /api/validate endpoint
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-muteform-token': apiKey,
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setRunError(`API ${res.status} \u2014 ${json.error || 'Unknown error'}`)
        return
      }

      const formatted = JSON.stringify(json, null, 2)
      setLiveResult(formatted)
      setLiveReport({
        score: json.health_score ?? 0,
        violations: json.summary?.violations_total ?? json.violations?.length ?? 0,
        fixed: json.summary?.auto_fixed ?? json.patches?.length ?? 0,
      })

      const entry: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source: 'live-test',
        violations: json.summary?.violations_total ?? json.violations?.length ?? 0,
        fixed: json.summary?.auto_fixed ?? json.patches?.length ?? 0,
        score: json.health_score ?? 0,
        report: formatted,
        expanded: false,
      }
      setLog(prev => [entry, ...prev])
    } catch (e: any) {
      setRunError(e?.message ? `Error \u2014 ${e.message}` : 'Error \u2014 check your JSON and try again')
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
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
    }}>
      <style dangerouslySetInnerHTML={{ __html: glowKeyframes }} />
      <Header />

      {/* ── Content ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 100px' }}>

        {/* Page heading */}
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700,
          color: 'var(--text-primary)', margin: '0 0 6px',
        }}>
          MCP Integration
        </h1>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)',
          margin: '0 0 40px', lineHeight: 1.6, maxWidth: 600,
        }}>
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
              background: 'var(--success-dim)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
              borderRadius: 6,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--success)',
                animation: 'glow-green 2s ease-in-out infinite',
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                Endpoint active
              </span>
            </div>

            {/* Endpoint URL display */}
            <div style={{
              padding: '16px 18px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 6,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6,
                letterSpacing: '0.02em',
              }}>
                Endpoint
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)',
                padding: '10px 14px', background: 'var(--code-bg)',
                borderRadius: 6, border: '1px solid var(--border)',
                lineHeight: 1.8, marginBottom: 12,
              }}>
                <span style={{ color: 'var(--success)' }}>POST</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>{ENDPOINT}/api/validate</span>
                <br />
                <span style={{ color: 'var(--text-muted)' }}>x-muteform-token:</span>{' '}
                <span style={{ color: 'var(--warning)' }}>{masked ? `${apiKey.substring(0, 12)}${'*'.repeat(20)}` : apiKey}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SmallButton
                  onClick={() => copyText(`${ENDPOINT}/api/validate`, 'endpoint')}
                  label={copied === 'endpoint' ? 'COPIED \u2713' : 'COPY ENDPOINT'}
                  active={copied === 'endpoint'}
                />
                <SmallButton
                  onClick={() => copyText(apiKey, 'token')}
                  label={copied === 'token' ? 'COPIED \u2713' : 'COPY TOKEN'}
                  active={copied === 'token'}
                />
                <SmallButton
                  onClick={() => setMasked(!masked)}
                  label={masked ? 'REVEAL TOKEN' : 'HIDE TOKEN'}
                />
              </div>
            </div>

            {/* API Token card */}
            <div style={{
              padding: '14px 18px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  color: 'var(--text-muted)', letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  API Token
                </span>
                <SmallButton
                  onClick={() => copyText(apiKey, 'key')}
                  label={copied === 'key' ? 'COPIED \u2713' : 'COPY'}
                  active={copied === 'key'}
                />
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)',
                padding: '8px 12px', background: 'var(--code-bg)',
                borderRadius: 6, border: '1px solid var(--border)',
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                  Create or open{' '}
                  <code style={{
                    color: 'var(--accent)', background: 'var(--accent-dim)',
                    padding: '1px 6px', borderRadius: 3, fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                  }}>
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
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
                />
              </div>
            </StepRow>

            {/* Step 4 */}
            <StepRow
              num={4}
              completed={completedSteps.has(4)}
              onComplete={() => markStepComplete(4)}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
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
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 6,
            }}>
              <div style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: 'var(--warning)', marginBottom: 14,
                animation: 'pulse-amber 2s ease-in-out infinite',
              }} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                No calls yet.
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                Add the snippet to CLAUDE.md and generate your first component.
              </p>
            </div>
          ) : (
            <div style={{
              border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 90px 70px 70px',
                minWidth: 480,
                padding: '10px 16px',
                background: 'var(--surface-elevated)',
                borderBottom: '1px solid var(--border)',
              }}>
                {['Time', 'Source', 'Violations', 'Fixed', 'Score'].map(h => (
                  <span key={h} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
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
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-elevated)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = entry.expanded ? 'var(--surface-elevated)' : 'transparent' }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 90px 70px 70px',
                      minWidth: 480,
                      padding: '10px 16px',
                      borderBottom: idx < log.length - 1 || entry.expanded ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      background: entry.expanded ? 'var(--surface-elevated)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{fmtTs(entry.timestamp)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{entry.source}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: entry.violations > 0 ? 'var(--warning)' : 'var(--success)' }}>{entry.violations}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--success)' }}>{entry.fixed}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: entry.score >= 80 ? 'var(--success)' : entry.score >= 50 ? 'var(--warning)' : 'var(--error)',
                    }}>
                      {entry.score}
                    </span>
                  </div>
                  {entry.expanded && (
                    <div style={{
                      padding: '14px 16px',
                      borderBottom: idx < log.length - 1 ? '1px solid var(--border)' : 'none',
                      background: 'var(--code-bg)',
                      transition: 'all 0.2s ease',
                    }}>
                      <pre style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
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
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)',
            margin: '0 0 14px', lineHeight: 1.6,
          }}>
            Paste an artifact JSON and call the real /api/validate endpoint. The raw JSON response below is exactly what Claude Code receives.
          </p>

          <div style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Artifact JSON
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                Pre-filled: Onboarding Flow (Cursor AI output)
              </span>
            </div>
            <textarea
              value={artifactInput}
              onChange={e => setArtifactInput(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 180,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '12px 14px',
                resize: 'vertical', outline: 'none', lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {runError && (
            <div style={{
              marginBottom: 14, padding: '12px 14px',
              background: 'var(--error-dim)', border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
              borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--error)',
              lineHeight: 1.5,
            }}>
              {runError}
            </div>
          )}

          <button
            onClick={handleRunTest}
            disabled={running}
            onMouseEnter={e => {
              if (!running) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'
            }}
            onMouseLeave={e => {
              if (!running) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
            }}
            style={{
              width: '100%', padding: '14px 0',
              fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700,
              letterSpacing: '0.04em', color: 'var(--bg)',
              background: running ? 'var(--text-muted)' : 'var(--accent)',
              border: 'none', borderRadius: 6, cursor: running ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {running ? 'Running...' : 'Test Governance'}
          </button>

          {/* Summary stat cards */}
          {liveReport && (
            <div style={{ marginTop: 18 }}>
              <div className="grid-3" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16,
              }}>
                <StatCard value={liveReport.score} label="HEALTH SCORE" color="var(--success)" bg="var(--success-dim)" />
                <StatCard value={liveReport.violations} label="VIOLATIONS" color="var(--warning)" bg="var(--warning-dim)" />
                <StatCard value={liveReport.fixed} label="AUTO-FIXED" color="var(--accent)" bg="var(--accent-dim)" />
              </div>

              <a
                href="/report"
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent)' }}
                style={{
                  display: 'block', textAlign: 'center',
                  fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700,
                  color: 'var(--bg)', background: 'var(--accent)',
                  padding: '14px 0', borderRadius: 6,
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
                  background: 'var(--surface-elevated)', border: '1px solid var(--border)',
                  borderRadius: jsonCollapsed ? 6 : '6px 6px 0 0',
                  cursor: 'pointer',
                  transition: 'border-radius 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--success)',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    API Response — what Claude Code receives
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
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
                />
              </div>
              {!jsonCollapsed && (
                <div style={{
                  background: 'var(--code-bg)', border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderRadius: '0 0 6px 6px', overflow: 'hidden',
                }}>
                  <pre style={{
                    padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--text-muted)', overflowX: 'auto', margin: 0, lineHeight: 1.7,
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
    <div style={{ marginBottom: 40, animation: 'fadeInSection 0.4s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.1em' }}>{label}</span>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      {children}
    </div>
  )
}

function SmallButton({
  onClick, label, active = false,
}: {
  onClick: (e?: React.MouseEvent) => void
  label: string
  active?: boolean
}) {
  return (
    <button
      onClick={(e) => onClick(e)}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 10px', borderRadius: 4,
        background: active ? 'var(--success-dim)' : 'var(--surface)',
        color: active ? 'var(--success)' : 'var(--text-muted)',
        border: active ? '1px solid color-mix(in srgb, var(--success) 25%, transparent)' : '1px solid var(--border)',
        cursor: 'pointer', letterSpacing: '0.06em',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}

function CodeBlock({
  code, copyId, copied, onCopy, filename, copyLabel,
}: {
  code: string
  copyId: string
  copied: string | null
  onCopy: (text: string, id: string) => void
  filename?: string
  copyLabel?: string
}) {
  const isCopied = copied === copyId
  return (
    <div style={{
      background: 'var(--code-bg)', border: '1px solid var(--border)',
      borderRadius: 6, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-elevated)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{filename ?? 'snippet'}</span>
        <SmallButton
          onClick={() => onCopy(code, copyId)}
          label={isCopied ? 'COPIED \u2713' : (copyLabel ?? 'COPY')}
          active={isCopied}
        />
      </div>
      <pre style={{
        padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--text-primary)', overflowX: 'auto', margin: 0, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        WebkitOverflowScrolling: 'touch',
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
          width: 1, background: 'var(--border)',
        }} />
      )}

      {/* Step number circle */}
      <div
        onClick={onComplete}
        style={{
          width: 30, height: 30, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          background: completed ? 'var(--success-dim)' : 'var(--surface)',
          border: completed ? '1px solid color-mix(in srgb, var(--success) 35%, transparent)' : '1px solid var(--border)',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          color: completed ? 'var(--success)' : 'var(--text-muted)',
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
      background: bg, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`, borderRadius: 4,
    }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
    </div>
  )
}
