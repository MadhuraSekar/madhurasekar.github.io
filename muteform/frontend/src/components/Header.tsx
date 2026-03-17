'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { tokens } from '@/lib/design-tokens'

const T = tokens

const NAV_ITEMS = [
  { label: 'Playground', href: '/playground' },
  { label: 'Demo', href: '/demo' },
  { label: 'Governance', href: '/governance' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Waitlist', href: '/waitlist' },
]

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <>
      <style>{`
        .hdr-links { display: flex; align-items: center; gap: 4px; }
        .hdr-hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; color: ${T.text}; }
        .hdr-mobile {
          display: none; position: fixed; top: 52px; left: 0; right: 0;
          background: ${T.bg}; border-bottom: 1px solid ${T.border};
          z-index: 199; flex-direction: column; padding: 16px 20px; gap: 4px;
        }
        .hdr-mobile.open { display: flex; }
        .hdr-mobile a {
          font-family: ${T.fontMono}; font-size: 13px; padding: 12px 0;
          border-bottom: 1px solid ${T.border}; color: ${T.textMuted}; text-decoration: none;
        }
        .hdr-mobile a:last-child { border-bottom: none; }
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
        padding: '0 24px', height: 52,
        background: T.bg, borderBottom: `1px solid ${T.border}`,
        fontFamily: T.fontMono,
      }}>
        {/* Logo */}
        <a href="/" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          textDecoration: 'none', flexShrink: 0,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: T.radius.sm,
            background: T.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 13, color: '#fff',
            }}>M</span>
          </div>
          <span style={{
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 14,
            color: T.text, letterSpacing: '-0.01em',
          }}>muteform</span>
        </a>

        {/* Center nav */}
        <div className="hdr-links" style={{ gap: 2, flex: 1, justifyContent: 'center' }}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href
            return (
              <a key={item.label} href={item.href} style={{
                fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.04em',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? T.text : T.textMuted,
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: T.radius.sm,
                background: isActive ? T.surface2 : 'transparent',
                transition: 'all 0.15s ease',
              }}>{item.label}</a>
            )
          })}
        </div>

        {/* Right */}
        <div className="hdr-links" style={{ gap: 10, flexShrink: 0 }}>
          <a href="/#waitlist" style={{
            fontFamily: T.fontMono, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
            color: '#fff', background: T.blue,
            padding: '8px 16px', borderRadius: T.radius.sm,
            textDecoration: 'none', transition: 'opacity 0.15s ease',
          }}>Get beta access</a>
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

      <div className={`hdr-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <div className={`hdr-mobile ${mobileOpen ? 'open' : ''}`}>
        {NAV_ITEMS.map(item => (
          <a key={item.label} href={item.href} style={{
            color: pathname === item.href ? T.text : T.textMuted,
            fontWeight: pathname === item.href ? 600 : 400,
          }}>{item.label}</a>
        ))}
      </div>
    </>
  )
}
