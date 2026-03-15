// ─── Muteform Engine — Public API ────────────────────────────
export type {
  MuteformConfig,
  TokenDefinitions,
  RuleDefinition,
  InterfaceNode,
  InterfaceDefinition,
  Violation,
  ValidationResult,
  RemediationResult,
  HealthScore,
} from './types'

export { loadConfig, validate, flattenColors } from './engine'
export { remediate } from './remediation'
export { calculateScore, scoreFromViolations } from './scoring'
export { parseHTML } from './html-parser'
export {
  contrastRatio,
  deltaE2000,
  findNearestColor,
  adjustForegroundForContrast,
  hexToRgb,
  rgbToHex,
  relativeLuminance,
} from './color'
