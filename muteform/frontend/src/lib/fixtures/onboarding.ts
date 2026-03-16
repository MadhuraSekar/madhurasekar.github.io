// ─── Onboarding Flow Fixture ────────────────────────────────
// 3 nodes from Cursor AI output. Deliberate violations:
//   - 1 off-token color (#3478F6)
//   - 1 off-token color (#FF6B00)
//   - 3 off-scale spacings (22, 3, 5)
//   - 1 unapproved typography style (display-xl)
//   - 1 unapproved typography style (label-xs)
//   - 1 ghost button variant (Continue Button)
//   - 1 layout grid violation (10 columns)
//   - WCAG: #FF6B00 on white ≈ 3.0:1 (fail)
import type { InterfaceDefinition } from '../engine/types'

export const ONBOARDING_FLOW: InterfaceDefinition = {
  nodes: [
    {
      id: 'onb-n1',
      type: 'interactive',
      path: 'Onboarding Flow / Step 1 / Continue Button',
      properties: {
        colors: { color: '#3478F6' },
        spacing: { padding: 22 },
        typography: { style: 'display-xl' },
        component: { name: 'button', variant: 'ghost' },
        layout: { columns: 10 },
      },
    },
    {
      id: 'onb-n2',
      type: 'element',
      path: 'Onboarding Flow / Step Header / Progress Bar',
      properties: {
        colors: { color: '#FF6B00' },
        spacing: { padding: 3 },
      },
    },
    {
      id: 'onb-n3',
      type: 'text',
      path: 'Onboarding Flow / Step 1 / Skip Link',
      properties: {
        typography: { style: 'label-xs' },
        spacing: { padding: 5 },
      },
    },
  ],
  metadata: {
    source: 'ai-generated',
    platform: 'web',
    generatedAt: new Date().toISOString(),
    agentId: 'cursor-ai',
  },
}

export const ONBOARDING_WIREFRAME = [
  { id: 'onb-n1', label: 'Continue Button', x: 10, y: 55, w: 80, h: 12, color: '#3478F6' },
  { id: 'onb-n2', label: 'Progress Bar', x: 10, y: 8, w: 80, h: 5, color: '#FF6B00' },
  { id: 'onb-n3', label: 'Skip Link', x: 35, y: 75, w: 30, h: 6, color: '#1a1d24' },
]
