'use client'

import { useState } from 'react'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  amber: '#ffb830', blue: '#4090ff', blueDim: '#4090ff18',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"

const MEMBERS = [
  { name: 'You', email: 'admin@acme.co', role: 'Admin', scans: 47, score: 97 },
  { name: 'Sarah C.', email: 'sarah@acme.co', role: 'Member', scans: 31, score: 94 },
  { name: 'Raj M.', email: 'raj@acme.co', role: 'Member', scans: 23, score: 91 },
]

export default function TeamPage() {
  const [inviteEmail, setInviteEmail] = useState('')
  const [invited, setInvited] = useState(false)

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInvited(true)
    setInviteEmail('')
    setTimeout(() => setInvited(false), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${T.green}, ${T.green}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 800, color: T.bg }}>M</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: T.textBright }}>muteform</span>
          </a>
          <span style={{ fontFamily: mono, fontSize: 10, color: T.amber, background: `${T.amber}18`, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.amber}33`, letterSpacing: '0.06em' }}>
            TEAM
          </span>
        </div>
        <a href="/dashboard" style={{ fontFamily: mono, fontSize: 11, color: T.muted, textDecoration: 'none' }}>← Dashboard</a>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
        <h1 style={{ fontFamily: sans, fontSize: 24, fontWeight: 700, color: T.textBright, marginBottom: 24 }}>
          Team
        </h1>

        {/* Invite */}
        <div style={{
          padding: '16px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 24,
        }}>
          <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.textBright, display: 'block', marginBottom: 10 }}>
            Invite a team member
          </span>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
            <input
              type="email" placeholder="colleague@company.com" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              style={{
                flex: 1, fontFamily: sans, fontSize: 13, padding: '8px 12px', borderRadius: 6,
                background: T.bg, color: T.text, border: `1px solid ${T.border}`, outline: 'none',
              }}
            />
            <button type="submit" style={{
              fontFamily: mono, fontSize: 11, fontWeight: 600, padding: '8px 16px', borderRadius: 6,
              background: T.green, color: T.bg, border: 'none', cursor: 'pointer',
            }}>INVITE</button>
          </form>
          {invited && <span style={{ fontFamily: sans, fontSize: 12, color: T.green, marginTop: 8, display: 'block' }}>Invitation sent!</span>}
        </div>

        {/* Members */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: T.textBright }}>Members</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>{MEMBERS.length} members</span>
          </div>
          {MEMBERS.map((m, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto',
              alignItems: 'center', gap: 16, padding: '12px 16px',
              borderBottom: i < MEMBERS.length - 1 ? `1px solid ${T.border}` : 'none',
            }}>
              <div>
                <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.text }}>{m.name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: T.dim }}>{m.email}</div>
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: m.role === 'Admin' ? T.amber : T.muted }}>{m.role}</span>
              <span style={{ fontFamily: mono, fontSize: 12, color: T.muted }}>{m.scans} scans</span>
              <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: m.score >= 90 ? T.green : T.amber }}>{m.score}</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: T.dim, letterSpacing: '0.08em' }}>SCORE</span>
            </div>
          ))}
        </div>

        {/* Badge */}
        <div style={{
          marginTop: 24, padding: '20px', background: T.surface, border: `1px solid ${T.green}33`,
          borderRadius: 10, textAlign: 'center',
        }}>
          <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: T.textBright, marginBottom: 8 }}>
            Public Governance Badge
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
            background: T.bg, borderRadius: 6, border: `1px solid ${T.green}44`,
          }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: T.green }}>Governed by Muteform</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: T.green, fontWeight: 700 }}>· Score: 94</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: T.dim, marginTop: 8 }}>
            Embed this badge in your README or website
          </div>
        </div>

        {/* Team stats */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Total scans', value: '101' },
            { label: 'Avg score', value: '94' },
            { label: 'Top violation', value: 'Color' },
          ].map(s => (
            <div key={s.label} style={{
              padding: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, textAlign: 'center',
            }}>
              <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: T.textBright }}>{s.value}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: T.muted, letterSpacing: '0.06em', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
