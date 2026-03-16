// ─── Checkout Flow Fixture ───────────────────────────────────
// ~14 nodes. Deliberate violations:
//   - 2 off-token colors (#3478F6, #1a8f4e)
//   - 1 off-scale spacing (22px)
//   - 1 ghost button variant (forbidden)
//   - 1 low-contrast text pair (WCAG fail)
//   - 1 unapproved typography style (display-xl)
// Expected: score ~35-45 before governance, 90-100 after fixes.
import type { InterfaceDefinition } from '../engine/types'

export const CHECKOUT_FLOW: InterfaceDefinition = {
  nodes: [
    {
      id: 'checkout-header',
      type: 'container',
      path: 'Checkout > Header',
      properties: {
        colors: { 'background-color': '#111111', color: '#f0f1f3' },
        spacing: { padding: 16, gap: 12 },
        layout: { display: 'flex', columns: 12 },
      },
    },
    {
      id: 'checkout-logo',
      type: 'element',
      path: 'Checkout > Header > Logo',
      properties: {
        colors: { color: '#0055FF' },
        typography: { family: 'DM Sans', size: 20, weight: 700 },
      },
    },
    {
      id: 'checkout-breadcrumb',
      type: 'text',
      path: 'Checkout > Header > Breadcrumb',
      properties: {
        colors: { color: '#9ca3af' },
        typography: { family: 'DM Sans', size: 12, weight: 400 },
        spacing: { margin: 8 },
      },
    },
    {
      id: 'checkout-form-container',
      type: 'container',
      path: 'Checkout > FormSection',
      properties: {
        colors: { 'background-color': '#111111' },
        spacing: { padding: 32, gap: 24 },
        layout: { display: 'grid', columns: 8 },
      },
    },
    {
      id: 'checkout-email-field',
      type: 'interactive',
      path: 'Checkout > FormSection > EmailField',
      properties: {
        colors: { color: '#f0f1f3', 'background-color': '#111111', 'border-color': '#0055FF' },
        spacing: { padding: 12, margin: 16 },
        typography: { family: 'DM Sans', size: 14, weight: 400 },
      },
    },
    {
      id: 'checkout-card-input',
      type: 'interactive',
      path: 'Checkout > FormSection > CardInput',
      properties: {
        colors: { color: '#f0f1f3', 'background-color': '#111111', 'border-color': '#3478F6' },
        spacing: { padding: 12, margin: 16 },
        typography: { family: 'DM Sans', size: 14, weight: 400 },
      },
    },
    {
      id: 'checkout-helper-text',
      type: 'text',
      path: 'Checkout > FormSection > HelperText',
      properties: {
        colors: { color: '#8a8a8a', 'background-color': '#b0b0b0' },
        contrast: { foreground: '#8a8a8a', background: '#b0b0b0' },
        typography: { family: 'DM Sans', size: 12, weight: 400 },
        spacing: { margin: 4 },
      },
    },
    {
      id: 'checkout-cta',
      type: 'interactive',
      path: 'Checkout > FormSection > PrimaryCTA',
      properties: {
        colors: { color: '#ffffff', 'background-color': '#3478F6' },
        spacing: { padding: 16, margin: 22 },
        typography: { family: 'DM Sans', size: 16, weight: 600, style: 'display-xl' },
        component: { name: 'button', variant: 'ghost' },
        motion: { duration: 200, easing: 'ease-out' },
      },
    },
    {
      id: 'checkout-price-row',
      type: 'container',
      path: 'Checkout > OrderSummary > PriceRow',
      properties: {
        colors: { color: '#f0f1f3', 'background-color': '#111111' },
        spacing: { padding: 16, gap: 8 },
        layout: { display: 'flex' },
      },
    },
    {
      id: 'checkout-subtotal',
      type: 'text',
      path: 'Checkout > OrderSummary > Subtotal',
      properties: {
        colors: { color: '#9ca3af' },
        typography: { family: 'DM Sans', size: 14, weight: 400 },
      },
    },
    {
      id: 'checkout-total',
      type: 'text',
      path: 'Checkout > OrderSummary > Total',
      properties: {
        colors: { color: '#f0f1f3' },
        typography: { family: 'DM Sans', size: 18, weight: 700 },
        spacing: { margin: 8 },
      },
    },
    {
      id: 'checkout-trust-badges',
      type: 'container',
      path: 'Checkout > TrustBadges',
      properties: {
        colors: { 'background-color': '#1a8f4e' },
        spacing: { padding: 12, gap: 16 },
        layout: { display: 'flex' },
      },
    },
    {
      id: 'checkout-footer-links',
      type: 'text',
      path: 'Checkout > Footer > Links',
      properties: {
        colors: { color: '#9ca3af' },
        typography: { family: 'DM Sans', size: 11, weight: 400 },
        spacing: { padding: 24 },
      },
    },
    {
      id: 'checkout-footer',
      type: 'container',
      path: 'Checkout > Footer',
      properties: {
        colors: { 'background-color': '#111111', color: '#9ca3af' },
        spacing: { padding: 24 },
        layout: { display: 'flex', columns: 12 },
      },
    },
  ],
  metadata: {
    source: 'ai-generated',
    platform: 'web',
    generatedAt: new Date().toISOString(),
    agentId: 'claude-sonnet-4-20250514',
  },
}

/** Wireframe blocks for visual representation */
export const CHECKOUT_WIREFRAME = [
  { id: 'checkout-header', label: 'Header', x: 0, y: 0, w: 100, h: 7, color: '#111111' },
  { id: 'checkout-logo', label: 'Logo', x: 3, y: 1, w: 12, h: 5, color: '#0055FF' },
  { id: 'checkout-breadcrumb', label: 'Breadcrumb', x: 20, y: 2, w: 30, h: 3, color: '#1a1c22' },
  { id: 'checkout-form-container', label: 'Form', x: 5, y: 10, w: 45, h: 55, color: '#111111' },
  { id: 'checkout-email-field', label: 'Email', x: 8, y: 14, w: 38, h: 6, color: '#161819' },
  { id: 'checkout-card-input', label: 'Card', x: 8, y: 22, w: 38, h: 6, color: '#161819' },
  { id: 'checkout-helper-text', label: 'Help', x: 8, y: 30, w: 25, h: 3, color: '#1a1c22' },
  { id: 'checkout-cta', label: 'Pay Now', x: 8, y: 35, w: 38, h: 8, color: '#3478F6' },
  { id: 'checkout-price-row', label: 'Price Row', x: 55, y: 10, w: 38, h: 12, color: '#111111' },
  { id: 'checkout-subtotal', label: 'Subtotal', x: 58, y: 12, w: 15, h: 3, color: '#1a1c22' },
  { id: 'checkout-total', label: 'Total', x: 58, y: 17, w: 15, h: 4, color: '#1a1c22' },
  { id: 'checkout-trust-badges', label: 'Trust', x: 55, y: 25, w: 38, h: 6, color: '#1a8f4e' },
  { id: 'checkout-footer-links', label: 'Links', x: 5, y: 72, w: 40, h: 3, color: '#1a1c22' },
  { id: 'checkout-footer', label: 'Footer', x: 0, y: 78, w: 100, h: 7, color: '#111111' },
]
