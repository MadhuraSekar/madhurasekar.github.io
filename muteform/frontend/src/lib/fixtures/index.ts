// ─── Fixture Registry ────────────────────────────────────────
export { CHECKOUT_FLOW, CHECKOUT_WIREFRAME } from './checkout'
export { SAAS_DASHBOARD, DASHBOARD_WIREFRAME } from './dashboard'
export { ONBOARDING_FLOW, ONBOARDING_WIREFRAME } from './onboarding'
export { SETTINGS_PAGE, SETTINGS_WIREFRAME } from './settings'

import type { InterfaceDefinition } from '../engine/types'
import { CHECKOUT_FLOW, CHECKOUT_WIREFRAME } from './checkout'
import { SAAS_DASHBOARD, DASHBOARD_WIREFRAME } from './dashboard'
import { ONBOARDING_FLOW, ONBOARDING_WIREFRAME } from './onboarding'
import { SETTINGS_PAGE, SETTINGS_WIREFRAME } from './settings'

export interface FixtureEntry {
  id: string
  name: string
  description: string
  source: string
  artifact: InterfaceDefinition
  wireframe: typeof CHECKOUT_WIREFRAME
  nodeCount: number
}

export const FIXTURES: FixtureEntry[] = [
  {
    id: 'dashboard',
    name: 'SaaS Dashboard',
    description: 'Analytics dashboard with revenue chart, export button, stats grid, and avatar',
    source: 'Claude Code output',
    artifact: SAAS_DASHBOARD,
    wireframe: DASHBOARD_WIREFRAME,
    nodeCount: SAAS_DASHBOARD.nodes.length,
  },
  {
    id: 'onboarding',
    name: 'Onboarding Flow',
    description: 'Onboarding wizard with continue button, progress bar, and skip link',
    source: 'Cursor AI output',
    artifact: ONBOARDING_FLOW,
    wireframe: ONBOARDING_WIREFRAME,
    nodeCount: ONBOARDING_FLOW.nodes.length,
  },
  {
    id: 'settings',
    name: 'Settings Page',
    description: 'Settings with save button, section label, and danger zone',
    source: 'v0 output',
    artifact: SETTINGS_PAGE,
    wireframe: SETTINGS_WIREFRAME,
    nodeCount: SETTINGS_PAGE.nodes.length,
  },
  {
    id: 'checkout',
    name: 'Checkout Flow',
    description: 'E-commerce payment form with header, card inputs, CTA, and order summary',
    source: 'Claude Code output',
    artifact: CHECKOUT_FLOW,
    wireframe: CHECKOUT_WIREFRAME,
    nodeCount: CHECKOUT_FLOW.nodes.length,
  },
]

export function getFixture(id: string): FixtureEntry | undefined {
  return FIXTURES.find(f => f.id === id)
}
