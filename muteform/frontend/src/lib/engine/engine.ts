// ─── Muteform Validation Engine ──────────────────────────────
import type {
  MuteformConfig,
  InterfaceDefinition,
  InterfaceNode,
  ValidationResult,
  Violation,
  TokenDefinitions,
} from './types'
import { contrastRatio, deltaE2000, findNearestColor, adjustForegroundForContrast } from './color'
import yaml from 'js-yaml'

/** Flatten nested color tokens into a flat Record<string, string> */
export function flattenColors(obj: any, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  if (!obj || typeof obj !== 'object') return out
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof val === 'string' && val.startsWith('#')) {
      out[path] = val
    } else if (typeof val === 'object' && val !== null) {
      Object.assign(out, flattenColors(val, path))
    }
  }
  return out
}

/** Parse a YAML string into MuteformConfig */
export function loadConfig(yamlString: string): MuteformConfig {
  try {
    return JSON.parse(yamlString) as MuteformConfig
  } catch {
    const raw = yaml.load(yamlString) as any
    return normalizeConfig(raw)
  }
}

/** Normalize raw YAML object into MuteformConfig */
function normalizeConfig(raw: any): MuteformConfig {
  const config: MuteformConfig = {
    name: raw.name || '',
    version: raw.version || '',
    tokens: {},
    rules: [],
  }

  if (raw.tokens) {
    const t = raw.tokens
    if (t.colors) config.tokens.colors = t.colors
    if (t.spacing) {
      config.tokens.spacing = {
        scale: Array.isArray(t.spacing.scale) ? t.spacing.scale : [],
        tolerance: t.spacing.tolerance ?? 0,
      }
    }
    if (t.typography) {
      config.tokens.typography = {
        families: t.typography.families || {},
        scale_ratio: t.typography.scale_ratio,
        min_body_size: t.typography.min_body_size,
        allowed_styles: Array.isArray(t.typography.allowed_styles)
          ? t.typography.allowed_styles.map(String)
          : undefined,
      }
    }
    if (t.motion) {
      config.tokens.motion = {
        max_duration: t.motion.max_duration,
        easing_allowed: t.motion.easing_allowed,
      }
    }
    if (t.layout) {
      config.tokens.layout = {
        grid_columns: Array.isArray(t.layout.grid_columns) ? t.layout.grid_columns : [],
      }
    }
    if (t.components) {
      config.tokens.components = {}
      for (const [name, def] of Object.entries(t.components as Record<string, any>)) {
        config.tokens.components[name] = {
          allowed_variants: Array.isArray(def.allowed_variants)
            ? def.allowed_variants.map(String)
            : undefined,
          allowed_sizes: Array.isArray(def.allowed_sizes)
            ? def.allowed_sizes.map(String)
            : undefined,
        }
      }
    }
  }

  if (Array.isArray(raw.rules)) {
    config.rules = raw.rules.map((r: any) => ({
      id: String(r.id || ''),
      severity: r.severity || 'medium',
      description: r.description || '',
      check: r.check || '',
      auto_fix: r.auto_fix === false || r.auto_fix === 'false' ? false : String(r.auto_fix || ''),
    }))
  }

  return config
}

/** Run all rules against all nodes */
export function validate(
  interfaceDef: InterfaceDefinition,
  config: MuteformConfig
): ValidationResult {
  const start = performance.now()
  const violations: Violation[] = []
  const colorPalette = flattenColors(config.tokens.colors)

  for (const node of interfaceDef.nodes) {
    for (const rule of config.rules) {
      const vList = evaluateRule(rule, node, config, colorPalette)
      for (const v of vList) violations.push(v)
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    nodesScanned: interfaceDef.nodes.length,
    rulesEvaluated: config.rules.length,
    scanDurationMs: Math.round((performance.now() - start) * 10) / 10,
  }
}

function evaluateRule(
  rule: any,
  node: InterfaceNode,
  config: MuteformConfig,
  colorPalette: Record<string, string>
): Violation[] {
  const check: string = rule.check || ''
  const results: Violation[] = []

  // Color token compliance
  if (rule.id.includes('color') && (check.includes('color') || check.includes('token'))) {
    if (node.properties.colors) {
      const allColors = Object.values(colorPalette).map(c => c.toLowerCase())
      for (const [prop, val] of Object.entries(node.properties.colors)) {
        if (!val.startsWith('#')) continue
        if (!allColors.includes(val.toLowerCase())) {
          const nearest = findNearestColor(val, colorPalette)
          results.push({
            ruleId: rule.id,
            severity: rule.severity,
            nodeId: node.id,
            nodePath: node.path,
            property: `colors.${prop}`,
            currentValue: val,
            suggestedValue: nearest.hex,
            message: `Color ${val} not in approved palette (nearest: ${nearest.name} ${nearest.hex}, ΔE=${nearest.distance.toFixed(1)})`,
            autoFixAvailable: !!rule.auto_fix,
            detail: rule.description,
          })
        }
      }
    }
  }

  // Spacing scale compliance
  if (rule.id.includes('spacing') && (check.includes('spacing') || check.includes('scale'))) {
    const scale = config.tokens.spacing?.scale || []
    if (scale.length && node.properties.spacing) {
      for (const [prop, val] of Object.entries(node.properties.spacing)) {
        if (!scale.includes(val)) {
          const nearest = scale.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a)
          results.push({
            ruleId: rule.id,
            severity: rule.severity,
            nodeId: node.id,
            nodePath: node.path,
            property: `spacing.${prop}`,
            currentValue: `${val}px`,
            suggestedValue: `${nearest}px`,
            message: `Spacing ${val}px not on approved scale [${scale.join(',')}] (nearest: ${nearest}px)`,
            autoFixAvailable: !!rule.auto_fix,
            detail: rule.description,
          })
        }
      }
    }
  }

  // WCAG contrast
  if (rule.id.includes('contrast') && (check.includes('contrast') || check.includes('wcag'))) {
    if (node.properties.contrast) {
      const { foreground, background } = node.properties.contrast
      const ratio = contrastRatio(foreground, background)
      const isLargeText = (node.properties.typography?.size || 16) >= 18 ||
        ((node.properties.typography?.size || 16) >= 14 && (node.properties.typography?.weight || 400) >= 700)
      const targetRatio = isLargeText ? 3.0 : 4.5
      if (ratio < targetRatio) {
        const adjusted = adjustForegroundForContrast(foreground, background, targetRatio)
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          nodeId: node.id,
          nodePath: node.path,
          property: 'contrast.ratio',
          currentValue: `${ratio.toFixed(1)}:1`,
          suggestedValue: adjusted,
          message: `Contrast ratio ${ratio.toFixed(1)}:1 fails WCAG AA (min ${targetRatio}:1${isLargeText ? ' for large text' : ''})`,
          autoFixAvailable: !!rule.auto_fix,
          detail: rule.description,
        })
      }
    }
  }

  // Motion duration
  if (rule.id.includes('motion') && (check.includes('motion') || check.includes('duration'))) {
    const maxDuration = config.tokens.motion?.max_duration || 300
    if (node.properties.motion?.duration && node.properties.motion.duration > maxDuration) {
      results.push({
        ruleId: rule.id,
        severity: rule.severity,
        nodeId: node.id,
        nodePath: node.path,
        property: 'motion.duration',
        currentValue: `${node.properties.motion.duration}ms`,
        suggestedValue: `${maxDuration}ms`,
        message: `Transition ${node.properties.motion.duration}ms exceeds ${maxDuration}ms max`,
        autoFixAvailable: !!rule.auto_fix,
        detail: rule.description,
      })
    }
  }

  // Typography family
  if (rule.id.includes('typography') && (check.includes('family') || check.includes('font'))) {
    const families = config.tokens.typography?.families
    if (families && node.properties.typography?.family) {
      const allowed = Object.values(families).map(f => f.toLowerCase())
      if (!allowed.includes(node.properties.typography.family.toLowerCase())) {
        const categories = Object.keys(families)
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          nodeId: node.id,
          nodePath: node.path,
          property: 'typography.family',
          currentValue: node.properties.typography.family,
          suggestedValue: families[categories[0]],
          message: `Font "${node.properties.typography.family}" not in approved families [${Object.values(families).join(', ')}]`,
          autoFixAvailable: !!rule.auto_fix,
          detail: rule.description,
        })
      }
    }
  }

  // Typography style compliance
  if (rule.id.includes('typography-style') && (check.includes('style') || check.includes('typography'))) {
    const allowedStyles = config.tokens.typography?.allowed_styles
    if (allowedStyles && node.properties.typography?.style) {
      if (!allowedStyles.includes(node.properties.typography.style)) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          nodeId: node.id,
          nodePath: node.path,
          property: 'typography.style',
          currentValue: node.properties.typography.style,
          suggestedValue: 'body',
          message: `Typography style "${node.properties.typography.style}" not in allowed styles [${allowedStyles.join(', ')}]`,
          autoFixAvailable: !!rule.auto_fix,
          detail: rule.description,
        })
      }
    }
  }

  // Component variant compliance
  if (rule.id.includes('component') && (check.includes('variant') || check.includes('component'))) {
    if (node.properties.component) {
      const compName = node.properties.component.name
      const variant = node.properties.component.variant
      const compDef = config.tokens.components?.[compName]
      if (compDef?.allowed_variants && !compDef.allowed_variants.includes(variant)) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          nodeId: node.id,
          nodePath: node.path,
          property: 'component.variant',
          currentValue: variant,
          suggestedValue: compDef.allowed_variants[0],
          message: `${compName} variant "${variant}" not allowed. Approved: [${compDef.allowed_variants.join(', ')}]`,
          autoFixAvailable: !!rule.auto_fix,
          detail: rule.description,
        })
      }
    }
  }

  // Layout grid columns
  if (rule.id.includes('layout') && (check.includes('grid') || check.includes('column') || check.includes('layout'))) {
    const allowedCols = config.tokens.layout?.grid_columns || []
    if (allowedCols.length && node.properties.layout?.columns) {
      if (!allowedCols.includes(node.properties.layout.columns)) {
        const nearest = allowedCols.reduce((a, b) =>
          Math.abs(b - node.properties.layout!.columns!) < Math.abs(a - node.properties.layout!.columns!) ? b : a
        )
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          nodeId: node.id,
          nodePath: node.path,
          property: 'layout.columns',
          currentValue: `${node.properties.layout.columns} columns`,
          suggestedValue: `${nearest} columns`,
          message: `${node.properties.layout.columns}-column grid not in approved set [${allowedCols.join(',')}]`,
          autoFixAvailable: false, // requires human review
          detail: rule.description,
        })
      }
    }
  }

  return results
}
