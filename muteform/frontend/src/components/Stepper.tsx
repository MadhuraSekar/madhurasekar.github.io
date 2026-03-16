'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { loadSession } from '@/lib/session'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const session = loadSession()
    setCompletedSteps(session.completedSteps || [])
  }, [])

  if (!PRODUCT_PATHS.some(p => pathname === p)) return null

  const currentIdx = STEPS.findIndex(s => pathname === s.href)

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: 56,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      fontFamily: 'var(--font-mono)',
    }}>

      {/* Logo */}
      <a href="/" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        textDecoration: 'none', flexShrink: 0,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 4,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700,
            color: '#fff',
          }}>M</span>
        </div>
        <span style={{
          fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}>muteform</span>
      </a>

      {/* Steps (desktop) */}
      <div className="nav-links" style={{ gap: 4, flex: 1, justifyContent: 'center' }}>
        {STEPS.map((step, i) => {
          const isActive = i === currentIdx
          const isCompleted = completedSteps.includes(i)
          const isClickable = isCompleted || isActive

          return (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {isClickable ? (
                <a
                  href={step.href}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: 'none',
                    color: isActive ? 'var(--text-primary)' : 'var(--accent)',
                    padding: '6px 10px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {isCompleted ? (
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : (
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: '2px solid var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
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
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  padding: '6px 10px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: 0.6,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  {step.label}
                </span>
              )}

              {/* Connection line */}
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 24, height: 1, margin: '0 2px',
                  background: isCompleted ? 'var(--accent)' : 'var(--border)',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Get help (desktop) */}
      <div className="nav-links" style={{ gap: 10, flexShrink: 0 }}>
        <a href="/integrate" style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--text-secondary)', textDecoration: 'none',
        }}>Get help</a>
      </div>

      {/* Hamburger (mobile) */}
      <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Mobile menu — uses global .nav-mobile-menu from globals.css */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        {STEPS.map(step => (
          <a key={step.label} href={step.href} onClick={() => setMobileMenuOpen(false)}>
            {step.label}
          </a>
        ))}
        <a href="/integrate" onClick={() => setMobileMenuOpen(false)}>Get help</a>
      </div>
    </nav>
  )
}
