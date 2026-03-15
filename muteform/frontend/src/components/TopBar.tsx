'use client'

import { C, mono, syne } from './ui/tokens'

const TABS = ['Scan', 'History', 'Drift', 'Rules', 'MCP'] as const
export type TabName = (typeof TABS)[number]

interface TopBarProps {
  activeTab: TabName
  onTabChange: (tab: TabName) => void
}

export function TopBar({ activeTab, onTabChange }: TopBarProps) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 52, borderBottom: `1px solid ${C.border}`,
      background: C.bg, position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <rect x="1" y="1" width="20" height="20" rx="4" stroke={C.blue} strokeWidth="1.5" />
            <path d="M6 11h10M11 6v10" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: syne, fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', color: C.text }}>
            Muteform
          </span>
        </div>
        <nav style={{ display: 'flex', gap: 2 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              style={{
                fontFamily: mono, fontSize: 10, letterSpacing: '0.07em',
                padding: '5px 12px', borderRadius: 3, border: 'none', cursor: 'pointer',
                background: activeTab === tab ? C.surface2 : 'transparent',
                color: tab === 'MCP'
                  ? (activeTab === tab ? C.green : C.muted)
                  : (activeTab === tab ? C.text : C.muted),
                transition: 'all 0.12s',
              }}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
        <span style={{ fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: '0.06em' }}>
          ENGINE READY
        </span>
      </div>
    </header>
  )
}
