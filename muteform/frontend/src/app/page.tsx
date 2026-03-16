'use client'

import React, { useState, useEffect, useRef, useCallback, FormEvent, CSSProperties } from 'react'

/* ── design tokens ── */
const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', amber: '#ffb830', blue: '#4090ff',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"
const serif = "'Instrument Serif', Georgia, serif"
const syne = "'Syne', sans-serif"

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

/* ── animated score ring ── */
function ScoreRing({ score }: { score: number }) {
  const [drawn, setDrawn] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { setDrawn(true); obs.unobserve(el) }
        }
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return function () { obs.disconnect() }
  }, [])

  const size = 96
  const stroke = 5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = drawn ? circ * (1 - score / 100) : circ

  return (
    <div ref={ref} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={T.green} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
        <text
          x={size / 2} y={size / 2}
          textAnchor="middle" dominantBaseline="central"
          fill={T.textBright}
          fontFamily={mono}
          fontSize="22"
          fontWeight="600"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {score}
        </text>
      </svg>
      <span style={{
        fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: 2,
        color: T.green, background: T.greenDim, padding: '3px 10px', borderRadius: 4,
      }}>
        COMPLIANT
      </span>
    </div>
  )
}

/* ── before/after comparison line ── */
function ComparisonLine({ text, marker, color, bgTint }: {
  text: string; marker: string; color: string; bgTint: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      background: bgTint,
      borderRadius: 4,
      marginBottom: 4,
    }}>
      <span style={{
        fontFamily: mono, fontSize: 14, fontWeight: 700,
        color: color, flexShrink: 0, width: 18, textAlign: 'center',
      }}>
        {marker}
      </span>
      <span style={{
        fontFamily: mono, fontSize: 13, color: T.text, lineHeight: 1.5,
      }}>
        {text}
      </span>
    </div>
  )
}

/* ── social proof card ── */
function QuoteCard({ quote, name, role, delay }: {
  quote: string; name: string; role: string; delay?: number
}) {
  return (
    <FadeIn delay={delay}>
      <div style={{
        background: T.surface,
        borderRadius: 10,
        padding: '28px 24px',
        borderLeft: `3px solid ${T.green}`,
        border: `1px solid ${T.border}`,
        borderLeftColor: T.green,
        borderLeftWidth: 3,
        height: '100%',
        boxSizing: 'border-box' as const,
      }}>
        <p style={{
          fontFamily: serif, fontSize: 17, fontStyle: 'italic',
          color: T.textBright, lineHeight: 1.6, margin: '0 0 20px',
        }}>
          &ldquo;{quote}&rdquo;
        </p>
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: T.text }}>
            {name}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: T.muted, marginTop: 2 }}>
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
    maxWidth: 1080,
    margin: '0 auto',
    padding: '100px 24px',
  }
  const heading: CSSProperties = {
    fontFamily: serif,
    color: T.textBright,
    fontSize: 32,
    fontWeight: 400,
    lineHeight: 1.25,
    margin: 0,
  }

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: sans, minHeight: '100vh' }}>

      {/* ── keyframes ── */}
      <style>{`
        @keyframes scanLine {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        a { color: inherit; text-decoration: none; }
        ::selection { background: ${T.green}; color: ${T.bg}; }
        .btn-hover { transition: all 150ms ease; }
        .btn-hover:hover { transform: scale(1.02); }
        @media (max-width: 768px) {
          .hero-heading { font-size: 30px !important; }
          .hero-sub { font-size: 15px !important; }
          .section-pad { padding: 60px 16px !important; }
          .footer-inner { flex-direction: column; text-align: center; }
          .comparison-grid { grid-template-columns: 1fr !important; }
          .quotes-grid { grid-template-columns: 1fr !important; }
        }
        .nav-links { }
        .nav-hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
        }
        .nav-mobile-menu {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 280px;
          background: ${T.surface};
          border-left: 1px solid ${T.border};
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
          color: ${T.text};
          font-size: 28px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }
        .nav-mobile-menu a {
          font-size: 16px;
          color: ${T.text};
          padding: 12px 0;
          border-bottom: 1px solid ${T.border};
        }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .nav-hamburger { display: block !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════════
          1. NAV BAR
      ════════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: T.bg + 'e6',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid ' + T.border,
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56,
        }}>
          {/* logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 5,
              background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: mono, fontWeight: 700, fontSize: 15, color: T.bg,
            }}>M</div>
            <span style={{ fontFamily: syne, fontWeight: 700, fontSize: 15, color: T.textBright, letterSpacing: -0.5 }}>
              muteform
            </span>
          </a>

          {/* links (desktop) */}
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="/demo" className="btn-hover" style={{ fontSize: 13, color: T.muted, fontWeight: 500, transition: 'color 150ms ease' }}>Demo</a>
            <a href="#waitlist" className="btn-hover" style={{ fontSize: 13, color: T.muted, fontWeight: 500, transition: 'color 150ms ease' }}>Beta Access</a>
            <a href="/import" className="btn-hover" style={{
              fontSize: 13, fontWeight: 600, color: T.bg,
              background: T.green, padding: '7px 16px', borderRadius: 6,
              transition: 'all 150ms ease',
            }}>
              Get Started &rarr;
            </a>
          </div>
          {/* hamburger (mobile) */}
          <button className="nav-hamburger" onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </nav>

      {/* mobile menu */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">&times;</button>
        <a href="/demo" onClick={() => setMobileMenuOpen(false)} style={{ fontFamily: sans }}>Demo</a>
        <a href="#waitlist" onClick={() => setMobileMenuOpen(false)} style={{ fontFamily: sans }}>Beta Access</a>
        <a href="/import" onClick={() => setMobileMenuOpen(false)} style={{
          fontFamily: sans, fontWeight: 600, color: T.bg, background: T.green,
          borderRadius: 8, textAlign: 'center', marginTop: 8, border: 'none',
          padding: '12px 0',
        }}>Get Started &rarr;</a>
      </div>

      {/* ════════════════════════════════════════════
          2. HERO
      ════════════════════════════════════════════ */}
      <section style={{ ...section, paddingTop: 80, paddingBottom: 60, textAlign: 'center' }}>
        <FadeIn>
          <p style={{
            fontFamily: sans, fontSize: 18, fontWeight: 500,
            color: T.muted, margin: '0 auto 12px', maxWidth: 600,
            lineHeight: 1.5,
          }}>
            Your AI tools don&rsquo;t know your design system.
          </p>
        </FadeIn>

        <FadeIn delay={80}>
          <p style={{
            fontFamily: sans, fontSize: 20, fontWeight: 600,
            margin: '0 auto 28px', maxWidth: 600,
          }}>
            <span style={{
              color: T.bg, background: T.green,
              padding: '2px 10px', borderRadius: 4,
              display: 'inline-block',
            }}>
              Muteform fixes that.
            </span>
          </p>
        </FadeIn>

        <FadeIn delay={140}>
          <h1 className="hero-heading" style={{
            fontFamily: serif, fontSize: 44, fontWeight: 400, lineHeight: 1.2,
            color: T.textBright, margin: '0 auto 20px', maxWidth: 700,
          }}>
            Design governance for AI&#8209;generated interfaces
          </h1>
        </FadeIn>

        <FadeIn delay={220}>
          <p className="hero-sub" style={{
            fontFamily: sans, fontSize: 17, lineHeight: 1.7,
            color: T.muted, margin: '0 auto 36px', maxWidth: 620,
          }}>
            Muteform turns your design system into a living, executable contract.
            Every AI&nbsp;agent. Every generated interface. Every pixel. Governed.
          </p>
        </FadeIn>

        <FadeIn delay={320}>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/import" className="btn-hover" style={{
              fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.bg,
              background: T.green, padding: '11px 24px', borderRadius: 7,
              display: 'inline-block', transition: 'all 150ms ease',
            }}>
              Start with your design system &rarr;
            </a>
            <a href="/demo" className="btn-hover" style={{
              fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.text,
              border: '1px solid ' + T.border2, padding: '11px 24px', borderRadius: 7,
              display: 'inline-block', transition: 'all 150ms ease',
            }}>
              Watch the Demo
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={460} style={{ marginTop: 48 }}>
          <ScoreRing score={100} />
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════
          3. HOW IT WORKS — SPLIT SCREEN COMPARISON
      ════════════════════════════════════════════ */}
      <section style={section} className="section-pad">
        <FadeIn>
          <h2 style={{ ...heading, marginBottom: 48, textAlign: 'center' }}>How it works</h2>
        </FadeIn>

        <FadeIn delay={100}>
          <div
            className="comparison-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
              marginBottom: 32,
            }}
          >
            {/* Left — Without Muteform */}
            <div style={{
              background: `${T.red}08`,
              border: `1px solid ${T.red}20`,
              borderRadius: 12,
              padding: '28px 24px',
              overflow: 'hidden',
            }}>
              <div style={{
                fontFamily: mono, fontSize: 11, fontWeight: 600,
                color: T.red, letterSpacing: 1.5, marginBottom: 20,
                textTransform: 'uppercase' as const,
              }}>
                Without Muteform
              </div>

              <div style={{
                background: T.bg, borderRadius: 8, padding: '16px 12px',
                border: `1px solid ${T.red}15`,
              }}>
                <ComparisonLine
                  text={'color: #3478F6       \u2190 not a token'}
                  marker={'\u00d7'}
                  color={T.red}
                  bgTint={`${T.red}08`}
                />
                <ComparisonLine
                  text={'padding: 22px        \u2190 not in scale'}
                  marker={'\u00d7'}
                  color={T.red}
                  bgTint={`${T.red}08`}
                />
                <ComparisonLine
                  text={'font-size: 15px      \u2190 not in system'}
                  marker={'\u00d7'}
                  color={T.red}
                  bgTint={`${T.red}08`}
                />
                <ComparisonLine
                  text={'variant="ghost"      \u2190 not approved'}
                  marker={'\u00d7'}
                  color={T.red}
                  bgTint={`${T.red}08`}
                />
              </div>
            </div>

            {/* Right — With Muteform */}
            <div style={{
              background: `${T.green}08`,
              border: `1px solid ${T.green}20`,
              borderRadius: 12,
              padding: '28px 24px',
              overflow: 'hidden',
            }}>
              <div style={{
                fontFamily: mono, fontSize: 11, fontWeight: 600,
                color: T.green, letterSpacing: 1.5, marginBottom: 20,
                textTransform: 'uppercase' as const,
              }}>
                With Muteform
              </div>

              <div style={{
                background: T.bg, borderRadius: 8, padding: '16px 12px',
                border: `1px solid ${T.green}15`,
              }}>
                <ComparisonLine
                  text="color: tokens.primary"
                  marker={'\u2713'}
                  color={T.green}
                  bgTint={`${T.green}08`}
                />
                <ComparisonLine
                  text="padding: spacing[4]"
                  marker={'\u2713'}
                  color={T.green}
                  bgTint={`${T.green}08`}
                />
                <ComparisonLine
                  text="font-size: type.body"
                  marker={'\u2713'}
                  color={T.green}
                  bgTint={`${T.green}08`}
                />
                <ComparisonLine
                  text='variant="primary"'
                  marker={'\u2713'}
                  color={T.green}
                  bgTint={`${T.green}08`}
                />
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <p style={{
            fontFamily: mono, fontSize: 13, color: T.muted,
            textAlign: 'center', margin: 0,
          }}>
            Happens automatically. Every time. Every AI tool.
          </p>
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════
          4. SOCIAL PROOF
      ════════════════════════════════════════════ */}
      <section style={section} className="section-pad">
        <FadeIn>
          <div style={{
            fontFamily: mono, fontSize: 11, fontWeight: 600,
            color: T.muted, letterSpacing: 1.5, marginBottom: 12,
            textTransform: 'uppercase' as const, textAlign: 'center',
          }}>
            Beta Tester Reactions
          </div>
          <h2 style={{ ...heading, marginBottom: 48, textAlign: 'center' }}>
            What teams are saying
          </h2>
        </FadeIn>

        <div
          className="quotes-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
          }}
        >
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

      {/* ════════════════════════════════════════════
          5. WAITLIST CTA
      ════════════════════════════════════════════ */}
      <section id="waitlist" style={{ ...section, textAlign: 'center' }} className="section-pad">
        <FadeIn>
          <h2 style={{ ...heading, maxWidth: 560, margin: '0 auto 16px' }}>
            Design systems were built for humans. AI needs governance.
          </h2>
        </FadeIn>
        <FadeIn delay={80}>
          <p style={{ fontSize: 17, color: T.muted, marginBottom: 36 }}>
            Get early access to design governance.
          </p>
        </FadeIn>

        <FadeIn delay={160}>
          {formState === 'success' ? (
            <div style={{
              fontFamily: mono, fontSize: 14, color: T.green,
              background: T.greenDim, display: 'inline-block',
              padding: '14px 28px', borderRadius: 8,
            }}>
              You&rsquo;re on the list. We&rsquo;ll be in touch.
            </div>
          ) : (
            <form
              onSubmit={handleWaitlist}
              style={{
                display: 'flex', gap: 10, justifyContent: 'center',
                maxWidth: 440, margin: '0 auto', flexWrap: 'wrap',
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
                  fontFamily: mono, fontSize: 14,
                  color: T.text, background: T.surface,
                  border: '1px solid ' + T.border2, borderRadius: 7,
                  padding: '11px 16px', outline: 'none',
                  transition: 'border-color 150ms ease',
                }}
              />
              <button
                type="submit"
                disabled={formState === 'sending'}
                className="btn-hover"
                style={{
                  fontFamily: sans, fontSize: 14, fontWeight: 600,
                  color: T.bg, background: T.green,
                  border: 'none', borderRadius: 7, padding: '11px 24px',
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
            <p style={{ fontFamily: mono, fontSize: 12, color: T.red, marginTop: 12 }}>
              {errorMsg || 'Something went wrong. Please try again.'}
            </p>
          )}

          <p style={{
            fontFamily: mono, fontSize: 12, color: T.dim, marginTop: 20,
          }}>
            Beta access for design teams
          </p>
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════
          6. FOOTER
      ════════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid ' + T.border,
        padding: '32px 24px',
      }}>
        <div className="footer-inner" style={{
          maxWidth: 1080, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 4,
              background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: mono, fontWeight: 700, fontSize: 12, color: T.bg,
            }}>M</div>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.dim }}>
              &copy; 2024 Muteform
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/demo" style={{ fontFamily: mono, fontSize: 12, color: T.dim, transition: 'color 150ms ease' }}>Demo</a>
            <a href="/import" style={{ fontFamily: mono, fontSize: 12, color: T.dim, transition: 'color 150ms ease' }}>Get Started</a>
            <a href="#waitlist" style={{ fontFamily: mono, fontSize: 12, color: T.dim, transition: 'color 150ms ease' }}>Beta Access</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
