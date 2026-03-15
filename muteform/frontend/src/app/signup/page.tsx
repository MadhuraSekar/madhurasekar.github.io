'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"
const serif = "'Instrument Serif', Georgia, serif"

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true)
    setError('')
    // MVP: skip real auth, go straight to onboarding
    setTimeout(() => {
      router.push('/onboarding/connect')
    }, 500)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 800, color: T.bg }}>M</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 18, fontWeight: 700, color: T.textBright }}>muteform</span>
          </div>
          <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: T.textBright, margin: '0 0 8px' }}>
            Create your account
          </h1>
          <p style={{ fontFamily: sans, fontSize: 13, color: T.muted }}>
            Connect your design system in 60 seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              fontFamily: sans, fontSize: 14, padding: '12px 14px', borderRadius: 8,
              background: T.surface, color: T.text, border: `1px solid ${T.border}`, outline: 'none',
            }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              fontFamily: sans, fontSize: 14, padding: '12px 14px', borderRadius: 8,
              background: T.surface, color: T.text, border: `1px solid ${T.border}`, outline: 'none',
            }}
          />
          {error && <span style={{ fontFamily: sans, fontSize: 12, color: T.red }}>{error}</span>}
          <button type="submit" disabled={loading} style={{
            fontFamily: mono, fontSize: 13, fontWeight: 600, padding: '12px',
            borderRadius: 8, background: T.green, color: T.bg, border: 'none',
            cursor: 'pointer', opacity: loading ? 0.7 : 1, letterSpacing: '0.02em',
          }}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontFamily: sans, fontSize: 12, color: T.muted }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: T.green, textDecoration: 'none' }}>Sign in</a>
          </span>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/" style={{ fontFamily: mono, fontSize: 11, color: T.dim, textDecoration: 'none' }}>← Back to home</a>
        </div>
      </div>
    </div>
  )
}
