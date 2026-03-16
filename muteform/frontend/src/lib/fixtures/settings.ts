// ─── Settings Page Fixture ──────────────────────────────────
// 3 nodes. Deliberate violations:
//   - 1 off-token color (#059669)
//   - 1 off-token color (#DC2626)
//   - 2 off-scale spacings (20, 9, 13)
//   - 1 unapproved typography style (overline-sm)
//   - 1 outline button variant
//   - 1 layout grid violation (7 columns)
//   - WCAG contrast: #059669 against white = ~3.9:1 (fail)
import type { InterfaceDefinition } from '../engine/types'

export const SETTINGS_PAGE: InterfaceDefinition = {
  nodes: [
    {
      id: 'set-n1',
      type: 'interactive',
      path: 'Settings Page / Profile Section / Save Button',
      properties: {
        colors: { color: '#059669' },
        spacing: { padding: 20 },
        component: { name: 'button', variant: 'outline' },
      },
    },
    {
      id: 'set-n2',
      type: 'text',
      path: 'Settings Page / Notifications / Section Label',
      properties: {
        typography: { style: 'overline-sm' },
        spacing: { padding: 9 },
      },
    },
    {
      id: 'set-n3',
      type: 'container',
      path: 'Settings Page / Account / Danger Zone',
      properties: {
        colors: { color: '#DC2626' },
        spacing: { padding: 13 },
        layout: { columns: 7 },
      },
    },
  ],
  metadata: {
    source: 'ai-generated',
    platform: 'web',
    generatedAt: new Date().toISOString(),
    agentId: 'v0',
  },
}

export const SETTINGS_WIREFRAME = [
  { id: 'set-n1', label: 'Save Button', x: 60, y: 12, w: 30, h: 10, color: '#059669' },
  { id: 'set-n2', label: 'Section Label', x: 10, y: 40, w: 40, h: 6, color: '#1a1d24' },
  { id: 'set-n3', label: 'Danger Zone', x: 10, y: 65, w: 80, h: 20, color: '#DC2626' },
]
