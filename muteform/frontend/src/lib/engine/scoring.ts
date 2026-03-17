// ─── Muteform Scoring Engine ─────────────────────────────────
import type { ValidationResult, HealthScore, Violation } from './types'

const SEVERITY_DEDUCTIONS: Record<string, number> = {
  critical: 15,
  high: 8,
  medium: 3,
  low: 1,
}

// Governance-spec weights: Accessibility 30%, Token 25%, Components 20%, Spacing 15%, Layout 10%
const CATEGORY_WEIGHTS: Record<string, number> = {
  accessibility: 0.30,
  color: 0.25,      // "Token Compliance" in the UI
  component: 0.20,
  spacing: 0.15,
  layout: 0.10,
  // typography, motion, other: 0 weight (displayed but not scored)
}

function categoryFromRule(ruleId: string): string {
  if (ruleId.includes('color')) return 'color'
  if (ruleId.includes('spacing')) return 'spacing'
  if (ruleId.includes('typography') || ruleId.includes('font')) return 'typography'
  if (ruleId.includes('motion') || ruleId.includes('animation')) return 'motion'
  if (ruleId.includes('contrast') || ruleId.includes('wcag') || ruleId.includes('a11y')) return 'accessibility'
  if (ruleId.includes('component') || ruleId.includes('variant')) return 'component'
  if (ruleId.includes('layout') || ruleId.includes('grid')) return 'layout'
  return 'other'
}

/**
 * Compute weighted health score from category scores.
 * Only categories with defined weights are included.
 */
export function weightedHealthScore(categoryScores: Record<string, number>): number {
  let score = 0
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const catScore = categoryScores[cat] ?? 100 // default to 100 if no violations in category
    score += catScore * weight
  }
  return Math.round(score)
}

export function calculateScore(result: ValidationResult): HealthScore {
  const violationCounts: Record<string, number> = {}
  const categoryDeductions: Record<string, number> = {}

  for (const v of result.violations) {
    const cat = categoryFromRule(v.ruleId)
    violationCounts[cat] = (violationCounts[cat] || 0) + 1
    categoryDeductions[cat] = (categoryDeductions[cat] || 0) + (SEVERITY_DEDUCTIONS[v.severity] || 1)
  }

  // Per-category scores (100 minus deductions for that category, floored at 0)
  const allCategories = ['color', 'spacing', 'typography', 'motion', 'accessibility', 'layout', 'component']
  const breakdown: Record<string, number> = {}
  for (const cat of allCategories) {
    breakdown[cat] = Math.max(0, 100 - (categoryDeductions[cat] || 0))
  }

  // Overall = weighted average of category scores
  const overall = weightedHealthScore(breakdown)

  return { overall, breakdown, violationCounts }
}

/** Calculate score from a subset of violations (e.g. after fixing some) */
export function scoreFromViolations(violations: Violation[]): number {
  const categoryDeductions: Record<string, number> = {}
  for (const v of violations) {
    const cat = categoryFromRule(v.ruleId)
    categoryDeductions[cat] = (categoryDeductions[cat] || 0) + (SEVERITY_DEDUCTIONS[v.severity] || 1)
  }
  const allCategories = ['color', 'spacing', 'typography', 'motion', 'accessibility', 'layout', 'component']
  const breakdown: Record<string, number> = {}
  for (const cat of allCategories) {
    breakdown[cat] = Math.max(0, 100 - (categoryDeductions[cat] || 0))
  }
  return weightedHealthScore(breakdown)
}
