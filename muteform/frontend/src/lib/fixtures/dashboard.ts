// ─── SaaS Dashboard Fixture ──────────────────────────────────
// ~17 nodes. Deliberate violations:
//   - 2 off-token colors (#2563eb, #e74c3c)
//   - 2 off-scale spacings (18px, 30px)
//   - 1 unapproved typography family (Helvetica)
//   - 1 layout grid violation (10 columns — not in [4, 8, 12])
//   - 1 low-contrast text pair
// Expected: score ~30-45 before governance, 90-100 after fixes.
import type { InterfaceDefinition } from '../engine/types'

export const SAAS_DASHBOARD: InterfaceDefinition = {
  nodes: [
    {
      id: 'dash-sidebar',
      type: 'container',
      path: 'Dashboard > Sidebar',
      properties: {
        colors: { 'background-color': '#111111', color: '#f0f1f3' },
        spacing: { padding: 16 },
        layout: { display: 'flex', columns: 4 },
      },
    },
    {
      id: 'dash-sidebar-logo',
      type: 'element',
      path: 'Dashboard > Sidebar > Logo',
      properties: {
        colors: { color: '#0055FF' },
        typography: { family: 'DM Sans', size: 18, weight: 700 },
      },
    },
    {
      id: 'dash-sidebar-nav',
      type: 'container',
      path: 'Dashboard > Sidebar > NavLinks',
      properties: {
        colors: { color: '#9ca3af' },
        spacing: { padding: 8, gap: 4 },
        typography: { family: 'DM Sans', size: 13, weight: 500 },
      },
    },
    {
      id: 'dash-topbar',
      type: 'container',
      path: 'Dashboard > TopBar',
      properties: {
        colors: { 'background-color': '#111111', color: '#f0f1f3' },
        spacing: { padding: 16, gap: 12 },
      },
    },
    {
      id: 'dash-search',
      type: 'interactive',
      path: 'Dashboard > TopBar > Search',
      properties: {
        colors: { color: '#f0f1f3', 'background-color': '#111111', 'border-color': '#0055FF' },
        spacing: { padding: 8 },
        typography: { family: 'DM Sans', size: 14, weight: 400 },
      },
    },
    {
      id: 'dash-stat-card-1',
      type: 'container',
      path: 'Dashboard > StatsRow > Revenue',
      properties: {
        colors: { 'background-color': '#111111', color: '#f0f1f3' },
        spacing: { padding: 24, gap: 8 },
        typography: { family: 'Helvetica', size: 32, weight: 700 },
      },
    },
    {
      id: 'dash-stat-card-2',
      type: 'container',
      path: 'Dashboard > StatsRow > Users',
      properties: {
        colors: { 'background-color': '#111111', color: '#f0f1f3' },
        spacing: { padding: 24, gap: 8 },
        typography: { family: 'DM Sans', size: 32, weight: 700 },
      },
    },
    {
      id: 'dash-stat-card-3',
      type: 'container',
      path: 'Dashboard > StatsRow > Conversion',
      properties: {
        colors: { 'background-color': '#111111', color: '#22c55e' },
        spacing: { padding: 24, gap: 8 },
        typography: { family: 'DM Sans', size: 32, weight: 700 },
      },
    },
    {
      id: 'dash-stat-card-4',
      type: 'container',
      path: 'Dashboard > StatsRow > Churn',
      properties: {
        colors: { 'background-color': '#111111', color: '#e74c3c' },
        spacing: { padding: 18, gap: 8 },
        typography: { family: 'DM Sans', size: 32, weight: 700 },
      },
    },
    {
      id: 'dash-chart-container',
      type: 'container',
      path: 'Dashboard > ChartSection',
      properties: {
        colors: { 'background-color': '#111111' },
        spacing: { padding: 24, gap: 16 },
        layout: { display: 'grid', columns: 10 },
      },
    },
    {
      id: 'dash-chart-title',
      type: 'text',
      path: 'Dashboard > ChartSection > Title',
      properties: {
        colors: { color: '#f0f1f3' },
        typography: { family: 'DM Sans', size: 16, weight: 600 },
        spacing: { margin: 8 },
      },
    },
    {
      id: 'dash-chart-legend',
      type: 'text',
      path: 'Dashboard > ChartSection > Legend',
      properties: {
        colors: { color: '#555555', 'background-color': '#6a6a6a' },
        contrast: { foreground: '#555555', background: '#6a6a6a' },
        typography: { family: 'DM Sans', size: 11, weight: 400 },
      },
    },
    {
      id: 'dash-table',
      type: 'container',
      path: 'Dashboard > DataTable',
      properties: {
        colors: { 'background-color': '#111111' },
        spacing: { padding: 16, gap: 4 },
        layout: { display: 'grid', columns: 12 },
      },
    },
    {
      id: 'dash-table-header',
      type: 'text',
      path: 'Dashboard > DataTable > Header',
      properties: {
        colors: { color: '#9ca3af', 'background-color': '#111111' },
        typography: { family: 'DM Sans', size: 11, weight: 600 },
        spacing: { padding: 8 },
      },
    },
    {
      id: 'dash-table-row',
      type: 'text',
      path: 'Dashboard > DataTable > Row',
      properties: {
        colors: { color: '#f0f1f3' },
        typography: { family: 'DM Sans', size: 13, weight: 400 },
        spacing: { padding: 8, gap: 30 },
      },
    },
    {
      id: 'dash-action-primary',
      type: 'interactive',
      path: 'Dashboard > Actions > ExportBtn',
      properties: {
        colors: { color: '#ffffff', 'background-color': '#2563eb' },
        spacing: { padding: 12 },
        typography: { family: 'DM Sans', size: 14, weight: 600 },
        component: { name: 'button', variant: 'primary' },
      },
    },
    {
      id: 'dash-action-secondary',
      type: 'interactive',
      path: 'Dashboard > Actions > FilterBtn',
      properties: {
        colors: { color: '#f0f1f3', 'background-color': '#111111' },
        spacing: { padding: 12 },
        typography: { family: 'DM Sans', size: 14, weight: 500 },
        component: { name: 'button', variant: 'secondary' },
      },
    },
  ],
  metadata: {
    source: 'ai-generated',
    platform: 'web',
    generatedAt: new Date().toISOString(),
    agentId: 'claude-sonnet-4-20250514',
  },
}

export const DASHBOARD_WIREFRAME = [
  { id: 'dash-sidebar', label: 'Sidebar', x: 0, y: 0, w: 18, h: 100, color: '#111111' },
  { id: 'dash-sidebar-logo', label: 'Logo', x: 2, y: 2, w: 14, h: 5, color: '#0055FF' },
  { id: 'dash-sidebar-nav', label: 'Nav', x: 2, y: 10, w: 14, h: 40, color: '#161819' },
  { id: 'dash-topbar', label: 'Top Bar', x: 18, y: 0, w: 82, h: 7, color: '#111111' },
  { id: 'dash-search', label: 'Search', x: 20, y: 1.5, w: 30, h: 4, color: '#161819' },
  { id: 'dash-stat-card-1', label: 'Revenue', x: 20, y: 10, w: 18, h: 12, color: '#111111' },
  { id: 'dash-stat-card-2', label: 'Users', x: 40, y: 10, w: 18, h: 12, color: '#111111' },
  { id: 'dash-stat-card-3', label: 'Conv.', x: 60, y: 10, w: 18, h: 12, color: '#111111' },
  { id: 'dash-stat-card-4', label: 'Churn', x: 80, y: 10, w: 18, h: 12, color: '#e74c3c' },
  { id: 'dash-chart-container', label: 'Chart', x: 20, y: 26, w: 58, h: 30, color: '#111111' },
  { id: 'dash-chart-legend', label: 'Legend', x: 80, y: 26, w: 18, h: 10, color: '#161819' },
  { id: 'dash-table', label: 'Table', x: 20, y: 60, w: 78, h: 28, color: '#111111' },
  { id: 'dash-table-header', label: 'TH', x: 20, y: 60, w: 78, h: 4, color: '#161819' },
  { id: 'dash-action-primary', label: 'Export', x: 82, y: 92, w: 8, h: 5, color: '#2563eb' },
  { id: 'dash-action-secondary', label: 'Filter', x: 72, y: 92, w: 8, h: 5, color: '#161819' },
]
