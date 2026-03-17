'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Header from '@/components/Header'
import { tokens } from '@/lib/design-tokens'

const T = tokens
const mono = T.fontMono
const syne = T.fontDisplay

/* ─── Active rules data ─── */
const ACTIVE_RULES = [
  { id: 'color-token-compliance', severity: 'high', description: 'All colors must reference approved design tokens', autoFix: true },
  { id: 'spacing-scale-compliance', severity: 'medium', description: 'Spacing values must use the approved scale [4, 8, 12, 16, 24, 32, 48, 64]', autoFix: true },
  { id: 'contrast-wcag-aa', severity: 'critical', description: 'All text must meet WCAG AA contrast requirements (4.5:1)', autoFix: true },
  { id: 'typography-style-compliance', severity: 'high', description: 'Typography styles must be from approved list', autoFix: true },
  { id: 'component-variant-compliance', severity: 'critical', description: 'Component variants must be from approved list', autoFix: true },
  { id: 'layout-grid-compliance', severity: 'medium', description: 'Grid columns must use approved column counts [4, 8, 12]', autoFix: false },
]

function sevColor(s: string): string {
  switch (s) { case 'critical': return T.red; case 'high': return '#f97316'; case 'medium': return T.amber; default: return T.textMuted }
}

/* ─── Governance history ─── */
const HISTORY = [
  { date: 'Mar 16, 2026', interface: 'acme.com/checkout', score: 96, fixed: 4, source: 'Claude via MCP' },
  { date: 'Mar 15, 2026', interface: 'acme.com/dashboard', score: 88, fixed: 2, source: 'Cursor' },
  { date: 'Mar 14, 2026', interface: 'acme.com/onboarding', score: 91, fixed: 3, source: 'v0 by Vercel' },
  { date: 'Mar 13, 2026', interface: 'acme.com/settings', score: 100, fixed: 1, source: 'Copilot' },
  { date: 'Mar 12, 2026', interface: 'acme.com/checkout', score: 94, fixed: 3, source: 'Claude via MCP' },
  { date: 'Mar 11, 2026', interface: 'acme.com/dashboard', score: 82, fixed: 5, source: 'Cursor' },
]

/* ─── MCP config snippet ─── */
const MCP_CONFIG = `{
  "mcpServers": {
    "muteform": {
      "command": "npx",
      "args": ["-y", "@muteform/mcp-server"],
      "env": {
        "MUTEFORM_TOKEN": "mf_beta_ak7x9...",
        "MUTEFORM_POLICY": ".muteform.yml"
      }
    }
  }
}`

export default function GovernancePage() {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'rules' | 'mcp' | 'history'>('rules')

  const copyConfig = () => {
    navigator.clipboard.writeText(MCP_CONFIG)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) {
          .gov-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Header />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 60px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: syne, fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Governance</h1>
          <p style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, marginTop: 4 }}>
            Active ruleset, MCP integration, and scan history · Acme Design System v2.1
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: T.surface, borderRadius: 8, padding: 3, border: `1px solid ${T.border}`, width: 'fit-content' }}>
          {([
            { id: 'rules' as const, label: 'Active Rules' },
            { id: 'mcp' as const, label: 'MCP Integration' },
            { id: 'history' as const, label: 'Scan History' },
          ]).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: mono, fontSize: 11, fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? T.text : T.textMuted,
              background: activeTab === t.id ? T.surface2 : 'transparent',
              transition: 'all 0.15s ease',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ═══ ACTIVE RULES ═══ */}
        {activeTab === 'rules' && (
          <div style={{ animation: 'fadeSlideIn 0.2s ease both' }}>
            {/* Summary cards */}
            <div className="gov-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              <div style={{ padding: '16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.text }}>{ACTIVE_RULES.length}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Active Rules</div>
              </div>
              <div style={{ padding: '16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.green }}>{ACTIVE_RULES.filter(r => r.autoFix).length}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Auto-Fixable</div>
              </div>
              <div style={{ padding: '16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.red }}>{ACTIVE_RULES.filter(r => r.severity === 'critical').length}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Critical Rules</div>
              </div>
            </div>

            {/* Rules list */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {ACTIVE_RULES.map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < ACTIVE_RULES.length - 1 ? `1px solid ${T.border}` : 'none',
                }}>
                  <div style={{ width: 4, height: 32, borderRadius: 2, background: sevColor(r.severity), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: mono, fontSize: 11, color: T.text, fontWeight: 600 }}>{r.id}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, marginTop: 2 }}>{r.description}</div>
                  </div>
                  <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: sevColor(r.severity), background: `${sevColor(r.severity)}18`, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase' }}>{r.severity}</span>
                  <span style={{
                    fontFamily: mono, fontSize: 8, fontWeight: 600,
                    color: r.autoFix ? T.green : T.amber,
                    background: r.autoFix ? T.greenDim : T.amberDim,
                    padding: '2px 8px', borderRadius: 3,
                  }}>{r.autoFix ? 'auto-fix' : 'manual'}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <a href="/playground" style={{ fontFamily: mono, fontSize: 10, color: T.blue, textDecoration: 'none' }}>Edit rules in Playground →</a>
            </div>
          </div>
        )}

        {/* ═══ MCP INTEGRATION ═══ */}
        {activeTab === 'mcp' && (
          <div style={{ animation: 'fadeSlideIn 0.2s ease both' }}>
            {/* Pipeline visual */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '24px', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 16 }}>Governance Pipeline</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
                {[
                  { label: 'AI Agent', sub: 'Claude, Cursor, v0', color: T.amber },
                  { label: 'MCP Protocol', sub: 'Model Context', color: T.blue },
                  { label: 'Muteform Engine', sub: 'Governance Layer', color: T.green },
                  { label: 'Validated Output', sub: 'Compliant UI', color: T.green },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      padding: '12px 20px', background: `${step.color}08`, border: `1px solid ${step.color}33`,
                      borderRadius: 8, textAlign: 'center', minWidth: 120,
                    }}>
                      <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: step.color }}>{step.label}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: T.textMuted, marginTop: 2 }}>{step.sub}</div>
                    </div>
                    {i < 3 && (
                      <div style={{ fontFamily: mono, fontSize: 14, color: T.textDim, padding: '0 8px' }}>→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* MCP Config */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.text }}>MCP Server Configuration</span>
                <button onClick={copyConfig} style={{
                  fontFamily: mono, fontSize: 9, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                  background: copied ? T.greenDim : T.surface2, color: copied ? T.green : T.textMuted,
                  border: `1px solid ${copied ? T.green + '33' : T.border}`,
                }}>{copied ? '✓ Copied' : 'Copy'}</button>
              </div>
              <pre style={{
                padding: '16px', margin: 0, fontFamily: mono, fontSize: 11, lineHeight: 1.7,
                color: T.text, overflow: 'auto',
              }}>{MCP_CONFIG}</pre>
            </div>

            {/* Integration steps */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '20px' }}>
              <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 16 }}>Quick Setup</div>
              {[
                { step: '1', text: 'Add the MCP config above to your AI tool\'s settings', detail: 'Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client' },
                { step: '2', text: 'Place .muteform.yml in your project root', detail: 'Define your tokens, rules, and severity levels' },
                { step: '3', text: 'AI agents will auto-validate generated UI', detail: 'Every component gets scanned before it reaches your codebase' },
              ].map(s => (
                <div key={s.step} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: T.blueDim, border: `1px solid ${T.blue}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontFamily: mono, fontSize: 10, fontWeight: 700, color: T.blue,
                  }}>{s.step}</div>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: T.text, fontWeight: 500 }}>{s.text}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: T.textMuted, marginTop: 2 }}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SCAN HISTORY ═══ */}
        {activeTab === 'history' && (
          <div style={{ animation: 'fadeSlideIn 0.2s ease both' }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 1fr', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
                {['Date', 'Interface', 'Score', 'Fixed', 'Source'].map(h => (
                  <div key={h} style={{ fontFamily: mono, fontSize: 8, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1.5 }}>{h}</div>
                ))}
              </div>
              {HISTORY.map((h, i) => {
                const scoreCol = h.score >= 90 ? T.green : h.score >= 60 ? T.amber : T.red
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 1fr', gap: 8,
                    padding: '10px 16px', borderBottom: i < HISTORY.length - 1 ? `1px solid ${T.border}` : 'none',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.textMuted }}>{h.date}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.text }}>{h.interface}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 32, height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
                        <div style={{ width: `${h.score}%`, height: '100%', background: scoreCol, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: scoreCol }}>{h.score}</span>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.green }}>{h.fixed} auto-fixed</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: T.textMuted }}>{h.source}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
