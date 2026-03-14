import { FastifyInstance } from 'fastify'
import { createAdminClient } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'

export default async function (fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // GET /rulesets
  fastify.get('/', async (request, reply) => {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('workspace_id', request.workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    return data
  })

  // POST /rulesets
  fastify.post('/', async (request, reply) => {
    const { name, tokens, typography, components, layout, custom_rules } = request.body as {
      name: string
      tokens?: any
      typography?: any
      components?: any
      layout?: any
      custom_rules?: any
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('rulesets')
      .insert({
        workspace_id: request.workspaceId,
        name,
        tokens: tokens || {},
        typography: typography || {},
        components: components || {},
        layout: layout || {},
        custom_rules: custom_rules || [],
      })
      .select()
      .single()

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    return reply.code(201).send(data)
  })

  // PUT /rulesets/:id
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { name, tokens, typography, components, layout, custom_rules } = request.body as {
      name?: string
      tokens?: any
      typography?: any
      components?: any
      layout?: any
      custom_rules?: any
    }

    const supabase = createAdminClient()

    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name
    if (tokens !== undefined) updates.tokens = tokens
    if (typography !== undefined) updates.typography = typography
    if (components !== undefined) updates.components = components
    if (layout !== undefined) updates.layout = layout
    if (custom_rules !== undefined) updates.custom_rules = custom_rules

    const { data, error } = await supabase
      .from('rulesets')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', request.workspaceId)
      .select()
      .single()

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    if (!data) {
      return reply.code(404).send({ error: 'Ruleset not found' })
    }

    return data
  })

  // DELETE /rulesets/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('rulesets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', request.workspaceId)

    if (error) {
      return reply.code(500).send({ error: error.message })
    }

    return reply.code(204).send()
  })

  // GET /rulesets/:id/export
  fastify.get('/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', request.workspaceId)
      .single()

    if (error || !data) {
      return reply.code(404).send({ error: 'Ruleset not found' })
    }

    const filename = `${data.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(data)
  })
}
