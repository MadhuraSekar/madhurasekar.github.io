'use client'

import { useState } from 'react'
import { TopBar, TabName } from '@/components/TopBar'
import dynamic from 'next/dynamic'
import { C, mono } from '@/components/ui/tokens'

const ScanTab = dynamic(() => import('@/components/ScanTab').then(m => ({ default: m.ScanTab })), {
  loading: () => <TabLoader />,
})
const HistoryTab = dynamic(() => import('@/components/HistoryTab').then(m => ({ default: m.HistoryTab })), {
  loading: () => <TabLoader />,
})
const DriftTab = dynamic(() => import('@/components/DriftTab').then(m => ({ default: m.DriftTab })), {
  loading: () => <TabLoader />,
})
const RulesTab = dynamic(() => import('@/components/RulesTab').then(m => ({ default: m.RulesTab })), {
  loading: () => <TabLoader />,
})
const MCPTab = dynamic(() => import('@/components/MCPTab').then(m => ({ default: m.MCPTab })), {
  loading: () => <TabLoader />,
})

function TabLoader() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>Loading...</span>
    </div>
  )
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabName>('Scan')

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <TopBar activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {activeTab === 'Scan' && <ScanTab />}
        {activeTab === 'History' && <HistoryTab />}
        {activeTab === 'Drift' && <DriftTab />}
        {activeTab === 'Rules' && <RulesTab />}
        {activeTab === 'MCP' && <MCPTab />}
      </main>
    </div>
  )
}
