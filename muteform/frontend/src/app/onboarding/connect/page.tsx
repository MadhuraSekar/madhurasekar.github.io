'use client'

import { useState, useCallback, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

const T = {
  bg: '#08090d', surface: '#0c0e12', surface2: '#111318',
  border: '#1a1d24', border2: '#252830',
  green: '#00e087', greenDim: '#00e08718',
  red: '#ff4070', redDim: '#ff407018',
  amber: '#ffb830', amberDim: '#ffb83018',
  blue: '#4090ff', blueDim: '#4090ff18',
  muted: '#6b7280', dim: '#3a3f4a',
  text: '#e8eaf0', textBright: '#f8f9fb',
}
const mono = "'JetBrains Mono', 'DM Mono', monospace"
const sans = "'DM Sans', system-ui, sans-serif"
const serif = "'Instrument Serif', Georgia, serif"

interface TokenSummary {
  colors: number
  spacing: number
  fonts: number
  format: string
}

function detectTokens(raw: string): TokenSummary | null {
  if (!raw || !raw.trim()) return null
  var text = raw.trim()

  var colors = 0
  var spacing = 0
  var fonts = 0
  var format = 'Unknown'

  // CSS custom properties
  if (text.indexOf('--') !== -1 && text.indexOf(':') !== -1) {
    format = 'CSS Custom Properties'
    var colorPatterns = text.match(/--(color|bg|background|text|border|accent|primary|secondary|success|warning|error|danger|info|surface|foreground|muted|card|popover|destructive|ring|input|chart)[^;]*/gi)
    var spacingPatterns = text.match(/--(space|spacing|gap|padding|margin|radius|size|width|height)[^;]*/gi)
    var fontPatterns = text.match(/--(font|family|typeface)[^;]*/gi)
    colors = colorPatterns ? colorPatterns.length : 0
    spacing = spacingPatterns ? spacingPatterns.length : 0
    fonts = fontPatterns ? fontPatterns.length : 0
  }
  // Try JSON
  else {
    try {
      var parsed = JSON.parse(text)
      // Style Dictionary
      if (parsed.color || parsed.colors) {
        format = 'Style Dictionary'
        colors = countKeys(parsed.color || parsed.colors)
        spacing = countKeys(parsed.spacing || parsed.space || {})
        fonts = countKeys(parsed.font || parsed.fonts || parsed.fontFamily || parsed.fontFamilies || {})
      }
      // Tailwind config
      else if (parsed.theme || parsed.extend) {
        format = 'Tailwind Config'
        var theme = parsed.theme || parsed.extend || {}
        colors = countKeys(theme.colors || {})
        spacing = countKeys(theme.spacing || {})
        fonts = countKeys(theme.fontFamily || {})
      }
      // Raw JSON tokens
      else {
        format = 'JSON Tokens'
        var allKeys = flatKeys(parsed)
        colors = allKeys.filter(function(k: string) { return /color|bg|background|text|border|accent|primary|secondary|fill|stroke/i.test(k) }).length
        spacing = allKeys.filter(function(k: string) { return /space|spacing|gap|padding|margin|radius|size/i.test(k) }).length
        fonts = allKeys.filter(function(k: string) { return /font|family|typeface/i.test(k) }).length
        if (colors === 0 && spacing === 0 && fonts === 0) {
          colors = Math.min(allKeys.length, 20)
        }
      }
    } catch (e) {
      // YAML-like
      if (text.indexOf(':') !== -1) {
        format = 'YAML'
        var lines = text.split('\n')
        lines.forEach(function(line: string) {
          if (/color|bg|background|text|border|accent|primary|secondary/i.test(line)) colors++
          if (/space|spacing|gap|padding|margin|radius/i.test(line)) spacing++
          if (/font|family|typeface/i.test(line)) fonts++
        })
      }
    }
  }

  if (colors === 0 && spacing === 0 && fonts === 0) return null
  return { colors: colors, spacing: spacing, fonts: fonts, format: format }
}

function countKeys(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0
  var count = 0
  var keys = Object.keys(obj)
  keys.forEach(function(k) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      count += countKeys(obj[k])
    } else {
      count++
    }
  })
  return count
}

function flatKeys(obj: any, prefix?: string): string[] {
  if (!obj || typeof obj !== 'object') return []
  var result: string[] = []
  Object.keys(obj).forEach(function(k) {
    var path = prefix ? prefix + '.' + k : k
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      var nested = flatKeys(obj[k], path)
      nested.forEach(function(n) { result.push(n) })
    } else {
      result.push(path)
    }
  })
  return result
}

var TEMPLATES: Record<string, string> = {
  'Minimal': JSON.stringify({
    color: { primary: '#000', secondary: '#666', background: '#fff', text: '#111', border: '#ddd' },
    spacing: { sm: '4px', md: '8px', lg: '16px' },
    font: { body: 'system-ui, sans-serif' }
  }, null, 2),
  'Standard (Recommended)': JSON.stringify({
    color: {
      primary: '#2563eb', 'primary-hover': '#1d4ed8', secondary: '#7c3aed', accent: '#06b6d4',
      success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
      background: '#ffffff', surface: '#f8fafc', 'surface-alt': '#f1f5f9',
      text: '#0f172a', 'text-muted': '#64748b', 'text-dim': '#94a3b8',
      border: '#e2e8f0', 'border-strong': '#cbd5e1',
      'bg-dark': '#0f172a', 'surface-dark': '#1e293b', 'text-dark': '#f8fafc',
      'text-muted-dark': '#94a3b8', 'border-dark': '#334155'
    },
    spacing: {
      '2xs': '2px', xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px'
    },
    font: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" }
  }, null, 2),
  'Strict': JSON.stringify({
    color: {
      'brand-primary': '#1a1a2e', 'brand-secondary': '#16213e', 'brand-accent': '#0f3460',
      'ui-bg': '#ffffff', 'ui-surface': '#fafafa', 'ui-surface-raised': '#f5f5f5',
      'ui-border': '#e5e5e5', 'ui-border-strong': '#d4d4d4', 'ui-divider': '#f0f0f0',
      'text-primary': '#171717', 'text-secondary': '#525252', 'text-tertiary': '#737373', 'text-disabled': '#a3a3a3',
      'status-success': '#16a34a', 'status-warning': '#ca8a04', 'status-error': '#dc2626', 'status-info': '#2563eb',
      'interactive-primary': '#1a1a2e', 'interactive-hover': '#16213e', 'interactive-active': '#0f3460', 'interactive-disabled': '#d4d4d4'
    },
    spacing: {
      '4': '4px', '8': '8px', '12': '12px', '16': '16px', '20': '20px', '24': '24px', '32': '32px', '40': '40px', '48': '48px', '64': '64px'
    },
    font: { display: "'Instrument Serif', Georgia, serif", heading: "'DM Sans', sans-serif", body: "'DM Sans', sans-serif", mono: "'JetBrains Mono', monospace" }
  }, null, 2),
  'Tailwind CSS': JSON.stringify({
    theme: {
      colors: {
        slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
        blue: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
        green: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a' },
        red: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626' },
        amber: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706' }
      },
      spacing: { '0': '0px', '1': '0.25rem', '2': '0.5rem', '3': '0.75rem', '4': '1rem', '5': '1.25rem', '6': '1.5rem', '8': '2rem', '10': '2.5rem', '12': '3rem', '16': '4rem' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }
    }
  }, null, 2),
  'Material Design 3': JSON.stringify({
    color: {
      primary: '#6750A4', 'on-primary': '#FFFFFF', 'primary-container': '#EADDFF', 'on-primary-container': '#21005D',
      secondary: '#625B71', 'on-secondary': '#FFFFFF', 'secondary-container': '#E8DEF8', 'on-secondary-container': '#1D192B',
      tertiary: '#7D5260', 'on-tertiary': '#FFFFFF', 'tertiary-container': '#FFD8E4', 'on-tertiary-container': '#31111D',
      error: '#B3261E', 'on-error': '#FFFFFF', 'error-container': '#F9DEDC', 'on-error-container': '#410E0B',
      background: '#FFFBFE', 'on-background': '#1C1B1F', surface: '#FFFBFE', 'on-surface': '#1C1B1F',
      'surface-variant': '#E7E0EC', 'on-surface-variant': '#49454F', outline: '#79747E', 'outline-variant': '#CAC4D0'
    },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
    font: { display: "'Roboto', sans-serif", headline: "'Roboto', sans-serif", body: "'Roboto', sans-serif" }
  }, null, 2),
}

function ProgressBar({ step }: { step: number }) {
  var steps = ['Connect', 'Rules', 'Scan']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 48, width: '100%', maxWidth: 480 }}>
      {steps.map(function(label, i) {
        var active = i + 1 === step
        var done = i + 1 < step
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? T.green : active ? T.greenDim : T.surface2,
                border: '2px solid ' + (done || active ? T.green : T.border),
                color: done ? T.bg : active ? T.green : T.muted,
                fontFamily: mono, fontSize: 13, fontWeight: 700,
                transition: 'all 0.3s ease',
              }}>
                {done ? '\u2713' : String(i + 1)}
              </div>
              <span style={{
                marginTop: 6, fontFamily: mono, fontSize: 11, letterSpacing: '0.05em',
                color: active ? T.green : done ? T.text : T.muted,
                textTransform: 'uppercase' as const,
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 2, flex: 1, background: done ? T.green : T.border,
                marginTop: -18, transition: 'background 0.3s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

type Method = 'paste' | 'upload' | 'figma' | 'template'

export default function ConnectPage() {
  var router = useRouter()
  var [method, setMethod] = useState<Method>('paste')
  var [rawTokens, setRawTokens] = useState('')
  var [summary, setSummary] = useState<TokenSummary | null>(null)
  var [dragging, setDragging] = useState(false)
  var [fileName, setFileName] = useState('')
  var [figmaUrl, setFigmaUrl] = useState('')
  var [figmaMsg, setFigmaMsg] = useState('')
  var [selectedTemplate, setSelectedTemplate] = useState('')

  var handlePaste = useCallback(function(val: string) {
    setRawTokens(val)
    setSummary(detectTokens(val))
  }, [])

  var handleFile = useCallback(function(file: File) {
    setFileName(file.name)
    var reader = new FileReader()
    reader.onload = function(e) {
      var text = (e.target as FileReader).result as string
      setRawTokens(text)
      setSummary(detectTokens(text))
    }
    reader.readAsText(file)
  }, [])

  var handleDrop = useCallback(function(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  var handleDragOver = useCallback(function(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }, [])

  var handleDragLeave = useCallback(function() {
    setDragging(false)
  }, [])

  var handleFileInput = useCallback(function(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0])
    }
  }, [handleFile])

  var handleFigmaConnect = useCallback(function() {
    setFigmaMsg('Figma integration coming soon \u2014 paste your tokens instead.')
  }, [])

  var handleTemplate = useCallback(function(name: string) {
    setSelectedTemplate(name)
    var tokens = TEMPLATES[name] || ''
    setRawTokens(tokens)
    setSummary(detectTokens(tokens))
  }, [])

  var methods: Array<{ key: Method; label: string; hint: string }> = [
    { key: 'paste', label: 'Paste Tokens', hint: 'fastest' },
    { key: 'upload', label: 'Upload File', hint: '.json, .yaml' },
    { key: 'figma', label: 'Connect Figma', hint: 'beta' },
    { key: 'template', label: 'Use Template', hint: '5 presets' },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.text, fontFamily: sans,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px',
    }}>
      <ProgressBar step={1} />

      <div style={{
        fontFamily: serif, fontSize: 36, color: T.textBright, marginBottom: 8,
        fontStyle: 'italic', letterSpacing: '-0.01em',
      }}>
        Connect Your Design System
      </div>
      <p style={{ fontFamily: mono, fontSize: 13, color: T.muted, marginBottom: 40, letterSpacing: '0.02em' }}>
        Import your tokens to generate a custom ruleset
      </p>

      {/* Method tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 32, padding: 4,
        background: T.surface, borderRadius: 10, border: '1px solid ' + T.border,
      }}>
        {methods.map(function(m) {
          var active = method === m.key
          return (
            <button
              key={m.key}
              onClick={function() { setMethod(m.key); setFigmaMsg('') }}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? T.surface2 : 'transparent',
                color: active ? T.textBright : T.muted,
                fontFamily: mono, fontSize: 12, letterSpacing: '0.02em',
                transition: 'all 0.2s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span>{m.label}</span>
              <span style={{ fontSize: 10, color: active ? T.green : T.dim }}>{m.hint}</span>
            </button>
          )
        })}
      </div>

      {/* Content area */}
      <div style={{
        width: '100%', maxWidth: 640,
        background: T.surface, borderRadius: 12, border: '1px solid ' + T.border,
        padding: 32, minHeight: 300,
      }}>
        {/* Paste */}
        {method === 'paste' && (
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12, display: 'block' }}>
              PASTE YOUR DESIGN TOKENS
            </label>
            <textarea
              value={rawTokens}
              onChange={function(e) { handlePaste(e.target.value) }}
              placeholder={'{\n  "color": {\n    "primary": "#2563eb",\n    "secondary": "#7c3aed",\n    "background": "#ffffff"\n  },\n  "spacing": {\n    "sm": "8px",\n    "md": "16px"\n  }\n}'}
              style={{
                width: '100%', minHeight: 220, padding: 16, borderRadius: 8,
                background: T.bg, border: '1px solid ' + T.border2, color: T.text,
                fontFamily: mono, fontSize: 13, lineHeight: 1.6, resize: 'vertical',
                outline: 'none', boxSizing: 'border-box' as const,
              }}
              onFocus={function(e) { e.currentTarget.style.borderColor = T.green }}
              onBlur={function(e) { e.currentTarget.style.borderColor = T.border2 }}
            />
            <p style={{ fontFamily: mono, fontSize: 11, color: T.dim, marginTop: 8 }}>
              Supports Style Dictionary, Tailwind config, raw JSON, CSS custom properties, YAML
            </p>
          </div>
        )}

        {/* Upload */}
        {method === 'upload' && (
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12, display: 'block' }}>
              UPLOAD TOKEN FILE
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                padding: 48, borderRadius: 12,
                border: '2px dashed ' + (dragging ? T.green : T.border2),
                background: dragging ? T.greenDim : T.bg,
                textAlign: 'center' as const, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={function() {
                var el = document.getElementById('file-input')
                if (el) el.click()
              }}
            >
              <input
                id="file-input"
                type="file"
                accept=".json,.yaml,.yml"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{dragging ? '\u2193' : '\u2191'}</div>
              <p style={{ fontFamily: mono, fontSize: 13, color: dragging ? T.green : T.muted }}>
                {fileName ? 'Loaded: ' + fileName : 'Drop a .json, .yaml, or .yml file here'}
              </p>
              <p style={{ fontFamily: mono, fontSize: 11, color: T.dim, marginTop: 8 }}>
                or click to browse
              </p>
            </div>
          </div>
        )}

        {/* Figma */}
        {method === 'figma' && (
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12, display: 'block' }}>
              CONNECT FIGMA FILE
            </label>
            <input
              type="text"
              placeholder="https://www.figma.com/file/..."
              value={figmaUrl}
              onChange={function(e) { setFigmaUrl(e.target.value) }}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 8,
                background: T.bg, border: '1px solid ' + T.border2, color: T.text,
                fontFamily: mono, fontSize: 13, outline: 'none', marginBottom: 16,
                boxSizing: 'border-box' as const,
              }}
              onFocus={function(e) { e.currentTarget.style.borderColor = T.blue }}
              onBlur={function(e) { e.currentTarget.style.borderColor = T.border2 }}
            />
            <button
              onClick={handleFigmaConnect}
              style={{
                padding: '12px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#5B4AE8', color: '#fff',
                fontFamily: mono, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>F</span> Connect with Figma
            </button>
            {figmaMsg && (
              <div style={{
                marginTop: 16, padding: '12px 16px', borderRadius: 8,
                background: T.amberDim, border: '1px solid ' + T.amber + '30',
                fontFamily: mono, fontSize: 12, color: T.amber,
              }}>
                {figmaMsg}
              </div>
            )}
          </div>
        )}

        {/* Template */}
        {method === 'template' && (
          <div>
            <label style={{ fontFamily: mono, fontSize: 11, color: T.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 16, display: 'block' }}>
              SELECT A TEMPLATE
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.keys(TEMPLATES).map(function(name) {
                var active = selectedTemplate === name
                var isRecommended = name.indexOf('Recommended') !== -1
                return (
                  <button
                    key={name}
                    onClick={function() { handleTemplate(name) }}
                    style={{
                      padding: '14px 20px', borderRadius: 8, border: '1px solid ' + (active ? T.green : T.border2),
                      background: active ? T.greenDim : T.bg, color: active ? T.green : T.text,
                      fontFamily: mono, fontSize: 13, cursor: 'pointer',
                      textAlign: 'left' as const, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>{name}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {isRecommended && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, background: T.greenDim,
                          color: T.green, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
                        }}>recommended</span>
                      )}
                      {active && <span style={{ color: T.green }}>{'\u2713'}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Token Summary */}
      {summary && (
        <div style={{
          width: '100%', maxWidth: 640, marginTop: 16,
          background: T.surface, borderRadius: 12, border: '1px solid ' + T.green + '40',
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, boxShadow: '0 0 8px ' + T.green + '60' }} />
            <span style={{ fontFamily: mono, fontSize: 12, color: T.green }}>
              {summary.format} detected
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>
              <strong style={{ color: T.textBright }}>{summary.colors}</strong> color tokens
            </span>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>
              <strong style={{ color: T.textBright }}>{summary.spacing}</strong> spacing values
            </span>
            <span style={{ fontFamily: mono, fontSize: 12, color: T.text }}>
              <strong style={{ color: T.textBright }}>{summary.fonts}</strong> font families
            </span>
          </div>
        </div>
      )}

      {/* CTA */}
      {summary && (
        <button
          onClick={function() { router.push('/onboarding/rules') }}
          style={{
            marginTop: 24, padding: '14px 36px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: T.green, color: T.bg,
            fontFamily: mono, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
            transition: 'all 0.2s ease',
            boxShadow: '0 0 24px ' + T.green + '30',
          }}
          onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 0 32px ' + T.green + '50' }}
          onMouseLeave={function(e) { e.currentTarget.style.boxShadow = '0 0 24px ' + T.green + '30' }}
        >
          Generate Ruleset {'\u2192'}
        </button>
      )}
    </div>
  )
}
