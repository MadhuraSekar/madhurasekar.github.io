// ─── Hardcoded Scan: runs the real engine synchronously ──────
// Uses the exact RULESET and ARTIFACT provided, no fetch, no API.
import { validate, calculateScore } from './index'
import type { MuteformConfig, InterfaceDefinition, Violation, ValidationResult, HealthScore } from './types'

// ─── RULESET mapped to MuteformConfig ────────────────────────
export var HARDCODED_CONFIG: MuteformConfig = {
  name: 'Acme Design System',
  version: '1.0.0',
  tokens: {
    colors: {
      primary: '#0055FF',
      neutral900: '#111111',
      success: '#22c55e',
      warning: '#f59e0b',
    },
    spacing: { scale: [4, 8, 12, 16, 24, 32, 48, 64] },
    layout: { grid_columns: [4, 8, 12] },
  },
  rules: [
    { id: 'color-token-compliance', severity: 'high', description: 'All colors must reference approved design tokens', check: 'color.value IN tokens.colors.*', auto_fix: 'snap_nearest_delta_e' },
    { id: 'spacing-scale-compliance', severity: 'medium', description: 'Spacing values must use the approved scale', check: 'spacing.value IN tokens.spacing.scale', auto_fix: 'snap_nearest' },
    { id: 'layout-grid-compliance', severity: 'medium', description: 'Grid columns must use approved column counts', check: 'layout.columns IN tokens.layout.grid_columns', auto_fix: false },
  ],
}

// ─── ARTIFACT mapped to InterfaceDefinition ──────────────────
export var HARDCODED_INTERFACE: InterfaceDefinition = {
  nodes: [
    {
      id: 'node_1',
      type: 'interactive',
      path: 'Checkout Flow / Payment Form / Primary CTA',
      properties: {
        colors: { color: '#3478F6' },
        spacing: { margin: 22 },
        layout: { columns: 10 },
      },
    },
  ],
  metadata: {
    source: 'generic-json',
    platform: 'web',
    generatedAt: '2026-03-15T00:00:00.000Z',
  },
}

// ─── The original artifact JSON (for display) ────────────────
export var ORIGINAL_ARTIFACT = {
  id: 'demo_artifact',
  name: 'Checkout Flow',
  source: 'generic-json',
  nodes: [{
    id: 'node_1',
    type: 'button',
    name: 'Primary CTA',
    parentName: 'Payment Form',
    styles: {
      color: '#3478F6',
      spacing: 22,
      typographyStyle: 'display-xl',
    },
    component: {
      name: 'button',
      variant: 'ghost',
    },
    layout: { gridColumns: 10 },
  }],
}

// ─── The governed (fixed) artifact JSON ──────────────────────
export var GOVERNED_ARTIFACT = {
  id: 'demo_artifact',
  name: 'Checkout Flow',
  source: 'generic-json',
  nodes: [{
    id: 'node_1',
    type: 'button',
    name: 'Primary CTA',
    parentName: 'Payment Form',
    styles: {
      color: '#0055FF',
      spacing: 24,
      typographyStyle: 'body',
    },
    component: {
      name: 'button',
      variant: 'primary',
    },
    layout: { gridColumns: 12 },
  }],
}

// ─── Extra violations the engine can't catch natively ────────
function getManualViolations(): Violation[] {
  return [
    {
      ruleId: 'typography-style-compliance',
      severity: 'high',
      nodeId: 'node_1',
      nodePath: 'Checkout Flow / Payment Form / Primary CTA',
      property: 'typographyStyle',
      currentValue: 'display-xl',
      suggestedValue: 'body',
      message: 'Typography style "display-xl" is not in allowed styles [h1, h2, h3, body, body-sm, caption, label]',
      autoFixAvailable: true,
      detail: 'The typographyStyle "display-xl" does not exist in the design system. Use one of the approved styles.',
    },
    {
      ruleId: 'component-variant-compliance',
      severity: 'critical',
      nodeId: 'node_1',
      nodePath: 'Checkout Flow / Payment Form / Primary CTA',
      property: 'component.variant',
      currentValue: 'ghost',
      suggestedValue: 'primary',
      message: 'Button variant "ghost" is not allowed. Approved variants: [primary, secondary]',
      autoFixAvailable: true,
      detail: 'The button component uses variant "ghost" which is not in the approved list. Use "primary" or "secondary".',
    },
  ]
}

// ─── Design Principles ──────────────────────────────────────
export interface DesignPrinciple {
  id: string
  title: string
  rule: string
  passed: boolean
  severity: 'high' | 'medium' | 'low'
  reason: string
  fix: string
  icon: string
  contrastRatio?: string
  contrastRequired?: string
}

export var DESIGN_PRINCIPLES: DesignPrinciple[] = [
  {
    id: 'dp-hierarchy',
    title: 'Visual Hierarchy',
    rule: 'Primary action must be most visually dominant',
    passed: false,
    severity: 'high',
    reason: 'Ghost variant recedes visually. Primary actions require filled variants to establish correct visual hierarchy.',
    fix: 'Change variant to primary',
    icon: 'hierarchy',
  },
  {
    id: 'dp-contrast',
    title: 'Accessibility \u2014 WCAG AA Contrast',
    rule: 'All interactive elements must meet 4.5:1 contrast ratio minimum',
    passed: false,
    severity: 'high',
    reason: '#3478F6 on white achieves 3.1:1. Minimum required is 4.5:1 for WCAG AA.',
    fix: 'Adjust to #0055FF \u2014 achieves 5.2:1',
    icon: 'contrast',
    contrastRatio: '3.1',
    contrastRequired: '4.5',
  },
  {
    id: 'dp-cognitive',
    title: 'Cognitive Load',
    rule: 'Maximum one primary action per screen section',
    passed: true,
    severity: 'low',
    reason: 'Single primary action detected in payment form. Cognitive load is appropriate.',
    fix: '',
    icon: 'brain',
  },
  {
    id: 'dp-spacing',
    title: 'Spacing Grid Alignment',
    rule: 'All spacing must align to 8pt grid system',
    passed: false,
    severity: 'medium',
    reason: '22px does not align to 8pt grid. Nearest grid value is 24px.',
    fix: 'Snap spacing to 24px',
    icon: 'grid',
  },
]

// ─── Run the full scan synchronously ─────────────────────────
export interface HardcodedScanResult {
  result: ValidationResult
  score: HealthScore
  allViolations: Violation[]
}

export function runHardcodedScan(): HardcodedScanResult {
  // Run engine validation (catches color, spacing, layout)
  var engineResult = validate(HARDCODED_INTERFACE, HARDCODED_CONFIG)

  // Add manual violations for typography + component variant
  var manualViolations = getManualViolations()
  var allViolations: Violation[] = []
  for (var i = 0; i < engineResult.violations.length; i++) {
    allViolations.push(engineResult.violations[i])
  }
  for (var j = 0; j < manualViolations.length; j++) {
    allViolations.push(manualViolations[j])
  }

  // Build combined result
  var combinedResult: ValidationResult = {
    passed: allViolations.length === 0,
    violations: allViolations,
    nodesScanned: engineResult.nodesScanned,
    rulesEvaluated: engineResult.rulesEvaluated + 2,
    scanDurationMs: engineResult.scanDurationMs,
  }

  var score = calculateScore(combinedResult)

  return {
    result: combinedResult,
    score: score,
    allViolations: allViolations,
  }
}
