// ─── Design System Store ─────────────────────────────────────
// Normalized schema for imported design systems.
// Persisted to localStorage so it survives page navigation.

export interface ImportedDesignSystem {
  source: 'url' | 'paste' | 'sample'
  sourceLabel: string
  tokens: {
    color: Record<string, string>
    spacing: number[]
  }
  typography: {
    allowedStyles: string[]
  }
  components: Record<string, {
    allowedVariants: string[]
    allowedSizes: string[]
  }>
  layout: {
    allowedGridColumns: number[]
  }
  customRules: GovernanceRule[]
}

export interface GovernanceRule {
  id: string
  name: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  autoFix: boolean
  autoFixStrategy: string
  blocked: boolean
  violationCount?: number
}

export interface DesignPrinciple {
  id: string
  title: string
  description: string
  whyItMatters: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  autoFix: boolean
  autoFixBehavior: string
}

const STORE_KEY = 'muteform_imported_system'
const RULES_KEY = 'muteform_governance_rules'
const PRINCIPLES_KEY = 'muteform_principles'

export const CARBON_SAMPLE: ImportedDesignSystem = {
  source: 'sample',
  sourceLabel: 'IBM Carbon Design System v11',
  tokens: {
    color: {
      'blue-60': '#0f62fe',
      'blue-70': '#0043ce',
      'gray-100': '#161616',
      'gray-90': '#262626',
      'gray-80': '#393939',
      'gray-70': '#525252',
      'gray-60': '#6f6f6f',
      'gray-50': '#8d8d8d',
      'gray-30': '#c6c6c6',
      'gray-10': '#f4f4f4',
      'white': '#ffffff',
      'green-50': '#24a148',
      'green-60': '#198038',
      'red-60': '#da1e28',
      'red-50': '#fa4d56',
      'yellow-30': '#f1c21b',
      'purple-60': '#8a3ffc',
      'teal-50': '#009d9a',
      'cyan-50': '#1192e8',
      'support-error': '#da1e28',
      'support-success': '#24a148',
      'support-warning': '#f1c21b',
      'support-info': '#0043ce',
    },
    spacing: [2, 4, 8, 12, 16, 24, 32, 48, 64, 96],
  },
  typography: {
    allowedStyles: [
      'heading-01', 'heading-02', 'heading-03', 'heading-04', 'heading-05',
      'body-01', 'body-02', 'body-compact-01', 'body-compact-02',
      'label-01', 'label-02', 'caption-01', 'caption-02',
      'helper-text-01', 'legal-01', 'code-01', 'code-02',
    ],
  },
  components: {
    button: {
      allowedVariants: ['primary', 'secondary', 'tertiary', 'ghost', 'danger'],
      allowedSizes: ['sm', 'md', 'lg', 'xl', '2xl'],
    },
    tag: {
      allowedVariants: ['red', 'magenta', 'purple', 'blue', 'cyan', 'teal', 'green', 'gray', 'cool-gray', 'warm-gray', 'high-contrast', 'outline'],
      allowedSizes: ['sm', 'md'],
    },
    notification: {
      allowedVariants: ['inline', 'toast', 'actionable'],
      allowedSizes: ['sm', 'lg'],
    },
    textInput: {
      allowedVariants: ['default', 'fluid'],
      allowedSizes: ['sm', 'md', 'lg'],
    },
    dropdown: {
      allowedVariants: ['default', 'inline'],
      allowedSizes: ['sm', 'md', 'lg'],
    },
    modal: {
      allowedVariants: ['default', 'danger', 'passive'],
      allowedSizes: ['xs', 'sm', 'md', 'lg'],
    },
  },
  layout: {
    allowedGridColumns: [2, 4, 8, 16],
  },
  customRules: [],
}

export const DEFAULT_GOVERNANCE_RULES: GovernanceRule[] = [
  { id: 'color-token-compliance', name: 'Color Token Compliance', description: 'All colors must reference approved design tokens', severity: 'high', autoFix: true, autoFixStrategy: 'snap_nearest_delta_e', blocked: false },
  { id: 'spacing-scale-compliance', name: 'Spacing Scale Compliance', description: 'Spacing values must use the approved scale', severity: 'medium', autoFix: true, autoFixStrategy: 'snap_nearest', blocked: false },
  { id: 'contrast-wcag-aa', name: 'WCAG AA Contrast Minimum', description: 'All text must meet WCAG AA contrast requirements (4.5:1)', severity: 'critical', autoFix: true, autoFixStrategy: 'adjust_foreground', blocked: true },
  { id: 'typography-style-compliance', name: 'Typography Style Compliance', description: 'Typography styles must be from approved list', severity: 'high', autoFix: true, autoFixStrategy: 'snap_nearest_category', blocked: false },
  { id: 'component-variant-compliance', name: 'Component Variant Compliance', description: 'Component variants must be from approved list', severity: 'critical', autoFix: true, autoFixStrategy: 'snap_nearest_category', blocked: true },
  { id: 'layout-grid-compliance', name: 'Grid Column Compliance', description: 'Grid columns must use approved column counts', severity: 'medium', autoFix: false, autoFixStrategy: '', blocked: false },
]

export const DEFAULT_PRINCIPLES: DesignPrinciple[] = [
  { id: 'dp-1', title: 'Primary actions must use filled button variants', description: 'The primary action on any screen must use a filled (primary) button variant to ensure visual dominance and clear user guidance.', whyItMatters: 'Users scan interfaces quickly. A filled button is the strongest visual signal for the intended action path.', severity: 'high', autoFix: true, autoFixBehavior: 'Change variant to primary' },
  { id: 'dp-2', title: 'WCAG AA contrast minimum 4.5:1 on all text', description: 'All text elements must achieve a minimum contrast ratio of 4.5:1 against their background.', whyItMatters: 'Insufficient contrast excludes users with low vision and violates accessibility regulations.', severity: 'critical', autoFix: true, autoFixBehavior: 'Snap to nearest compliant token' },
  { id: 'dp-3', title: 'Maximum one primary action per screen section', description: 'Each logical section should contain at most one primary-styled button to maintain clear visual hierarchy.', whyItMatters: 'Multiple primary actions create decision paralysis and dilute the intended user flow.', severity: 'medium', autoFix: false, autoFixBehavior: 'Manual review required' },
  { id: 'dp-4', title: 'All spacing must align to 8pt grid', description: 'Every spacing value (margin, padding, gap) must be a multiple of the base grid unit.', whyItMatters: 'Consistent spacing creates visual harmony and reduces cognitive load.', severity: 'medium', autoFix: true, autoFixBehavior: 'Snap to nearest grid value' },
]

export function saveDesignSystem(ds: ImportedDesignSystem): void {
  if (typeof window !== 'undefined') localStorage.setItem(STORE_KEY, JSON.stringify(ds))
}

export function loadDesignSystem(): ImportedDesignSystem | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveGovernanceRules(rules: GovernanceRule[]): void {
  if (typeof window !== 'undefined') localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

export function loadGovernanceRules(): GovernanceRule[] {
  if (typeof window === 'undefined') return DEFAULT_GOVERNANCE_RULES
  try {
    const raw = localStorage.getItem(RULES_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_GOVERNANCE_RULES
  } catch { return DEFAULT_GOVERNANCE_RULES }
}

export function savePrinciples(principles: DesignPrinciple[]): void {
  if (typeof window !== 'undefined') localStorage.setItem(PRINCIPLES_KEY, JSON.stringify(principles))
}

export function loadPrinciples(): DesignPrinciple[] {
  if (typeof window === 'undefined') return DEFAULT_PRINCIPLES
  try {
    const raw = localStorage.getItem(PRINCIPLES_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_PRINCIPLES
  } catch { return DEFAULT_PRINCIPLES }
}

export function parseTokenJSON(input: string, source: 'url' | 'paste', sourceLabel: string): ImportedDesignSystem {
  const data = JSON.parse(input)
  const color: Record<string, string> = {}
  const rawColors = data.tokens?.colors || data.tokens?.color || data.color || data.colors || {}
  function flattenColorsObj(obj: any, prefix = '') {
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val)) {
        color[prefix ? `${prefix}-${key}` : key] = val
      } else if (typeof val === 'object' && val !== null) {
        flattenColorsObj(val, prefix ? `${prefix}-${key}` : key)
      }
    }
  }
  flattenColorsObj(rawColors)

  const rawSpacing = data.tokens?.spacing?.scale || data.tokens?.spacing || data.spacing?.scale || data.spacing || []
  const spacing = Array.isArray(rawSpacing) ? rawSpacing.filter((n: any) => typeof n === 'number') : []
  const rawTypo = data.tokens?.typography?.allowed_styles || data.tokens?.typography?.allowedStyles || data.typography?.allowedStyles || data.typography?.allowed_styles || []
  const allowedStyles = Array.isArray(rawTypo) ? rawTypo : []
  const rawComponents = data.tokens?.components || data.components || {}
  const components: Record<string, { allowedVariants: string[]; allowedSizes: string[] }> = {}
  for (const [name, comp] of Object.entries(rawComponents)) {
    const c = comp as any
    components[name] = {
      allowedVariants: c.allowed_variants || c.allowedVariants || c.variants || [],
      allowedSizes: c.allowed_sizes || c.allowedSizes || c.sizes || [],
    }
  }
  const rawGrid = data.tokens?.layout?.grid_columns || data.tokens?.layout?.allowedGridColumns || data.layout?.allowedGridColumns || data.layout?.grid_columns || []
  const allowedGridColumns = Array.isArray(rawGrid) ? rawGrid : []

  return {
    source, sourceLabel: sourceLabel || data.name || 'Imported Design System',
    tokens: { color, spacing }, typography: { allowedStyles }, components,
    layout: { allowedGridColumns }, customRules: [],
  }
}

export function getImportWarnings(ds: ImportedDesignSystem): string[] {
  const w: string[] = []
  if (Object.keys(ds.tokens.color).length === 0) w.push('No color tokens found — using defaults')
  if (ds.tokens.spacing.length === 0) w.push('No spacing scale found — using defaults')
  if (ds.typography.allowedStyles.length === 0) w.push('No typography styles found — using defaults')
  if (Object.keys(ds.components).length === 0) w.push('No component definitions found — using defaults')
  if (ds.layout.allowedGridColumns.length === 0) w.push('No layout grid columns found — using defaults')
  return w
}
