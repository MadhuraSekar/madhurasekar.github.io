import { randomBytes } from 'crypto'

// ─── Types ───────────────────────────────────────────────────────

export interface ArtifactNode {
  id: string
  type?: string
  name?: string
  parentName?: string
  path?: string
  styles?: {
    color?: string
    spacing?: number
    typographyStyle?: string
  }
  component?: {
    name: string
    variant?: string
    size?: string
  }
  layout?: {
    gridColumns?: number
  }
  children?: ArtifactNode[]
}

export interface Artifact {
  id: string
  name?: string
  source?: string
  nodes: ArtifactNode[]
}

export interface RulesetTokens {
  color?: Record<string, string>
  spacing?: number[]
}

export interface Ruleset {
  id: string
  name: string
  tokens: RulesetTokens
  typography?: { allowedStyles?: string[] }
  components?: Record<string, { allowedVariants?: string[]; allowedSizes?: string[] }>
  layout?: { allowedGridColumns?: number[] }
  custom_rules?: any[]
}

export interface SuggestedFix {
  property: string
  currentValue: any
  suggestedValue: any
  rationale: string
}

export interface Violation {
  id: string
  type: 'color_token_violation' | 'spacing_violation' | 'typography_violation' | 'component_violation' | 'layout_violation'
  severity: 'high' | 'medium' | 'low'
  node_id: string
  node_name: string
  node_path: string
  message: string
  confidence: 'high' | 'medium' | 'manual'
  preview_type: 'color' | 'spacing' | 'typography' | 'component' | 'layout'
  current_preview: any
  suggested_preview: any
  suggested_fix: SuggestedFix | null
}

export interface ScanResult {
  violations: Violation[]
  health_score: number
  violation_count: number
  high_count: number
  medium_count: number
  low_count: number
}

// ─── Helpers ─────────────────────────────────────────────────────

function rid(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`
}

function flatten(nodes: ArtifactNode[]): ArtifactNode[] {
  const out: ArtifactNode[] = []
  for (const n of nodes) {
    out.push(n)
    if (n.children && n.children.length) {
      out.push(...flatten(n.children))
    }
  }
  return out
}

function buildNodePath(node: ArtifactNode, artifact: Artifact): string {
  if (node.path) return node.path
  return `${artifact.name || artifact.id} / ${node.parentName || 'Frame'} / ${node.name || node.id}`
}

function tokenNameFor(value: string, colorMap: Record<string, string>): string | null {
  for (const [name, hex] of Object.entries(colorMap)) {
    if (hex === value) return name
  }
  return null
}

// ─── Scanner ─────────────────────────────────────────────────────

function scanNode(node: ArtifactNode, ruleset: Ruleset, artifact: Artifact): Violation[] {
  const violations: Violation[] = []
  const colorMap = ruleset.tokens?.color || {}
  const colors = Object.values(colorMap)
  const spacing = ruleset.tokens?.spacing || []
  const typo = ruleset.typography?.allowedStyles || []
  const nodePath = buildNodePath(node, artifact)

  // Color check
  if (node.styles?.color && colors.length && !colors.includes(node.styles.color)) {
    const suggested = colors[0]
    const suggestedName = tokenNameFor(suggested, colorMap)
    violations.push({
      id: rid('v'),
      type: 'color_token_violation',
      severity: 'high',
      node_id: node.id,
      node_name: node.name || node.id,
      node_path: nodePath,
      message: `Color ${node.styles.color} is not part of the approved token palette.`,
      confidence: 'medium',
      preview_type: 'color',
      current_preview: { hex: node.styles.color, label: node.styles.color },
      suggested_preview: { hex: suggested, label: `${suggestedName ? suggestedName + ' ' : ''}${suggested}` },
      suggested_fix: {
        property: 'color',
        currentValue: node.styles.color,
        suggestedValue: suggested,
        rationale: 'Replace with the nearest approved color token.',
      },
    })
  }

  // Spacing check
  if (typeof node.styles?.spacing === 'number' && spacing.length && !spacing.includes(node.styles.spacing)) {
    const near = spacing.reduce((a, b) =>
      Math.abs(b - node.styles!.spacing!) < Math.abs(a - node.styles!.spacing!) ? b : a
    )
    violations.push({
      id: rid('v'),
      type: 'spacing_violation',
      severity: 'medium',
      node_id: node.id,
      node_name: node.name || node.id,
      node_path: nodePath,
      message: `Spacing ${node.styles.spacing}px is not in the approved spacing scale. Closest token is ${near}px.`,
      confidence: Math.abs(near - node.styles.spacing) === 0 ? 'high' : 'medium',
      preview_type: 'spacing',
      current_preview: { size: node.styles.spacing, label: `${node.styles.spacing}px` },
      suggested_preview: { size: near, label: `${near}px (token)` },
      suggested_fix: {
        property: 'spacing',
        currentValue: node.styles.spacing,
        suggestedValue: near,
        rationale: 'Replace with the nearest approved spacing token.',
      },
    })
  }

  // Typography check
  if (node.styles?.typographyStyle && typo.length && !typo.includes(node.styles.typographyStyle)) {
    const suggested = typo[0]
    violations.push({
      id: rid('v'),
      type: 'typography_violation',
      severity: 'medium',
      node_id: node.id,
      node_name: node.name || node.id,
      node_path: nodePath,
      message: `Typography style "${node.styles.typographyStyle}" is not in the approved type scale.`,
      confidence: 'medium',
      preview_type: 'typography',
      current_preview: { style: node.styles.typographyStyle, label: node.styles.typographyStyle },
      suggested_preview: { style: suggested, label: `${suggested} (approved)` },
      suggested_fix: {
        property: 'typographyStyle',
        currentValue: node.styles.typographyStyle,
        suggestedValue: suggested,
        rationale: 'Replace with an approved typography style.',
      },
    })
  }

  // Component check
  if (node.component?.name && ruleset.components) {
    const rule = ruleset.components[node.component.name]
    if (!rule) {
      violations.push({
        id: rid('v'),
        type: 'component_violation',
        severity: 'high',
        node_id: node.id,
        node_name: node.name || node.id,
        node_path: nodePath,
        message: `Component "${node.component.name}" is not in the approved component library.`,
        confidence: 'manual',
        preview_type: 'component',
        current_preview: { name: node.component.name, variant: node.component.variant || '—', label: node.component.name },
        suggested_preview: null,
        suggested_fix: null,
      })
    } else if (node.component.variant && rule.allowedVariants && !rule.allowedVariants.includes(node.component.variant)) {
      const suggested = rule.allowedVariants[0]
      violations.push({
        id: rid('v'),
        type: 'component_violation',
        severity: 'medium',
        node_id: node.id,
        node_name: node.name || node.id,
        node_path: nodePath,
        message: `Variant "${node.component.variant}" is not approved for ${node.component.name}. Use "${suggested}".`,
        confidence: 'high',
        preview_type: 'component',
        current_preview: { name: node.component.name, variant: node.component.variant, label: `${node.component.name} / ${node.component.variant}` },
        suggested_preview: { name: node.component.name, variant: suggested, label: `${node.component.name} / ${suggested}` },
        suggested_fix: {
          property: 'component.variant',
          currentValue: node.component.variant,
          suggestedValue: suggested,
          rationale: 'Replace with an approved component variant.',
        },
      })
    }
  }

  // Layout check
  if (
    typeof node.layout?.gridColumns === 'number' &&
    ruleset.layout?.allowedGridColumns &&
    !ruleset.layout.allowedGridColumns.includes(node.layout.gridColumns)
  ) {
    const suggested = ruleset.layout.allowedGridColumns[0]
    violations.push({
      id: rid('v'),
      type: 'layout_violation',
      severity: 'low',
      node_id: node.id,
      node_name: node.name || node.id,
      node_path: nodePath,
      message: `Grid with ${node.layout.gridColumns} columns is not in the approved layout system. Use ${ruleset.layout.allowedGridColumns.join(', ')}.`,
      confidence: 'high',
      preview_type: 'layout',
      current_preview: { columns: node.layout.gridColumns, label: `${node.layout.gridColumns} col` },
      suggested_preview: { columns: suggested, label: `${suggested} col (approved)` },
      suggested_fix: {
        property: 'layout.gridColumns',
        currentValue: node.layout.gridColumns,
        suggestedValue: suggested,
        rationale: 'Replace with an approved grid column count.',
      },
    })
  }

  return violations
}

export function scanArtifact(artifact: Artifact, ruleset: Ruleset): ScanResult {
  const allNodes = flatten(artifact.nodes)
  const violations = allNodes.flatMap(n => scanNode(n, ruleset, artifact))

  const high = violations.filter(v => v.severity === 'high').length
  const medium = violations.filter(v => v.severity === 'medium').length
  const low = violations.filter(v => v.severity === 'low').length

  return {
    violations,
    health_score: healthScore(violations),
    violation_count: violations.length,
    high_count: high,
    medium_count: medium,
    low_count: low,
  }
}

export function healthScore(violations: Array<{ severity: string; status?: string }>): number {
  const active = violations.filter(v => v.status !== 'ignored')
  if (!active.length) return 100
  const penalty = active.reduce((a, v) => a + (v.severity === 'high' ? 12 : v.severity === 'medium' ? 5 : 2), 0)
  return Math.max(0, 100 - penalty)
}
