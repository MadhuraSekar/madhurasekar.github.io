// ─── Mobile Onboarding Fixture ───────────────────────────────
// ~11 nodes. Deliberate violations:
//   - 1 forbidden button variant (ghost on skip link)
//   - 1 off-scale spacing (18px)
//   - 1 WCAG contrast failure (skip link: low-contrast)
//   - 1 off-token color (#7c3aed)
// Expected: score ~40-55 before governance, 90-100 after fixes.
import type { InterfaceDefinition } from '../engine/types'

export const MOBILE_ONBOARDING: InterfaceDefinition = {
  nodes: [
    {
      id: 'onboard-splash',
      type: 'image',
      path: 'Onboarding > SplashImage',
      properties: {
        colors: { 'background-color': '#111111' },
        spacing: { padding: 0 },
        layout: { display: 'flex', columns: 4 },
      },
    },
    {
      id: 'onboard-heading',
      type: 'text',
      path: 'Onboarding > Heading',
      properties: {
        colors: { color: '#f0f1f3' },
        typography: { family: 'DM Sans', size: 28, weight: 700 },
        spacing: { margin: 32 },
      },
    },
    {
      id: 'onboard-subheading',
      type: 'text',
      path: 'Onboarding > Subheading',
      properties: {
        colors: { color: '#9ca3af' },
        typography: { family: 'DM Sans', size: 16, weight: 400 },
        spacing: { margin: 12 },
      },
    },
    {
      id: 'onboard-body',
      type: 'text',
      path: 'Onboarding > BodyText',
      properties: {
        colors: { color: '#9ca3af' },
        typography: { family: 'DM Sans', size: 14, weight: 400 },
        spacing: { padding: 16, margin: 8 },
      },
    },
    {
      id: 'onboard-progress-dots',
      type: 'container',
      path: 'Onboarding > ProgressDots',
      properties: {
        colors: { color: '#0055FF' },
        spacing: { gap: 8, margin: 24 },
        layout: { display: 'flex' },
      },
    },
    {
      id: 'onboard-feature-card',
      type: 'container',
      path: 'Onboarding > FeatureCard',
      properties: {
        colors: { 'background-color': '#111111', 'border-color': '#7c3aed' },
        spacing: { padding: 24, gap: 12 },
      },
    },
    {
      id: 'onboard-feature-icon',
      type: 'element',
      path: 'Onboarding > FeatureCard > Icon',
      properties: {
        colors: { color: '#7c3aed' },
        spacing: { margin: 8 },
      },
    },
    {
      id: 'onboard-feature-text',
      type: 'text',
      path: 'Onboarding > FeatureCard > Description',
      properties: {
        colors: { color: '#9ca3af' },
        typography: { family: 'DM Sans', size: 13, weight: 400 },
        spacing: { margin: 4 },
      },
    },
    {
      id: 'onboard-cta',
      type: 'interactive',
      path: 'Onboarding > PrimaryCTA',
      properties: {
        colors: { color: '#ffffff', 'background-color': '#0055FF' },
        spacing: { padding: 16, margin: 18 },
        typography: { family: 'DM Sans', size: 16, weight: 600 },
        component: { name: 'button', variant: 'primary' },
      },
    },
    {
      id: 'onboard-skip',
      type: 'interactive',
      path: 'Onboarding > SkipLink',
      properties: {
        colors: { color: '#444444', 'background-color': '#333333' },
        contrast: { foreground: '#444444', background: '#333333' },
        typography: { family: 'DM Sans', size: 13, weight: 400 },
        spacing: { margin: 8 },
        component: { name: 'button', variant: 'ghost' },
      },
    },
    {
      id: 'onboard-footer',
      type: 'container',
      path: 'Onboarding > Footer',
      properties: {
        colors: { 'background-color': '#111111' },
        spacing: { padding: 16 },
      },
    },
  ],
  metadata: {
    source: 'ai-generated',
    platform: 'mobile',
    generatedAt: new Date().toISOString(),
    agentId: 'claude-sonnet-4-20250514',
  },
}

export const ONBOARDING_WIREFRAME = [
  { id: 'onboard-splash', label: 'Splash', x: 10, y: 0, w: 80, h: 25, color: '#111111' },
  { id: 'onboard-heading', label: 'Heading', x: 10, y: 28, w: 80, h: 5, color: '#1a1c22' },
  { id: 'onboard-subheading', label: 'Subhead', x: 10, y: 35, w: 60, h: 3, color: '#1a1c22' },
  { id: 'onboard-body', label: 'Body', x: 10, y: 40, w: 80, h: 6, color: '#1a1c22' },
  { id: 'onboard-progress-dots', label: '●●●○', x: 35, y: 49, w: 30, h: 3, color: '#0055FF' },
  { id: 'onboard-feature-card', label: 'Feature', x: 10, y: 55, w: 80, h: 14, color: '#111111' },
  { id: 'onboard-feature-icon', label: '★', x: 14, y: 58, w: 6, h: 6, color: '#7c3aed' },
  { id: 'onboard-feature-text', label: 'Desc', x: 24, y: 59, w: 60, h: 4, color: '#1a1c22' },
  { id: 'onboard-cta', label: 'Get Started', x: 10, y: 74, w: 80, h: 8, color: '#0055FF' },
  { id: 'onboard-skip', label: 'Skip', x: 30, y: 85, w: 40, h: 5, color: '#333333' },
  { id: 'onboard-footer', label: 'Footer', x: 0, y: 93, w: 100, h: 7, color: '#111111' },
]
