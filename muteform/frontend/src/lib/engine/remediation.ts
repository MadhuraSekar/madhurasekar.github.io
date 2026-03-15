// ─── Muteform Auto-Fix Engine ────────────────────────────────
import type { MuteformConfig, Violation, RemediationResult } from './types'
import { findNearestColor, adjustForegroundForContrast, hexToRgb, rgbToHex } from './color'
import { flattenColors } from './engine'

export function remediate(
  violations: Violation[],
  config: MuteformConfig
): RemediationResult {
  const applied: Violation[] = []
  const skipped: Violation[] = []
  const colorPalette = flattenColors(config.tokens.colors)

  for (const v of violations) {
    if (!v.autoFixAvailable) {
      skipped.push(v)
      continue
    }

    const rule = config.rules.find(r => r.id === v.ruleId)
    const strategy = rule?.auto_fix
    if (!strategy) {
      skipped.push(v)
      continue
    }

    const fixed = applyFix(v, strategy, config, colorPalette)
    if (fixed) {
      applied.push({ ...v, suggestedValue: fixed })
    } else {
      skipped.push(v)
    }
  }

  return {
    applied,
    skipped,
    totalFixed: applied.length,
    totalSkipped: skipped.length,
  }
}

function applyFix(
  violation: Violation,
  strategy: string,
  config: MuteformConfig,
  colorPalette: Record<string, string>
): any {
  switch (strategy) {
    case 'snap_nearest_delta_e': {
      // Find nearest color by deltaE2000
      const current = typeof violation.currentValue === 'string' ? violation.currentValue : ''
      if (current.startsWith('#')) {
        const nearest = findNearestColor(current, colorPalette)
        return nearest.hex
      }
      return null
    }

    case 'snap_nearest': {
      // Snap to nearest value in a numeric scale
      const scale = config.tokens.spacing?.scale || []
      const current = typeof violation.currentValue === 'string'
        ? parseInt(violation.currentValue)
        : violation.currentValue
      if (typeof current === 'number' && scale.length) {
        return scale.reduce((a, b) => Math.abs(b - current) < Math.abs(a - current) ? b : a)
      }
      return null
    }

    case 'adjust_foreground': {
      // Adjust foreground color until contrast ratio >= 4.5
      const current = typeof violation.currentValue === 'string' ? violation.currentValue : ''
      // We need the background color — extract from violation detail
      // For now use white as default background
      return adjustForegroundForContrast(
        current.includes(':') ? '#888888' : current,
        '#ffffff',
        4.5
      )
    }

    case 'clamp': {
      // Clamp to max value
      const maxDuration = config.tokens.motion?.max_duration || 300
      return `${maxDuration}ms`
    }

    case 'snap_nearest_category': {
      // Map to nearest font category
      const families = config.tokens.typography?.families
      if (families) {
        return Object.values(families)[0] // Return first approved family
      }
      return null
    }

    default:
      return null
  }
}
