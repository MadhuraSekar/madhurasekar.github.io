'use client'
import { useEffect, useState, useMemo } from 'react'
import { C, mono, syne, VMETA, SEVC, scoreColor, healthScore, fmtDate, fmtTime } from './ui/tokens'
import { ScoreRing } from './ui/ScoreRing'
import { ViolationRow } from './ui/ViolationRow'
import { api } from '@/lib/api'

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

interface ScanSummary {
  id: string
  artifact_name: string
  ruleset_name: string
  health_score: number
  violation_count: number
  high_count: number
  medium_count: number
  low_count: number
  created_at: string
}

interface ScanDetail extends ScanSummary {
  violations: Violation[]
}

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px',
  ...extra,
})

const label: React.CSSProperties = {
  fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted, marginBottom: 6,
}

const tag = (color: string, bg?: string): React.CSSProperties => ({
  fontFamily: mono, fontSize: 9, letterSpacing: '0.08em',
  padding: '2px 8px', borderRadius: 3,
  color, background: bg || C.surface2, border: `1px solid ${color}22`,
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

export default function HistoryTab() {
  const [scans, setScans] = useState<ScanSummary[]>([])
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)
  const [selectedScan, setSelectedScan] = useState<ScanDetail | null>(null)
  const [expandedViolationId, setExpandedViolationId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    api<ScanSummary[]>('/scans').then(setScans).catch(() => {})
  }, [])

  async function selectScan(id: string) {
    setSelectedScanId(id)
    setExpandedViolationId(null)
    setTypeFilter('all')
    setLoadingDetail(true)
    try {
      const data = await api<ScanDetail>(`/scans/${id}`)
      setSelectedScan(data)
    } catch {
      setSelectedScan(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const reversedScans = useMemo(() => [...scans].reverse(), [scans])

  const violationTypes = useMemo(() => {
    if (!selectedScan) return []
    const set = new Set(selectedScan.violations.map(v => v.type))
    return Array.from(set)
  }, [selectedScan])

  const filteredViolations = useMemo(() => {
    if (!selectedScan) return []
    if (typeFilter === 'all') return selectedScan.violations
    return selectedScan.violations.filter(v => v.type === typeFilter)
  }, [selectedScan, typeFilter])

  // Read-only handlers for ViolationRow
  const noop = () => {}
  const noopIgnore = (_id: string, _ignored: boolean) => {}

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0,
      height: '100%', minHeight: 500,
    }}>
      {/* Left sidebar */}
      <div style={{
        borderRight: `1px solid ${C.border}`,
        overflow: 'auto',
        background: C.surface,
      }}>
        {/* Sidebar header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
          position: 'sticky', top: 0, background: C.surface, zIndex: 1,
        }}>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted }}>
            SCAN HISTORY
          </span>
          <span style={{
            fontFamily: mono, fontSize: 10, color: C.dim,
            padding: '2px 8px', borderRadius: 3, background: C.surface2,
          }}>
            {scans.length}
          </span>
        </div>

        {/* Scan list */}
        {reversedScans.map(scan => {
          const isActive = scan.id === selectedScanId
          return (
            <div
              key={scan.id}
              onClick={() => selectScan(scan.id)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: `1px solid ${C.border}`,
                borderLeft: isActive ? `3px solid ${C.blue}` : '3px solid transparent',
                background: isActive ? C.blueDim : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = C.surface2
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              {/* Artifact name + score ring */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  fontFamily: syne, fontSize: 12, color: C.text, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 180,
                }}>
                  {scan.artifact_name}
                </span>
                <ScoreRing score={scan.health_score} size={28} />
              </div>

              {/* Timestamp */}
              <div style={{ fontFamily: mono, fontSize: 10, color: C.dim, marginBottom: 6 }}>
                {fmtDate(scan.created_at)} {fmtTime(scan.created_at)}
              </div>

              {/* Severity badges */}
              <div style={{ display: 'flex', gap: 6 }}>
                {scan.high_count > 0 && (
                  <span style={{
                    fontFamily: mono, fontSize: 9, color: SEVC.high,
                    padding: '1px 5px', borderRadius: 2, background: `${SEVC.high}15`,
                  }}>
                    {scan.high_count}H
                  </span>
                )}
                {scan.medium_count > 0 && (
                  <span style={{
                    fontFamily: mono, fontSize: 9, color: SEVC.medium,
                    padding: '1px 5px', borderRadius: 2, background: `${SEVC.medium}15`,
                  }}>
                    {scan.medium_count}M
                  </span>
                )}
                {scan.low_count > 0 && (
                  <span style={{
                    fontFamily: mono, fontSize: 9, color: SEVC.low,
                    padding: '1px 5px', borderRadius: 2, background: `${SEVC.low}15`,
                  }}>
                    {scan.low_count}L
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {scans.length === 0 && (
          <div style={{
            padding: 30, textAlign: 'center',
            fontFamily: syne, fontSize: 12, color: C.dim,
          }}>
            No scans yet
          </div>
        )}
      </div>

      {/* Right detail panel */}
      <div style={{ overflow: 'auto', padding: 20 }}>
        {!selectedScanId && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', minHeight: 400,
          }}>
            <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', color: C.dim }}>
              SELECT A SCAN TO INSPECT
            </span>
          </div>
        )}

        {loadingDetail && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', minHeight: 400,
          }}>
            <span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>
              Loading...
            </span>
          </div>
        )}

        {selectedScan && !loadingDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: syne, fontSize: 18, fontWeight: 700, color: C.text }}>
                {selectedScan.artifact_name}
              </span>
              <span style={tag(C.blue, C.blueDim)}>
                {selectedScan.id.slice(0, 8)}
              </span>
              <span style={tag(C.muted)}>
                {fmtDate(selectedScan.created_at)} {fmtTime(selectedScan.created_at)}
              </span>
              <span style={tag(C.purple, `${C.purple}12`)}>
                {selectedScan.ruleset_name}
              </span>
            </div>

            {/* Score + violation count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ScoreRing score={selectedScan.health_score} size={50} />
              <div>
                <div style={label}>VIOLATIONS</div>
                <div style={{ fontFamily: syne, fontSize: 28, fontWeight: 700, color: C.text }}>
                  {selectedScan.violation_count}
                </div>
              </div>
            </div>

            {/* Insights */}
            <ScanInsights violations={selectedScan.violations} />

            {/* Type filter tabs */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setTypeFilter('all')}
                style={{
                  fontFamily: mono, fontSize: 10, letterSpacing: '0.07em',
                  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                  background: typeFilter === 'all' ? C.blueDim : 'transparent',
                  border: `1px solid ${typeFilter === 'all' ? C.blue : C.border2}`,
                  color: typeFilter === 'all' ? C.blue : C.muted,
                  transition: 'all 0.15s',
                }}
              >
                ALL ({selectedScan.violations.length})
              </button>
              {violationTypes.map(t => {
                const meta = VMETA[t]
                const count = selectedScan.violations.filter(v => v.type === t).length
                const active = typeFilter === t
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    style={{
                      fontFamily: mono, fontSize: 10, letterSpacing: '0.07em',
                      padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                      background: active ? `${meta?.color || C.muted}18` : 'transparent',
                      border: `1px solid ${active ? (meta?.color || C.muted) : C.border2}`,
                      color: active ? (meta?.color || C.muted) : C.muted,
                      transition: 'all 0.15s',
                    }}
                  >
                    {meta?.icon || '!'} {meta?.short || t} ({count})
                  </button>
                )
              })}
            </div>

            {/* Violation list (read-only) */}
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

              {filteredViolations.map((v, i) => (
                <ViolationRow
                  key={v.id}
                  violation={v}
                  index={i}
                  isExpanded={expandedViolationId === v.id}
                  onToggle={() => setExpandedViolationId(expandedViolationId === v.id ? null : v.id)}
                  onApplyFix={noop}
                  onIgnore={noopIgnore}
                  isFixed={v.status === 'fixed'}
                  showPath={true}
                />
              ))}

              {filteredViolations.length === 0 && (
                <div style={{
                  padding: 40, textAlign: 'center',
                  fontFamily: syne, fontSize: 13, color: C.dim,
                }}>
                  No violations match current filter
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
