// ─── Muteform Scoring Engine ─────────────────────────────────
import type { ValidationResult, HealthScore, Violation } from './types'

const SEVERITY_DEDUCTIONS: Record<string, number> = {
  critical: 15,
  high: 8,
  medium: 3,
  low: 1,
}

function categoryFromRule(ruleId: string): string {
  if (ruleId.includes('color')) return 'color'
  if (ruleId.includes('spacing')) return 'spacing'
  if (ruleId.includes('typography') || ruleId.includes('font')) return 'typography'
  if (ruleId.includes('motion') || ruleId.includes('animation')) return 'motion'
  if (ruleId.includes('contrast') || ruleId.includes('wcag') || ruleId.includes('a11y')) return 'accessibility'
  if (ruleId.includes('layout') || ruleId.includes('grid')) return 'layout'
  return 'other'
}

export function calculateScore(result: ValidationResult): HealthScore {
  const violationCounts: Record<string, number> = {}
  const categoryDeductions: Record<string, number> = {}

  for (const v of result.violations) {
    const cat = categoryFromRule(v.ruleId)
    violationCounts[cat] = (violationCounts[cat] || 0) + 1
    categoryDeductions[cat] = (categoryDeductions[cat] || 0) + (SEVERITY_DEDUCTIONS[v.severity] || 1)
  }

  const totalDeduction = result.violations.reduce(
    (sum, v) => sum + (SEVERITY_DEDUCTIONS[v.severity] || 1), 0
  )

  const overall = Math.max(0, 100 - totalDeduction)

  // Per-category scores (100 minus deductions for that category, floored at 0)
  const allCategories = ['color', 'spacing', 'typography', 'motion', 'accessibility', 'layout']
  const breakdown: Record<string, number> = {}
  for (const cat of allCategories) {
    breakdown[cat] = Math.max(0, 100 - (categoryDeductions[cat] || 0))
  }

  return { overall, breakdown, violationCounts }
}

/** Calculate score from a subset of violations (e.g. after fixing some) */
export function scoreFromViolations(violations: Violation[]): number {
  const totalDeduction = violations.reduce(
    (sum, v) => sum + (SEVERITY_DEDUCTIONS[v.severity] || 1), 0
  )
  return Math.max(0, 100 - totalDeduction)
}
