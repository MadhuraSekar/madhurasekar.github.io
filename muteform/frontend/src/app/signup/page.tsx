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
  green: '#22c55e', greenDim: '#061a0c',
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      router.replace('/login?registered=true')
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: T.surface2,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    color: T.text,
    fontSize: 14,
    fontFamily: 'var(--font-dm-mono), monospace',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block' as const,
    fontSize: 12,
    color: T.muted,
    marginBottom: 6,
    fontFamily: 'var(--font-dm-mono), monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: T.bg,
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontFamily: 'var(--font-syne), sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: T.text,
            letterSpacing: '-0.02em',
          }}>
            muteform
          </h1>
          <p style={{
            fontFamily: 'var(--font-dm-mono), monospace',
            fontSize: 13,
            color: T.muted,
            marginTop: 8,
          }}>
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 32,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-syne), sans-serif',
            fontSize: 18,
            fontWeight: 600,
            color: T.text,
            marginBottom: 24,
          }}>
            Sign up
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
              fontFamily: 'var(--font-dm-mono), monospace',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = T.blue}
              onBlur={e => e.target.style.borderColor = T.border}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = T.blue}
              onBlur={e => e.target.style.borderColor = T.border}
              placeholder="Min 6 characters"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = T.blue}
              onBlur={e => e.target.style.borderColor = T.border}
              placeholder="Repeat password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: T.blue,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-dm-mono), monospace',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 13,
            color: T.muted,
            fontFamily: 'var(--font-dm-mono), monospace',
          }}>
            Already have an account?{' '}
            <a
              href="/login"
              style={{ color: T.blue, textDecoration: 'none' }}
              onMouseEnter={e => (e.target as HTMLElement).style.textDecoration = 'underline'}
              onMouseLeave={e => (e.target as HTMLElement).style.textDecoration = 'none'}
            >
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
