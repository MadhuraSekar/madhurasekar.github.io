'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { loadSession } from '@/lib/session'

const T = tokens

const APP_STEPS = [
  { label: 'Import', href: '/import', step: 0 },
  { label: 'Rules', href: '/rules', step: 1 },
  { label: 'Scan', href: '/scan', step: 2 },
  { label: 'Report', href: '/report', step: 3 },
]

const APP_PATHS = ['/import', '/rules', '/scan', '/report', '/integrate']

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const isApp = APP_PATHS.includes(pathname)

  useEffect(() => {
    if (isApp) {
      const session = loadSession()
      setCompletedSteps(session.completedSteps || [])
    }
  }, [isApp])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const currentStepIdx = APP_STEPS.findIndex(s => pathname === s.href)

  return (
    <>
      <style>{`
        .hdr-links { display: flex; align-items: center; gap: 24px; }
        .hdr-hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; color: ${T.text}; }
        .hdr-mobile {
          display: none; position: fixed; top: 56px; left: 0; right: 0;
          background: ${T.bg}; border-bottom: 1px solid ${T.border};
          z-index: 199; flex-direction: column; padding: 16px 20px; gap: 4px;
        }
        .hdr-mobile.open { display: flex; }
        .hdr-mobile a, .hdr-mobile span {
          font-family: ${T.fontMono}; font-size: 13px; padding: 12px 0;
          border-bottom: 1px solid ${T.border}; color: ${T.textMuted}; text-decoration: none;
        }
        .hdr-mobile a:last-child, .hdr-mobile span:last-child { border-bottom: none; }
        .hdr-overlay { display: none; position: fixed; inset: 0; z-index: 198; background: rgba(0,0,0,0.5); }
        .hdr-overlay.open { display: block; }
        @media (max-width: 768px) {
          .hdr-links { display: none !important; }
          .hdr-hamburger { display: flex !important; }
        }
      `}</style>

      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56,
        background: T.bg, borderBottom: `1px solid ${T.border}`,
        fontFamily: T.fontMono,
      }}>
        {/* Logo */}
        <a href="/" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          textDecoration: 'none', flexShrink: 0,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: T.radius.sm,
            background: T.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 15, color: '#fff',
            }}>M</span>
          </div>
          <span style={{
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 15,
            color: T.text, letterSpacing: '-0.01em',
          }}>muteform</span>
        </a>

        {/* Center: nav links or step indicator */}
        {isApp ? (
          <div className="hdr-links" style={{ gap: 4, flex: 1, justifyContent: 'center' }}>
            {APP_STEPS.map((step, i) => {
              const isActive = i === currentStepIdx
              const isCompleted = completedSteps.includes(i)
              const isClickable = isCompleted || isActive

              const circle = isCompleted ? (
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: T.blue,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              ) : (
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: isActive ? `2px solid ${T.blue}` : `1px solid ${T.border2}`,
                  background: isActive ? 'transparent' : T.surface2,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.fontMono, fontSize: 10, fontWeight: 600,
                  color: isActive ? T.blue : T.textMuted, flexShrink: 0,
                }}>
                  {i + 1}
                </span>
              )

              const label = (
                <span style={{
                  fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.08em',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? T.text : isCompleted ? T.blue : T.textMuted,
                }}>
                  {step.label}
                </span>
              )

              const connector = i < APP_STEPS.length - 1 ? (
                <div style={{
                  width: 24, height: 1, margin: '0 2px',
                  background: isCompleted ? T.blue : T.border,
                }} />
              ) : null

              return (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {isClickable ? (
                    <a href={step.href} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', textDecoration: 'none',
                    }}>
                      {circle}{label}
                    </a>
                  ) : (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', opacity: 0.6,
                    }}>
                      {circle}{label}
                    </span>
                  )}
                  {connector}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="hdr-links" style={{ gap: 28 }}>
            <a href="/demo" style={{
              fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.08em',
              color: pathname === '/demo' ? T.text : T.textMuted,
              fontWeight: pathname === '/demo' ? 600 : 400,
              textDecoration: 'none',
            }}>Demo</a>
            <a href="/integrate" style={{
              fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.08em',
              color: pathname === '/integrate' ? T.text : T.textMuted,
              fontWeight: pathname === '/integrate' ? 600 : 400,
              textDecoration: 'none',
            }}>Docs</a>
          </div>
        )}

        {/* Right side */}
        <div className="hdr-links" style={{ gap: 10, flexShrink: 0 }}>
          {isApp ? (
            <a href="/integrate" style={{
              fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.08em',
              color: T.textMuted, textDecoration: 'none',
            }}>Get help</a>
          ) : (
            <a href="/#waitlist" style={{
              fontFamily: T.fontMono, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
              color: '#fff', background: T.blue,
              padding: '10px 20px', borderRadius: T.radius.md,
              textDecoration: 'none',
            }}>Get beta access</a>
          )}
        </div>

        {/* Hamburger */}
        <button className="hdr-hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile overlay */}
      <div className={`hdr-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />

      {/* Mobile slide-down menu */}
      <div className={`hdr-mobile ${mobileOpen ? 'open' : ''}`}>
        {isApp ? (
          <>
            {APP_STEPS.map(step => (
              <a key={step.label} href={step.href} style={{
                color: pathname === step.href ? T.text : T.textMuted,
                fontWeight: pathname === step.href ? 600 : 400,
              }}>{step.label}</a>
            ))}
            <a href="/integrate" style={{ color: T.textMuted }}>Get help</a>
          </>
        ) : (
          <>
            <a href="/demo" style={{ color: pathname === '/demo' ? T.text : T.textMuted }}>Demo</a>
            <a href="/integrate" style={{ color: T.textMuted }}>Docs</a>
            <a href="/#waitlist" style={{
              color: '#fff', background: T.blue, borderRadius: T.radius.md,
              textAlign: 'center', padding: '12px 0', border: 'none', marginTop: 8,
            }}>Get beta access</a>
          </>
        )}
      </div>
    </>
  )
}
