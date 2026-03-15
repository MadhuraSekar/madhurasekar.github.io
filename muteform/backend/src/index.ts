import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import authRoutes from './routes/auth'
import rulesetsRoutes from './routes/rulesets'
import scansRoutes from './routes/scans'
import violationsRoutes from './routes/violations'
import mcpRoutes from './routes/mcp'
import analyticsRoutes from './routes/analytics'

const PORT = parseInt(process.env.PORT || '3001', 10)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

async function start() {
  const fastify = Fastify({ logger: true })

  await fastify.register(cors, {
    origin: [FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  })

  await fastify.register(sensible)

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Register routes
  await fastify.register(authRoutes, { prefix: '/auth' })
  await fastify.register(rulesetsRoutes, { prefix: '/rulesets' })
  await fastify.register(scansRoutes)
  await fastify.register(violationsRoutes)
  await fastify.register(mcpRoutes)
  await fastify.register(analyticsRoutes)

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`Muteform API running on port ${PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
