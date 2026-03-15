import { FastifyInstance } from 'fastify'
import { createAdminClient } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'

export default async function (fastify: FastifyInstance) {
  // GET /analytics/drift
  fastify.get('/analytics/drift', { preHandler: authMiddleware }, async (request, reply) => {
    const supabase = createAdminClient()

    // Fetch all scans for the workspace
    const { data: scans, error: scansError } = await supabase
      .from('scans')
      .select('id, artifact_name, health_score, violation_count, high_count, medium_count, low_count, created_at')
      .eq('workspace_id', request.workspaceId)
      .order('created_at', { ascending: true })

    if (scansError) {
      return reply.code(500).send({ error: scansError.message })
    }

    if (!scans || scans.length === 0) {
      return []
    }

    // Fetch violation type breakdowns for all scans in the workspace
    const scanIds = scans.map((s) => s.id)

    const { data: violations, error: violationsError } = await supabase
      .from('violations')
      .select('scan_id, type')
      .in('scan_id', scanIds)

    if (violationsError) {
      return reply.code(500).send({ error: violationsError.message })
    }

    // Build type counts per scan
    const typeCountsByScan: Record<string, Record<string, number>> = {}
    for (const v of violations || []) {
      if (!typeCountsByScan[v.scan_id]) {
        typeCountsByScan[v.scan_id] = {}
      }
      typeCountsByScan[v.scan_id][v.type] = (typeCountsByScan[v.scan_id][v.type] || 0) + 1
    }

    const result = scans.map((scan) => ({
      scan_id: scan.id,
      artifact_name: scan.artifact_name,
      health_score: scan.health_score,
      violation_count: scan.violation_count,
      high_count: scan.high_count,
      medium_count: scan.medium_count,
      low_count: scan.low_count,
      created_at: scan.created_at,
      by_type: typeCountsByScan[scan.id] || {},
    }))

    return result
  })
}
