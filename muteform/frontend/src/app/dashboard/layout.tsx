'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setReady(true)
      }
    })
  }, [router])

  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#080909',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6b7280' }}>
          Loading...
        </span>
      </div>
    )
  }

  return <>{children}</>
}
