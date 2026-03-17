'use client'

import React, { useState, useEffect, useRef, useCallback, FormEvent } from 'react'

// ─── BRAND TOKENS ───
const C = {
  black: '#050505',
  blackSoft: '#0A0A0A',
  surface1: '#111111',
  surface2: '#1A1A1A',
  surface3: '#222222',
  border: '#2A2A2A',
  borderLight: '#333333',
  textPrimary: '#F5F5F0',
  textSecondary: '#999999',
  textTertiary: '#666666',
  accent: '#BBFF00',
  accentDim: '#99CC00',
  accentGlow: 'rgba(187,255,0,0.15)',
  accentGlowStrong: 'rgba(187,255,0,0.30)',
  driftRed: '#FF3B3B',
  driftRedDim: 'rgba(255,59,59,0.15)',
}

const EASE_OUT = 'cubic-bezier(0.16,1,0.3,1)'
const GLYPHS = '░▒▓█▄▀┌┐└┘├┤┬┴┼─│◉◎○●◆▸▹△▽■□▪▫◇◈'

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

// ─── HOOKS ───
function useFadeIn(threshold = 0.15): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setVisible(true); obs.unobserve(el) } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const [ref, visible] = useFadeIn()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.7s ${EASE_OUT}, transform 0.7s ${EASE_OUT}`,
      transitionDelay: `${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── GLYPH FIELD ───
function GlyphField({ opacity = 0.35, density = 0.6 }: { opacity?: number; density?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const spansRef = useRef<HTMLSpanElement[]>([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cols = Math.max(30, Math.floor(vw / 9.5))
    const rows = Math.max(20, Math.floor(vh / 22))

    const frag = document.createDocumentFragment()
    const allSpans: HTMLSpanElement[] = []

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isRight = c > cols * 0.5
        const show = isRight ? Math.random() > (1 - density - 0.15) : Math.random() > (1 - density + 0.1)
        if (show) {
          const span = document.createElement('span')
          span.textContent = randomGlyph()
          allSpans.push(span)
          frag.appendChild(span)
        } else {
          frag.appendChild(document.createTextNode(' '))
        }
      }
      frag.appendChild(document.createTextNode('\n'))
    }
    el.innerHTML = ''
    el.appendChild(frag)
    spansRef.current = allSpans

    const interval = setInterval(() => {
      const spans = spansRef.current
      if (!spans.length) return
      const count = Math.max(3, Math.floor(spans.length * 0.012))
      for (let i = 0; i < count; i++) {
        const s = spans[Math.floor(Math.random() * spans.length)]
        s.textContent = randomGlyph()
        const roll = Math.random()
        if (roll < 0.08) {
          s.style.color = C.accent
          setTimeout(() => { s.style.color = '' }, 600)
        } else if (roll < 0.12) {
          s.style.color = C.driftRed
          setTimeout(() => { s.style.color = '' }, 400)
        }
      }
    }, 200)

    return () => clearInterval(interval)
  }, [density])

  return (
    <div ref={containerRef} aria-hidden="true" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      fontFamily: "'Space Mono', monospace", fontSize: 14, lineHeight: 1.6,
      color: C.border, opacity, pointerEvents: 'none', zIndex: 1,
      overflow: 'hidden', whiteSpace: 'pre', padding: '56px 20px 20px',
    }} />
  )
}

// ─── VIOLATION CARD ───
function ViolationCard({ glyph, title, delay }: { glyph: string; title: string; delay: number }) {
  const [ref, visible] = useFadeIn(0.1)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.driftRedDim : C.surface1,
        border: `1px solid ${hovered ? C.driftRed : C.border}`,
        borderRadius: 12,
        padding: '28px',
        position: 'relative',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.7s ${EASE_OUT}, transform 0.7s ${EASE_OUT}, border-color 0.3s ${EASE_OUT}, background 0.3s ${EASE_OUT}`,
        transitionDelay: visible ? `${delay}ms` : '0ms',
        cursor: 'default',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: C.driftRed, opacity: hovered ? 1 : 0,
        transition: `opacity 0.3s ${EASE_OUT}`,
      }} />
      <span style={{
        fontFamily: "'Space Mono', monospace", fontSize: 28,
        color: C.driftRed, display: 'block', marginBottom: 16,
      }}>{glyph}</span>
      <span style={{
        fontFamily: "'Outfit', sans-serif", fontWeight: 700,
        fontSize: 17, color: C.textPrimary,
      }}>{title}</span>
    </div>
  )
}

// ─── PIPELINE STEP ───
function PipelineStep({ text, sub, delay }: { text: string; sub: string; delay: number }) {
  const [ref, visible] = useFadeIn(0.2)
  return (
    <div ref={ref} style={{
      position: 'relative', paddingLeft: 40, marginBottom: 48,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.7s ${EASE_OUT}, transform 0.7s ${EASE_OUT}`,
      transitionDelay: `${delay}ms`,
    }}>
      <div style={{
        position: 'absolute', left: -1, top: 4, width: 12, height: 12,
        borderRadius: '50%', background: C.accent,
        boxShadow: `0 0 12px ${C.accentGlowStrong}`,
      }} />
      <div style={{
        fontFamily: "'Outfit', sans-serif", fontWeight: 400,
        fontSize: 18, color: C.textPrimary, marginBottom: 6,
      }}>{text}</div>
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: 11,
        letterSpacing: '0.1em', textTransform: 'uppercase' as const,
        color: C.textTertiary,
      }}>{sub}</div>
    </div>
  )
}

// ─── MAIN PAGE ───
export default function WaitlistClient() {
  const [email, setEmail] = useState('')
  const [formState, setFormState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pipelineVisible, setPipelineVisible] = useState(false)
  const pipelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = pipelineRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setPipelineVisible(true); obs.unobserve(el) } },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setFormState('sending')
    try {
      const res = await fetch('/api/waitlist', {
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

  return (
    <div style={{
      background: C.blackSoft, color: C.textPrimary,
      fontFamily: "'Outfit', sans-serif", minHeight: '100vh',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
        a { color: inherit; text-decoration: none; }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(187,255,0,0.15); }
          50% { box-shadow: 0 0 30px rgba(187,255,0,0.3); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes scrollBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        .wl-btn:hover {
          transform: scale(1.03) !important;
          box-shadow: 0 0 30px rgba(187,255,0,0.4) !important;
        }
        .wl-nav-cta:hover { color: ${C.accent} !important; }
        @media (max-width: 768px) {
          .wl-violation-grid { grid-template-columns: 1fr !important; }
          .wl-hero-content { max-width: 100% !important; }
          .wl-footer { flex-direction: column !important; gap: 16px !important; text-align: center !important; }
          .wl-scroll-ind { display: none !important; }
        }
      `}</style>

      {/* ─── NAV ─── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(24px, 4vw, 48px)', height: 56,
        background: 'rgba(5,5,5,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <a href="/waitlist" style={{
          fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14,
          letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: C.accent,
        }}>MUTEFORM</a>
        <a href="#waitlist-form" className="wl-nav-cta" style={{
          fontFamily: "'Space Mono', monospace", fontSize: 11,
          color: C.textSecondary, transition: `color 0.3s ${EASE_OUT}`,
        }}>Join Waitlist</a>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', position: 'relative', overflow: 'hidden',
        padding: `56px clamp(24px, 6vw, 80px) clamp(80px, 12vw, 140px)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <GlyphField opacity={0.35} density={0.6} />
        <div className="wl-hero-content" style={{ position: 'relative', zIndex: 2, maxWidth: 900 }}>
          {/* Eyebrow */}
          <FadeIn delay={0} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <span style={{ width: 32, height: 1, background: C.accent, display: 'block' }} />
            <span style={{
              fontFamily: "'Space Mono', monospace", fontSize: 12,
              letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: C.accent,
            }}>Interface Governance</span>
          </FadeIn>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: 'clamp(48px, 8vw, 110px)', lineHeight: 0.95,
            letterSpacing: '-0.03em', color: C.textPrimary, marginBottom: 28,
          }}>
            <FadeIn delay={100}>
              <span>Design <span style={{ color: C.accent }}>Governance</span></span>
            </FadeIn>
            <FadeIn delay={200}>
              <span>for AI-Generated</span>
            </FadeIn>
            <FadeIn delay={300}>
              <span>Interfaces</span>
            </FadeIn>
          </h1>

          {/* Subhead */}
          <FadeIn delay={500}>
            <p style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 300,
              fontSize: 'clamp(16px, 1.4vw, 20px)', lineHeight: 1.7,
              color: C.textSecondary, maxWidth: 560, marginBottom: 36,
            }}>
              Muteform keeps every generated interface aligned with your design system.
            </p>
          </FadeIn>

          {/* CTA Row */}
          <FadeIn delay={650}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <a href="#waitlist-form" className="wl-btn" style={{
                display: 'inline-block', fontFamily: "'Outfit', sans-serif",
                fontWeight: 600, fontSize: 15, color: C.black, background: C.accent,
                padding: '14px 32px', borderRadius: 8, textDecoration: 'none',
                transition: `transform 0.3s ${EASE_OUT}, box-shadow 0.3s ${EASE_OUT}`,
                animation: 'glowPulse 2s ease-in-out infinite',
              }}>Join the waitlist →</a>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Space Mono', monospace", fontSize: 11, color: C.textTertiary,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: C.accent,
                  animation: 'dotPulse 1.5s ease-in-out infinite',
                }} />
                Launching soon
              </span>
            </div>
          </FadeIn>
        </div>

        {/* Scroll indicator */}
        <div className="wl-scroll-ind" style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 2,
        }}>
          <FadeIn delay={1000}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 1, height: 48, background: C.border }} />
              <div style={{
                width: 4, height: 4, borderRadius: '50%', background: C.textTertiary,
                animation: 'scrollBounce 2s ease-in-out infinite',
              }} />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── THE PROBLEM ─── */}
      <section style={{
        padding: `clamp(80px, 12vw, 140px) clamp(24px, 6vw, 80px)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <FadeIn>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 11,
            letterSpacing: '0.15em', textTransform: 'uppercase' as const,
            color: C.textTertiary, marginBottom: 32,
          }}>THE PROBLEM</div>
        </FadeIn>
        <FadeIn delay={100}>
          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 700,
            fontSize: 'clamp(32px, 4vw, 52px)', color: C.textPrimary, marginBottom: 20,
          }}>Design is entering a new era</h2>
        </FadeIn>
        <FadeIn delay={200}>
          <p style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 300,
            fontSize: 17, lineHeight: 1.7, color: C.textSecondary,
            maxWidth: 620, marginBottom: 48,
          }}>
            Tools like Claude, OpenAI, and design copilots can now generate entire
            interfaces instantly. But without governance:
          </p>
        </FadeIn>

        <div className="wl-violation-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 64,
        }}>
          <ViolationCard glyph="◎→◉" title="Colors go off-brand" delay={0} />
          <ViolationCard glyph="├┄┤" title="Spacing breaks" delay={100} />
          <ViolationCard glyph="▓↔░" title="Components multiply" delay={200} />
          <ViolationCard glyph="┌╌┐" title="Design systems drift" delay={300} />
        </div>

        <FadeIn>
          <p style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 400, fontSize: 20,
            color: C.textSecondary, maxWidth: 640,
          }}>
            The faster interfaces are generated, the faster systems lose{' '}
            <span style={{ color: C.accent }}>consistency</span>.
          </p>
        </FadeIn>
      </section>

      {/* ─── THE SOLUTION ─── */}
      <section style={{
        padding: `clamp(80px, 12vw, 140px) clamp(24px, 6vw, 80px)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <FadeIn>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 11,
            letterSpacing: '0.15em', textTransform: 'uppercase' as const,
            color: C.textTertiary, marginBottom: 32,
          }}>THE SOLUTION</div>
        </FadeIn>
        <FadeIn delay={100}>
          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 700,
            fontSize: 'clamp(32px, 4vw, 48px)', color: C.textPrimary,
            marginBottom: 56, maxWidth: 640,
          }}>Muteform adds governance to AI-generated design</h2>
        </FadeIn>

        <div ref={pipelineRef} style={{ position: 'relative', paddingLeft: 40, marginBottom: 80 }}>
          {/* Connecting line */}
          <div style={{
            position: 'absolute', left: 5, top: 6, bottom: 6,
            width: 1, background: C.border,
          }} />
          <div style={{
            position: 'absolute', left: 5, top: 6, width: 1,
            height: pipelineVisible ? 'calc(100% - 12px)' : '0%',
            background: C.accent,
            transition: `height 1.2s ${EASE_OUT}`,
          }} />

          <PipelineStep text="Define the rules of your design system." sub="YAML rules → validation engine" delay={0} />
          <PipelineStep text="Run Muteform on generated interfaces." sub="47 components scanned in <2s" delay={200} />
          <PipelineStep text="Detect drift before it ships." sub="Token drift, spacing decay, layout mutation" delay={400} />
        </div>

        <FadeIn>
          <p style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 600,
            fontSize: 24, lineHeight: 1.4, color: C.accent,
          }}>
            Design systems stay consistent.<br />AI stays aligned.
          </p>
        </FadeIn>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section id="waitlist-form" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
        padding: `clamp(80px, 12vw, 140px) clamp(24px, 6vw, 80px)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <GlyphField opacity={0.15} density={0.45} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <FadeIn>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 700,
              fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1,
              color: C.textPrimary, marginBottom: 32,
            }}>
              Design systems were built for humans.<br />
              AI needs <span style={{ color: C.accent }}>governance</span>.
            </h2>
          </FadeIn>

          <FadeIn delay={150}>
            {formState === 'success' ? (
              <div style={{
                fontFamily: "'Space Mono', monospace", fontSize: 14,
                color: C.accent, background: C.accentGlow,
                display: 'inline-block', padding: '14px 28px', borderRadius: 8,
              }}>
                You&rsquo;re on the list. We&rsquo;ll be in touch.
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{
                display: 'flex', gap: 12, justifyContent: 'center',
                maxWidth: 500, margin: '0 auto', flexWrap: 'wrap',
              }}>
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1, minWidth: 220,
                    fontFamily: "'Space Mono', monospace", fontSize: 13,
                    color: C.textPrimary, background: C.surface1,
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: 8, padding: '14px 16px', outline: 'none',
                  }}
                />
                <button type="submit" disabled={formState === 'sending'} className="wl-btn" style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 600,
                  fontSize: 16, color: C.black, background: C.accent,
                  padding: '16px 40px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  transition: `transform 0.3s ${EASE_OUT}, box-shadow 0.3s ${EASE_OUT}`,
                  animation: 'glowPulse 2s ease-in-out infinite',
                  opacity: formState === 'sending' ? 0.7 : 1,
                }}>
                  {formState === 'sending' ? 'Joining...' : 'Join the waitlist →'}
                </button>
              </form>
            )}
            {formState === 'error' && (
              <p style={{
                fontFamily: "'Space Mono', monospace", fontSize: 13,
                color: C.driftRed, marginTop: 12,
              }}>{errorMsg || 'Something went wrong. Try again.'}</p>
            )}
          </FadeIn>

          <FadeIn delay={250}>
            <p style={{
              fontFamily: "'Space Mono', monospace", fontSize: 12,
              color: C.textTertiary, marginTop: 16,
            }}>Be one of the first 500.</p>
          </FadeIn>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="wl-footer" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `40px clamp(24px, 6vw, 80px)`,
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontFamily: "'Space Mono', monospace", fontWeight: 700,
            fontSize: 14, letterSpacing: '0.15em', textTransform: 'uppercase' as const,
            color: C.accent,
          }}>MUTEFORM</span>
          <span style={{
            fontFamily: "'Space Mono', monospace", fontSize: 11, color: C.textTertiary,
          }}>Design governance for AI</span>
        </div>
        <span style={{
          fontFamily: "'Space Mono', monospace", fontSize: 11, color: C.textTertiary,
        }}>© 2026 Muteform</span>
      </footer>
    </div>
  )
}
