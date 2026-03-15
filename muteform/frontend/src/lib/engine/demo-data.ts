// ─── Demo data: ruleset YAML, interface definition, violations ──
import type { InterfaceDefinition, MuteformConfig } from './types'

export const DEMO_RULESET_YAML = `name: "Acme Core v8"
version: "8.0.0"

tokens:
  colors:
    brand:
      primary: "#00e087"
      secondary: "#0a1628"
    semantic:
      success: "#00e087"
      warning: "#ffb830"
      error: "#ff4070"
      info: "#4090ff"
    neutral:
      white: "#ffffff"
      gray-100: "#f0f1f3"
      gray-400: "#9ca3af"
      gray-900: "#111827"
      black: "#000000"
  spacing:
    scale: [4, 8, 12, 16, 24, 32, 48, 64]
    tolerance: 0
  typography:
    families:
      display: "Instrument Serif"
      body: "DM Sans"
      mono: "JetBrains Mono"
    scale_ratio: 1.25
    min_body_size: 14
  motion:
    max_duration: 300
    easing_allowed: ["ease-out", "ease-in-out"]
  layout:
    grid_columns: [1, 2, 3, 4, 6, 12]

rules:
  - id: "contrast-wcag-aa"
    severity: critical
    description: "Interactive elements must meet WCAG AA"
    check: "contrast.ratio >= 4.5"
    auto_fix: "adjust_foreground"
  - id: "color-token-compliance"
    severity: high
    description: "All colors must reference approved tokens"
    check: "color.value IN tokens.colors.*"
    auto_fix: "snap_nearest_delta_e"
  - id: "spacing-scale-compliance"
    severity: medium
    description: "Spacing values must use approved scale"
    check: "spacing.value IN tokens.spacing.scale"
    auto_fix: "snap_nearest"
  - id: "motion-performance"
    severity: low
    description: "Transitions must not exceed max duration"
    check: "motion.duration <= tokens.motion.max_duration"
    auto_fix: "clamp"`

export const DEMO_CONFIG: MuteformConfig = {
  name: 'Acme Core v8',
  version: '8.0.0',
  tokens: {
    colors: {
      brand: { primary: '#00e087', secondary: '#0a1628' },
      semantic: { success: '#00e087', warning: '#ffb830', error: '#ff4070', info: '#4090ff' },
      neutral: { white: '#ffffff', 'gray-100': '#f0f1f3', 'gray-400': '#9ca3af', 'gray-900': '#111827', black: '#000000' },
    },
    spacing: { scale: [4, 8, 12, 16, 24, 32, 48, 64], tolerance: 0 },
    typography: {
      families: { display: 'Instrument Serif', body: 'DM Sans', mono: 'JetBrains Mono' },
      scale_ratio: 1.25,
      min_body_size: 14,
    },
    motion: { max_duration: 300, easing_allowed: ['ease-out', 'ease-in-out'] },
    layout: { grid_columns: [1, 2, 3, 4, 6, 12] },
  },
  rules: [
    { id: 'contrast-wcag-aa', severity: 'critical', description: 'Interactive elements must meet WCAG AA', check: 'contrast.ratio >= 4.5', auto_fix: 'adjust_foreground' },
    { id: 'color-token-compliance', severity: 'high', description: 'All colors must reference approved tokens', check: 'color.value IN tokens.colors.*', auto_fix: 'snap_nearest_delta_e' },
    { id: 'spacing-scale-compliance', severity: 'medium', description: 'Spacing values must use approved scale', check: 'spacing.value IN tokens.spacing.scale', auto_fix: 'snap_nearest' },
    { id: 'motion-performance', severity: 'low', description: 'Transitions must not exceed max duration', check: 'motion.duration <= tokens.motion.max_duration', auto_fix: 'clamp' },
  ],
}

/** The demo checkout interface — has 4 intentional violations */
export const DEMO_INTERFACE: InterfaceDefinition = {
  nodes: [
    {
      id: 'header-nav',
      type: 'container',
      path: 'Checkout > HeaderNav',
      properties: {
        colors: { 'background-color': '#0a1628' },
        spacing: { padding: 16 },
      },
    },
    {
      id: 'hero-section',
      type: 'container',
      path: 'Checkout > HeroSection',
      properties: {
        colors: { 'background-color': '#111827' },
        spacing: { padding: 32, gap: 24 },
        layout: { display: 'flex', columns: 1 },
      },
    },
    {
      id: 'helper-text',
      type: 'text',
      path: 'Checkout > PaymentForm > HelperText',
      properties: {
        colors: { color: '#6b7280', 'background-color': '#f0f1f3' },
        contrast: { foreground: '#6b7280', background: '#f0f1f3', ratio: 2.8 },
        typography: { family: 'DM Sans', size: 13, weight: 400 },
      },
    },
    {
      id: 'card-input',
      type: 'interactive',
      path: 'Checkout > PaymentForm > CardInput',
      properties: {
        colors: { color: '#ffffff', 'background-color': '#111827', 'border-color': '#3478F6' },
        spacing: { padding: 12, margin: 8 },
      },
    },
    {
      id: 'primary-cta',
      type: 'interactive',
      path: 'Checkout > PaymentForm > PrimaryCTA',
      properties: {
        colors: { color: '#ffffff', 'background-color': '#3478F6' },
        spacing: { padding: 16, margin: 22 },
        typography: { family: 'DM Sans', size: 16, weight: 600 },
        motion: { duration: 450, easing: 'ease-out' },
      },
    },
    {
      id: 'order-summary',
      type: 'container',
      path: 'Checkout > OrderSummary',
      properties: {
        colors: { 'background-color': '#111827' },
        spacing: { padding: 24, gap: 16 },
      },
    },
    {
      id: 'trust-badges',
      type: 'container',
      path: 'Checkout > TrustBadges',
      properties: {
        colors: { 'background-color': '#0a1628' },
        spacing: { padding: 16, gap: 32 },
        layout: { display: 'grid', columns: 3 },
      },
    },
    {
      id: 'footer',
      type: 'container',
      path: 'Checkout > Footer',
      properties: {
        colors: { 'background-color': '#0a1628', color: '#9ca3af' },
        spacing: { padding: 24 },
      },
    },
  ],
  metadata: {
    source: 'claude-sonnet-4-20250514',
    platform: 'web',
    generatedAt: new Date().toISOString(),
    agentId: 'claude-sonnet-4-20250514',
  },
}

/** Pre-computed violations for the demo (matches what the engine would produce) */
export interface DemoViolation {
  id: string
  ruleId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  nodeId: string
  nodePath: string
  property: string
  currentValue: string
  suggestedValue: string
  message: string
  detail: string
  autoFixAvailable: boolean
}

export const DEMO_VIOLATIONS: DemoViolation[] = [
  {
    id: 'dv-1',
    ruleId: 'contrast-wcag-aa',
    severity: 'critical',
    nodeId: 'helper-text',
    nodePath: 'Checkout > PaymentForm > HelperText',
    property: 'contrast.ratio',
    currentValue: '2.8:1',
    suggestedValue: '≥4.5:1',
    message: 'Contrast ratio 2.8:1 on helper text (needs 4.5:1)',
    detail: 'Helper text #6b7280 on #f0f1f3 background fails WCAG AA. Darken foreground to #5a6170 for compliance.',
    autoFixAvailable: true,
  },
  {
    id: 'dv-2',
    ruleId: 'color-token-compliance',
    severity: 'high',
    nodeId: 'primary-cta',
    nodePath: 'Checkout > PaymentForm > PrimaryCTA',
    property: 'colors.background-color',
    currentValue: '#3478F6',
    suggestedValue: '#4090ff',
    message: '#3478F6 not in approved palette (nearest: info #4090FF)',
    detail: 'CTA background uses #3478F6 which is not in the approved color token set. Nearest token: semantic.info #4090ff (ΔE=5.2)',
    autoFixAvailable: true,
  },
  {
    id: 'dv-3',
    ruleId: 'spacing-scale-compliance',
    severity: 'medium',
    nodeId: 'primary-cta',
    nodePath: 'Checkout > PaymentForm > PrimaryCTA',
    property: 'spacing.margin',
    currentValue: '22px',
    suggestedValue: '24px',
    message: '22px not on 4/8/12/16/24/32 scale (nearest: 24px)',
    detail: 'CTA margin of 22px does not match the approved spacing scale. Snapped to nearest value: 24px.',
    autoFixAvailable: true,
  },
  {
    id: 'dv-4',
    ruleId: 'motion-performance',
    severity: 'low',
    nodeId: 'primary-cta',
    nodePath: 'Checkout > PaymentForm > PrimaryCTA',
    property: 'motion.duration',
    currentValue: '450ms',
    suggestedValue: '300ms',
    message: '450ms exceeds 300ms max (clamp to 300ms)',
    detail: 'CTA transition duration 450ms exceeds the maximum allowed 300ms. Clamped to 300ms for performance.',
    autoFixAvailable: true,
  },
]

/** The YAML lines for the typing animation */
export const DEMO_YAML_LINES = DEMO_RULESET_YAML.split('\n')

/** Score progression during auto-fix: after each violation is fixed */
export const DEMO_SCORE_PROGRESSION = [42, 62, 75, 88, 100]

/** Engine log entries */
export const DEMO_LOG_ENTRIES = [
  { phase: 'init', text: 'Muteform engine v8.0.0 initialized' },
  { phase: 'init', text: 'Loading ruleset: Acme Core v8' },
  { phase: 'init', text: 'Parsed 4 rules across 6 categories' },
  { phase: 'init', text: 'Token palette loaded: 11 colors, 8 spacing values' },
  { phase: 'intercept', text: 'Intercepted generation request from agent: claude-sonnet-4-20250514' },
  { phase: 'intercept', text: 'Injecting design constraints pre-generation...' },
  { phase: 'intercept', text: 'Constraints injected: color palette, spacing scale, motion limits' },
  { phase: 'generate', text: 'AI generating interface: Checkout Flow' },
  { phase: 'generate', text: 'Generation complete. 8 nodes detected.' },
  { phase: 'scan', text: 'Starting post-generation scan...' },
  { phase: 'scan', text: 'Scanning node: HeaderNav ✓' },
  { phase: 'scan', text: 'Scanning node: HeroSection ✓' },
  { phase: 'scan', text: 'Scanning node: HelperText ✗ CRITICAL: contrast.wcag.fail' },
  { phase: 'scan', text: 'Scanning node: CardInput ✓' },
  { phase: 'scan', text: 'Scanning node: PrimaryCTA ✗ HIGH: color.token.unapproved' },
  { phase: 'scan', text: '  └─ ✗ MEDIUM: spacing.scale.mismatch' },
  { phase: 'scan', text: '  └─ ✗ LOW: motion.duration.exceeded' },
  { phase: 'scan', text: 'Scanning node: OrderSummary ✓' },
  { phase: 'scan', text: 'Scanning node: TrustBadges ✓' },
  { phase: 'scan', text: 'Scanning node: Footer ✓' },
  { phase: 'scan', text: 'Scan complete. 4 violations found. Health score: 42' },
  { phase: 'fix', text: 'Auto-remediation starting...' },
  { phase: 'fix', text: 'FIX 1/4: Adjusting foreground contrast #6b7280 → #5a6170 (4.5:1) ✓' },
  { phase: 'fix', text: 'FIX 2/4: Snapping color #3478F6 → #4090FF (ΔE=5.2) ✓' },
  { phase: 'fix', text: 'FIX 3/4: Snapping spacing 22px → 24px ✓' },
  { phase: 'fix', text: 'FIX 4/4: Clamping duration 450ms → 300ms ✓' },
  { phase: 'fix', text: '4/4 auto-remediated · 0 human intervention · 1.4s total' },
  { phase: 'done', text: 'All violations resolved. Health score: 100. SHIP IT.' },
]

/** Wireframe blocks for the interface preview */
export const WIREFRAME_BLOCKS = [
  { id: 'header-nav', label: 'Header Nav', x: 0, y: 0, w: 100, h: 8, color: '#0a1628' },
  { id: 'hero-section', label: 'Hero Section', x: 5, y: 12, w: 90, h: 15, color: '#111827' },
  { id: 'helper-text', label: 'Helper Text', x: 8, y: 32, w: 40, h: 4, color: '#1a1c22', violation: true },
  { id: 'card-input', label: 'Card Input', x: 8, y: 38, w: 40, h: 8, color: '#111827' },
  { id: 'primary-cta', label: 'Primary CTA', x: 8, y: 49, w: 40, h: 7, color: '#3478F6', violation: true },
  { id: 'order-summary', label: 'Order Summary', x: 55, y: 32, w: 38, h: 24, color: '#111827' },
  { id: 'trust-badges', label: 'Trust Badges', x: 5, y: 62, w: 90, h: 8, color: '#0a1628' },
  { id: 'footer', label: 'Footer', x: 0, y: 74, w: 100, h: 8, color: '#0a1628' },
]
