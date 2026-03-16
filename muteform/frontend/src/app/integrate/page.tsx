'use client'

import { useState } from 'react'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', amber: '#ffb830',
  blue: '#4090ff', blueDim: '#4090ff18',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"

function randomKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return 'mf_live_' + result
}

const CODE_SDK = `import { Muteform } from '@muteform/sdk';

const mf = new Muteform({
  apiKey: 'API_KEY_PLACEHOLDER',
  ruleset: 'acme-core-v8',
});

// Validate any HTML string
const result = await mf.scan(generatedHTML);
console.log(result.score);        // 42
console.log(result.violations);   // [...]

// Auto-fix and get clean output
const fixed = await mf.fix(generatedHTML);
console.log(fixed.html);          // cleaned HTML
console.log(fixed.score);         // 100`

const CODE_CI = `# .github/workflows/muteform.yml
name: Muteform Scan

on: [pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Muteform Scan
        uses: muteform/scan-action@v1
        with:
          api-key: \${{ secrets.MUTEFORM_API_KEY }}
          path: './generated-ui/'
          fail-on: 'critical'`

const CODE_AGENT = `import { Muteform } from '@muteform/sdk';
import Anthropic from '@anthropic-ai/sdk';

const mf = new Muteform({ apiKey: 'API_KEY_PLACEHOLDER' });
const anthropic = new Anthropic();

// Inject design constraints into AI prompt
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: mf.getConstraints(),
  messages: [{ role: 'user', content: 'Build a checkout page' }],
});

const html = extractHTML(response);
const governed = await mf.fix(html);
// governed.score === 100`

export default function IntegratePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [apiKey] = useState(randomKey)
  const [masked, setMasked] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [tab, setTab] = useState<'sdk' | 'ci' | 'agent'>('sdk')

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const codeForTab = tab === 'sdk' ? CODE_SDK.replace('API_KEY_PLACEHOLDER', apiKey) :
    tab === 'ci' ? CODE_CI : CODE_AGENT.replace('API_KEY_PLACEHOLDER', apiKey)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>muteform</span>
          </a>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.blue, background: T.blueDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.blue}33`, letterSpacing: '0.06em' }}>
            INTEGRATE
          </span>
        </div>
        <a href="/dashboard" style={{ fontFamily: mono, fontSize: 11, color: T.muted, textDecoration: 'none' }}>← Dashboard</a>
          <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg></button>
      </div>
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        <a href="/dashboard" style={{ fontFamily: sans }}>Dashboard</a>
        <a href="/scan" style={{ fontFamily: sans }}>Scan</a>
        <a href="/rules" style={{ fontFamily: sans }}>Rules</a>
        <a href="/governance" style={{ fontFamily: sans }}>Governance</a>
        <a href="/integrate" style={{ fontFamily: sans, color: T.green }}>Integrate</a>
        <a href="/team" style={{ fontFamily: sans }}>Team</a>
      </div>

      <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
        <h1 style={{ fontFamily: sans, fontSize: 24, fontWeight: 700, color: T.textBright, marginBottom: 8 }}>
          Integration Guide
        </h1>
        <p style={{ fontFamily: sans, fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 32 }}>
          Add Muteform to your workflow — SDK, CI/CD, or AI agent integration.
        </p>

        {/* API Key */}
        <div style={{
          padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 10, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.textBright }}>API Key</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMasked(!masked)} style={{
                fontFamily: mono, fontSize: 9, padding: '3px 8px', borderRadius: 3,
                background: T.surface2, color: T.muted, border: `1px solid ${T.border}`, cursor: 'pointer',
              }}>{masked ? 'REVEAL' : 'HIDE'}</button>
              <button onClick={() => copyText(apiKey, 'key')} style={{
                fontFamily: mono, fontSize: 9, padding: '3px 8px', borderRadius: 3,
                background: T.surface2, color: copied === 'key' ? T.green : T.muted,
                border: `1px solid ${copied === 'key' ? T.green + '33' : T.border}`, cursor: 'pointer',
              }}>{copied === 'key' ? 'COPIED ✓' : 'COPY'}</button>
            </div>
          </div>
          <div style={{
            fontFamily: mono, fontSize: 12, color: T.text, padding: '8px 12px',
            background: T.bg, borderRadius: 6, border: `1px solid ${T.border}`,
          }}>
            {masked ? apiKey.substring(0, 8) + '••••••••••••••••••••••••' : apiKey}
          </div>
        </div>

        {/* Code tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {([['sdk', 'SDK'], ['ci', 'CI/CD'], ['agent', 'AI Agent']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              fontFamily: mono, fontSize: 10, padding: '6px 14px', borderRadius: 6,
              background: tab === key ? T.green : T.surface2, color: tab === key ? T.bg : T.muted,
              border: tab === key ? 'none' : `1px solid ${T.border}`, cursor: 'pointer',
              letterSpacing: '0.04em', fontWeight: tab === key ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>

        {/* Code block */}
        <div style={{
          background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
          }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>
              {tab === 'sdk' ? 'app.ts' : tab === 'ci' ? '.github/workflows/muteform.yml' : 'agent.ts'}
            </span>
            <button onClick={() => copyText(codeForTab, 'code')} style={{
              fontFamily: mono, fontSize: 9, padding: '3px 8px', borderRadius: 3,
              background: T.surface2, color: copied === 'code' ? T.green : T.muted,
              border: `1px solid ${copied === 'code' ? T.green + '33' : T.border}`, cursor: 'pointer',
            }}>{copied === 'code' ? 'COPIED ✓' : 'COPY'}</button>
          </div>
          <pre style={{
            padding: 16, fontFamily: mono, fontSize: 11, lineHeight: 1.7,
            color: T.text, overflowX: 'auto', margin: 0,
          }}>
            {codeForTab}
          </pre>
        </div>

        {/* Install instructions */}
        <div style={{
          marginTop: 24, padding: '16px 20px', background: T.surface,
          border: `1px solid ${T.border}`, borderRadius: 10,
        }}>
          <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.textBright, display: 'block', marginBottom: 8 }}>
            Quick Start
          </span>
          <div style={{
            fontFamily: mono, fontSize: 12, color: T.green, padding: '8px 12px',
            background: T.bg, borderRadius: 6, border: `1px solid ${T.border}`,
          }}>
            npm install @muteform/sdk
          </div>
        </div>

        {/* Usage stats placeholder */}
        <div style={{
          marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        }}>
          {[
            { label: 'Scans this month', value: '—' },
            { label: 'Violations caught', value: '—' },
            { label: 'Auto-fixes applied', value: '—' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '16px', background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, textAlign: 'center',
            }}>
              <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.textBright }}>{s.value}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: T.muted, letterSpacing: '0.06em', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
