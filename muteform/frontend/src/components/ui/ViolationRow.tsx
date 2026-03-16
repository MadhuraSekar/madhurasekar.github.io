'use client'
import { useState } from 'react'
import { C, mono, syne, VMETA, SEVC } from './tokens'
import { VisualComparison, ConfidenceBadge, SeverityBadge } from './VisualComparison'

interface ViolationRowProps {
  violation: any
  index: number
  isExpanded: boolean
  onToggle: () => void
  onApplyFix: (violation: any) => void
  onIgnore: (id: string, ignored: boolean) => void
  isFixed: boolean
  showPath: boolean
}

export function ViolationRow({
  violation, index, isExpanded, onToggle, onApplyFix, onIgnore, isFixed, showPath,
}: ViolationRowProps) {
  const [hovering, setHovering] = useState(false)
  const meta = VMETA[violation.type] || { label: 'Issue', short: 'Issue', icon: '!', color: C.muted }
  const isIgnored = violation.status === 'ignored'
  const confidence = violation.confidence || 'manual'

  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      opacity: isIgnored ? 0.45 : isFixed ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          cursor: 'pointer', background: hovering ? C.surface2 : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        {/* Expand arrow */}
        <span style={{
          fontFamily: mono, fontSize: 10, color: C.dim, width: 14, textAlign: 'center',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s', display: 'inline-block',
        }}>
          {'\u25B6'}
        </span>

        {/* Type icon */}
        <span style={{
          fontFamily: mono, fontSize: 11, color: meta.color,
          width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 3, background: `${meta.color}15`, flexShrink: 0,
        }}>
          {meta.icon}
        </span>

        {/* Severity badge */}
        <SeverityBadge severity={violation.severity} />

        {/* Message */}
        <span style={{
          fontFamily: syne, fontSize: 12, color: C.text, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: isFixed ? 'line-through' : isIgnored ? 'line-through' : 'none',
        }}>
          {violation.message || 'Unnamed violation'}
        </span>

        {/* Node name */}
        {violation.nodeName && (
          <span style={{
            fontFamily: mono, fontSize: 10, color: C.muted, flexShrink: 0,
            maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {violation.nodeName}
          </span>
        )}

        {/* Confidence badge */}
        <ConfidenceBadge level={confidence} />

        {/* Status indicator */}
        {isFixed && (
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: '0.08em',
            color: C.green, padding: '2px 6px', borderRadius: 3,
            background: C.greenDim, border: `1px solid ${C.greenBorder}`,
          }}>
            FIXED
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{
          padding: '0 14px 14px 42px',
          borderTop: `1px solid ${C.border}`,
          background: C.surface,
        }}>
          {/* Node path */}
          {violation.nodePath && (
            <div style={{
              fontFamily: mono, fontSize: 10, color: C.muted, padding: '8px 0 4px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {violation.nodePath}
            </div>
          )}

          {/* Node ID */}
          {violation.nodeId && (
            <div style={{
              fontFamily: mono, fontSize: 10, color: C.dim2, padding: '4px 0',
            }}>
              ID: {violation.nodeId}
            </div>
          )}

          {/* Visual comparison */}
          {(violation.currentValue || violation.actual || violation.suggestedValue || violation.expected) && (
            <VisualComparison violation={violation} />
          )}

          {/* Description */}
          {violation.description && (
            <p style={{
              fontFamily: syne, fontSize: 12, color: C.muted,
              lineHeight: 1.5, margin: '8px 0',
            }}>
              {violation.description}
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {!isFixed && !isIgnored && (
              <button
                onClick={(e) => { e.stopPropagation(); onApplyFix(violation) }}
                style={{
                  fontFamily: mono, fontSize: 10, letterSpacing: '0.07em',
                  padding: '5px 12px', borderRadius: 3, cursor: 'pointer',
                  background: confidence === 'high' ? C.green : C.blue,
                  color: '#fff', border: 'none', transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {confidence === 'high' ? 'AUTO-FIX' : 'APPLY FIX'}
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation()
                onIgnore(violation.id || `v-${index}`, !isIgnored)
              }}
              style={{
                fontFamily: mono, fontSize: 10, letterSpacing: '0.07em',
                padding: '5px 12px', borderRadius: 3, cursor: 'pointer',
                background: 'transparent',
                border: `1px solid ${isIgnored ? C.amber : C.border2}`,
                color: isIgnored ? C.amber : C.muted, transition: 'all 0.15s',
              }}
            >
              {isIgnored ? 'UNIGNORE' : 'IGNORE'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
