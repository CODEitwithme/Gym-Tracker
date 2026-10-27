import type { ApiError, ApiResponse, Env, StoredCredential } from '../types'
import { encrypt } from '../encryption'

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function handleGetCredentials(
  deviceToken: string,
  env: Env
): Promise<Response> {
  const existing = await env.CREDENTIAL_STORE.get(`cred:${deviceToken}`)
  if (existing) {
    return jsonResponse<ApiResponse<{ provider: 'gemini'; hasKey: boolean }>>({
      ok: true,
      data: {
        provider: 'gemini',
        hasKey: true,
      },
    })
  }

  return jsonResponse<ApiResponse<{ provider: null; hasKey: boolean }>>({
    ok: true,
    data: {
      provider: null,
      hasKey: false,
    },
  })
}

export async function handlePutCredentials(
  deviceToken: string,
  body: unknown,
  env: Env
): Promise<Response> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'Request body must be a JSON object', code: 'INVALID_BODY' },
      400
    )
  }

  const b = body as Record<string, unknown>
  if (b.provider !== 'gemini' || typeof b.apiKey !== 'string') {
    return jsonResponse<ApiError>(
      { ok: false, error: 'Body must contain provider "gemini" and a string apiKey', code: 'INVALID_BODY' },
      400
    )
  }

  const apiKey = b.apiKey.trim()
  if (apiKey.length === 0) {
    return jsonResponse<ApiError>(
      { ok: false, error: 'API key must not be blank', code: 'INVALID_KEY' },
      400
    )
  }

  const encrypted = await encrypt(env.MASTER_ENCRYPTION_KEY, apiKey)
  const storedCredential: StoredCredential = {
    provider: 'gemini',
    iv: encrypted.iv,
    tag: encrypted.tag,
    ciphertext: encrypted.ciphertext,
  }

  await env.CREDENTIAL_STORE.put(
    `cred:${deviceToken}`,
    JSON.stringify(storedCredential),
    { expirationTtl: 7776000 } // 90 days in seconds
  )

  return jsonResponse<ApiResponse<{ provider: 'gemini'; hasKey: boolean }>>({
    ok: true,
    data: {
      provider: 'gemini',
      hasKey: true,
    },
  })
}

export async function handleDeleteCredentials(
  deviceToken: string,
  env: Env
): Promise<Response> {
  await env.CREDENTIAL_STORE.delete(`cred:${deviceToken}`)
  return jsonResponse<ApiResponse<null>>({
    ok: true,
    data: null,
  })
}
