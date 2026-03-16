// ─── Session Store ───────────────────────────────────────────
// Persists user identity, imported system, rules, scan results,
// and MCP token across page refreshes via localStorage.
// Also syncs to Supabase for data collection.

import { createClient } from './supabase'

// ─── Types ───────────────────────────────────────────────────
export interface UserProfile {
  id?: string          // Supabase row ID (set after first save)
  name: string
  company: string
  createdAt: string
}

export interface SessionData {
  user: UserProfile | null
  mcpToken: string | null
  lastScanFixture: string | null  // fixture id
  completedSteps: number[]        // [0,1,2,3] = import,rules,scan,report
}

// ─── Keys ────────────────────────────────────────────────────
const SESSION_KEY = 'muteform_session'
const SCAN_RESULT_KEY = 'muteform_last_scan'
const REPORT_KEY = 'muteform_last_report'

// ─── Session CRUD ────────────────────────────────────────────
export function loadSession(): SessionData {
  if (typeof window === 'undefined') return defaultSession()
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : defaultSession()
  } catch { return defaultSession() }
}

export function saveSession(s: SessionData): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  }
}

export function defaultSession(): SessionData {
  return { user: null, mcpToken: null, lastScanFixture: null, completedSteps: [] }
}

export function markStepComplete(step: number): void {
  const s = loadSession()
  if (!s.completedSteps.includes(step)) {
    s.completedSteps.push(step)
    saveSession(s)
  }
}

export function hasCompletedStep(step: number): boolean {
  return loadSession().completedSteps.includes(step)
}

// ─── Scan result persistence ─────────────────────────────────
export function saveScanResult(data: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SCAN_RESULT_KEY, JSON.stringify(data))
  }
}

export function loadScanResult(): any | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SCAN_RESULT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveReport(data: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REPORT_KEY, JSON.stringify(data))
  }
}

export function loadReport(): any | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(REPORT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ─── MCP Token ───────────────────────────────────────────────
export function generateMcpToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let r = ''
  for (let i = 0; i < 24; i++) r += chars[Math.floor(Math.random() * chars.length)]
  return 'mf_beta_' + r
}

export function getOrCreateMcpToken(): string {
  const s = loadSession()
  if (s.mcpToken) return s.mcpToken
  const token = generateMcpToken()
  s.mcpToken = token
  saveSession(s)
  return token
}

// ─── Supabase sync ───────────────────────────────────────────
// These are fire-and-forget — if Supabase is unreachable we still work offline.

export async function syncUserToSupabase(user: UserProfile): Promise<string | null> {
  try {
    const sb = createClient()
    const { data, error } = await sb.from('beta_testers').insert({
      name: user.name,
      company: user.company,
      created_at: user.createdAt,
      source: 'web-app',
    }).select('id').single()
    if (error) {
      // Try upsert if duplicate
      const { data: existing } = await sb.from('beta_testers')
        .select('id')
        .eq('name', user.name)
        .eq('company', user.company)
        .limit(1)
        .single()
      return existing?.id ?? null
    }
    return data?.id ?? null
  } catch { return null }
}

export async function syncScanReport(testerId: string | null, report: any): Promise<void> {
  try {
    const sb = createClient()
    await sb.from('scan_reports').insert({
      tester_id: testerId,
      fixture_name: report.fixtureName || report.fixture_name || 'unknown',
      ai_source: report.fixtureSource || report.ai_source || 'unknown',
      score_before: report.overallScore ?? report.score_before ?? 0,
      score_after: report.afterScore ?? report.score_after ?? 0,
      violations_total: report.violations?.length ?? report.violations_total ?? 0,
      auto_fixed: report.autoFixedCount ?? report.auto_fixed ?? 0,
      warnings: report.warningCount ?? report.warnings ?? 0,
      blocked: report.blockedCount ?? report.blocked ?? 0,
      report_json: JSON.stringify(report),
      created_at: new Date().toISOString(),
    })
  } catch { /* fire and forget */ }
}

export async function syncCustomRule(testerId: string | null, rule: any): Promise<void> {
  try {
    const sb = createClient()
    await sb.from('custom_rules').insert({
      tester_id: testerId,
      rule_name: rule.name,
      category: rule.category || 'general',
      severity: rule.severity,
      auto_fix: rule.autoFix ?? false,
      description: rule.description,
      created_at: new Date().toISOString(),
    })
  } catch { /* fire and forget */ }
}

export async function syncMcpCall(token: string): Promise<void> {
  try {
    const sb = createClient()
    await sb.from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token)
  } catch { /* fire and forget */ }
}

export async function syncMcpToken(testerId: string | null, token: string): Promise<void> {
  try {
    const sb = createClient()
    await sb.from('mcp_tokens').upsert({
      tester_id: testerId,
      token,
      created_at: new Date().toISOString(),
      last_used_at: null,
      call_count: 0,
    }, { onConflict: 'token' })
  } catch { /* fire and forget */ }
}

export async function syncWaitlistEmail(email: string): Promise<void> {
  try {
    const sb = createClient()
    await sb.from('waitlist').insert({
      email,
      created_at: new Date().toISOString(),
    })
  } catch { /* fire and forget */ }
}

export async function syncImportedSystem(testerId: string | null, ds: any): Promise<void> {
  try {
    const sb = createClient()
    await sb.from('imported_systems').insert({
      tester_id: testerId,
      source_type: ds.source,
      system_name: ds.sourceLabel,
      tokens_json: JSON.stringify(ds.tokens),
      rules_json: JSON.stringify(ds.customRules || []),
      created_at: new Date().toISOString(),
    })
  } catch { /* fire and forget */ }
}
