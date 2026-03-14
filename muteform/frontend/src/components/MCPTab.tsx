'use client'
import { useEffect, useState } from 'react'
import { C, mono, syne, fmtDate, fmtTime } from './ui/tokens'
import { CopyBtn } from './ui/CopyBtn'
import { api } from '@/lib/api'

interface MCPToken {
  id: string
  ruleset_id: string
  token: string
  name: string
  last_used_at: string | null
  created_at: string
}

interface Ruleset {
  id: string
  name: string
}

const TOOLS = ['Claude Code', 'Cursor', 'Lovable', 'v0'] as const
type Tool = typeof TOOLS[number]

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getSnippet(tool: Tool, endpoint: string): string {
  switch (tool) {
    case 'Claude Code':
      return `# In CLAUDE.md\nmcp_server: ${endpoint}`
    case 'Cursor':
      return `// .cursor/mcp.json\n{\n  "muteform": "${endpoint}"\n}`
    case 'Lovable':
      return `// lovable.config.js\nmcpEndpoint: "${endpoint}"`
    case 'v0':
      return `# v0 settings\nmuteform_endpoint=${endpoint}`
  }
}

function maskToken(token: string): string {
  if (token.length <= 8) return token
  return token.slice(0, 4) + '...' + token.slice(-4)
}

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px',
  ...extra,
})

const lbl: React.CSSProperties = {
  fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted, marginBottom: 6,
}

const bigNum = (color?: string): React.CSSProperties => ({
  fontFamily: syne, fontSize: 28, fontWeight: 700, color: color || C.text,
})

const inputStyle: React.CSSProperties = {
  fontFamily: mono, fontSize: 12, background: C.surface2, border: `1px solid ${C.border2}`,
  borderRadius: 4, padding: '8px 12px', color: C.text, outline: 'none', width: '100%',
}

const btnStyle = (primary?: boolean): React.CSSProperties => ({
  fontFamily: mono, fontSize: 10, letterSpacing: '0.07em', padding: '8px 16px',
  background: primary ? C.blue : 'transparent', border: `1px solid ${primary ? C.blue : C.border2}`,
  borderRadius: 4, color: primary ? '#fff' : C.muted, cursor: 'pointer', transition: 'all 0.2s',
})

const SAMPLE_JSON = JSON.stringify({
  type: 'react_component',
  name: 'LoginForm',
  code: '<div style={{ padding: 15, color: "#333", fontSize: 13 }}><button style={{ background: "#ff0000", borderRadius: 3 }}>Submit</button></div>',
}, null, 2)

export default function MCPTab() {
  const [tokens, setTokens] = useState<MCPToken[]>([])
  const [rulesets, setRulesets] = useState<Ruleset[]>([])
  const [activeTool, setActiveTool] = useState<Tool>('Claude Code')
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenRulesetId, setNewTokenRulesetId] = useState('')
  const [creating, setCreating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testJson, setTestJson] = useState(SAMPLE_JSON)

  useEffect(() => {
    Promise.all([
      api<MCPToken[]>('/mcp-tokens'),
      api<Ruleset[]>('/rulesets'),
    ]).then(([t, r]) => {
      setTokens(t)
      setRulesets(r)
      if (r.length) setNewTokenRulesetId(r[0].id)
    }).catch(() => {})
  }, [])

  async function createToken() {
    if (!newTokenName.trim() || !newTokenRulesetId) return
    setCreating(true)
    try {
      const t = await api<MCPToken>('/mcp-tokens', {
        method: 'POST',
        body: JSON.stringify({ name: newTokenName.trim(), ruleset_id: newTokenRulesetId }),
      })
      setTokens(prev => [...prev, t])
      setNewTokenName('')
    } catch { /* ignore */ }
    setCreating(false)
  }

  async function deleteToken(id: string) {
    try {
      await api(`/mcp-tokens/${id}`, { method: 'DELETE' })
      setTokens(prev => prev.filter(t => t.id !== id))
    } catch { /* ignore */ }
  }

  async function runTest() {
    if (!tokens.length) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${API_URL}/v1/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens[0].token}`,
        },
        body: testJson,
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err: any) {
      setTestResult({ error: err.message || 'Request failed' })
    }
    setTesting(false)
  }

  const firstToken = tokens[0]
  const endpoint = `${API_URL}/v1/validate`
  const activeRuleset = rulesets.find(r => r.id === firstToken?.ruleset_id)
  const snippet = getSnippet(activeTool, endpoint)

  function rulesetName(id: string) {
    return rulesets.find(r => r.id === id)?.name || id
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div style={card()}>
          <div style={lbl}>MCP STATUS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <span style={bigNum(C.green)}>ACTIVE</span>
          </div>
        </div>
        <div style={card()}>
          <div style={lbl}>RULESET</div>
          <div style={{ fontFamily: syne, fontSize: 18, fontWeight: 700, color: C.text }}>{activeRuleset?.name || 'None'}</div>
        </div>
        <div style={card()}>
          <div style={lbl}>TOKENS</div>
          <div style={bigNum()}>{tokens.length}</div>
        </div>
      </div>

      {/* Token management */}
      <div style={card()}>
        <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>API Tokens</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {tokens.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: C.surface2, borderRadius: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: C.text, minWidth: 80 }}>{t.name}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.muted, flex: 1 }}>{maskToken(t.token)}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.dim }}>{rulesetName(t.ruleset_id)}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.dim }}>
                {t.last_used_at ? `Used ${fmtDate(t.last_used_at)}` : 'Never used'}
              </span>
              <button onClick={() => deleteToken(t.id)} style={{
                fontFamily: mono, fontSize: 10, background: 'transparent', border: `1px solid ${C.border2}`,
                borderRadius: 3, color: C.red, cursor: 'pointer', padding: '4px 8px',
              }}>DELETE</button>
            </div>
          ))}
          {!tokens.length && <div style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>No tokens created yet.</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={lbl}>TOKEN NAME</div>
            <input value={newTokenName} onChange={e => setNewTokenName(e.target.value)} placeholder="e.g. dev-token" style={inputStyle} />
          </div>
          <div style={{ minWidth: 160 }}>
            <div style={lbl}>RULESET</div>
            <select value={newTokenRulesetId} onChange={e => setNewTokenRulesetId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {rulesets.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button onClick={createToken} disabled={creating} style={{ ...btnStyle(true), opacity: creating ? 0.6 : 1 }}>
            {creating ? 'CREATING...' : 'CREATE TOKEN'}
          </button>
        </div>
      </div>

      {/* Connection details */}
      {firstToken && (
        <div style={card()}>
          <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Connection Details</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={lbl}>MCP ENDPOINT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface2, borderRadius: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: C.text, flex: 1 }}>{endpoint}</span>
                <CopyBtn text={endpoint} />
              </div>
            </div>
            <div>
              <div style={lbl}>API KEY</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface2, borderRadius: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: C.text, flex: 1 }}>{maskToken(firstToken.token)}</span>
                <CopyBtn text={firstToken.token} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tool snippets */}
      <div style={card()}>
        <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Tool Configuration</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {TOOLS.map(tool => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              style={{
                fontFamily: mono, fontSize: 11, padding: '7px 14px', cursor: 'pointer',
                background: activeTool === tool ? C.blue : 'transparent',
                border: `1px solid ${activeTool === tool ? C.blue : C.border2}`,
                borderRadius: 4, color: activeTool === tool ? '#fff' : C.muted,
                transition: 'all 0.15s',
              }}
            >
              {tool}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <pre style={{
            fontFamily: mono, fontSize: 12, lineHeight: 1.6, color: C.text,
            background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 6,
            padding: '16px 20px', margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto',
          }}>
            {snippet}
          </pre>
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <CopyBtn text={snippet} />
          </div>
        </div>
      </div>

      {/* Live validation test */}
      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text }}>Live Validation Test</div>
          <button
            onClick={runTest}
            disabled={testing || !tokens.length}
            style={{ ...btnStyle(true), opacity: (testing || !tokens.length) ? 0.6 : 1 }}
          >
            {testing ? 'RUNNING...' : 'RUN TEST'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Input pane */}
          <div>
            <div style={lbl}>ARTIFACT INPUT</div>
            <textarea
              value={testJson}
              onChange={e => setTestJson(e.target.value)}
              rows={14}
              style={{
                ...inputStyle, resize: 'vertical', fontFamily: mono, fontSize: 11,
                lineHeight: 1.5, minHeight: 200,
              }}
            />
          </div>

          {/* Result pane */}
          <div>
            <div style={lbl}>VALIDATION RESULT</div>
            <div style={{
              background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 4,
              padding: '12px 14px', minHeight: 200, maxHeight: 340, overflowY: 'auto',
            }}>
              {!testResult && (
                <div style={{ fontFamily: mono, fontSize: 11, color: C.dim, textAlign: 'center', marginTop: 60 }}>
                  Click RUN TEST to validate the artifact.
                </div>
              )}
              {testResult?.error && (
                <div style={{ fontFamily: mono, fontSize: 11, color: C.red }}>{testResult.error}</div>
              )}
              {testResult && !testResult.error && (
                <div>
                  {testResult.health_score !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={lbl}>HEALTH SCORE</span>
                      <span style={{ fontFamily: syne, fontSize: 20, fontWeight: 700, color: testResult.health_score >= 80 ? C.green : testResult.health_score >= 55 ? C.amber : C.red }}>
                        {testResult.health_score}
                      </span>
                    </div>
                  )}
                  {testResult.violations?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {testResult.violations.map((v: any, i: number) => (
                        <div key={i} style={{ padding: '8px 10px', background: C.surface, borderRadius: 4, borderLeft: `3px solid ${v.severity === 'high' ? C.red : v.severity === 'medium' ? C.amber : C.green}` }}>
                          <div style={{ fontFamily: mono, fontSize: 11, color: C.text, marginBottom: 2 }}>{v.message || v.type}</div>
                          <div style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>{v.severity} - {v.type}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {testResult.violations?.length === 0 && (
                    <div style={{ fontFamily: mono, fontSize: 11, color: C.green, textAlign: 'center', marginTop: 60 }}>
                      No violations found. Artifact passes all rules.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
