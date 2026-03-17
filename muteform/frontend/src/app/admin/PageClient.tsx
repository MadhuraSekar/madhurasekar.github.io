'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

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

interface Tester {
  id: string
  name: string
  company: string
  created_at: string
  scans: number
  rules: number
  mcp_calls: number
  last_active: string | null
}

interface Stats {
  totalTesters: number
  totalScans: number
  totalRules: number
  totalMcpCalls: number
  testers: Tester[]
  topViolations: { rule: string; count: number }[]
  topCustomRules: { name: string; count: number }[]
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleLogin() {
    if (password === 'muteform_admin_2024') {
      setAuthed(true)
      setError('')
    } else {
      setError('Wrong password')
    }
  }

  useEffect(() => {
    if (!authed) return
    loadStats()
  }, [authed])

  async function loadStats() {
    setLoading(true)
    try {
      const sb = createClient()

      // Fetch testers
      const { data: testers } = await sb.from('beta_testers').select('*').order('created_at', { ascending: false })
      const testerList = testers || []

      // Fetch scan counts per tester
      const { data: scans } = await sb.from('scan_reports').select('tester_id')
      const scanCounts: Record<string, number> = {}
      ;(scans || []).forEach((s: any) => { scanCounts[s.tester_id] = (scanCounts[s.tester_id] || 0) + 1 })

      // Fetch custom rule counts per tester
      const { data: rules } = await sb.from('custom_rules').select('tester_id, rule_name')
      const ruleCounts: Record<string, number> = {}
      const ruleNameCounts: Record<string, number> = {}
      ;(rules || []).forEach((r: any) => {
        ruleCounts[r.tester_id] = (ruleCounts[r.tester_id] || 0) + 1
        ruleNameCounts[r.rule_name] = (ruleNameCounts[r.rule_name] || 0) + 1
      })

      // Fetch MCP call counts
      const { data: mcpTokens } = await sb.from('mcp_tokens').select('tester_id, call_count, last_used_at')
      const mcpCounts: Record<string, number> = {}
      let totalMcp = 0
      ;(mcpTokens || []).forEach((t: any) => {
        mcpCounts[t.tester_id] = (mcpCounts[t.tester_id] || 0) + (t.call_count || 0)
        totalMcp += t.call_count || 0
      })

      // Fetch violation stats from reports
      const { data: reports } = await sb.from('scan_reports').select('report_json').limit(50)
      const violationCounts: Record<string, number> = {}
      ;(reports || []).forEach((r: any) => {
        try {
          const parsed = typeof r.report_json === 'string' ? JSON.parse(r.report_json) : r.report_json
          const violations = parsed?.violations || parsed?.governance_report?.violations || []
          violations.forEach((v: any) => {
            const rule = v.ruleName || v.rule || 'unknown'
            violationCounts[rule] = (violationCounts[rule] || 0) + 1
          })
        } catch { /* skip */ }
      })

      const enrichedTesters: Tester[] = testerList.map((t: any) => ({
        id: t.id,
        name: t.name || 'Unknown',
        company: t.company || 'Unknown',
        created_at: t.created_at,
        scans: scanCounts[t.id] || 0,
        rules: ruleCounts[t.id] || 0,
        mcp_calls: mcpCounts[t.id] || 0,
        last_active: t.last_active_at || t.created_at,
      }))

      const topViolations = Object.entries(violationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([rule, count]) => ({ rule, count }))

      const topCustomRules = Object.entries(ruleNameCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))

      setStats({
        totalTesters: testerList.length,
        totalScans: scans?.length || 0,
        totalRules: rules?.length || 0,
        totalMcpCalls: totalMcp,
        testers: enrichedTesters,
        topViolations,
        topCustomRules,
      })
    } catch (e: any) {
      setError('Failed to load data: ' + (e?.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 32, width: 360 }}>
          <h1 style={{ fontFamily: syne, fontSize: 20, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>Admin Access</h1>
          <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, margin: '0 0 20px' }}>Enter password to view tester data</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: mono, fontSize: 13, color: T.text,
              background: T.bg, border: `1px solid ${T.border2}`,
              borderRadius: 8, padding: '10px 14px', outline: 'none',
              marginBottom: 12,
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              width: '100%', fontFamily: mono, fontSize: 13, fontWeight: 600,
              color: '#000', background: T.green, border: 'none',
              borderRadius: 8, padding: '10px 0', cursor: 'pointer',
            }}
          >
            Login
          </button>
          {error && <p style={{ fontFamily: mono, fontSize: 12, color: T.red, marginTop: 12, textAlign: 'center' }}>{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: mono }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: syne, fontSize: 24, fontWeight: 700, color: T.text, margin: 0 }}>Muteform Command Center</h1>
            <p style={{ fontFamily: mono, fontSize: 12, color: T.muted, marginTop: 4 }}>Product intelligence dashboard</p>
          </div>
          <button onClick={loadStats} disabled={loading} style={{
            fontFamily: mono, fontSize: 11, color: T.green, background: T.greenDim,
            border: `1px solid ${T.green}33`, borderRadius: 6, padding: '6px 14px',
            cursor: loading ? 'wait' : 'pointer',
          }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <div style={{ padding: 14, background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 8, fontFamily: mono, fontSize: 12, color: T.red, marginBottom: 20 }}>{error}</div>}

        {loading && !stats && (
          <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>Loading data from Supabase...</div>
        )}

        {stats && (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
              {[
                { label: 'Testers', value: stats.totalTesters, color: T.blue },
                { label: 'Scans', value: stats.totalScans, color: T.green },
                { label: 'Custom Rules', value: stats.totalRules, color: T.amber },
                { label: 'MCP Calls', value: stats.totalMcpCalls, color: T.blue },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  padding: 20, background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 10, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: syne, fontSize: 32, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.muted, letterSpacing: '0.08em', marginTop: 4, textTransform: 'uppercase' }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Testers Table */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text, margin: '0 0 12px' }}>All Testers</h2>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 2fr',
                  padding: '10px 16px', background: T.surface2, borderBottom: `1px solid ${T.border}`,
                }}>
                  {['Name', 'Company', 'Scans', 'Rules', 'MCP Calls', 'Joined'].map(h => (
                    <span key={h} style={{ fontFamily: mono, fontSize: 9, color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
                  ))}
                </div>
                {stats.testers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>No testers yet</div>
                ) : stats.testers.map((t, i) => (
                  <div key={t.id} style={{
                    display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 2fr',
                    padding: '10px 16px',
                    borderBottom: i < stats.testers.length - 1 ? `1px solid ${T.border}` : 'none',
                    background: i % 2 === 0 ? 'transparent' : T.surface,
                  }}>
                    <span style={{ fontSize: 12, color: T.text }}>{t.name}</span>
                    <span style={{ fontSize: 12, color: T.muted }}>{t.company}</span>
                    <span style={{ fontSize: 12, color: t.scans > 0 ? T.green : T.dim }}>{t.scans}</span>
                    <span style={{ fontSize: 12, color: t.rules > 0 ? T.amber : T.dim }}>{t.rules}</span>
                    <span style={{ fontSize: 12, color: t.mcp_calls > 0 ? T.blue : T.dim }}>{t.mcp_calls}</span>
                    <span style={{ fontSize: 11, color: T.dim }}>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Two columns: Top Violations + Top Custom Rules */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h2 style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text, margin: '0 0 12px' }}>Top Violations</h2>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {stats.topViolations.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>No data yet</div>
                  ) : stats.topViolations.map((v, i) => (
                    <div key={v.rule} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
                      borderBottom: i < stats.topViolations.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <span style={{ fontSize: 11, color: T.text }}>{v.rule}</span>
                      <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>{v.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: T.text, margin: '0 0 12px' }}>Top Custom Rules</h2>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {stats.topCustomRules.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 12 }}>No data yet</div>
                  ) : stats.topCustomRules.map((r, i) => (
                    <div key={r.name} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
                      borderBottom: i < stats.topCustomRules.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <span style={{ fontSize: 11, color: T.text }}>{r.name}</span>
                      <span style={{ fontSize: 11, color: T.amber, fontWeight: 600 }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: 2fr"] { display: flex !important; flex-direction: column !important; gap: 4px !important; }
        }
      `}</style>
    </div>
  )
}
