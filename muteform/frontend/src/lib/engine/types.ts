// ─── Muteform Core Types ─────────────────────────────────────

export interface MuteformConfig {
  name: string
  version: string
  extends?: string
  tokens: TokenDefinitions
  rules: RuleDefinition[]
}

export interface TokenDefinitions {
  colors?: Record<string, any>
  spacing?: { scale: number[]; tolerance?: number }
  typography?: {
    families?: Record<string, string>
    scale_ratio?: number
    min_body_size?: number
  }
  motion?: {
    max_duration?: number
    easing_allowed?: string[]
  }
  layout?: {
    grid_columns?: number[]
  }
}

export interface RuleDefinition {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  check: string
  auto_fix: string | false
}

export interface InterfaceNode {
  id: string
  type: 'element' | 'text' | 'image' | 'container' | 'interactive'
  path: string
  properties: {
    colors?: Record<string, string>
    spacing?: Record<string, number>
    typography?: {
      family?: string
      size?: number
      weight?: number
      lineHeight?: number
    }
    layout?: {
      display?: string
      columns?: number
      gap?: number
    }
    motion?: {
      duration?: number
      easing?: string
    }
    contrast?: {
      foreground: string
      background: string
      ratio?: number
    }
    [key: string]: any
  }
  children?: string[]
}

export interface InterfaceDefinition {
  nodes: InterfaceNode[]
  metadata: {
    source: string
    platform: string
    generatedAt: string
    agentId?: string
  }
}

export interface Violation {
  ruleId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  nodeId: string
  nodePath: string
  property: string
  currentValue: any
  suggestedValue?: any
  message: string
  autoFixAvailable: boolean
  detail: string
}

export interface ValidationResult {
  passed: boolean
  violations: Violation[]
  nodesScanned: number
  rulesEvaluated: number
  scanDurationMs: number
}

export interface RemediationResult {
  applied: Violation[]
  skipped: Violation[]
  totalFixed: number
  totalSkipped: number
}

export interface HealthScore {
  overall: number
  breakdown: Record<string, number>
  violationCounts: Record<string, number>
}
