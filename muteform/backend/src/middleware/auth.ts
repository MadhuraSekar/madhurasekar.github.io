import { FastifyRequest, FastifyReply } from 'fastify'
import { createAdminClient } from '../lib/supabase'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    userEmail: string
    workspaceId: string
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing authorization token' })
  }

  const token = authHeader.slice(7)
  const supabase = createAdminClient()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return reply.code(401).send({ error: 'Invalid token' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return reply.code(401).send({ error: 'Profile not found' })
  }

  request.userId = user.id
  request.userEmail = user.email || ''
  request.workspaceId = profile.workspace_id
}
