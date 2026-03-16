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
  Fix,
  RewriteResult,
  ScanResult,
} from './types'

export { loadConfig, validate, flattenColors } from './engine'
export { remediate } from './remediation'
export { calculateScore, scoreFromViolations } from './scoring'
export { scanArtifact, computeHealthScore } from './scan'
export { rewriteArtifact } from './rewrite'
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
