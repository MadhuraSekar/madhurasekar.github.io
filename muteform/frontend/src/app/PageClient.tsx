'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback, FormEvent, CSSProperties } from 'react'
import Header from '@/components/Header'
import { tokens } from '@/lib/design-tokens'

const T = tokens

function useFadeIn(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setVisible(true); obs.unobserve(el) } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

function FadeIn({ children, delay }: { children: React.ReactNode; delay?: number }) {
  const [ref, visible] = useFadeIn()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
      transitionDelay: delay ? delay + 'ms' : '0ms',
    }}>
      {children}
    </div>
  )
}

function CodeLine({ text, marker, isError }: { text: string; marker: string; isError: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', fontFamily: T.fontMono, fontSize: 13, lineHeight: 1.5 }}>
      <span style={{ color: isError ? T.red : T.green, fontWeight: 700, flexShrink: 0, width: 16, textAlign: 'center' }}>{marker}</span>
      <span style={{ color: T.textMuted }}>{text}</span>
    </div>
  )
}

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [formState, setFormState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleWaitlist = useCallback(async (e: FormEvent) => {
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

  const section: CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '96px 24px' }

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: T.fontMono, fontSize: 14, lineHeight: 1.6, minHeight: '100vh' }}>
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

      <Header />

      {/* Hero */}
      <section style={{ ...section, paddingTop: 80, paddingBottom: 64 }} className="section-pad">
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <FadeIn>
              <h1 className="hero-heading" style={{
                fontFamily: T.fontDisplay, fontSize: 56, fontWeight: 700, lineHeight: 1.1,
                color: T.text, margin: '0 0 24px', letterSpacing: '-0.02em',
              }}>
                Your design system.{' '}Enforced everywhere.
              </h1>
            </FadeIn>
            <FadeIn delay={100}>
              <p style={{ fontFamily: T.fontMono, fontSize: 14, lineHeight: 1.7, color: T.textMuted, margin: '0 0 36px', maxWidth: 520 }}>
                Muteform turns your design system into a living, executable contract.
                Every AI&nbsp;tool. Every generated interface.
              </p>
            </FadeIn>
            <FadeIn delay={200}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <a href="/import" style={{
                  fontFamily: T.fontMono, fontSize: 13, fontWeight: 500, color: '#fff',
                  background: T.blue, padding: '12px 24px', borderRadius: T.radius.md,
                  display: 'inline-block',
                }}>
                  Start with your design system &rarr;
                </a>
                <a href="/demo" style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 500, color: T.blue }}>
                  Watch demo
                </a>
                <a href="/waitlist" style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 500, color: T.textMuted }}>
                  Join waitlist →
                </a>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={300}>
            <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius.md, overflow: 'hidden' }}>
              <div style={{ borderBottom: `1px solid ${T.border}`, padding: '14px 16px 12px' }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, color: T.red, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Without governance</div>
                <CodeLine text={'color: #3478F6       \u2190 not a token'} marker={'\u2715'} isError={true} />
                <CodeLine text={'padding: 22px        \u2190 off scale'} marker={'\u2715'} isError={true} />
                <CodeLine text={'font-size: 15px      \u2190 not in system'} marker={'\u2715'} isError={true} />
                <CodeLine text={'variant="ghost"      \u2190 unapproved'} marker={'\u2715'} isError={true} />
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, color: T.green, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 10 }}>After Muteform</div>
                <CodeLine text="color: tokens.primary" marker={'\u2713'} isError={false} />
                <CodeLine text="padding: spacing[4]" marker={'\u2713'} isError={false} />
                <CodeLine text="font-size: type.body" marker={'\u2713'} isError={false} />
                <CodeLine text='variant="primary"' marker={'\u2713'} isError={false} />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* How it works */}
      <section style={section} className="section-pad">
        <FadeIn>
          <h2 style={{ fontFamily: T.fontDisplay, fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: T.text, margin: '0 0 56px' }}>How it works</h2>
        </FadeIn>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {[
            { num: '1', title: 'Import your design system', desc: 'Connect Figma tokens, Tailwind configs, or any token JSON. Muteform learns your system in seconds.' },
            { num: '2', title: 'Define governance rules', desc: 'Set policies for color, spacing, typography, and accessibility. Start with built-in rules or write your own.' },
            { num: '3', title: 'AI generates. Muteform governs.', desc: 'Every AI-generated component is scanned against your rules in real time. Violations surface instantly.' },
            { num: '4', title: 'Ship with confidence.', desc: 'Auto-fix what can be fixed. Block what can\u2019t. Your design system stays intact, no matter who\u2014or what\u2014writes the code.' },
          ].map((step, i) => (
            <FadeIn key={step.num} delay={i * 80}>
              <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 24, alignItems: 'start' }}>
                <div style={{ fontFamily: T.fontDisplay, fontSize: 40, fontWeight: 700, color: T.textDim, lineHeight: 1 }}>{step.num}</div>
                <div>
                  <h3 style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 600, color: T.text, margin: '0 0 6px' }}>{step.title}</h3>
                  <p style={{ fontFamily: T.fontMono, fontSize: 14, lineHeight: 1.7, color: T.textMuted, margin: 0, maxWidth: 560 }}>{step.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Beta access */}
      <section id="waitlist" style={{ ...section, textAlign: 'center' }} className="section-pad">
        <FadeIn>
          <h2 style={{ fontFamily: T.fontDisplay, fontSize: 36, fontWeight: 700, color: T.text, maxWidth: 560, margin: '0 auto 40px' }}>Get early access</h2>
        </FadeIn>
        <FadeIn delay={100}>
          {formState === 'success' ? (
            <div style={{ fontFamily: T.fontMono, fontSize: 14, color: T.green, background: T.greenDim, display: 'inline-block', padding: '14px 28px', borderRadius: T.radius.sm }}>
              You&rsquo;re on the list. We&rsquo;ll be in touch.
            </div>
          ) : (
            <form onSubmit={handleWaitlist} style={{ display: 'flex', gap: 10, justifyContent: 'center', maxWidth: 460, margin: '0 auto', flexWrap: 'wrap' }}>
              <input type="email" required placeholder="you@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1, minWidth: 220, fontFamily: T.fontMono, fontSize: 13,
                  color: T.text, background: T.surface, border: `1px solid ${T.border2}`,
                  borderRadius: T.radius.sm, padding: '11px 16px', outline: 'none',
                }}
              />
              <button type="submit" disabled={formState === 'sending'} style={{
                fontFamily: T.fontMono, fontSize: 13, fontWeight: 500, color: '#fff',
                background: T.blue, border: 'none', borderRadius: T.radius.md,
                padding: '11px 24px', cursor: formState === 'sending' ? 'wait' : 'pointer',
                opacity: formState === 'sending' ? 0.7 : 1,
              }}>
                {formState === 'sending' ? 'Requesting...' : 'Request beta access'}
              </button>
            </form>
          )}
          {formState === 'error' && (
            <p style={{ fontFamily: T.fontMono, fontSize: 13, color: T.red, marginTop: 12 }}>
              {errorMsg || 'Something went wrong. Please try again.'}
            </p>
          )}
        </FadeIn>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: '32px 24px' }}>
        <div className="footer-inner" style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: T.radius.sm, background: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, color: '#fff' }}>M</span>
            </div>
            <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.textDim }}>&copy; 2025 Muteform</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/demo" style={{ fontFamily: T.fontMono, fontSize: 12, color: T.textDim }}>Demo</a>
            <a href="/import" style={{ fontFamily: T.fontMono, fontSize: 12, color: T.textDim }}>Get Started</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
