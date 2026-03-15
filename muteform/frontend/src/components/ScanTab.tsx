'use client'
import { useEffect, useState, useMemo } from 'react'
import { C, mono, syne, VMETA, SEVC, scoreColor, healthScore, fmtDate, fmtTime } from './ui/tokens'
import { ScoreRing } from './ui/ScoreRing'
import { ViolationRow } from './ui/ViolationRow'
import { api } from '@/lib/api'

interface Ruleset {
  id: string
  name: string
  rules: any
}

interface Violation {
  id: string
  type: string
  severity: string
  message: string
  status: string
  confidence?: string
  nodeName?: string
  nodeId?: string
  nodePath?: string
  currentValue?: any
  actual?: any
  suggestedValue?: any
  expected?: any
  description?: string
}

interface ScanResult {
  id: string
  artifact_name: string
  ruleset_name: string
  health_score: number
  violation_count: number
  high_count: number
  medium_count: number
  low_count: number
  created_at: string
  violations: Violation[]
}

const SAMPLE_ARTIFACT = JSON.stringify({
  id: 'artifact_1',
  name: 'Checkout Flow',
  source: 'generic-json',
  nodes: [
    {
      id: 'node_1',
      type: 'button',
      name: 'Submit Button',
      parentName: 'Payment Form',
      styles: { color: '#3478F6', spacing: 22, typographyStyle: 'display-xl' },
      component: { name: 'button', variant: 'ghost', size: 'md' },
      layout: { gridColumns: 10 },
    },
  ],
}, null, 2)

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px',
  ...extra,
})

const label: React.CSSProperties = {
  fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted, marginBottom: 6,
}

const pill = (active: boolean, color?: string): React.CSSProperties => ({
  fontFamily: mono, fontSize: 10, letterSpacing: '0.07em',
  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
  background: active ? (color ? `${color}18` : C.blueDim) : 'transparent',
  border: `1px solid ${active ? (color || C.blue) : C.border2}`,
  color: active ? (color || C.blue) : C.muted,
  transition: 'all 0.15s',
})

const btnStyle = (bg: string, disabled?: boolean): React.CSSProperties => ({
  fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', fontWeight: 700,
  padding: '8px 20px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? C.dim2 : bg, color: '#fff', border: 'none',
  opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s',
})

function ScanInsights({ violations }: { violations: Violation[] }) {
  const active = violations.filter(v => v.status !== 'ignored')
  if (!active.length) return null

  const typeCounts: Record<string, number> = {}
  const nodeCounts: Record<string, number> = {}
  let fixable = 0
  let critical = 0

  active.forEach(v => {
    typeCounts[v.type] = (typeCounts[v.type] || 0) + 1
    if (v.nodeName) nodeCounts[v.nodeName] = (nodeCounts[v.nodeName] || 0) + 1
    if (v.confidence === 'high') fixable++
    if (v.severity === 'high') critical++
  })

  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
  const topNode = Object.entries(nodeCounts).sort((a, b) => b[1] - a[1])[0]
  const topMeta = topType ? VMETA[topType[0]] : null

  const items = [
    { label: 'TOP ISSUE', value: topMeta ? `${topMeta.icon} ${topMeta.label} (${topType[1]})` : '-', color: topMeta?.color || C.muted },
    { label: 'MOST AFFECTED', value: topNode ? `${topNode[0]} (${topNode[1]})` : '-', color: C.text },
    { label: 'AUTO-FIXABLE', value: String(fixable), color: C.green },
    { label: 'CRITICAL', value: String(critical), color: critical > 0 ? C.red : C.muted },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {items.map(it => (
        <div key={it.label} style={card()}>
          <div style={label}>{it.label}</div>
          <div style={{ fontFamily: mono, fontSize: 12, color: it.color }}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function ScanTab() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([])
  const [selectedRulesetId, setSelectedRulesetId] = useState('')
  const [artifactJson, setArtifactJson] = useState(SAMPLE_ARTIFACT)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [groupByType, setGroupByType] = useState(false)
  const [showPath, setShowPath] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api<Ruleset[]>('/rulesets').then(data => {
      setRulesets(data)
      if (data.length) setSelectedRulesetId(data[0].id)
    }).catch(() => {})
  }, [])

  const selectedRuleset = rulesets.find(r => r.id === selectedRulesetId)

  async function runScan() {
    if (!selectedRulesetId) return
    setScanning(true)
    setResult(null)
    try {
      const parsed = JSON.parse(artifactJson)
      const data = await api<ScanResult>('/scan', {
        method: 'POST',
        body: JSON.stringify({ artifact_json: parsed, ruleset_id: selectedRulesetId }),
      })
      setResult(data)
      setExpandedId(null)
      setSeverityFilter('all')
      setTypeFilter('all')
    } catch (e: any) {
      console.error('Scan failed:', e)
    } finally {
      setScanning(false)
    }
  }

  async function patchViolation(id: string, status: string) {
    try {
      await api(`/violations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setResult(prev => {
        if (!prev) return prev
        const violations = prev.violations.map(v =>
          v.id === id ? { ...v, status } : v
        )
        const highCount = violations.filter(v => v.severity === 'high' && v.status !== 'fixed').length
        const medCount = violations.filter(v => v.severity === 'medium' && v.status !== 'fixed').length
        const lowCount = violations.filter(v => v.severity === 'low' && v.status !== 'fixed').length
        return {
          ...prev,
          violations,
          health_score: healthScore(violations),
          high_count: highCount,
          medium_count: medCount,
          low_count: lowCount,
        }
      })
    } catch (e) {
      console.error('Patch failed:', e)
    }
  }

  function handleFix(v: Violation) {
    patchViolation(v.id, 'fixed')
  }

  function handleIgnore(id: string, ignored: boolean) {
    patchViolation(id, ignored ? 'ignored' : 'active')
  }

  async function fixAll() {
    if (!result) return
    const unfixed = result.violations.filter(v => v.status !== 'fixed' && v.status !== 'ignored')
    for (const v of unfixed) {
      await patchViolation(v.id, 'fixed')
    }
  }

  // Filtering
  const filteredViolations = useMemo(() => {
    if (!result) return []
    return result.violations.filter(v => {
      if (severityFilter !== 'all' && v.severity !== severityFilter) return false
      if (typeFilter !== 'all' && v.type !== typeFilter) return false
      return true
    })
  }, [result, severityFilter, typeFilter])

  // Unique types for filter pills
  const violationTypes = useMemo(() => {
    if (!result) return []
    const set = new Set(result.violations.map(v => v.type))
    return Array.from(set)
  }, [result])

  // Grouping
  const groupedViolations = useMemo(() => {
    if (!groupByType) return null
    const groups: Record<string, Violation[]> = {}
    filteredViolations.forEach(v => {
      const key = v.type
      if (!groups[key]) groups[key] = []
      groups[key].push(v)
    })
    return groups
  }, [filteredViolations, groupByType])

  const ignoredCount = result ? result.violations.filter(v => v.status === 'ignored').length : 0
  const score = result ? healthScore(result.violations) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top split pane: ruleset + artifact */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Active ruleset (read-only) */}
        <div style={card()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={label}>ACTIVE RULESET</div>
            {rulesets.length > 1 && (
              <select
                value={selectedRulesetId}
                onChange={e => setSelectedRulesetId(e.target.value)}
                style={{
                  fontFamily: mono, fontSize: 10, background: C.surface2,
                  border: `1px solid ${C.border2}`, borderRadius: 3, color: C.text,
                  padding: '3px 8px', cursor: 'pointer', outline: 'none',
                }}
              >
                {rulesets.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>
          <pre style={{
            fontFamily: mono, fontSize: 11, color: C.muted, lineHeight: 1.6,
            maxHeight: 260, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap',
            background: C.bg, borderRadius: 6, padding: 12,
            border: `1px solid ${C.border}`,
          }}>
            {selectedRuleset ? JSON.stringify(selectedRuleset.rules, null, 2) : 'Loading...'}
          </pre>
        </div>

        {/* Artifact JSON textarea */}
        <div style={card()}>
          <div style={label}>ARTIFACT JSON</div>
          <textarea
            value={artifactJson}
            onChange={e => setArtifactJson(e.target.value)}
            spellCheck={false}
            style={{
              fontFamily: mono, fontSize: 11, color: C.text, lineHeight: 1.6,
              width: '100%', height: 260, resize: 'vertical',
              background: C.bg, borderRadius: 6, padding: 12,
              border: `1px solid ${C.border}`, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={runScan}
          disabled={scanning || !selectedRulesetId}
          style={btnStyle(C.blue, scanning || !selectedRulesetId)}
          onMouseEnter={e => { if (!scanning) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = scanning ? '0.5' : '1' }}
        >
          {scanning ? 'SCANNING...' : 'RUN SCAN'}
        </button>

        {result && (
          <>
            <button
              onClick={fixAll}
              style={btnStyle(C.green)}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              FIX ALL
            </button>

            <div style={{ width: 1, height: 20, background: C.border2 }} />

            <button
              onClick={() => setShowPath(!showPath)}
              style={pill(showPath)}
            >
              NODE PATH {showPath ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setGroupByType(!groupByType)}
              style={pill(groupByType)}
            >
              GROUP BY TYPE {groupByType ? 'ON' : 'OFF'}
            </button>
          </>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            <div style={card({ display: 'flex', alignItems: 'center', gap: 12 })}>
              <ScoreRing score={score} size={44} />
              <div>
                <div style={label}>HEALTH</div>
                <div style={{ fontFamily: syne, fontSize: 22, fontWeight: 700, color: scoreColor(score) }}>
                  {score}
                </div>
              </div>
            </div>
            {[
              { l: 'TOTAL', v: result.violations.length, c: C.text },
              { l: 'HIGH', v: result.high_count, c: SEVC.high },
              { l: 'MEDIUM', v: result.medium_count, c: SEVC.medium },
              { l: 'LOW', v: result.low_count, c: SEVC.low },
              { l: 'IGNORED', v: ignoredCount, c: C.muted },
            ].map(s => (
              <div key={s.l} style={card()}>
                <div style={label}>{s.l}</div>
                <div style={{ fontFamily: syne, fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Insights */}
          <ScanInsights violations={result.violations} />

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Severity filters */}
            {(['all', 'high', 'medium', 'low'] as const).map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                style={pill(severityFilter === s, s !== 'all' ? SEVC[s] : undefined)}>
                {s.toUpperCase()}
              </button>
            ))}

            <div style={{ width: 1, height: 20, background: C.border2, alignSelf: 'center' }} />

            {/* Type filters */}
            <button onClick={() => setTypeFilter('all')} style={pill(typeFilter === 'all')}>
              ALL TYPES
            </button>
            {violationTypes.map(t => {
              const meta = VMETA[t]
              return (
                <button key={t} onClick={() => setTypeFilter(t)}
                  style={pill(typeFilter === t, meta?.color)}>
                  {meta?.icon || '!'} {meta?.short || t}
                </button>
              )
            })}
          </div>

          {/* Violation list */}
          <div style={card({ padding: 0, overflow: 'hidden' })}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted }}>
                VIOLATIONS
              </span>
              <span style={{
                fontFamily: mono, fontSize: 10, color: C.dim,
                padding: '2px 8px', borderRadius: 3, background: C.surface2,
              }}>
                {filteredViolations.length}
              </span>
            </div>

            {groupedViolations ? (
              Object.entries(groupedViolations).map(([type, violations]) => {
                const meta = VMETA[type] || { label: type, icon: '!', color: C.muted }
                const isCollapsed = collapsedGroups[type]
                return (
                  <div key={type}>
                    <div
                      onClick={() => setCollapsedGroups(prev => ({ ...prev, [type]: !prev[type] }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', cursor: 'pointer',
                        background: C.surface2, borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <span style={{
                        fontFamily: mono, fontSize: 10, color: C.dim, width: 14, textAlign: 'center',
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                        transition: 'transform 0.15s', display: 'inline-block',
                      }}>
                        {'\u25B6'}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: meta.color }}>
                        {meta.icon}
                      </span>
                      <span style={{ fontFamily: syne, fontSize: 12, color: C.text }}>
                        {meta.label}
                      </span>
                      <span style={{
                        fontFamily: mono, fontSize: 10, color: C.muted,
                        marginLeft: 'auto', padding: '1px 6px', borderRadius: 3, background: C.surface,
                      }}>
                        {violations.length}
                      </span>
                    </div>
                    {!isCollapsed && violations.map((v, i) => (
                      <ViolationRow
                        key={v.id}
                        violation={v}
                        index={i}
                        isExpanded={expandedId === v.id}
                        onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                        onApplyFix={handleFix}
                        onIgnore={handleIgnore}
                        isFixed={v.status === 'fixed'}
                        showPath={showPath}
                      />
                    ))}
                  </div>
                )
              })
            ) : (
              filteredViolations.map((v, i) => (
                <ViolationRow
                  key={v.id}
                  violation={v}
                  index={i}
                  isExpanded={expandedId === v.id}
                  onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  onApplyFix={handleFix}
                  onIgnore={handleIgnore}
                  isFixed={v.status === 'fixed'}
                  showPath={showPath}
                />
              ))
            )}

            {filteredViolations.length === 0 && (
              <div style={{
                padding: 40, textAlign: 'center',
                fontFamily: syne, fontSize: 13, color: C.dim,
              }}>
                No violations match current filters
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !scanning && (
        <div style={{
          padding: 60, textAlign: 'center',
          fontFamily: syne, fontSize: 14, color: C.dim,
        }}>
          Configure your artifact and run a scan
        </div>
      )}
    </div>
  )
}
