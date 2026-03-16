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

/* ── main page ── */
export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [formState, setFormState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [waitlistCount, setWaitlistCount] = useState(347)

  useEffect(() => {
    fetch('/api/waitlist').then(r => r.json()).then(d => {
      if (d.count) setWaitlistCount(d.count)
    }).catch(() => {})
  }, [])

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
      var data = await res.json()
      if (data.count) setWaitlistCount(data.count)
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
            <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 15, color: T.textBright, letterSpacing: -0.5 }}>
              muteform
            </span>
          </a>

          {/* links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="/demo" style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>Demo</a>
            <a href="/playground" style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>Playground</a>
            <a href="#waitlist" style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>Waitlist</a>
            <a href="/playground" style={{
              fontSize: 13, fontWeight: 600, color: T.bg,
              background: T.green, padding: '7px 16px', borderRadius: 6,
            }}>
              Get Started &rarr;
            </a>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════
          2. HERO
      ════════════════════════════════════════════ */}
      <section style={{ ...section, paddingTop: 80, paddingBottom: 60, textAlign: 'center' }}>
        <FadeIn>
          <h1 style={{
            fontFamily: serif, fontSize: 44, fontWeight: 400, lineHeight: 1.2,
            color: T.textBright, margin: '0 auto 20px', maxWidth: 700,
          }}>
            Design governance for AI&#8209;generated interfaces
          </h1>
        </FadeIn>

        <FadeIn delay={120}>
          <p style={{
            fontFamily: sans, fontSize: 17, lineHeight: 1.7,
            color: T.muted, margin: '0 auto 36px', maxWidth: 580,
          }}>
            Muteform turns your design system into a living, executable contract.
            Every AI&nbsp;agent. Every generated interface. Every pixel. Governed.
          </p>
        </FadeIn>

        <FadeIn delay={240}>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/playground" style={{
              fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.bg,
              background: T.green, padding: '11px 24px', borderRadius: 7,
              display: 'inline-block',
            }}>
              Try the Playground &rarr;
            </a>
            <a href="/demo" style={{
              fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.text,
              border: '1px solid ' + T.border2, padding: '11px 24px', borderRadius: 7,
              display: 'inline-block',
            }}>
              Watch the Demo
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={400} style={{ marginTop: 48 }}>
          <ScoreRing score={100} />
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════
          3. THE PROBLEM
      ════════════════════════════════════════════ */}
      <section style={{ ...section, paddingTop: 60 }}>
        <FadeIn>
          <h2 style={{ ...heading, maxWidth: 620, marginBottom: 16 }}>
            AI agents generate thousands of interfaces. Design systems can&rsquo;t keep up.
          </h2>
        </FadeIn>
        <FadeIn delay={100}>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: T.muted, maxWidth: 560, margin: '0 0 48px' }}>
            Every new AI coding tool ships UI faster than any team can review.
            Without automated governance, design drift compounds daily&mdash;brand
            erodes, accessibility breaks, users suffer.
          </p>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { val: '10,000+', label: 'interfaces generated daily by AI agents' },
            { val: '73%', label: 'drift from design systems within 30 days' },
            { val: '0', label: 'governance tools for AI output (before Muteform)' },
          ].map(function (item, i) {
            return (
              <FadeIn key={i} delay={i * 120}>
                <div style={{
                  background: T.surface, border: '1px solid ' + T.border, borderRadius: 10,
                  padding: '32px 28px',
                }}>
                  <div style={{
                    fontFamily: mono, fontSize: 36, fontWeight: 700, color: T.green, marginBottom: 8,
                  }}>{item.val}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: T.muted }}>{item.label}</div>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          4. HOW IT WORKS
      ════════════════════════════════════════════ */}
      <section style={section}>
        <FadeIn>
          <h2 style={{ ...heading, marginBottom: 48 }}>How it works</h2>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Step 1 */}
          <FadeIn delay={0}>
            <div style={{
              background: T.surface, border: '1px solid ' + T.border, borderRadius: 10,
              padding: '32px 28px', height: '100%', boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>&#9998;</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: T.green, letterSpacing: 1.5, marginBottom: 8 }}>
                STEP 1
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: T.textBright, marginBottom: 14 }}>
                Define your rules
              </div>
              <pre style={{
                fontFamily: mono, fontSize: 12, lineHeight: 1.7, color: T.muted,
                background: T.surface2, borderRadius: 6, padding: '14px 16px',
                margin: 0, overflowX: 'auto',
              }}>{`rules:
  colors: [only: "tokens"]
  spacing: [multiples: 4]
  typography: [system: true]
  a11y: [wcag: "AA"]
  layout: [grid: 8]`}</pre>
            </div>
          </FadeIn>

          {/* Step 2 */}
          <FadeIn delay={140}>
            <div style={{
              background: T.surface, border: '1px solid ' + T.border, borderRadius: 10,
              padding: '32px 28px', height: '100%', boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>&#9889;</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: T.green, letterSpacing: 1.5, marginBottom: 8 }}>
                STEP 2
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: T.textBright, marginBottom: 14 }}>
                AI generates, Muteform intercepts
              </div>
              <div style={{
                background: T.surface2, borderRadius: 6, padding: '20px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: mono, fontSize: 13, color: T.muted, marginBottom: 6 }}>
                  AI output &rarr; <span style={{ color: T.green, fontWeight: 600 }}>&#9632; INTERCEPT</span> &rarr; Validated
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, color: T.dim, marginTop: 8 }}>
                  Every render pass. Zero latency.
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Step 3 */}
          <FadeIn delay={280}>
            <div style={{
              background: T.surface, border: '1px solid ' + T.border, borderRadius: 10,
              padding: '32px 28px', height: '100%', boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>&#10003;</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: T.green, letterSpacing: 1.5, marginBottom: 8 }}>
                STEP 3
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: T.textBright, marginBottom: 14 }}>
                Auto-fix, score, ship
              </div>
              <div style={{
                background: T.surface2, borderRadius: 6, padding: '20px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: T.red }}>34</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginTop: 2 }}>BEFORE</div>
                </div>
                <div style={{ fontFamily: mono, fontSize: 18, color: T.dim }}>&rarr;</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: T.green }}>100</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginTop: 2 }}>AFTER</div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          5. DEMO SECTION
      ════════════════════════════════════════════ */}
      <section style={{ ...section, paddingTop: 40 }}>
        <FadeIn>
          <h2 style={{ ...heading, marginBottom: 24 }}>See it in action</h2>
        </FadeIn>
        <FadeIn delay={100}>
          <a href="/demo" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{
              position: 'relative', overflow: 'hidden',
              background: T.surface, border: '1px solid ' + T.border, borderRadius: 12,
              padding: '56px 32px', textAlign: 'center',
              cursor: 'pointer',
            }}>
              {/* scan line */}
              <div style={{
                position: 'absolute', left: 0, width: '100%', height: 1,
                background: 'linear-gradient(90deg, transparent, ' + T.green + ', transparent)',
                animation: 'scanLine 3s ease-in-out infinite',
                top: 0,
              }} />

              <div style={{
                fontFamily: mono, fontSize: 12, color: T.muted, letterSpacing: 2, marginBottom: 16,
              }}>
                LIVE DEMO
              </div>
              <div style={{
                fontFamily: serif, fontSize: 22, color: T.textBright, marginBottom: 24,
              }}>
                Watch Muteform scan, score, and auto&#8209;fix a generated interface
              </div>
              <div style={{
                display: 'inline-block',
                fontFamily: mono, fontSize: 13, fontWeight: 600,
                color: T.bg, background: T.green,
                padding: '10px 24px', borderRadius: 6,
              }}>
                RUN DEMO &rarr;
              </div>
            </div>
          </a>
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════
          6. FOR DESIGNERS
      ════════════════════════════════════════════ */}
      <section style={section}>
        <FadeIn>
          <h2 style={{ ...heading, maxWidth: 540, marginBottom: 16 }}>
            Muteform is the skill that defines the next era of design.
          </h2>
        </FadeIn>
        <FadeIn delay={80}>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: T.muted, maxWidth: 500, margin: '0 0 8px' }}>
            Author rules. Govern AI. Ship with confidence.
          </p>
        </FadeIn>
        <FadeIn delay={160}>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: T.muted, maxWidth: 540, margin: '0 0 36px' }}>
            Muteform Certified designers ensure every AI&#8209;generated interface meets the bar.
          </p>
        </FadeIn>
        <FadeIn delay={240}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            border: '1.5px solid ' + T.green, borderRadius: 8,
            padding: '14px 24px', background: T.greenDim,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 4,
              background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: mono, fontWeight: 700, fontSize: 13, color: T.bg,
            }}>M</div>
            <span style={{
              fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: 2,
              color: T.green,
            }}>
              MUTEFORM CERTIFIED
            </span>
          </div>
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════
          7. WAITLIST CTA
      ════════════════════════════════════════════ */}
      <section id="waitlist" style={{ ...section, textAlign: 'center' }}>
        <FadeIn>
          <h2 style={{ ...heading, maxWidth: 560, margin: '0 auto 16px' }}>
            Design systems were built for humans. AI needs governance.
          </h2>
        </FadeIn>
        <FadeIn delay={80}>
          <p style={{ fontSize: 17, color: T.muted, marginBottom: 36 }}>
            Be one of the first 500.
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
                }}
              />
              <button
                type="submit"
                disabled={formState === 'sending'}
                style={{
                  fontFamily: sans, fontSize: 14, fontWeight: 600,
                  color: T.bg, background: T.green,
                  border: 'none', borderRadius: 7, padding: '11px 24px',
                  cursor: formState === 'sending' ? 'wait' : 'pointer',
                  opacity: formState === 'sending' ? 0.7 : 1,
                }}
              >
                {formState === 'sending' ? 'Joining...' : 'Join Waitlist'}
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
            animation: 'pulse 3s ease-in-out infinite',
          }}>
            {waitlistCount} / 500 spots claimed
          </p>
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════
          8. FOOTER
      ════════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid ' + T.border,
        padding: '32px 24px',
      }}>
        <div style={{
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
            <a href="/demo" style={{ fontFamily: mono, fontSize: 12, color: T.dim }}>Demo</a>
            <a href="/playground" style={{ fontFamily: mono, fontSize: 12, color: T.dim }}>Playground</a>
            <a href="#waitlist" style={{ fontFamily: mono, fontSize: 12, color: T.dim }}>Waitlist</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
