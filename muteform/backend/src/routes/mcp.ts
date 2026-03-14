import { randomBytes } from 'crypto'
import { FastifyInstance } from 'fastify'
import { createAdminClient } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'
import { scanArtifact } from '../core/scanner'
import type { Artifact, Ruleset } from '../core/scanner'

export default async function (fastify: FastifyInstance) {
  // POST /v1/validate — MCP token auth
  fastify.post('/v1/validate', async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing MCP token' })
    }

    const token = authHeader.slice(7)
    const supabase = createAdminClient()

    // Look up MCP token
    const { data: mcpToken, error: tokenError } = await supabase
      .from('mcp_tokens')
      .select('id, workspace_id, ruleset_id')
      .eq('token', token)
      .single()

    if (tokenError || !mcpToken) {
      return reply.code(401).send({ error: 'Invalid MCP token' })
    }

    // Fetch ruleset
    const { data: ruleset, error: rulesetError } = await supabase
      .from('rulesets')
      .select('*')
      .eq('id', mcpToken.ruleset_id)
      .eq('workspace_id', mcpToken.workspace_id)
      .single()

    if (rulesetError || !ruleset) {
      return reply.code(404).send({ error: 'Linked ruleset not found' })
    }

    const { artifact_json } = request.body as { artifact_json: any }

    // Insert artifact
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: mcpToken.workspace_id,
        name: artifact_json.name || 'Untitled',
        source: artifact_json.source || 'mcp',
        artifact_json,
      })
      .select()
      .single()

    if (artifactError || !artifact) {
      return reply.code(500).send({ error: 'Failed to save artifact' })
    }

    // Run scanner
    const artifactInput: Artifact = {
      id: artifact.id,
      name: artifact_json.name,
      source: artifact_json.source,
      nodes: artifact_json.nodes || [],
    }

    const rulesetInput: Ruleset = {
      id: ruleset.id,
      name: ruleset.name,
      tokens: ruleset.tokens || {},
      typography: ruleset.typography,
      components: ruleset.components,
      layout: ruleset.layout,
      custom_rules: ruleset.custom_rules,
    }

    const result = scanArtifact(artifactInput, rulesetInput)

    // Insert scan
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        workspace_id: mcpToken.workspace_id,
        artifact_id: artifact.id,
        ruleset_id: ruleset.id,
        artifact_name: artifact_json.name || 'Untitled',
        ruleset_name: ruleset.name,
        health_score: result.health_score,
        violation_count: result.violation_count,
        high_count: result.high_count,
        medium_count: result.medium_count,
        low_count: result.low_count,
      })
      .select()
      .single()

    if (scanError || !scan) {
      return reply.code(500).send({ error: 'Failed to save scan' })
    }

    // Insert violations
    if (result.violations.length > 0) {
      const violationRows = result.violations.map((v) => ({
        scan_id: scan.id,
        workspace_id: mcpToken.workspace_id,
        type: v.type,
        severity: v.severity,
        node_id: v.node_id,
        node_name: v.node_name,
        node_path: v.node_path,
        message: v.message,
        confidence: v.confidence,
        preview_type: v.preview_type,
        current_preview: v.current_preview,
        suggested_preview: v.suggested_preview,
        suggested_fix: v.suggested_fix,
        status: 'open',
      }))

      await supabase.from('violations').insert(violationRows)
    }

    // Update last_used_at
    await supabase
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', mcpToken.id)

    // Return scan result
    const { data: savedViolations } = await supabase
      .from('violations')
      .select('*')
      .eq('scan_id', scan.id)

    return reply.code(201).send({ scan, violations: savedViolations || [] })
  })

  // GET /v1/ruleset — MCP token auth
  fastify.get('/v1/ruleset', async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing MCP token' })
    }

    const token = authHeader.slice(7)
    const supabase = createAdminClient()

    const { data: mcpToken, error: tokenError } = await supabase
      .from('mcp_tokens')
      .select('workspace_id, ruleset_id')
      .eq('token', token)
      .single()

    if (tokenError || !mcpToken) {
      return reply.code(401).send({ error: 'Invalid MCP token' })
    }

    const { data: ruleset, error: rulesetError } = await supabase
      .from('rulesets')
      .select('*')
      .eq('id', mcpToken.ruleset_id)
      .eq('workspace_id', mcpToken.workspace_id)
      .single()

    if (rulesetError || !ruleset) {
      return reply.code(404).send({ error: 'Linked ruleset not found' })
    }

    return ruleset
  })

  // GET /mcp-tokens — Supabase JWT auth
  fastify.get('/mcp-tokens', { preHandler: authMiddleware }, async (request, reply) => {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('mcp_tokens')
      .select('id, workspace_id, ruleset_id, name, last_used_at, created_at')
      .eq('workspace_id', request.workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    return data
  })

  // POST /mcp-tokens — Supabase JWT auth
  fastify.post('/mcp-tokens', { preHandler: authMiddleware }, async (request, reply) => {
    const { ruleset_id, name } = request.body as { ruleset_id: string; name: string }

    const supabase = createAdminClient()

    // Verify ruleset belongs to workspace
    const { data: ruleset } = await supabase
      .from('rulesets')
      .select('id')
      .eq('id', ruleset_id)
      .eq('workspace_id', request.workspaceId)
      .single()

    if (!ruleset) {
      return reply.code(404).send({ error: 'Ruleset not found' })
    }

    const token = 'mf_live_' + randomBytes(16).toString('hex')

    const { data, error } = await supabase
      .from('mcp_tokens')
      .insert({
        workspace_id: request.workspaceId,
        ruleset_id,
        token,
        name,
      })
      .select()
      .single()

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    return reply.code(201).send(data)
  })

  // DELETE /mcp-tokens/:id — Supabase JWT auth
  fastify.delete('/mcp-tokens/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('mcp_tokens')
      .delete()
      .eq('id', id)
      .eq('workspace_id', request.workspaceId)

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    return reply.code(204).send()
  })
}
