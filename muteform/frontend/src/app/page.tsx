'use client'

import React, { useState, useEffect, useRef, useCallback, FormEvent, CSSProperties } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

/* ── fade-in on scroll hook ── */
function useFadeIn(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            setVisible(true)
            obs.unobserve(el)
          }
        }
      },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return function () { obs.disconnect() }
  }, [])

  return [ref, visible]
}

/* ── reusable fade wrapper ── */
function FadeIn({ children, delay, style }: {
  children: React.ReactNode
  delay?: number
  style?: CSSProperties
}) {
  const [ref, visible] = useFadeIn()
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        transitionDelay: delay ? delay + 'ms' : '0ms',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ── comparison line for hero code block ── */
function CodeLine({ text, marker, isError }: {
  text: string; marker: string; isError: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      <span style={{
        color: isError ? 'var(--error)' : 'var(--success)',
        fontWeight: 700,
        flexShrink: 0,
        width: 16,
        textAlign: 'center',
      }}>
        {marker}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  )
}

/* ── main page ── */
export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [formState, setFormState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleWaitlist = useCallback(async function (e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setFormState('sending')
    try {
      var res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) throw new Error('Request failed')
      await res.json()
      setFormState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setFormState('error')
    }
  }, [email])

  /* ── shared styles ── */
  const section: CSSProperties = {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '96px 24px',
  }

  return (
    <div style={{
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      lineHeight: 1.6,
      minHeight: '100vh',
    }}>

      {/* ── page-scoped responsive styles ── */}
      <style>{`
        a { color: inherit; text-decoration: none; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-heading { font-size: 32px !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .section-pad { padding: 64px 20px !important; }
          .footer-inner { flex-direction: column; text-align: center; gap: 16px; }
        }
      `}</style>

      {/* ================================================================
          NAV
      ================================================================ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56,
        }}>
          {/* logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 4,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 15,
                color: '#fff',
              }}>M</span>
            </div>
            <span style={{
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
              color: 'var(--text-primary)', letterSpacing: '-0.01em',
            }}>
              muteform
            </span>
          </a>

          {/* center links (desktop) */}
          <div className="nav-links" style={{ gap: 28 }}>
            <a href="/demo" style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: 'var(--text-secondary)', transition: 'color 150ms ease',
            }}>Demo</a>
            <a href="/integrate" style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: 'var(--text-secondary)', transition: 'color 150ms ease',
            }}>Docs</a>
          </div>

          {/* right side (desktop) */}
          <div className="nav-links" style={{ gap: 10 }}>
            <a href="#waitlist" style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
              color: '#fff',
              background: 'var(--accent)',
              padding: '7px 18px', borderRadius: 4,
              transition: 'all 150ms ease',
            }}>
              Get beta access
            </a>
            <ThemeToggle />
          </div>

          {/* hamburger (mobile) */}
          <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </nav>

      {/* mobile menu — uses global .nav-mobile-menu from globals.css */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        <a href="/demo" onClick={() => setMobileMenuOpen(false)}>Demo</a>
        <a href="/integrate" onClick={() => setMobileMenuOpen(false)}>Docs</a>
        <a href="#waitlist" onClick={() => setMobileMenuOpen(false)} style={{
          fontWeight: 600, color: '#fff', background: 'var(--accent)',
          borderRadius: 4, textAlign: 'center', marginTop: 8,
          padding: '12px 0', border: 'none',
        }}>Get beta access</a>
      </div>

      {/* ================================================================
          HERO
      ================================================================ */}
      <section style={{ ...section, paddingTop: 80, paddingBottom: 64 }} className="section-pad">
        <div className="hero-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 64,
          alignItems: 'center',
        }}>
          {/* Left: text */}
          <div>
            <FadeIn>
              <h1 className="hero-heading" style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 52,
                fontWeight: 700,
                lineHeight: 1.1,
                color: 'var(--text-primary)',
                margin: '0 0 24px',
                letterSpacing: '-0.02em',
              }}>
                Your design system.{' '}Enforced everywhere.
              </h1>
            </FadeIn>

            <FadeIn delay={100}>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
                margin: '0 0 36px',
                maxWidth: 520,
              }}>
                Muteform turns your design system into a living, executable contract.
                Every AI&nbsp;tool. Every generated interface.
              </p>
            </FadeIn>

            <FadeIn delay={200}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <a href="/import" style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  background: 'var(--accent)',
                  padding: '12px 24px',
                  borderRadius: 4,
                  display: 'inline-block',
                  transition: 'all 150ms ease',
                }}>
                  Start with your design system &rarr;
                </a>
                <a href="/demo" style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--accent)',
                  transition: 'opacity 150ms ease',
                }}>
                  Watch demo
                </a>
              </div>
            </FadeIn>
          </div>

          {/* Right: code comparison */}
          <FadeIn delay={300}>
            <div style={{
              background: 'var(--code-bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              {/* Without governance */}
              <div style={{
                borderBottom: '1px solid var(--border)',
                padding: '14px 16px 12px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  color: 'var(--error)', letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const, marginBottom: 10,
                }}>
                  Without governance
                </div>
                <CodeLine text={'color: #3478F6       \u2190 not a token'} marker={'\u2715'} isError={true} />
                <CodeLine text={'padding: 22px        \u2190 off scale'} marker={'\u2715'} isError={true} />
                <CodeLine text={'font-size: 15px      \u2190 not in system'} marker={'\u2715'} isError={true} />
                <CodeLine text={'variant="ghost"      \u2190 unapproved'} marker={'\u2715'} isError={true} />
              </div>

              {/* After Muteform */}
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  color: 'var(--success)', letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const, marginBottom: 10,
                }}>
                  After Muteform
                </div>
                <CodeLine text="color: tokens.primary" marker={'\u2713'} isError={false} />
                <CodeLine text="padding: spacing[4]" marker={'\u2713'} isError={false} />
                <CodeLine text="font-size: type.body" marker={'\u2713'} isError={false} />
                <CodeLine text='variant="primary"' marker={'\u2713'} isError={false} />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS
      ================================================================ */}
      <section style={section} className="section-pad">
        <FadeIn>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.2,
            color: 'var(--text-primary)',
            margin: '0 0 56px',
            letterSpacing: '-0.01em',
          }}>
            How it works
          </h2>
        </FadeIn>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {[
            { num: '1', title: 'Import your design system', desc: 'Connect Figma tokens, Tailwind configs, or any token JSON. Muteform learns your system in seconds.' },
            { num: '2', title: 'Define governance rules', desc: 'Set policies for color, spacing, typography, and accessibility. Start with built-in rules or write your own.' },
            { num: '3', title: 'AI generates. Muteform governs.', desc: 'Every AI-generated component is scanned against your rules in real time. Violations surface instantly.' },
            { num: '4', title: 'Ship with confidence.', desc: 'Auto-fix what can be fixed. Block what can\u2019t. Your design system stays intact, no matter who\u2014or what\u2014writes the code.' },
          ].map((step, i) => (
            <FadeIn key={step.num} delay={i * 80}>
              <div className="how-grid" style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr',
                gap: 24,
                alignItems: 'start',
              }}>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 40,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}>
                  {step.num}
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: '0 0 6px',
                  }}>
                    {step.title}
                  </h3>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    maxWidth: 560,
                  }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ================================================================
          BETA ACCESS
      ================================================================ */}
      <section id="waitlist" style={{ ...section, textAlign: 'center' }} className="section-pad">
        <FadeIn>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.25,
            color: 'var(--text-primary)',
            maxWidth: 560,
            margin: '0 auto 40px',
            letterSpacing: '-0.01em',
          }}>
            Get early access
          </h2>
        </FadeIn>

        <FadeIn delay={100}>
          {formState === 'success' ? (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500,
              color: 'var(--success)',
              background: 'var(--success-dim)',
              display: 'inline-block',
              padding: '14px 28px', borderRadius: 4,
            }}>
              You&rsquo;re on the list. We&rsquo;ll be in touch.
            </div>
          ) : (
            <form
              onSubmit={handleWaitlist}
              style={{
                display: 'flex', gap: 10, justifyContent: 'center',
                maxWidth: 460, margin: '0 auto', flexWrap: 'wrap',
              }}
            >
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={function (e) { setEmail(e.target.value) }}
                style={{
                  flex: 1, minWidth: 220,
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  color: 'var(--text-primary)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  padding: '11px 16px',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                }}
              />
              <button
                type="submit"
                disabled={formState === 'sending'}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
                  color: '#fff',
                  background: 'var(--accent)',
                  border: 'none', borderRadius: 4,
                  padding: '11px 24px',
                  cursor: formState === 'sending' ? 'wait' : 'pointer',
                  opacity: formState === 'sending' ? 0.7 : 1,
                  transition: 'all 150ms ease',
                }}
              >
                {formState === 'sending' ? 'Requesting...' : 'Request beta access'}
              </button>
            </form>
          )}

          {formState === 'error' && (
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: 'var(--error)', marginTop: 12,
            }}>
              {errorMsg || 'Something went wrong. Please try again.'}
            </p>
          )}
        </FadeIn>
      </section>

      {/* ================================================================
          FOOTER
      ================================================================ */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '32px 24px',
      }}>
        <div className="footer-inner" style={{
          maxWidth: 1120, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 4,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 12,
                color: '#fff',
              }}>M</span>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--text-muted)',
            }}>
              &copy; 2025 Muteform
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/demo" style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--text-muted)', transition: 'color 150ms ease',
            }}>Demo</a>
            <a href="/import" style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--text-muted)', transition: 'color 150ms ease',
            }}>Get Started</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
