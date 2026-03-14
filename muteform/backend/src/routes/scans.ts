import { FastifyInstance } from 'fastify'
import { createAdminClient } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'
import { scanArtifact } from '../core/scanner'
import type { Artifact, Ruleset } from '../core/scanner'

export default async function (fastify: FastifyInstance) {
  // POST /scan
  fastify.post('/scan', { preHandler: authMiddleware }, async (request, reply) => {
    const { artifact_json, ruleset_id } = request.body as {
      artifact_json: any
      ruleset_id: string
    }

    const supabase = createAdminClient()

    // 1. Fetch ruleset
    const { data: ruleset, error: rulesetError } = await supabase
      .from('rulesets')
      .select('*')
      .eq('id', ruleset_id)
      .eq('workspace_id', request.workspaceId)
      .single()

    if (rulesetError || !ruleset) {
      return reply.code(404).send({ error: 'Ruleset not found' })
    }

    // 2. Insert artifact
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: request.workspaceId,
        name: artifact_json.name || 'Untitled',
        source: artifact_json.source || 'upload',
        artifact_json,
      })
      .select()
      .single()

    if (artifactError || !artifact) {
      return reply.code(500).send({ error: 'Failed to save artifact' })
    }

    // 3. Run scanner
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

    // 4. Insert scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        workspace_id: request.workspaceId,
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

    // 5. Insert violations
    if (result.violations.length > 0) {
      const violationRows = result.violations.map((v) => ({
        scan_id: scan.id,
        workspace_id: request.workspaceId,
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

      const { error: violationsError } = await supabase
        .from('violations')
        .insert(violationRows)

      if (violationsError) {
        return reply.code(500).send({ error: 'Failed to save violations' })
      }
    }

    // 6. Return scan + violations
    const { data: savedViolations } = await supabase
      .from('violations')
      .select('*')
      .eq('scan_id', scan.id)

    return reply.code(201).send({ scan, violations: savedViolations || [] })
  })

  // GET /scans
  fastify.get('/scans', { preHandler: authMiddleware }, async (request, reply) => {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('workspace_id', request.workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    return data
  })

  // GET /scans/:id
  fastify.get('/scans/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const supabase = createAdminClient()

    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', request.workspaceId)
      .single()

    if (scanError || !scan) {
      return reply.code(404).send({ error: 'Scan not found' })
    }

    const { data: violations } = await supabase
      .from('violations')
      .select('*')
      .eq('scan_id', scan.id)

    return { scan, violations: violations || [] }
  })
}
