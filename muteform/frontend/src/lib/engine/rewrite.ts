// ─── Rewrite Engine: apply auto-fixes to artifact ───────────
import type {
  InterfaceDefinition,
  InterfaceNode,
  MuteformConfig,
  Violation,
  Fix,
  RewriteResult,
} from './types'
import { scanArtifact } from './scan'
import { findNearestColor, adjustForegroundForContrast, contrastRatio } from './color'
import { flattenColors } from './engine'

/**
 * Takes an artifact + violations, applies all auto-fixable violations,
 * returns the rewritten artifact with before/after scores.
 */
export function rewriteArtifact(
  artifact: InterfaceDefinition,
  violations: Violation[],
  policy: MuteformConfig
): RewriteResult {
  const colorPalette = flattenColors(policy.tokens.colors)
  const beforeScore = computeScore(violations)

  // Deep clone nodes
  const rewrittenNodes: InterfaceNode[] = JSON.parse(JSON.stringify(artifact.nodes))
  const appliedFixes: Fix[] = []

  for (const v of violations) {
    if (!v.autoFixAvailable) continue

    const node = rewrittenNodes.find(n => n.id === v.nodeId)
    if (!node) continue

    const fix = applyViolationFix(node, v, policy, colorPalette)
    if (fix) {
      appliedFixes.push(fix)
    }
  }

  const rewrittenArtifact: InterfaceDefinition = {
    nodes: rewrittenNodes,
    metadata: { ...artifact.metadata },
  }

  // Re-scan to get after-score
  const afterResult = scanArtifact(rewrittenArtifact, policy)

  return {
    rewrittenArtifact,
    appliedFixes,
    beforeScore,
    afterScore: afterResult.score,
  }
}

function applyViolationFix(
  node: InterfaceNode,
  violation: Violation,
  policy: MuteformConfig,
  colorPalette: Record<string, string>
): Fix | null {
  const prop = violation.property

  // Color fix: snap to nearest approved token
  if (prop.startsWith('colors.')) {
    const colorKey = prop.replace('colors.', '')
    if (node.properties.colors && typeof violation.suggestedValue === 'string' && violation.suggestedValue.startsWith('#')) {
      node.properties.colors[colorKey] = violation.suggestedValue
      return makeFix(violation)
    }
    // Fallback: compute nearest
    const current = node.properties.colors?.[colorKey]
    if (current) {
      const nearest = findNearestColor(current, colorPalette)
      node.properties.colors![colorKey] = nearest.hex
      return makeFix(violation, nearest.hex)
    }
  }

  // Spacing fix: snap to nearest scale value
  if (prop.startsWith('spacing.')) {
    const spacingKey = prop.replace('spacing.', '')
    const scale = policy.tokens.spacing?.scale || []
    if (node.properties.spacing && scale.length) {
      const current = node.properties.spacing[spacingKey]
      const nearest = scale.reduce((a, b) => Math.abs(b - current) < Math.abs(a - current) ? b : a)
      node.properties.spacing[spacingKey] = nearest
      return makeFix(violation, `${nearest}px`)
    }
  }

  // Contrast fix: adjust foreground to meet 4.5:1
  if (prop === 'contrast.ratio') {
    if (node.properties.contrast) {
      const { foreground, background } = node.properties.contrast
      const isLargeText = (node.properties.typography?.size || 16) >= 18
      const targetRatio = isLargeText ? 3.0 : 4.5
      const adjusted = adjustForegroundForContrast(foreground, background, targetRatio)
      node.properties.contrast.foreground = adjusted
      node.properties.contrast.ratio = contrastRatio(adjusted, background)
      // Also update the color in colors if it matches
      if (node.properties.colors?.color === foreground) {
        node.properties.colors.color = adjusted
      }
      return makeFix(violation, adjusted)
    }
  }

  // Component variant fix: replace with first allowed variant
  if (prop === 'component.variant') {
    if (node.properties.component) {
      const compDef = policy.tokens.components?.[node.properties.component.name]
      if (compDef?.allowed_variants?.[0]) {
        node.properties.component.variant = compDef.allowed_variants[0]
        return makeFix(violation, compDef.allowed_variants[0])
      }
    }
  }

  // Typography style fix: use 'body' as default
  if (prop === 'typography.style') {
    if (node.properties.typography) {
      const suggested = violation.suggestedValue || 'body'
      node.properties.typography.style = suggested
      return makeFix(violation, suggested)
    }
  }

  // Typography family fix: use first approved family
  if (prop === 'typography.family') {
    if (node.properties.typography) {
      const families = policy.tokens.typography?.families
      if (families) {
        const first = Object.values(families)[0]
        node.properties.typography.family = first
        return makeFix(violation, first)
      }
    }
  }

  // Motion fix: clamp to max
  if (prop === 'motion.duration') {
    if (node.properties.motion) {
      const max = policy.tokens.motion?.max_duration || 300
      node.properties.motion.duration = max
      return makeFix(violation, `${max}ms`)
    }
  }

  // Layout grid: NOT auto-fixable (requires human review)
  if (prop === 'layout.columns') {
    return null
  }

  return null
}

function makeFix(violation: Violation, suggestedOverride?: any): Fix {
  return {
    ruleId: violation.ruleId,
    nodeId: violation.nodeId,
    property: violation.property,
    currentValue: violation.currentValue,
    suggestedValue: suggestedOverride ?? violation.suggestedValue,
    autoApplicable: true,
  }
}

function computeScore(violations: Violation[]): number {
  const weights: Record<string, number> = { critical: 15, high: 8, medium: 3, low: 1 }
  const deduction = violations.reduce((sum, v) => sum + (weights[v.severity] || 1), 0)
  return Math.max(0, 100 - deduction)
}
