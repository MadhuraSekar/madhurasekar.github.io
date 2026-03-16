// ─── SaaS Dashboard Fixture ─────────────────────────────────
// 4 nodes from Claude Code output. Deliberate violations:
//   - 2 off-token colors (#29A8AB, #E23400)
//   - 3 off-scale spacings (18, 10, 14)
//   - 1 unapproved typography style (display-sm)
//   - 1 ghost button variant (Export Button)
//   - 1 outline card variant
//   - 1 layout grid violation (5 columns)
//   - WCAG: #E23400 on white ≈ 3.6:1 (fail)
import type { InterfaceDefinition } from '../engine/types'

export const SAAS_DASHBOARD: InterfaceDefinition = {
  nodes: [
    {
      id: 'dash-n1',
      type: 'container',
      path: 'SaaS Dashboard / Main Dashboard / Revenue Chart',
      properties: {
        colors: { color: '#29A8AB' },
        spacing: { padding: 18 },
        component: { name: 'card', variant: 'outline' },
      },
    },
    {
      id: 'dash-n2',
      type: 'interactive',
      path: 'SaaS Dashboard / Action Bar / Export Button',
      properties: {
        colors: { color: '#E23400' },
        spacing: { padding: 10 },
        typography: { style: 'display-sm' },
        component: { name: 'button', variant: 'ghost' },
      },
    },
    {
      id: 'dash-n3',
      type: 'container',
      path: 'SaaS Dashboard / Main Dashboard / Stats Grid',
      properties: {
        spacing: { padding: 14 },
        layout: { columns: 5 },
      },
    },
    {
      id: 'dash-n4',
      type: 'element',
      path: 'SaaS Dashboard / Header / User Avatar',
      properties: {
        colors: { color: '#8B5CF6' },
        spacing: { padding: 6 },
      },
    },
  ],
  metadata: {
    source: 'ai-generated',
    platform: 'web',
    generatedAt: new Date().toISOString(),
    agentId: 'claude-code',
  },
}

export const DASHBOARD_WIREFRAME = [
  { id: 'dash-n1', label: 'Revenue Chart', x: 5, y: 15, w: 55, h: 35, color: '#29A8AB' },
  { id: 'dash-n2', label: 'Export Button', x: 65, y: 15, w: 30, h: 10, color: '#E23400' },
  { id: 'dash-n3', label: 'Stats Grid', x: 5, y: 55, w: 55, h: 20, color: '#1a1d24' },
  { id: 'dash-n4', label: 'User Avatar', x: 85, y: 3, w: 10, h: 8, color: '#8B5CF6' },
]
