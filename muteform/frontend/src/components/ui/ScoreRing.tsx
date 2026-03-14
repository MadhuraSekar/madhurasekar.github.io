'use client'
import { C, mono, scoreColor } from './tokens'

export function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const col = scoreColor(score)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border2} strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={3}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{
          fontFamily: mono, fontSize: size * 0.22, fill: col, fontWeight: 700,
          transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`,
        }}>
        {score}
      </text>
    </svg>
  )
}
