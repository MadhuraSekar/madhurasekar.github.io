// ─── Governance Engine ──────────────────────────────────────
// Enriches engine violations with full taxonomy,
// adds WCAG contrast + visual hierarchy auto-checks,
// and produces a governance report.

import type { InterfaceDefinition, Violation, ScanResult, RewriteResult, MuteformConfig } from './engine/types'
import { contrastRatio } from './engine/color'

// ─── Enriched Violation Type ────────────────────────────────
export type ViolationType =
  | 'color_token'
  | 'spacing'
  | 'typography'
  | 'component'
  | 'layout'
  | 'accessibility'

export type GovernanceSeverity = 'block' | 'warn' | 'auto-fix'

export interface EnrichedViolation {
  id: string
  type: ViolationType
  severity: GovernanceSeverity
  ruleName: string
  ruleSource: string
  nodeId: string
  nodeName: string
  nodePath: string
  evidence: string
  fixApplied: boolean
  fixDescription: string
  suggestedFix: string
}

// ─── Category Scores ────────────────────────────────────────
export interface CategoryScore {
  name: string
  key: string
  score: number
  color: string
}

// ─── Governance Report ──────────────────────────────────────
export interface GovernanceReport {
  fixtureName: string
  fixtureSource: string
  timestamp: string
  overallScore: number
  afterScore: number
  categories: CategoryScore[]
  violations: EnrichedViolation[]
  autoFixedCount: number
  warningCount: number
  blockedCount: number
}

// ─── Approximate contrast against white for a hex color ─────
function contrastAgainstWhite(hex: string): number {
  try {
    return contrastRatio(hex, '#ffffff')
  } catch {
    return 21 // assume passing if we can't parse
  }
}

// ─── Map engine violation to enriched violation ─────────────
function mapViolationType(property: string, ruleId: string): ViolationType {
  if (property.startsWith('colors.') || ruleId.includes('color')) return 'color_token'
  if (property.startsWith('spacing.') || ruleId.includes('spacing')) return 'spacing'
  if (property.startsWith('typography.') || ruleId.includes('typography')) return 'typography'
  if (property.startsWith('component.') || ruleId.includes('component')) return 'component'
  if (property.startsWith('layout.') || ruleId.includes('layout') || ruleId.includes('grid')) return 'layout'
  if (property.includes('contrast') || ruleId.includes('contrast') || ruleId.includes('wcag')) return 'accessibility'
  return 'color_token'
}

function mapSeverity(v: Violation): GovernanceSeverity {
  // WCAG contrast failures that aren't auto-fixable => block
  if (v.ruleId.includes('contrast') && !v.autoFixAvailable) return 'block'
  // Layout grid => block (requires manual review)
  if (v.property === 'layout.columns' && !v.autoFixAvailable) return 'block'
  // Auto-fixable => auto-fix
  if (v.autoFixAvailable) return 'auto-fix'
  // Everything else => warn
  return 'warn'
}

function ruleSourceForType(type: ViolationType, ruleId: string): string {
  if (type === 'accessibility' || ruleId.includes('contrast') || ruleId.includes('wcag')) return 'WCAG 2.1 AA'
  if (ruleId.includes('hierarchy') || ruleId.includes('visual')) return 'Design Principles'
  return 'Design System v2.1'
}

function humanRuleName(ruleId: string): string {
  const names: Record<string, string> = {
    'color-token-compliance': 'Color Token Compliance',
    'spacing-scale-compliance': 'Spacing Scale Compliance',
    'contrast-wcag-aa': 'WCAG AA Contrast Minimum',
    'typography-style-compliance': 'Typography Style Compliance',
    'component-variant-compliance': 'Component Variant Compliance',
    'layout-grid-compliance': 'Grid Column Compliance',
    'wcag-contrast-off-palette': 'WCAG AA Contrast Minimum',
    'visual-hierarchy': 'Primary Action Must Use Filled Variant',
  }
  return names[ruleId] || ruleId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function nodeNameFromPath(path: string): string {
  const parts = path.split(/\s*[/>]\s*/)
  return parts[parts.length - 1] || path
}

// ─── Generate WCAG contrast violations for off-palette colors ──
function generateWcagViolations(artifact: InterfaceDefinition, config: MuteformConfig): EnrichedViolation[] {
  const violations: EnrichedViolation[] = []
  const approvedColors = new Set<string>()

  // Flatten approved colors
  const flattenColors = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    for (const val of Object.values(obj)) {
      if (typeof val === 'string' && val.startsWith('#')) {
        approvedColors.add(val.toLowerCase())
      } else if (typeof val === 'object') {
        flattenColors(val)
      }
    }
  }
  flattenColors(config.tokens.colors)

  for (const node of artifact.nodes) {
    if (!node.properties.colors) continue
    for (const [, colorVal] of Object.entries(node.properties.colors)) {
      if (!colorVal.startsWith('#')) continue
      if (approvedColors.has(colorVal.toLowerCase())) continue

      const ratio = contrastAgainstWhite(colorVal)
      if (ratio < 4.5) {
        violations.push({
          id: `wcag-${node.id}-${colorVal}`,
          type: 'accessibility',
          severity: 'block',
          ruleName: 'WCAG AA Contrast Minimum',
          ruleSource: 'WCAG 2.1 AA',
          nodeId: node.id,
          nodeName: nodeNameFromPath(node.path),
          nodePath: node.path,
          evidence: `${colorVal} achieves ${ratio.toFixed(1)}:1 against white. Minimum 4.5:1 required.`,
          fixApplied: false,
          fixDescription: 'Adjust to approved token with sufficient contrast',
          suggestedFix: 'Use nearest approved color token',
        })
      }
    }
  }

  return violations
}

// ─── Generate visual hierarchy violations ───────────────────
function generateHierarchyViolations(artifact: InterfaceDefinition): EnrichedViolation[] {
  const violations: EnrichedViolation[] = []

  // Group buttons by parent path
  const buttonsByParent = new Map<string, typeof artifact.nodes>()
  for (const node of artifact.nodes) {
    if (!node.properties.component) continue
    if (node.properties.component.name !== 'button') continue
    const pathParts = node.path.split(' / ')
    const parentPath = pathParts.slice(0, -1).join(' / ')
    const existing = buttonsByParent.get(parentPath) || []
    existing.push(node)
    buttonsByParent.set(parentPath, existing)
  }

  buttonsByParent.forEach((buttons) => {
    if (buttons.length !== 1) return
    const btn = buttons[0]
    const variant = btn.properties.component?.variant
    if (variant === 'ghost' || variant === 'outline') {
      violations.push({
        id: `hierarchy-${btn.id}`,
        type: 'accessibility',
        severity: 'warn',
        ruleName: 'Primary Action Must Use Filled Variant',
        ruleSource: 'Design Principles',
        nodeId: btn.id,
        nodeName: nodeNameFromPath(btn.path),
        nodePath: btn.path,
        evidence: `${variant} variant recedes visually. Users may miss the primary action.`,
        fixApplied: false,
        fixDescription: 'Change to variant: primary',
        suggestedFix: 'primary',
      })
    }
  })

  return violations
}

// ─── Enrich engine violations ───────────────────────────────
function enrichViolation(v: Violation, fixApplied: boolean): EnrichedViolation {
  const type = mapViolationType(v.property, v.ruleId)
  const severity = fixApplied ? 'auto-fix' : mapSeverity(v)

  let evidence = ''
  if (type === 'color_token') {
    evidence = `${v.currentValue} found, not in approved palette`
  } else if (type === 'spacing') {
    evidence = `${v.currentValue} not on approved spacing scale`
  } else if (type === 'typography') {
    evidence = `"${v.currentValue}" not in allowed typography styles`
  } else if (type === 'component') {
    evidence = `Variant "${v.currentValue}" not in allowed variants`
  } else if (type === 'layout') {
    evidence = `${v.currentValue} not in approved grid column set`
  } else if (type === 'accessibility') {
    evidence = `${v.currentValue} fails WCAG AA contrast minimum`
  } else {
    evidence = v.message
  }

  let fixDescription = ''
  if (fixApplied) {
    fixDescription = `Auto-fixed: ${v.currentValue} → ${v.suggestedValue || 'approved value'}`
  } else if (v.autoFixAvailable) {
    fixDescription = `Will snap to ${v.suggestedValue || 'nearest approved value'}`
  } else {
    fixDescription = 'Requires manual review'
  }

  return {
    id: `${v.ruleId}-${v.nodeId}-${v.property}`,
    type,
    severity: fixApplied ? 'auto-fix' : severity,
    ruleName: humanRuleName(v.ruleId),
    ruleSource: ruleSourceForType(type, v.ruleId),
    nodeId: v.nodeId,
    nodeName: nodeNameFromPath(v.nodePath),
    nodePath: v.nodePath,
    evidence,
    fixApplied,
    fixDescription,
    suggestedFix: v.suggestedValue != null ? String(v.suggestedValue) : '',
  }
}

// ─── Build governance report ────────────────────────────────
export function buildGovernanceReport(
  fixtureName: string,
  fixtureSource: string,
  artifact: InterfaceDefinition,
  scanResult: ScanResult,
  rewriteResult: RewriteResult | null,
  config: MuteformConfig,
): GovernanceReport {
  const fixedNodeIds = new Set(rewriteResult?.appliedFixes.map(f => `${f.ruleId}-${f.nodeId}-${f.property}`) || [])

  // Enrich engine violations
  const enriched: EnrichedViolation[] = scanResult.violations.map(v => {
    const key = `${v.ruleId}-${v.nodeId}-${v.property}`
    return enrichViolation(v, fixedNodeIds.has(key))
  })

  // Add WCAG contrast checks for off-palette colors
  const wcagViolations = generateWcagViolations(artifact, config)
  // Deduplicate: don't add WCAG violations for nodes already flagged for contrast
  const existingContrastNodes = new Set(enriched.filter(e => e.type === 'accessibility').map(e => e.nodeId))
  for (const wv of wcagViolations) {
    if (!existingContrastNodes.has(wv.nodeId)) {
      enriched.push(wv)
    }
  }

  // Add visual hierarchy checks
  const hierarchyViolations = generateHierarchyViolations(artifact)
  const existingHierarchyNodes = new Set(enriched.filter(e => e.ruleName.includes('Primary')).map(e => e.nodeId))
  for (const hv of hierarchyViolations) {
    if (!existingHierarchyNodes.has(hv.nodeId)) {
      enriched.push(hv)
    }
  }

  // Category scores
  const categoryDeductions: Record<string, number> = {}
  const sevWeights: Record<GovernanceSeverity, number> = { 'block': 15, 'warn': 5, 'auto-fix': 3 }
  for (const v of enriched) {
    const cat = v.type === 'color_token' ? 'token' :
                v.type === 'accessibility' ? 'accessibility' : v.type
    const w = v.fixApplied ? 0 : (sevWeights[v.severity] || 3)
    categoryDeductions[cat] = (categoryDeductions[cat] || 0) + w
  }

  const catDefs = [
    { name: 'Token Compliance', key: 'token', color: '#ff4070' },
    { name: 'Layout', key: 'layout', color: '#ffb830' },
    { name: 'Typography', key: 'typography', color: '#a855f7' },
    { name: 'Components', key: 'component', color: '#4090ff' },
    { name: 'Accessibility', key: 'accessibility', color: '#00e087' },
  ]

  const categories: CategoryScore[] = catDefs.map(c => ({
    ...c,
    score: Math.max(0, 100 - (categoryDeductions[c.key] || 0)),
  }))

  const autoFixed = enriched.filter(v => v.fixApplied)
  const warnings = enriched.filter(v => !v.fixApplied && v.severity === 'warn')
  const blocked = enriched.filter(v => !v.fixApplied && v.severity === 'block')
  const unfixedAutoFix = enriched.filter(v => !v.fixApplied && v.severity === 'auto-fix')

  // Overall score
  const unfixedDeduction = [...warnings, ...blocked, ...unfixedAutoFix].reduce((s, v) => {
    return s + (sevWeights[v.severity] || 3)
  }, 0)
  const overallBefore = Math.max(0, 100 - enriched.reduce((s, v) => s + (sevWeights[v.severity] || 3), 0))
  const overallAfter = rewriteResult ? Math.max(0, 100 - unfixedDeduction) : overallBefore

  return {
    fixtureName,
    fixtureSource,
    timestamp: new Date().toISOString(),
    overallScore: overallBefore,
    afterScore: overallAfter,
    categories,
    violations: enriched,
    autoFixedCount: autoFixed.length,
    warningCount: warnings.length,
    blockedCount: blocked.length,
  }
}

// ─── Export report as JSON ──────────────────────────────────
export function reportToJSON(report: GovernanceReport): string {
  return JSON.stringify({
    governance_report: {
      fixture: report.fixtureName,
      source: report.fixtureSource,
      timestamp: report.timestamp,
      score: { before: report.overallScore, after: report.afterScore },
      categories: report.categories.map(c => ({ name: c.name, score: c.score })),
      summary: {
        auto_fixed: report.autoFixedCount,
        warnings: report.warningCount,
        blocked: report.blockedCount,
      },
      violations: report.violations.map(v => ({
        id: v.id,
        type: v.type,
        severity: v.severity,
        rule: v.ruleName,
        source: v.ruleSource,
        node: v.nodePath,
        evidence: v.evidence,
        fix_applied: v.fixApplied,
        fix: v.fixDescription,
        suggested: v.suggestedFix,
      })),
    },
  }, null, 2)
}
