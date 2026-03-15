'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const T = {
  bg: '#080909', surface: '#0c0d0f', surface2: '#101214',
  border: '#161819', border2: '#1e2226',
  blue: '#0055FF', blueDim: '#0a1428',
  text: '#f0f1f3', muted: '#6b7280', dim: '#374151',
  red: '#ef4444', redDim: '#1a0505',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: T.bg,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        width: 600,
        height: 600,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${T.blue}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo + tagline */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${T.blue}, ${T.blue}99)`,
            marginBottom: 20,
            boxShadow: `0 0 40px ${T.blue}22`,
          }}>
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: '#fff',
            }}>M</span>
          </div>
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: T.text,
            letterSpacing: '-0.03em',
          }}>
            muteform
          </h1>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: T.muted,
            marginTop: 8,
            letterSpacing: '0.02em',
          }}>
            Design governance for AI-generated interfaces
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: '36px 32px',
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${T.border}`,
          backdropFilter: 'blur(12px)',
        }}>
          <h2 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: T.text,
            marginBottom: 28,
          }}>
            Sign in
          </h2>

          {error && (
            <div style={{
              background: T.redDim,
              border: `1px solid ${T.red}33`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: T.red,
              fontFamily: "'DM Mono', monospace",
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              color: T.muted,
              marginBottom: 8,
              fontFamily: "'DM Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                background: T.surface2,
                border: `1px solid ${focused === 'email' ? T.blue : T.border}`,
                borderRadius: 10,
                color: T.text,
                fontSize: 14,
                fontFamily: "'DM Mono', monospace",
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: focused === 'email' ? `0 0 0 3px ${T.blue}15` : 'none',
              }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              color: T.muted,
              marginBottom: 8,
              fontFamily: "'DM Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                background: T.surface2,
                border: `1px solid ${focused === 'password' ? T.blue : T.border}`,
                borderRadius: 10,
                color: T.text,
                fontSize: 14,
                fontFamily: "'DM Mono', monospace",
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: focused === 'password' ? `0 0 0 3px ${T.blue}15` : 'none',
              }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 20px',
              background: `linear-gradient(135deg, ${T.blue}, #0044cc)`,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Mono', monospace",
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s, transform 0.1s, box-shadow 0.2s',
              boxShadow: `0 4px 16px ${T.blue}33`,
              letterSpacing: '0.02em',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Demo link */}
        <p style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 12,
          color: T.dim,
          fontFamily: "'DM Mono', monospace",
        }}>
          <a
            href="/demo"
            style={{
              color: T.muted,
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = T.text}
            onMouseLeave={e => (e.target as HTMLElement).style.color = T.muted}
          >
            Try the live demo →
          </a>
        </p>
      </div>
    </div>
  )
}
