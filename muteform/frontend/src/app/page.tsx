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

/* ── testimonial card ── */
function QuoteCard({ quote, name, role, delay }: {
  quote: string; name: string; role: string; delay?: number
}) {
  return (
    <FadeIn delay={delay}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 4,
        padding: '32px 28px',
        border: '1px solid var(--border)',
        height: '100%',
        boxSizing: 'border-box' as const,
      }}>
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 18,
          fontStyle: 'italic',
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          margin: '0 0 24px',
        }}>
          &ldquo;{quote}&rdquo;
        </p>
        <div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            {name}
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 13,
            color: 'var(--text-muted)', marginTop: 2,
          }}>
            {role}
          </div>
        </div>
      </div>
    </FadeIn>
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
      fontFamily: 'var(--font-sans)',
      fontSize: 15,
      lineHeight: 1.6,
      minHeight: '100vh',
    }}>

      {/* ── global styles ── */}
      <style>{`
        a { color: inherit; text-decoration: none; }
        ::selection { background: var(--accent); color: var(--bg); }

        .nav-links { display: flex; align-items: center; gap: 32; }
        .nav-hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: var(--text-primary);
        }
        .nav-mobile-menu {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 280px;
          background: var(--surface);
          border-left: 1px solid var(--border);
          z-index: 200;
          display: flex;
          flex-direction: column;
          padding: 24px;
          gap: 16px;
          transform: translateX(100%);
          transition: transform 300ms ease;
        }
        .nav-mobile-menu.open { transform: translateX(0); }
        .nav-mobile-close {
          align-self: flex-end;
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 28px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }
        .nav-mobile-menu a {
          font-size: 16px;
          font-family: var(--font-sans);
          color: var(--text-primary);
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }

        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .nav-hamburger { display: block !important; }
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-heading { font-size: 36px !important; }
          .stats-row { flex-direction: column; gap: 32px !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .quotes-grid { grid-template-columns: 1fr !important; }
          .section-pad { padding: 64px 20px !important; }
          .footer-inner { flex-direction: column; text-align: center; gap: 16px; }
        }
      `}</style>

      {/* ================================================================
          NAV
      ================================================================ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60,
        }}>
          {/* logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 4,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 16,
                color: 'var(--bg)',
              }}>M</span>
            </div>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16,
              color: 'var(--text-primary)', letterSpacing: '-0.01em',
            }}>
              muteform
            </span>
          </a>

          {/* center links (desktop) */}
          <div className="nav-links">
            <a href="/demo" style={{
              fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
              color: 'var(--text-secondary)', transition: 'color 150ms ease',
            }}>Demo</a>
            <a href="/integrate" style={{
              fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
              color: 'var(--text-secondary)', transition: 'color 150ms ease',
            }}>Docs</a>
          </div>

          {/* right side (desktop) */}
          <div className="nav-links" style={{ gap: 12 }}>
            <a href="#waitlist" style={{
              fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
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

      {/* mobile menu */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        <a href="/demo" onClick={() => setMobileMenuOpen(false)}>Demo</a>
        <a href="/integrate" onClick={() => setMobileMenuOpen(false)}>Docs</a>
        <a href="#waitlist" onClick={() => setMobileMenuOpen(false)} style={{
          fontWeight: 600, color: 'var(--bg)', background: 'var(--accent)',
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
                fontFamily: 'var(--font-serif)',
                fontSize: 60,
                fontWeight: 400,
                lineHeight: 1.1,
                color: 'var(--text-primary)',
                margin: '0 0 24px',
                letterSpacing: '-0.02em',
              }}>
                Your design system,{'\n'}enforced everywhere.
              </h1>
            </FadeIn>

            <FadeIn delay={100}>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 17,
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
                margin: '0 0 36px',
                maxWidth: 520,
              }}>
                Muteform turns your design rules into executable policy.
                Every AI&nbsp;tool. Every generated interface. Automatically.
              </p>
            </FadeIn>

            <FadeIn delay={200}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <a href="/import" style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  color: 'var(--bg)',
                  background: 'var(--accent)',
                  padding: '12px 24px',
                  borderRadius: 4,
                  display: 'inline-block',
                  transition: 'all 150ms ease',
                }}>
                  Start with your system
                </a>
                <a href="/demo" style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--accent)',
                  transition: 'opacity 150ms ease',
                }}>
                  See it in action &rarr;
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
          STATS ROW
      ================================================================ */}
      <section style={{ ...section, paddingTop: 48, paddingBottom: 48 }} className="section-pad">
        <FadeIn>
          <div className="stats-row" style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 80,
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            padding: '48px 0',
          }}>
            {[
              { number: '9', caption: 'violations detected' },
              { number: '2ms', caption: 'to scan any UI' },
              { number: '100', caption: 'health score after governance' },
            ].map((stat) => (
              <div key={stat.caption} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 52,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  marginBottom: 8,
                }}>
                  {stat.number}
                </div>
                <div style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}>
                  {stat.caption}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ================================================================
          PROBLEM SECTION
      ================================================================ */}
      <section style={section} className="section-pad">
        <FadeIn>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.2,
            color: 'var(--text-primary)',
            margin: '0 0 40px',
            maxWidth: 680,
            letterSpacing: '-0.01em',
          }}>
            AI generates UI faster than any team can review.
          </h2>
        </FadeIn>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            'Every AI tool interprets your design system differently \u2014 or ignores it entirely.',
            'Manual reviews can\u2019t keep up with the volume of generated components.',
            'Without governance, design debt compounds with every prompt.',
          ].map((statement, i) => (
            <FadeIn key={i} delay={i * 80}>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
                margin: 0,
              }}>
                &mdash;&ensp;{statement}
              </p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS
      ================================================================ */}
      <section style={section} className="section-pad">
        <FadeIn>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 40,
            fontWeight: 400,
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
                gridTemplateColumns: '72px 1fr',
                gap: 24,
                alignItems: 'start',
              }}>
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 48,
                  fontWeight: 400,
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}>
                  {step.num}
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: '0 0 6px',
                  }}>
                    {step.title}
                  </h3>
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
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
          PROOF / TESTIMONIALS
      ================================================================ */}
      <section style={section} className="section-pad">
        <FadeIn>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.2,
            color: 'var(--text-primary)',
            margin: '0 0 48px',
            letterSpacing: '-0.01em',
          }}>
            What teams are saying
          </h2>
        </FadeIn>

        <div className="quotes-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          <QuoteCard
            quote="Finally something that survives a Figma handoff."
            name="Sarah Chen"
            role="Design Lead"
            delay={0}
          />
          <QuoteCard
            quote="Set it once. Every engineer's AI output is governed automatically."
            name="Marcus Webb"
            role="Design Systems"
            delay={140}
          />
          <QuoteCard
            quote="The WCAG check alone saves us hours every sprint."
            name="Priya Patel"
            role="Senior Designer"
            delay={280}
          />
        </div>
      </section>

      {/* ================================================================
          BOTTOM CTA
      ================================================================ */}
      <section id="waitlist" style={{ ...section, textAlign: 'center' }} className="section-pad">
        <FadeIn>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.25,
            color: 'var(--text-primary)',
            maxWidth: 640,
            margin: '0 auto 40px',
            letterSpacing: '-0.01em',
          }}>
            Design systems were built for humans.{'\n'}AI needs governance infrastructure.
          </h2>
        </FadeIn>

        <FadeIn delay={100}>
          {formState === 'success' ? (
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500,
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
                  fontFamily: 'var(--font-sans)', fontSize: 14,
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
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
                  letterSpacing: '0.01em',
                  color: 'var(--bg)',
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
              fontFamily: 'var(--font-sans)', fontSize: 13,
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
                color: 'var(--bg)',
              }}>M</span>
            </div>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 13,
              color: 'var(--text-muted)',
            }}>
              &copy; 2025 Muteform
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/demo" style={{
              fontFamily: 'var(--font-sans)', fontSize: 13,
              color: 'var(--text-muted)', transition: 'color 150ms ease',
            }}>Demo</a>
            <a href="/import" style={{
              fontFamily: 'var(--font-sans)', fontSize: 13,
              color: 'var(--text-muted)', transition: 'color 150ms ease',
            }}>Get Started</a>
            <a href="#waitlist" style={{
              fontFamily: 'var(--font-sans)', fontSize: 13,
              color: 'var(--text-muted)', transition: 'color 150ms ease',
            }}>Beta Access</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
