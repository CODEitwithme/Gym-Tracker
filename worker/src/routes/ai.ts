import type { ApiError, ApiResponse, Env, ParsedMeal, ParsedWorkout, StoredCredential } from '../types'
import { decrypt } from '../encryption'
import { callGemini, callGeminiMeal, GeminiApiError } from '../geminiAdapter'
import type { RateLimiter } from '../rateLimit'

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

async function getDecryptedApiKey(deviceToken: string, env: Env): Promise<string | null> {
  const storedJson = await env.CREDENTIAL_STORE.get(`cred:${deviceToken}`)
  if (!storedJson) return null
  try {
    const stored = JSON.parse(storedJson) as StoredCredential
    return await decrypt(env.MASTER_ENCRYPTION_KEY, stored)
  } catch {
    return null
  }
}

export async function handleTestConnection(
  deviceToken: string,
  env: Env,
  rateLimiter: RateLimiter
): Promise<Response> {
  if (!(await rateLimiter.check(deviceToken, env.CREDENTIAL_STORE))) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
      429
    )
  }

  const apiKey = await getDecryptedApiKey(deviceToken, env)
  if (!apiKey) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'No credentials configured', code: 'NO_CREDENTIALS' },
      404
    )
  }

  try {
    await callGemini(apiKey, 'I did 3 sets of 10 bench press at 60kg')
    return jsonResponse<ApiResponse<{ provider: 'gemini'; message: string }>>({
      ok: true,
      data: {
        provider: 'gemini',
        message: 'Connection successful',
      },
    })
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) {
      return jsonResponse<ApiError>(
        { ok: false, error: err.message, code: err.code },
        400
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown provider error'
    return jsonResponse<ApiError>(
      { ok: false, error: message, code: 'PROVIDER_ERROR' },
      400
    )
  }
}

export async function handleParseWorkout(
  deviceToken: string,
  body: unknown,
  env: Env,
  rateLimiter: RateLimiter
): Promise<Response> {
  if (!(await rateLimiter.check(deviceToken, env.CREDENTIAL_STORE))) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
      429
    )
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'Request body must be a JSON object', code: 'INVALID_BODY' },
      400
    )
  }

  const b = body as Record<string, unknown>
  if (
    typeof b.message !== 'string' ||
    b.message.trim().length === 0 ||
    b.message.length > 2000
  ) {
    return jsonResponse<ApiError>(
      {
        ok: false,
        error: 'Message must be a string between 1 and 2000 characters',
        code: 'INVALID_MESSAGE',
      },
      400
    )
  }

  const apiKey = await getDecryptedApiKey(deviceToken, env)
  if (!apiKey) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'No credentials configured', code: 'NO_CREDENTIALS' },
      404
    )
  }

  try {
    const parsed = await callGemini(apiKey, b.message.trim())
    return jsonResponse<ApiResponse<ParsedWorkout>>({
      ok: true,
      data: parsed,
    })
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) {
      return jsonResponse<ApiError>(
        { ok: false, error: err.message, code: err.code },
        400
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown provider error'
    return jsonResponse<ApiError>(
      { ok: false, error: message, code: 'PROVIDER_ERROR' },
      400
    )
  }
}

export async function handleParseMeal(
  deviceToken: string,
  body: unknown,
  env: Env,
  rateLimiter: RateLimiter
): Promise<Response> {
  if (!(await rateLimiter.check(deviceToken, env.CREDENTIAL_STORE))) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
      429
    )
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'Request body must be a JSON object', code: 'INVALID_BODY' },
      400
    )
  }

  const b = body as Record<string, unknown>
  if (
    typeof b.message !== 'string' ||
    b.message.trim().length === 0 ||
    b.message.length > 2000
  ) {
    return jsonResponse<ApiError>(
      {
        ok: false,
        error: 'Message must be a string between 1 and 2000 characters',
        code: 'INVALID_MESSAGE',
      },
      400
    )
  }

  const apiKey = await getDecryptedApiKey(deviceToken, env)
  if (!apiKey) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'No credentials configured', code: 'NO_CREDENTIALS' },
      404
    )
  }

  try {
    const parsed = await callGeminiMeal(apiKey, b.message.trim())
    return jsonResponse<ApiResponse<ParsedMeal>>({
      ok: true,
      data: parsed,
    })
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) {
      return jsonResponse<ApiError>(
        { ok: false, error: err.message, code: err.code },
        400
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown provider error'
    return jsonResponse<ApiError>(
      { ok: false, error: message, code: 'PROVIDER_ERROR' },
      400
    )
  }
}
