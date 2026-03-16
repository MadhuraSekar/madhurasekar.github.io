'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { loadSession } from '@/lib/session'

const T = {
  bg: '#080909', surface: '#0c0d0f', surface2: '#101214',
  border: '#161819', border2: '#1e2226',
  green: '#22c55e', greenDim: '#22c55e18',
  text: '#f0f1f3', muted: '#6b7280', dim: '#374151',
}
const mono = "'DM Mono', monospace"
const syne = "'Syne', sans-serif"

const STEPS = [
  { label: 'Import', href: '/import', step: 0 },
  { label: 'Rules', href: '/rules', step: 1 },
  { label: 'Scan', href: '/scan', step: 2 },
  { label: 'Report', href: '/report', step: 3 },
]

const PRODUCT_PATHS = ['/import', '/rules', '/scan', '/report', '/integrate']

export default function Stepper() {
  const pathname = usePathname()
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)
  const [hoveredMcp, setHoveredMcp] = useState(false)

  useEffect(() => {
    const session = loadSession()
    setCompletedSteps(session.completedSteps || [])
    if (session.user?.name) {
      setUserName(session.user.name)
    }
  }, [])

  // Only show on product pages
  if (!PRODUCT_PATHS.some(p => pathname === p)) return null

  const currentIdx = STEPS.findIndex(s => pathname === s.href)

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 24px',
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      position: 'relative',
      zIndex: 50,
    }}>
      <style>{`
        .stepper-steps-scroll {
          display: flex;
          align-items: center;
          flex: 1;
          justify-content: center;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .stepper-steps-scroll::-webkit-scrollbar { display: none; }
        @media (max-width: 640px) {
          .stepper-steps-scroll { justify-content: flex-start; }
        }
      `}</style>

      {/* Logo */}
      <a href="/" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        textDecoration: 'none', marginRight: 24, flexShrink: 0,
        transition: 'opacity 150ms ease',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: T.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T.bg }}>M</span>
        </div>
        <span style={{ fontFamily: syne, fontSize: 15, fontWeight: 700, color: T.text }}>muteform</span>
      </a>

      {/* Steps */}
      <div className="stepper-steps-scroll">
        {STEPS.map((step, i) => {
          const isActive = i === currentIdx
          const isCompleted = completedSteps.includes(i)
          const isClickable = isCompleted || isActive
          const isFuture = !isActive && !isCompleted
          const isHovered = hoveredStep === i

          return (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {isClickable ? (
                <a
                  href={step.href}
                  onMouseEnter={() => setHoveredStep(i)}
                  onMouseLeave={() => setHoveredStep(null)}
                  style={{
                    fontFamily: mono, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                    color: isActive ? '#000' : T.green,
                    background: isActive ? T.green : (isHovered ? `${T.green}22` : T.greenDim),
                    padding: '6px 14px', borderRadius: 6,
                    border: isCompleted && !isActive ? `1px solid ${T.green}33` : '1px solid transparent',
                    whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 150ms ease',
                    transform: isHovered && !isActive ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: isActive ? 'rgba(0,0,0,0.15)' : `${T.green}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: mono, fontSize: 10, fontWeight: 700,
                    color: isActive ? '#000' : T.green,
                  }}>
                    {isCompleted ? '\u2713' : i + 1}
                  </span>
                  {step.label}
                </a>
              ) : (
                <span style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600,
                  color: T.dim,
                  padding: '6px 14px', borderRadius: 6,
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: isFuture ? 0.6 : 1,
                  cursor: 'default',
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: T.surface2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: mono, fontSize: 10, fontWeight: 700,
                    color: T.dim,
                    border: `1px solid ${T.border2}`,
                  }}>
                    {i + 1}
                  </span>
                  {step.label}
                </span>
              )}

              {/* Connection line between steps */}
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 32, height: 2, margin: '0 2px',
                  background: isCompleted ? T.green : T.border,
                  borderRadius: 1,
                  transition: 'background 400ms ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Animated fill for the progress line */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    background: T.green,
                    transform: isCompleted ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left center',
                    transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right side: MCP link + user name */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginLeft: 16, flexShrink: 0,
      }}>
        <a
          href="/integrate"
          onMouseEnter={() => setHoveredMcp(true)}
          onMouseLeave={() => setHoveredMcp(false)}
          style={{
            fontFamily: mono, fontSize: 11, fontWeight: 600,
            color: pathname === '/integrate' ? T.green : T.muted,
            textDecoration: 'none',
            padding: '5px 12px', borderRadius: 6,
            whiteSpace: 'nowrap',
            background: pathname === '/integrate' ? T.greenDim : (hoveredMcp ? `${T.text}08` : 'transparent'),
            transition: 'all 150ms ease',
          }}
        >
          MCP
        </a>

        {userName && (
          <span style={{
            fontFamily: mono, fontSize: 11, color: T.muted,
            whiteSpace: 'nowrap',
            padding: '4px 10px',
            background: T.surface2,
            borderRadius: 5,
            border: `1px solid ${T.border}`,
          }}>
            {userName}
          </span>
        )}
      </div>
    </div>
  )
}
