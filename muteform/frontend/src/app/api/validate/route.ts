import { NextResponse } from 'next/server'
import { loadConfig, scanArtifact, rewriteArtifact } from '@/lib/engine'

// Default policy YAML used for validation
const DEFAULT_YAML = `name: "Muteform Governance"
version: "1.0.0"
tokens:
  colors:
    primary: "#0055FF"
    neutral900: "#111111"
    success: "#22c55e"
    warning: "#f59e0b"
    accent: "#9ca3af"
  spacing:
    scale: [4, 8, 12, 16, 24, 32, 48, 64]
  typography:
    families:
      display: "Instrument Serif"
      body: "DM Sans"
      mono: "JetBrains Mono"
    allowed_styles: [h1, h2, h3, body, body-sm, caption, label]
  components:
    button:
      allowed_variants: [primary, secondary]
      allowed_sizes: [sm, md, lg]
  layout:
    grid_columns: [4, 8, 12]
rules:
  - id: "color-token-compliance"
    severity: high
    description: "All colors must reference approved design tokens"
    check: "color.value IN tokens.colors.*"
    auto_fix: "snap_nearest_delta_e"
  - id: "spacing-scale-compliance"
    severity: medium
    description: "Spacing values must use the approved scale"
    check: "spacing.value IN tokens.spacing.scale"
    auto_fix: "snap_nearest"
  - id: "contrast-wcag-aa"
    severity: critical
    description: "All text must meet WCAG AA contrast requirements"
    check: "contrast.ratio >= 4.5"
    auto_fix: "adjust_foreground"
  - id: "typography-style-compliance"
    severity: high
    description: "Typography styles must be from approved list"
    check: "typography.style IN tokens.typography.allowed_styles"
    auto_fix: "snap_nearest_category"
  - id: "component-variant-compliance"
    severity: critical
    description: "Component variants must be from approved list"
    check: "component.variant IN tokens.components.*.allowed_variants"
    auto_fix: "snap_nearest_category"
  - id: "layout-grid-compliance"
    severity: medium
    description: "Grid columns must use approved column counts"
    check: "layout.columns IN tokens.layout.grid_columns"
    auto_fix: false`

/**
 * Normalize incoming nodes from simplified API format to engine InterfaceNode format.
 * Accepts: { id, type, name, styles: { color, spacing, ... }, component: { name, variant } }
 * Produces: { id, type, path, properties: { colors, spacing, component, ... } }
 */
function normalizeNodes(nodes: any[]): any[] {
  const VALID_TYPES = new Set(['element', 'text', 'image', 'container', 'interactive'])
  return nodes.map((n, i) => {
    // If already in engine format (has properties object), pass through
    if (n.properties && typeof n.properties === 'object') return n

    const type = VALID_TYPES.has(n.type) ? n.type : 'interactive'
    const path = n.path || `root/${n.type || 'node'}[${i}]`
    const properties: Record<string, any> = {}

    // Map styles.color → properties.colors.color
    if (n.styles) {
      if (n.styles.color) {
        properties.colors = { color: n.styles.color }
      }
      if (n.styles.backgroundColor || n.styles.background) {
        properties.colors = {
          ...properties.colors,
          background: n.styles.backgroundColor || n.styles.background,
        }
      }
      if (typeof n.styles.spacing === 'number') {
        properties.spacing = { padding: n.styles.spacing }
      }
      if (n.styles.fontSize || n.styles.fontFamily) {
        properties.typography = {
          size: n.styles.fontSize,
          family: n.styles.fontFamily,
        }
      }
    }

    // Map component directly
    if (n.component) {
      properties.component = n.component
    }

    // Map contrast if present
    if (n.contrast) {
      properties.contrast = n.contrast
    }

    return {
      id: n.id || `node_${i}`,
      type,
      path,
      properties,
      children: n.children,
    }
  })
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-muteform-token') || ''
    if (!token.startsWith('mf_beta_')) {
      return NextResponse.json(
        { error: 'Invalid or missing x-muteform-token header' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const raw = body.artifact || body.code || body

    // Validate artifact shape
    if (!raw.nodes || !Array.isArray(raw.nodes)) {
      return NextResponse.json(
        { error: 'Invalid artifact: must contain a "nodes" array. Send { "nodes": [...] } or { "artifact": { "nodes": [...] } }' },
        { status: 400 }
      )
    }

    // Normalize nodes from simplified API format to engine format
    const artifact = {
      nodes: normalizeNodes(raw.nodes),
      metadata: raw.metadata || {
        source: 'api',
        platform: 'external',
        generatedAt: new Date().toISOString(),
      },
    }

    const config = loadConfig(DEFAULT_YAML)
    const scanResult = scanArtifact(artifact, config)
    const rewriteResult = rewriteArtifact(artifact, scanResult.violations, config)

    const patches = rewriteResult.appliedFixes.map(f => ({
      node_id: f.nodeId,
      property: f.property,
      current: f.currentValue,
      replace_with: f.suggestedValue,
      rule: f.ruleId,
      confidence: 'high',
    }))

    const scanId = crypto.randomUUID()

    return NextResponse.json({
      scan_id: scanId,
      health_score: rewriteResult.afterScore,
      compliant: scanResult.violations.length === 0,
      violations: scanResult.violations.map(v => ({
        rule_id: v.ruleId,
        severity: v.severity,
        node_id: v.nodeId,
        node_path: v.nodePath,
        property: v.property,
        current_value: v.currentValue,
        suggested_value: v.suggestedValue,
        message: v.message,
        auto_fix_available: v.autoFixAvailable,
      })),
      patches,
      summary: {
        nodes_scanned: scanResult.nodesScanned,
        rules_evaluated: scanResult.rulesEvaluated,
        scan_duration_ms: scanResult.scanDurationMs,
        violations_total: scanResult.violations.length,
        auto_fixed: rewriteResult.appliedFixes.length,
        score_before: scanResult.score,
        score_after: rewriteResult.afterScore,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    version: '1.0.0',
    docs: 'POST an artifact JSON to this endpoint with x-muteform-token header',
  })
}
