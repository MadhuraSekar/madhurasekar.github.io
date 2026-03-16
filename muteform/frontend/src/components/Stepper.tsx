'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { loadSession } from '@/lib/session'
import ThemeToggle from '@/components/ThemeToggle'

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

  useEffect(() => {
    const session = loadSession()
    setCompletedSteps(session.completedSteps || [])
    if (session.user?.name) {
      setUserName(session.user.name)
    }
  }, [])

  if (!PRODUCT_PATHS.some(p => pathname === p)) return null

  const currentIdx = STEPS.findIndex(s => pathname === s.href)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 24px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'relative',
      zIndex: 50,
      fontFamily: 'var(--font-sans)',
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
          width: 26, height: 26, borderRadius: 4,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700,
            color: 'var(--bg)',
          }}>M</span>
        </div>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}>muteform</span>
      </a>

      {/* Steps */}
      <div className="stepper-steps-scroll">
        {STEPS.map((step, i) => {
          const isActive = i === currentIdx
          const isCompleted = completedSteps.includes(i)
          const isFuture = !isActive && !isCompleted
          const isClickable = isCompleted || isActive

          return (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {isClickable ? (
                <a
                  href={step.href}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    color: isActive ? 'var(--text-primary)' : 'var(--accent)',
                    padding: '6px 12px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    transition: 'all 150ms ease',
                  }}
                >
                  {isCompleted ? (
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : (
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: '2px solid var(--accent)',
                      background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
                      color: 'var(--accent)',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                  )}
                  {step.label}
                </a>
              ) : (
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  padding: '6px 12px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  opacity: isFuture ? 0.7 : 1,
                  cursor: 'default',
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  {step.label}
                </span>
              )}

              {/* Connection line between steps */}
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 32, height: 1, margin: '0 2px',
                  background: isCompleted ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 400ms ease',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Right side: user name + ThemeToggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginLeft: 16, flexShrink: 0,
      }}>
        {userName && (
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}>
            {userName}
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  )
}
