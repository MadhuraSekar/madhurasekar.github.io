import { FastifyInstance } from 'fastify'
import { createAdminClient } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'

export default async function (fastify: FastifyInstance) {
  // POST /auth/signup
  fastify.post('/signup', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      return reply.code(400).send({ error: error.message })
    }

    return { user: data.user, session: data.session }
  })

  // POST /auth/signin
  fastify.post('/signin', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return reply.code(401).send({ error: error.message })
    }

    return { user: data.user, session: data.session }
  })

  // GET /auth/me
  fastify.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    const supabase = createAdminClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, workspace_id, email, display_name, created_at')
      .eq('id', request.userId)
      .single()

    if (profileError || !profile) {
      return reply.code(404).send({ error: 'Profile not found' })
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .eq('id', profile.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return reply.code(404).send({ error: 'Workspace not found' })
    }

    return { profile, workspace }
  })
}
