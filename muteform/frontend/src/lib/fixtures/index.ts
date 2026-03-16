// ─── Fixture Registry ────────────────────────────────────────
export { CHECKOUT_FLOW, CHECKOUT_WIREFRAME } from './checkout'
export { SAAS_DASHBOARD, DASHBOARD_WIREFRAME } from './dashboard'
export { MOBILE_ONBOARDING, ONBOARDING_WIREFRAME } from './onboarding'

import type { InterfaceDefinition } from '../engine/types'
import { CHECKOUT_FLOW, CHECKOUT_WIREFRAME } from './checkout'
import { SAAS_DASHBOARD, DASHBOARD_WIREFRAME } from './dashboard'
import { MOBILE_ONBOARDING, ONBOARDING_WIREFRAME } from './onboarding'

export interface FixtureEntry {
  id: string
  name: string
  description: string
  artifact: InterfaceDefinition
  wireframe: typeof CHECKOUT_WIREFRAME
  nodeCount: number
}

export const FIXTURES: FixtureEntry[] = [
  {
    id: 'checkout',
    name: 'Checkout Flow',
    description: 'E-commerce payment form with header, card inputs, CTA, order summary, and footer',
    artifact: CHECKOUT_FLOW,
    wireframe: CHECKOUT_WIREFRAME,
    nodeCount: CHECKOUT_FLOW.nodes.length,
  },
  {
    id: 'dashboard',
    name: 'SaaS Dashboard',
    description: 'Analytics dashboard with sidebar, stat cards, chart, data table, and action buttons',
    artifact: SAAS_DASHBOARD,
    wireframe: DASHBOARD_WIREFRAME,
    nodeCount: SAAS_DASHBOARD.nodes.length,
  },
  {
    id: 'onboarding',
    name: 'Mobile Onboarding',
    description: 'Welcome flow with splash, heading, feature card, progress dots, and skip link',
    artifact: MOBILE_ONBOARDING,
    wireframe: ONBOARDING_WIREFRAME,
    nodeCount: MOBILE_ONBOARDING.nodes.length,
  },
]

export function getFixture(id: string): FixtureEntry | undefined {
  return FIXTURES.find(f => f.id === id)
}
