// ─── Muteform Validation Engine ──────────────────────────────
import type {
  MuteformConfig,
  InterfaceDefinition,
  InterfaceNode,
  ValidationResult,
  Violation,
  TokenDefinitions,
} from './types'
import { contrastRatio, deltaE2000, findNearestColor } from './color'

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

/** Parse a YAML string into MuteformConfig (uses js-yaml if available, else simple parser) */
export function loadConfig(yamlString: string): MuteformConfig {
  // Simple YAML-like parser for browser use without js-yaml dependency
  // Handles the structured format we need
  try {
    // Try JSON first (for testing convenience)
    return JSON.parse(yamlString) as MuteformConfig
  } catch {
    // Basic YAML parsing — for production, integrate js-yaml
    return parseSimpleYaml(yamlString)
  }
}

function parseSimpleYaml(yaml: string): MuteformConfig {
  const lines = yaml.split('\n')
  const config: any = { name: '', version: '', tokens: {}, rules: [] }
  let currentSection = ''
  let currentSubSection = ''
  let currentRule: any = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.search(/\S/)

    if (indent === 0 && trimmed.includes(':')) {
      const [key, ...rest] = trimmed.split(':')
      const val = rest.join(':').trim().replace(/^["']|["']$/g, '')
      if (key === 'name') config.name = val
      else if (key === 'version') config.version = val
      else if (key === 'tokens') currentSection = 'tokens'
      else if (key === 'rules') currentSection = 'rules'
    } else if (currentSection === 'tokens' && indent >= 2) {
      // Simplified token parsing
      const [key, ...rest] = trimmed.split(':')
      const k = key.trim()
      const val = rest.join(':').trim().replace(/^["']|["']$/g, '')
      if (indent === 2) {
        currentSubSection = k
        if (!config.tokens[currentSubSection]) config.tokens[currentSubSection] = {}
      } else if (val) {
        if (k === 'scale' && val.startsWith('[')) {
          config.tokens[currentSubSection].scale = JSON.parse(val)
        } else if (k === 'tolerance') {
          config.tokens[currentSubSection].tolerance = parseInt(val)
        } else if (k === 'max_duration') {
          config.tokens[currentSubSection] = config.tokens[currentSubSection] || {}
          config.tokens[currentSubSection].max_duration = parseInt(val)
        } else if (k === 'easing_allowed' && val.startsWith('[')) {
          config.tokens[currentSubSection] = config.tokens[currentSubSection] || {}
          config.tokens[currentSubSection].easing_allowed = JSON.parse(val)
        } else if (k === 'grid_columns' && val.startsWith('[')) {
          config.tokens[currentSubSection] = config.tokens[currentSubSection] || {}
          config.tokens[currentSubSection].grid_columns = JSON.parse(val)
        } else if (k === 'scale_ratio') {
          config.tokens[currentSubSection] = config.tokens[currentSubSection] || {}
          config.tokens[currentSubSection].scale_ratio = parseFloat(val)
        } else if (k === 'min_body_size') {
          config.tokens[currentSubSection] = config.tokens[currentSubSection] || {}
          config.tokens[currentSubSection].min_body_size = parseInt(val)
        } else {
          // Nested color or font value
          if (typeof config.tokens[currentSubSection] !== 'object') config.tokens[currentSubSection] = {}
          config.tokens[currentSubSection][k] = val.startsWith('#') ? val : val
        }
      }
    } else if (currentSection === 'rules') {
      if (trimmed.startsWith('- id:')) {
        if (currentRule) config.rules.push(currentRule)
        currentRule = { id: trimmed.replace('- id:', '').trim().replace(/^["']|["']$/g, '') }
      } else if (currentRule && trimmed.includes(':')) {
        const [key, ...rest] = trimmed.split(':')
        const k = key.trim()
        const val = rest.join(':').trim().replace(/^["']|["']$/g, '')
        if (k === 'severity') currentRule.severity = val
        else if (k === 'description') currentRule.description = val
        else if (k === 'check') currentRule.check = val
        else if (k === 'auto_fix') currentRule.auto_fix = val === 'false' ? false : val
      }
    }
  }
  if (currentRule) config.rules.push(currentRule)

  return config as MuteformConfig
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
      const v = evaluateRule(rule, node, config, colorPalette)
      if (v) violations.push(v)
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
): Violation | null {
  const check: string = rule.check || ''

  // Color token compliance
  if (rule.id.includes('color') && check.includes('color')) {
    if (node.properties.colors) {
      for (const [prop, val] of Object.entries(node.properties.colors)) {
        const allColors = Object.values(colorPalette).map(c => c.toLowerCase())
        if (!allColors.includes(val.toLowerCase())) {
          const nearest = findNearestColor(val, colorPalette)
          return {
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
          }
        }
      }
    }
  }

  // Spacing scale compliance
  if (rule.id.includes('spacing') && check.includes('spacing')) {
    const scale = config.tokens.spacing?.scale || []
    if (scale.length && node.properties.spacing) {
      for (const [prop, val] of Object.entries(node.properties.spacing)) {
        if (!scale.includes(val)) {
          const nearest = scale.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a)
          return {
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
          }
        }
      }
    }
  }

  // WCAG contrast
  if (rule.id.includes('contrast') && check.includes('contrast')) {
    if (node.properties.contrast) {
      const { foreground, background } = node.properties.contrast
      const ratio = contrastRatio(foreground, background)
      const targetRatio = 4.5
      if (ratio < targetRatio) {
        return {
          ruleId: rule.id,
          severity: rule.severity,
          nodeId: node.id,
          nodePath: node.path,
          property: 'contrast.ratio',
          currentValue: `${ratio.toFixed(1)}:1`,
          suggestedValue: `≥${targetRatio}:1`,
          message: `Contrast ratio ${ratio.toFixed(1)}:1 fails WCAG AA (min ${targetRatio}:1)`,
          autoFixAvailable: !!rule.auto_fix,
          detail: rule.description,
        }
      }
    }
  }

  // Motion duration
  if (rule.id.includes('motion') && check.includes('motion')) {
    const maxDuration = config.tokens.motion?.max_duration || 300
    if (node.properties.motion?.duration && node.properties.motion.duration > maxDuration) {
      return {
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
      }
    }
  }

  // Typography family
  if (rule.id.includes('typography-family') || (rule.id.includes('typography') && check.includes('family'))) {
    const families = config.tokens.typography?.families
    if (families && node.properties.typography?.family) {
      const allowed = Object.values(families).map(f => f.toLowerCase())
      if (!allowed.includes(node.properties.typography.family.toLowerCase())) {
        const categories = Object.keys(families)
        return {
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
        }
      }
    }
  }

  // Typography scale ratio
  if (rule.id.includes('typography-scale') || (rule.id.includes('typography') && check.includes('ratio'))) {
    const minRatio = config.tokens.typography?.scale_ratio || 1.25
    // This would check adjacent heading sizes — simplified for now
  }

  // Layout grid columns
  if (rule.id.includes('layout') || check.includes('grid')) {
    const allowedCols = config.tokens.layout?.grid_columns || []
    if (allowedCols.length && node.properties.layout?.columns) {
      if (!allowedCols.includes(node.properties.layout.columns)) {
        const nearest = allowedCols.reduce((a, b) =>
          Math.abs(b - node.properties.layout!.columns!) < Math.abs(a - node.properties.layout!.columns!) ? b : a
        )
        return {
          ruleId: rule.id,
          severity: rule.severity,
          nodeId: node.id,
          nodePath: node.path,
          property: 'layout.columns',
          currentValue: `${node.properties.layout.columns} columns`,
          suggestedValue: `${nearest} columns`,
          message: `${node.properties.layout.columns}-column grid not in approved set [${allowedCols.join(',')}]`,
          autoFixAvailable: !!rule.auto_fix,
          detail: rule.description,
        }
      }
    }
  }

  return null
}
