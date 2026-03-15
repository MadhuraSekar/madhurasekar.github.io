// ─── HTML/CSS → InterfaceDefinition parser ──────────────────
import type { InterfaceDefinition, InterfaceNode } from './types'

/** Parse HTML + optional CSS into an InterfaceDefinition */
export function parseHTML(html: string, css?: string): InterfaceDefinition {
  const nodes: InterfaceNode[] = []
  const allStyles = extractStyles(html, css)

  // Simple tag-based parsing
  const tagRegex = /<(\w+)([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  let match: RegExpExecArray | null
  let nodeIndex = 0

  // Parse top-level and nested elements
  const elements = extractElements(html)

  for (const el of elements) {
    nodeIndex++
    const id = el.id || `node_${nodeIndex}`
    const inlineStyles = parseInlineStyle(el.style || '')
    const classStyles = resolveClassStyles(el.classes, allStyles)
    const mergedStyles = { ...classStyles, ...inlineStyles }

    const node: InterfaceNode = {
      id,
      type: categorizeElement(el.tag),
      path: el.path || `root > ${el.tag}#${id}`,
      properties: {},
    }

    // Extract colors
    const colors: Record<string, string> = {}
    for (const [prop, val] of Object.entries(mergedStyles)) {
      if (isColorProperty(prop) && isColorValue(val)) {
        colors[prop] = normalizeColor(val)
      }
    }
    if (Object.keys(colors).length) node.properties.colors = colors

    // Extract spacing
    const spacing: Record<string, number> = {}
    for (const [prop, val] of Object.entries(mergedStyles)) {
      if (isSpacingProperty(prop)) {
        const px = parsePxValue(val)
        if (px !== null) spacing[prop] = px
      }
    }
    if (Object.keys(spacing).length) node.properties.spacing = spacing

    // Extract typography
    const typo: any = {}
    if (mergedStyles['font-family']) typo.family = mergedStyles['font-family'].split(',')[0].trim().replace(/['"]/g, '')
    if (mergedStyles['font-size']) typo.size = parsePxValue(mergedStyles['font-size']) || undefined
    if (mergedStyles['font-weight']) typo.weight = parseInt(mergedStyles['font-weight']) || undefined
    if (mergedStyles['line-height']) typo.lineHeight = parseFloat(mergedStyles['line-height']) || undefined
    if (Object.keys(typo).length) node.properties.typography = typo

    // Extract layout
    const layout: any = {}
    if (mergedStyles['display']) layout.display = mergedStyles['display']
    if (mergedStyles['grid-template-columns']) {
      const cols = mergedStyles['grid-template-columns'].split(/\s+/).length
      layout.columns = cols
    }
    if (mergedStyles['gap']) layout.gap = parsePxValue(mergedStyles['gap']) || undefined
    if (Object.keys(layout).length) node.properties.layout = layout

    // Extract motion
    const motion: any = {}
    if (mergedStyles['transition-duration'] || mergedStyles['animation-duration']) {
      const dur = mergedStyles['transition-duration'] || mergedStyles['animation-duration']
      motion.duration = parseMsValue(dur)
    }
    if (mergedStyles['transition-timing-function']) {
      motion.easing = mergedStyles['transition-timing-function']
    }
    if (Object.keys(motion).length) node.properties.motion = motion

    // Calculate contrast for text elements
    if (node.type === 'text' || node.type === 'interactive') {
      const fg = colors['color'] || '#000000'
      const bg = colors['background-color'] || colors['background'] || '#ffffff'
      if (fg && bg) {
        node.properties.contrast = { foreground: fg, background: bg }
      }
    }

    nodes.push(node)
  }

  return {
    nodes,
    metadata: {
      source: 'html-paste',
      platform: 'web',
      generatedAt: new Date().toISOString(),
    },
  }
}

interface ParsedElement {
  tag: string
  id?: string
  classes: string[]
  style?: string
  path?: string
  textContent?: string
}

function extractElements(html: string): ParsedElement[] {
  const elements: ParsedElement[] = []
  // Match opening tags with attributes
  const regex = /<(\w+)([^>]*)>/gi
  let m: RegExpExecArray | null

  while ((m = regex.exec(html)) !== null) {
    const tag = m[1].toLowerCase()
    if (['html', 'head', 'meta', 'link', 'script', 'br', 'hr'].includes(tag)) continue

    const attrs = m[2]
    const id = (attrs.match(/id=["']([^"']+)["']/i) || [])[1]
    const classStr = (attrs.match(/class=["']([^"']+)["']/i) || [])[1] || ''
    const style = (attrs.match(/style=["']([^"']+)["']/i) || [])[1]

    elements.push({
      tag,
      id,
      classes: classStr.split(/\s+/).filter(Boolean),
      style,
      path: `root > ${tag}${id ? '#' + id : ''}${classStr ? '.' + classStr.split(/\s+/)[0] : ''}`,
    })
  }

  return elements
}

function extractStyles(html: string, css?: string): Record<string, Record<string, string>> {
  const styles: Record<string, Record<string, string>> = {}

  // Extract <style> blocks
  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []
  let allCss = css || ''
  for (const block of styleBlocks) {
    const content = block.replace(/<\/?style[^>]*>/gi, '')
    allCss += '\n' + content
  }

  // Parse CSS rules
  const ruleRegex = /([^{]+)\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = ruleRegex.exec(allCss)) !== null) {
    const selector = m[1].trim()
    const declarations = parseInlineStyle(m[2])
    styles[selector] = declarations
  }

  return styles
}

function parseInlineStyle(style: string): Record<string, string> {
  const props: Record<string, string> = {}
  if (!style) return props
  for (const decl of style.split(';')) {
    const [prop, ...vals] = decl.split(':')
    if (prop && vals.length) {
      props[prop.trim().toLowerCase()] = vals.join(':').trim()
    }
  }
  return props
}

function resolveClassStyles(
  classes: string[],
  allStyles: Record<string, Record<string, string>>
): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const cls of classes) {
    const key = `.${cls}`
    if (allStyles[key]) Object.assign(merged, allStyles[key])
  }
  return merged
}

function categorizeElement(tag: string): InterfaceNode['type'] {
  if (['button', 'input', 'select', 'textarea', 'a'].includes(tag)) return 'interactive'
  if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'label'].includes(tag)) return 'text'
  if (['img', 'svg', 'video'].includes(tag)) return 'image'
  if (['div', 'section', 'main', 'header', 'footer', 'nav', 'aside', 'article'].includes(tag)) return 'container'
  return 'element'
}

function isColorProperty(prop: string): boolean {
  return ['color', 'background-color', 'background', 'border-color', 'outline-color', 'fill', 'stroke'].includes(prop)
}

function isColorValue(val: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(val) || /^rgb/i.test(val)
}

function normalizeColor(val: string): string {
  if (val.startsWith('#')) {
    let h = val.slice(1)
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    return '#' + h.toLowerCase()
  }
  // Parse rgb(r, g, b)
  const rgbMatch = val.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgbMatch) {
    const [_, r, g, b] = rgbMatch
    return '#' + [r, g, b].map(c => parseInt(c).toString(16).padStart(2, '0')).join('')
  }
  return val
}

function isSpacingProperty(prop: string): boolean {
  return ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'gap', 'row-gap', 'column-gap'].includes(prop)
}

function parsePxValue(val: string): number | null {
  const m = val.match(/([\d.]+)\s*px/)
  return m ? parseFloat(m[1]) : null
}

function parseMsValue(val: string): number | null {
  if (val.includes('ms')) {
    const m = val.match(/([\d.]+)\s*ms/)
    return m ? parseFloat(m[1]) : null
  }
  const m = val.match(/([\d.]+)\s*s/)
  return m ? parseFloat(m[1]) * 1000 : null
}
