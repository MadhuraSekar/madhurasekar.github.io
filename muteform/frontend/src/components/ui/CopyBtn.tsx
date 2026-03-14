'use client'
import { useState } from 'react'
import { C, mono } from './tokens'

export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false)
  function doCopy() {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})
    setOk(true)
    setTimeout(() => setOk(false), 1800)
  }
  return (
    <button onClick={doCopy} style={{
      fontFamily: mono, fontSize: 10, letterSpacing: '0.07em', padding: '5px 10px',
      background: 'transparent', border: `1px solid ${ok ? C.green : C.border2}`,
      borderRadius: 3, color: ok ? C.green : C.muted, cursor: 'pointer', transition: 'all 0.2s',
    }}>
      {ok ? 'COPIED' : (label || 'COPY')}
    </button>
  )
}
