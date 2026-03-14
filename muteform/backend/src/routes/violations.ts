import { FastifyInstance } from 'fastify'
import { createAdminClient } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'

export default async function (fastify: FastifyInstance) {
  // PATCH /violations/:id
  fastify.patch('/violations/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }

    if (!['open', 'ignored', 'fixed'].includes(status)) {
      return reply.code(400).send({ error: 'Status must be one of: open, ignored, fixed' })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('violations')
      .update({ status })
      .eq('id', id)
      .eq('workspace_id', request.workspaceId)
      .select()
      .single()

    if (error || !data) {
      return reply.code(404).send({ error: 'Violation not found' })
    }

    return data
  })
}
