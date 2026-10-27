import { AutoRouter } from 'itty-router'
import type { Env } from './types'
import { addCors, preflight } from './cors'
import { RateLimiter } from './rateLimit'
import {
  handleGetCredentials,
  handlePutCredentials,
  handleDeleteCredentials,
} from './routes/credentials'
import {
  handleTestConnection,
  handleParseWorkout,
  handleParseMeal,
} from './routes/ai'

export const aiRateLimiter = new RateLimiter(10, 60 * 1000)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function getDeviceToken(request: Request): { deviceToken: string } | Response {
  const token = request.headers.get('X-Device-Token')
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Device token required', code: 'MISSING_TOKEN' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  if (!UUID_REGEX.test(token)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid device token format', code: 'INVALID_TOKEN' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  return { deviceToken: token }
}

export const router = AutoRouter()

router.options('*', (request: Request, env: Env) => {
  const origin = request.headers.get('Origin') ?? ''
  return preflight(origin, env?.ALLOWED_ORIGIN || 'http://localhost:5173')
})

router.get('/api/settings/ai-credentials', async (request: Request, env: Env) => {
  const auth = getDeviceToken(request)
  if (auth instanceof Response) return auth
  return handleGetCredentials(auth.deviceToken, env)
})

router.put('/api/settings/ai-credentials', async (request: Request, env: Env) => {
  const auth = getDeviceToken(request)
  if (auth instanceof Response) return auth
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON body', code: 'INVALID_BODY' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  return handlePutCredentials(auth.deviceToken, body, env)
})

router.delete('/api/settings/ai-credentials', async (request: Request, env: Env) => {
  const auth = getDeviceToken(request)
  if (auth instanceof Response) return auth
  return handleDeleteCredentials(auth.deviceToken, env)
})

router.post('/api/ai/test-connection', async (request: Request, env: Env) => {
  const auth = getDeviceToken(request)
  if (auth instanceof Response) return auth
  return handleTestConnection(auth.deviceToken, env, aiRateLimiter)
})

router.post('/api/ai/parse-workout', async (request: Request, env: Env) => {
  const auth = getDeviceToken(request)
  if (auth instanceof Response) return auth
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON body', code: 'INVALID_BODY' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  return handleParseWorkout(auth.deviceToken, body, env, aiRateLimiter)
})

router.post('/api/ai/parse-meal', async (request: Request, env: Env) => {
  const auth = getDeviceToken(request)
  if (auth instanceof Response) return auth
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON body', code: 'INVALID_BODY' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  return handleParseMeal(auth.deviceToken, body, env, aiRateLimiter)
})

const worker = {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''
    const allowedOrigin = env?.ALLOWED_ORIGIN || 'http://localhost:5173'

    if (request.method === 'OPTIONS') {
      return preflight(origin, allowedOrigin)
    }

    try {
      const response = await router.fetch(request, env, ctx)
      if (!response) {
        return addCors(
          new Response(
            JSON.stringify({ ok: false, error: 'Not Found', code: 'NOT_FOUND' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          ),
          origin,
          allowedOrigin
        )
      }
      return addCors(response, origin, allowedOrigin)
    } catch {
      // NEVER log env.MASTER_ENCRYPTION_KEY or decrypted keys
      return addCors(
        new Response(
          JSON.stringify({ ok: false, error: 'Internal Server Error', code: 'INTERNAL_ERROR' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
        origin,
        allowedOrigin
      )
    }
  },
}

export default worker
