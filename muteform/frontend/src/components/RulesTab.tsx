'use client'
import { useEffect, useState } from 'react'
import { C, mono, syne } from './ui/tokens'
import { api } from '@/lib/api'

interface Ruleset {
  id: string
  name: string
  tokens: { color: Record<string, string> }
  typography: { allowedStyles: string[] }
  components: Record<string, { variants: string[]; sizes: string[] }>
  layout: { allowedGridColumns: number[] }
  custom_rules: CustomRule[]
}

interface CustomRule {
  title: string
  description: string
  type: string
}

const RULE_TYPES = [
  { id: 'layout_pattern', label: 'Layout Pattern', eg: 'Banner: top of screen only' },
  { id: 'accessibility', label: 'Accessibility', eg: 'Elderly UX: min font-size 18px' },
  { id: 'component_placement', label: 'Component Placement', eg: 'Modal: never on mobile' },
  { id: 'feature_specific', label: 'Feature Rule', eg: 'Checkout: high-contrast required' },
  { id: 'brand', label: 'Brand Constraint', eg: 'Logo: never below the fold' },
]

const SECTIONS = [
  { id: 'tokens', label: 'Color Tokens' },
  { id: 'spacing', label: 'Spacing Scale' },
  { id: 'typography', label: 'Typography' },
  { id: 'components', label: 'Components' },
  { id: 'layout', label: 'Layout' },
  { id: 'custom', label: 'Custom Rules' },
] as const

type Section = typeof SECTIONS[number]['id']

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px',
  ...extra,
})

const lbl: React.CSSProperties = {
  fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: C.muted, marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  fontFamily: mono, fontSize: 12, background: C.surface2, border: `1px solid ${C.border2}`,
  borderRadius: 4, padding: '8px 12px', color: C.text, outline: 'none', width: '100%',
}

const btnStyle = (primary?: boolean): React.CSSProperties => ({
  fontFamily: mono, fontSize: 10, letterSpacing: '0.07em', padding: '8px 16px',
  background: primary ? C.blue : 'transparent', border: `1px solid ${primary ? C.blue : C.border2}`,
  borderRadius: 4, color: primary ? '#fff' : C.muted, cursor: 'pointer', transition: 'all 0.2s',
})

const removeBtn: React.CSSProperties = {
  fontFamily: mono, fontSize: 10, background: 'transparent', border: `1px solid ${C.border2}`,
  borderRadius: 3, color: C.red, cursor: 'pointer', padding: '4px 8px',
}

const tag = (bg: string, color: string): React.CSSProperties => ({
  fontFamily: mono, fontSize: 10, padding: '3px 8px', borderRadius: 3,
  background: bg, color, display: 'inline-block',
})

function emptyRuleset(): Ruleset {
  return {
    id: '', name: '', tokens: { color: {} }, typography: { allowedStyles: [] },
    components: {}, layout: { allowedGridColumns: [] }, custom_rules: [],
  }
}

function ensureShape(rs: any): Ruleset {
  return {
    ...rs,
    tokens: rs.tokens || { color: {} },
    typography: rs.typography || { allowedStyles: [] },
    components: rs.components || {},
    layout: rs.layout || { allowedGridColumns: [] },
    custom_rules: rs.custom_rules || [],
  }
}

export default function RulesTab() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([])
  const [activeRulesetId, setActiveRulesetId] = useState('')
  const [ruleset, setRuleset] = useState<Ruleset>(emptyRuleset())
  const [section, setSection] = useState<Section>('tokens')
  const [newColor, setNewColor] = useState({ name: '', value: '#0055FF' })
  const [newSpacing, setNewSpacing] = useState('')
  const [newTypo, setNewTypo] = useState('')
  const [newComp, setNewComp] = useState({ name: '', variants: '', sizes: '' })
  const [newGrid, setNewGrid] = useState('')
  const [newRule, setNewRule] = useState({ title: '', description: '', type: 'layout_pattern' })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Ruleset[]>('/rulesets').then(data => {
      setRulesets(data)
      if (data.length) {
        const rs = ensureShape(data[0])
        setActiveRulesetId(rs.id)
        setRuleset(rs)
      }
    }).catch(() => {})
  }, [])

  function selectRuleset(id: string) {
    const rs = rulesets.find(r => r.id === id)
    if (rs) { setActiveRulesetId(id); setRuleset(ensureShape(rs)) }
  }

  async function save() {
    setSaving(true)
    try {
      const { id, ...body } = ruleset
      await api(`/rulesets/${id}`, { method: 'PUT', body: JSON.stringify({ name: body.name, tokens: body.tokens, typography: body.typography, components: body.components, layout: body.layout, custom_rules: body.custom_rules }) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ }
    setSaving(false)
  }

  function update(fn: (rs: Ruleset) => Ruleset) {
    setRuleset(prev => fn({ ...prev }))
  }

  // Color tokens helpers
  function addColor() {
    if (!newColor.name.trim()) return
    update(rs => { rs.tokens = { ...rs.tokens, color: { ...rs.tokens.color, [newColor.name.trim()]: newColor.value } }; return rs })
    setNewColor({ name: '', value: '#0055FF' })
  }
  function removeColor(name: string) {
    update(rs => { const c = { ...rs.tokens.color }; delete c[name]; rs.tokens = { ...rs.tokens, color: c }; return rs })
  }

  // Spacing helpers
  const spacingValues: number[] = Array.isArray((ruleset.tokens as any)?.spacing) ? (ruleset.tokens as any).spacing : []
  function addSpacing() {
    const n = parseInt(newSpacing)
    if (isNaN(n)) return
    update(rs => { (rs.tokens as any).spacing = [...spacingValues, n].sort((a, b) => a - b); return rs })
    setNewSpacing('')
  }
  function removeSpacing(val: number) {
    update(rs => { (rs.tokens as any).spacing = spacingValues.filter(v => v !== val); return rs })
  }

  // Typography helpers
  function addTypo() {
    if (!newTypo.trim()) return
    update(rs => { rs.typography = { ...rs.typography, allowedStyles: [...rs.typography.allowedStyles, newTypo.trim()] }; return rs })
    setNewTypo('')
  }
  function removeTypo(style: string) {
    update(rs => { rs.typography = { ...rs.typography, allowedStyles: rs.typography.allowedStyles.filter(s => s !== style) }; return rs })
  }

  // Components helpers
  function addComponent() {
    if (!newComp.name.trim()) return
    const variants = newComp.variants.split(',').map(s => s.trim()).filter(Boolean)
    const sizes = newComp.sizes.split(',').map(s => s.trim()).filter(Boolean)
    update(rs => { rs.components = { ...rs.components, [newComp.name.trim()]: { variants, sizes } }; return rs })
    setNewComp({ name: '', variants: '', sizes: '' })
  }
  function removeComponent(name: string) {
    update(rs => { const c = { ...rs.components }; delete c[name]; rs.components = c; return rs })
  }

  // Layout helpers
  const gridCols = ruleset.layout?.allowedGridColumns || []
  function addGrid() {
    const n = parseInt(newGrid)
    if (isNaN(n)) return
    update(rs => { rs.layout = { ...rs.layout, allowedGridColumns: [...gridCols, n].sort((a, b) => a - b) }; return rs })
    setNewGrid('')
  }
  function removeGrid(val: number) {
    update(rs => { rs.layout = { ...rs.layout, allowedGridColumns: gridCols.filter(v => v !== val) }; return rs })
  }

  // Custom rules helpers
  function addCustomRule() {
    if (!newRule.title.trim()) return
    update(rs => { rs.custom_rules = [...rs.custom_rules, { ...newRule }]; return rs })
    setNewRule({ title: '', description: '', type: 'layout_pattern' })
  }
  function removeCustomRule(idx: number) {
    update(rs => { rs.custom_rules = rs.custom_rules.filter((_, i) => i !== idx); return rs })
  }

  const colorEntries = Object.entries(ruleset.tokens?.color || {})

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, minHeight: 500 }}>
      {/* Sidebar */}
      <div style={{ ...card(), display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 0' }}>
        <div style={{ ...lbl, padding: '0 16px' }}>RULESET</div>
        <div style={{ padding: '0 16px' }}>
          <input
            value={ruleset.name}
            onChange={e => update(rs => { rs.name = e.target.value; return rs })}
            style={{ ...inputStyle, fontSize: 13, fontFamily: syne, fontWeight: 600 }}
          />
        </div>

        {rulesets.length > 1 && (
          <div style={{ padding: '0 16px' }}>
            <select
              value={activeRulesetId}
              onChange={e => selectRuleset(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {rulesets.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                border: 'none', borderLeft: `3px solid ${section === s.id ? C.blue : 'transparent'}`,
                padding: '10px 16px', fontFamily: mono, fontSize: 11, color: section === s.id ? C.text : C.muted,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 16px' }}>
          <button onClick={save} disabled={saving} style={{ ...btnStyle(true), width: '100%', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'SAVING...' : saved ? 'SAVED' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={card()}>
        {/* Color Tokens */}
        {section === 'tokens' && (
          <div>
            <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Color Tokens</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 20 }}>Define your design system color palette. Violations are flagged when scanned artifacts use colors outside this set.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {colorEntries.map(([name, hex]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: C.surface2, borderRadius: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: hex as string, border: `1px solid ${C.border2}`, flexShrink: 0 }} />
                  <span style={{ fontFamily: mono, fontSize: 12, color: C.text, flex: 1 }}>{name}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{hex as string}</span>
                  <button onClick={() => removeColor(name)} style={removeBtn}>REMOVE</button>
                </div>
              ))}
              {!colorEntries.length && <div style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>No color tokens defined.</div>}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>NAME</div>
                <input value={newColor.name} onChange={e => setNewColor(p => ({ ...p, name: e.target.value }))} placeholder="e.g. primary" style={inputStyle} />
              </div>
              <div>
                <div style={lbl}>COLOR</div>
                <input type="color" value={newColor.value} onChange={e => setNewColor(p => ({ ...p, value: e.target.value }))} style={{ ...inputStyle, width: 48, height: 36, padding: 2, cursor: 'pointer' }} />
              </div>
              <button onClick={addColor} style={btnStyle(true)}>ADD</button>
            </div>
          </div>
        )}

        {/* Spacing Scale */}
        {section === 'spacing' && (
          <div>
            <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Spacing Scale</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 20 }}>Allowed spacing values (in px). Artifacts using values outside this scale will be flagged.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {spacingValues.map(val => {
                const maxVal = Math.max(...spacingValues, 1)
                return (
                  <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: C.surface2, borderRadius: 6 }}>
                    <div style={{ width: `${(val / maxVal) * 60}%`, minWidth: 4, height: 8, background: C.blue, borderRadius: 4, transition: 'width 0.3s' }} />
                    <span style={{ fontFamily: mono, fontSize: 12, color: C.text, minWidth: 40 }}>{val}px</span>
                    <button onClick={() => removeSpacing(val)} style={{ ...removeBtn, marginLeft: 'auto' }}>REMOVE</button>
                  </div>
                )
              })}
              {!spacingValues.length && <div style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>No spacing values defined.</div>}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>VALUE (px)</div>
                <input type="number" value={newSpacing} onChange={e => setNewSpacing(e.target.value)} placeholder="e.g. 8" style={inputStyle} />
              </div>
              <button onClick={addSpacing} style={btnStyle(true)}>ADD</button>
            </div>
          </div>
        )}

        {/* Typography */}
        {section === 'typography' && (
          <div>
            <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Typography</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 20 }}>Allowed typography styles. Scanned artifacts using unlisted styles will trigger violations.</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {ruleset.typography.allowedStyles.map(style => (
                <div key={style} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: C.surface2, borderRadius: 6, border: `1px solid ${C.border2}` }}>
                  <span style={{ fontFamily: syne, fontSize: 14, color: C.blue, fontWeight: 600 }}>Aa</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.text }}>{style}</span>
                  <button onClick={() => removeTypo(style)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontFamily: mono, fontSize: 12, padding: '0 2px' }}>x</button>
                </div>
              ))}
              {!ruleset.typography.allowedStyles.length && <div style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>No typography styles defined.</div>}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>STYLE NAME</div>
                <input value={newTypo} onChange={e => setNewTypo(e.target.value)} placeholder="e.g. heading-lg" style={inputStyle} />
              </div>
              <button onClick={addTypo} style={btnStyle(true)}>ADD</button>
            </div>
          </div>
        )}

        {/* Components */}
        {section === 'components' && (
          <div>
            <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Components</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 20 }}>Registered components with their allowed variants and sizes.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {Object.entries(ruleset.components || {}).map(([name, comp]) => (
                <div key={name} style={{ padding: '12px 16px', background: C.surface2, borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: syne, fontSize: 14, fontWeight: 600, color: C.text }}>{name}</span>
                    <button onClick={() => removeComponent(name)} style={removeBtn}>REMOVE</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    {(comp.variants || []).map(v => <span key={v} style={tag(C.blueDim, C.blue)}>{v}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(comp.sizes || []).map(s => <span key={s} style={tag(C.surface, C.muted)}>{s}</span>)}
                  </div>
                </div>
              ))}
              {!Object.keys(ruleset.components || {}).length && <div style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>No components defined.</div>}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={lbl}>NAME</div>
                <input value={newComp.name} onChange={e => setNewComp(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Button" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={lbl}>VARIANTS (comma-sep)</div>
                <input value={newComp.variants} onChange={e => setNewComp(p => ({ ...p, variants: e.target.value }))} placeholder="primary, secondary" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={lbl}>SIZES (comma-sep)</div>
                <input value={newComp.sizes} onChange={e => setNewComp(p => ({ ...p, sizes: e.target.value }))} placeholder="sm, md, lg" style={inputStyle} />
              </div>
              <button onClick={addComponent} style={btnStyle(true)}>ADD COMPONENT</button>
            </div>
          </div>
        )}

        {/* Layout */}
        {section === 'layout' && (
          <div>
            <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Layout</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 20 }}>Allowed grid column counts. Layouts using other column counts will be flagged.</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, marginBottom: 24 }}>
              {gridCols.map(col => (
                <div key={col} style={{ padding: '12px 10px', background: C.surface2, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginBottom: 8, height: 28 }}>
                    {Array.from({ length: col }).map((_, i) => (
                      <div key={i} style={{ width: Math.max(3, 24 / col), height: '100%', background: C.blue, borderRadius: 1, opacity: 0.7 }} />
                    ))}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: C.text, marginBottom: 6 }}>{col} col</div>
                  <button onClick={() => removeGrid(col)} style={{ ...removeBtn, fontSize: 9, padding: '2px 6px' }}>REMOVE</button>
                </div>
              ))}
              {!gridCols.length && <div style={{ fontFamily: mono, fontSize: 11, color: C.dim, gridColumn: '1/-1' }}>No grid columns defined.</div>}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>COLUMNS</div>
                <input type="number" value={newGrid} onChange={e => setNewGrid(e.target.value)} placeholder="e.g. 12" style={inputStyle} />
              </div>
              <button onClick={addGrid} style={btnStyle(true)}>ADD</button>
            </div>
          </div>
        )}

        {/* Custom Rules */}
        {section === 'custom' && (
          <div>
            <div style={{ fontFamily: syne, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Custom Rules</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 20 }}>Intent-based rules that capture design decisions beyond tokens and scales. These encode your team's design philosophy.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {!ruleset.custom_rules.length && (
                <div style={{
                  border: `2px dashed ${C.border2}`, borderRadius: 8, padding: '32px 20px', textAlign: 'center',
                  fontFamily: mono, fontSize: 11, color: C.dim,
                }}>
                  No custom rules yet. Add your first intent-based rule below.
                </div>
              )}
              {ruleset.custom_rules.map((rule, idx) => {
                const rtype = RULE_TYPES.find(r => r.id === rule.type)
                return (
                  <div key={idx} style={{ padding: '14px 16px', background: C.surface2, borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: syne, fontSize: 14, fontWeight: 600, color: C.text }}>{rule.title}</span>
                        <span style={tag(C.blueDim, C.blue)}>{rtype?.label || rule.type}</span>
                      </div>
                      <button onClick={() => removeCustomRule(idx)} style={removeBtn}>REMOVE</button>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{rule.description}</div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px', background: C.surface2, borderRadius: 8 }}>
              <div>
                <div style={lbl}>TYPE</div>
                <select value={newRule.type} onChange={e => setNewRule(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {RULE_TYPES.map(rt => <option key={rt.id} value={rt.id}>{rt.label} - e.g. {rt.eg}</option>)}
                </select>
              </div>
              <div>
                <div style={lbl}>TITLE</div>
                <input value={newRule.title} onChange={e => setNewRule(p => ({ ...p, title: e.target.value }))} placeholder="e.g. No modals on mobile" style={inputStyle} />
              </div>
              <div>
                <div style={lbl}>DESCRIPTION</div>
                <textarea
                  value={newRule.description}
                  onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the design intent behind this rule..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <button onClick={addCustomRule} style={{ ...btnStyle(true), alignSelf: 'flex-start' }}>ADD RULE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
