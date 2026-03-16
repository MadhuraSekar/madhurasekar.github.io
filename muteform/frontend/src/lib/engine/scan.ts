// ─── scanArtifact: unified scan entry point ─────────────────
import type { InterfaceDefinition, MuteformConfig, ScanResult, Fix, Violation } from './types'
import { validate } from './engine'
import { calculateScore } from './scoring'

/**
 * Run a full deterministic scan of an artifact against a policy.
 * Returns violations, suggested fixes, and a health score.
 */
export function scanArtifact(
  artifact: InterfaceDefinition,
  policy: MuteformConfig
): ScanResult {
  const result = validate(artifact, policy)
  const score = calculateScore(result)

  const fixes: Fix[] = result.violations
    .filter(v => v.autoFixAvailable && v.suggestedValue != null)
    .map(v => ({
      ruleId: v.ruleId,
      nodeId: v.nodeId,
      property: v.property,
      currentValue: v.currentValue,
      suggestedValue: v.suggestedValue,
      autoApplicable: v.autoFixAvailable,
    }))

  return {
    violations: result.violations,
    fixes,
    score: score.overall,
    nodesScanned: result.nodesScanned,
    rulesEvaluated: result.rulesEvaluated,
    scanDurationMs: result.scanDurationMs,
  }
}

/**
 * Compute the weighted health score from violations.
 * critical = 3x, high = 2x, medium = 1x, low = 0.5x
 */
export function computeHealthScore(violations: Violation[], totalChecks: number): number {
  if (totalChecks === 0) return 100
  const weights: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0.5 }
  const weighted = violations.reduce((sum, v) => sum + (weights[v.severity] || 1), 0)
  return Math.max(0, Math.round((1 - (weighted / totalChecks)) * 100))
}
