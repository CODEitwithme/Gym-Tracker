import { describe, it, expect, vi, beforeEach } from 'vitest'
import worker, { aiRateLimiter } from './index'
import type { ApiError, Env, ParsedWorkout, StoredCredential } from './types'
import { encrypt, decrypt } from './encryption'
import { validateParsedWorkout, validateParsedMeal } from './geminiAdapter'

const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const TEST_DEVICE_TOKEN = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d'
const TEST_ORIGIN = 'http://localhost:5173'

function createMockKV(): KVNamespace {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
  } as unknown as KVNamespace
}

function createTestEnv(kv?: KVNamespace): Env {
  return {
    CREDENTIAL_STORE: kv ?? createMockKV(),
    MASTER_ENCRYPTION_KEY: TEST_MASTER_KEY,
    ALLOWED_ORIGIN: TEST_ORIGIN,
  }
}

describe('Forge/Fit Worker Backend', () => {
  let env: Env

  beforeEach(() => {
    vi.restoreAllMocks()
    aiRateLimiter.reset()
    env = createTestEnv()
  })

  // Test 1: GET /api/settings/ai-credentials with no stored credential returns hasKey: false
  it('1. GET /api/settings/ai-credentials with no stored credential returns hasKey: false', async () => {
    const request = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'GET',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
        'Origin': TEST_ORIGIN,
      },
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(TEST_ORIGIN)

    const data = await response.json()
    expect(data).toEqual({
      ok: true,
      data: {
        provider: null,
        hasKey: false,
      },
    })
  })

  // Test 2: PUT /api/settings/ai-credentials stores encrypted credential and returns hasKey: true
  it('2. PUT /api/settings/ai-credentials stores encrypted credential and returns hasKey: true', async () => {
    const rawApiKey = 'AIzaSyFakeKeyForTesting12345'
    const request = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
        'Origin': TEST_ORIGIN,
      },
      body: JSON.stringify({
        provider: 'gemini',
        apiKey: rawApiKey,
      }),
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toEqual({
      ok: true,
      data: {
        provider: 'gemini',
        hasKey: true,
      },
    })

    // Verify stored credential in KV is encrypted
    const storedRaw = await env.CREDENTIAL_STORE.get(`cred:${TEST_DEVICE_TOKEN}`)
    expect(storedRaw).toBeTruthy()
    const stored = JSON.parse(storedRaw!) as StoredCredential
    expect(stored.provider).toBe('gemini')
    expect(stored.iv).toBeDefined()
    expect(stored.tag).toBeDefined()
    expect(stored.ciphertext).toBeDefined()
    // Plaintext key is NOT stored
    expect(storedRaw).not.toContain(rawApiKey)

    // Decrypting stored credential recovers original key
    const decrypted = await decrypt(TEST_MASTER_KEY, stored)
    expect(decrypted).toBe(rawApiKey)
  })

  // Test 3: GET after PUT returns hasKey: true, provider: 'gemini'
  it('3. GET after PUT returns hasKey: true, provider: \'gemini\'', async () => {
    // PUT
    const putRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        provider: 'gemini',
        apiKey: 'AIzaSyValidKey12345',
      }),
    })
    await worker.fetch(putRequest, env)

    // GET
    const getRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'GET',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
    })
    const response = await worker.fetch(getRequest, env)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toEqual({
      ok: true,
      data: {
        provider: 'gemini',
        hasKey: true,
      },
    })
  })

  // Test 4: DELETE removes credential
  it('4. DELETE removes credential', async () => {
    // Put credential first
    const putRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        provider: 'gemini',
        apiKey: 'AIzaSyValidKey12345',
      }),
    })
    await worker.fetch(putRequest, env)

    // DELETE
    const deleteRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'DELETE',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
    })
    const deleteResponse = await worker.fetch(deleteRequest, env)
    expect(deleteResponse.status).toBe(200)
    const deleteData = await deleteResponse.json()
    expect(deleteData).toEqual({
      ok: true,
      data: null,
    })

    // Check GET returns hasKey: false
    const getRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'GET',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
    })
    const getResponse = await worker.fetch(getRequest, env)
    const getData = await getResponse.json()
    expect(getData).toEqual({
      ok: true,
      data: {
        provider: null,
        hasKey: false,
      },
    })
  })

  // Test 5: Missing device token returns 401
  it('5. Missing device token returns 401', async () => {
    const request = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'GET',
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data).toEqual({
      ok: false,
      error: 'Device token required',
      code: 'MISSING_TOKEN',
    })

    // Invalid UUID token also returns 401
    const invalidTokenRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'GET',
      headers: {
        'X-Device-Token': 'not-a-uuid',
      },
    })
    const invalidTokenResponse = await worker.fetch(invalidTokenRequest, env)
    expect(invalidTokenResponse.status).toBe(401)
    const invalidTokenData = await invalidTokenResponse.json()
    expect(invalidTokenData).toEqual({
      ok: false,
      error: 'Invalid device token format',
      code: 'INVALID_TOKEN',
    })
  })

  // Test 6: Invalid body on PUT returns 400
  it('6. Invalid body on PUT returns 400', async () => {
    // Invalid provider
    const badProviderRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: 'AIzaSyValidKey12345',
      }),
    })
    const res1 = await worker.fetch(badProviderRequest, env)
    expect(res1.status).toBe(400)
    const data1 = (await res1.json()) as ApiError
    expect(data1.ok).toBe(false)
    expect(data1.code).toBe('INVALID_BODY')

    // Blank API key
    const blankKeyRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        provider: 'gemini',
        apiKey: '   ',
      }),
    })
    const res2 = await worker.fetch(blankKeyRequest, env)
    expect(res2.status).toBe(400)
    const data2 = (await res2.json()) as ApiError
    expect(data2.ok).toBe(false)
    expect(data2.code).toBe('INVALID_KEY')
  })

  // Test 7: POST /api/ai/parse-workout without credentials returns 404 with code NO_CREDENTIALS
  it('7. POST /api/ai/parse-workout without credentials returns 404 with code NO_CREDENTIALS', async () => {
    const request = new Request('http://localhost/api/ai/parse-workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        message: '3 sets of 10 bench press at 80kg',
      }),
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data).toEqual({
      ok: false,
      error: 'No credentials configured',
      code: 'NO_CREDENTIALS',
    })
  })

  // Test 8: Rate limiting returns 429 after threshold
  it('8. Rate limiting returns 429 after threshold', async () => {
    // 10 requests allowed
    for (let i = 0; i < 10; i++) {
      expect(await aiRateLimiter.check(TEST_DEVICE_TOKEN)).toBe(true)
    }

    // 11th request exceeds limit
    expect(await aiRateLimiter.check(TEST_DEVICE_TOKEN)).toBe(false)

    // Through the HTTP endpoint
    const request = new Request('http://localhost/api/ai/parse-workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        message: 'bench press',
      }),
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data).toEqual({
      ok: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
    })
  })

  // Test 9: API key is never returned in GET response
  it('9. API key is never returned in GET response', async () => {
    const secretKey = 'AIzaSyTopSecretKeyNeverExpose'

    // Store credential
    const putRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        provider: 'gemini',
        apiKey: secretKey,
      }),
    })
    await worker.fetch(putRequest, env)

    // GET response inspection
    const getRequest = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'GET',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
    })
    const getResponse = await worker.fetch(getRequest, env)
    const rawText = await getResponse.text()

    // Must not contain the secret key or ciphertext
    expect(rawText).not.toContain(secretKey)
    expect(rawText).not.toContain('ciphertext')
    expect(rawText).not.toContain('iv')
    expect(rawText).not.toContain('tag')

    const parsed = JSON.parse(rawText)
    expect(parsed.data).toEqual({
      provider: 'gemini',
      hasKey: true,
    })
    expect(parsed.data.apiKey).toBeUndefined()
  })

  // Test 10: validateParsedWorkout rejects malformed AI output
  it('10. validateParsedWorkout rejects malformed AI output', () => {
    // Non-object
    expect(() => validateParsedWorkout(null)).toThrow('Parsed workout must be an object')
    expect(() => validateParsedWorkout('string')).toThrow('Parsed workout must be an object')
    expect(() => validateParsedWorkout([1, 2, 3])).toThrow('Parsed workout must be an object')

    // Missing exercise or empty exercise
    expect(() =>
      validateParsedWorkout({
        exercise: '',
        confidence: 'high',
      })
    ).toThrow('exercise must be a non-empty string')

    expect(() =>
      validateParsedWorkout({
        exercise: 12345,
        confidence: 'high',
      })
    ).toThrow('exercise must be a non-empty string')

    // Invalid confidence
    expect(() =>
      validateParsedWorkout({
        exercise: 'Bench Press',
        confidence: 'moderate',
      })
    ).toThrow('confidence must be "high" or "low"')

    // Invalid unit
    expect(() =>
      validateParsedWorkout({
        exercise: 'Bench Press',
        confidence: 'high',
        unit: 'kilograms',
      })
    ).toThrow('unit must be "kg", "lbs", or null')

    // Negative weight
    expect(() =>
      validateParsedWorkout({
        exercise: 'Bench Press',
        confidence: 'high',
        weight: -10,
      })
    ).toThrow('weight must be a non-negative number or null')

    // Non-integer reps
    expect(() =>
      validateParsedWorkout({
        exercise: 'Bench Press',
        confidence: 'high',
        reps: 10.5,
      })
    ).toThrow('reps must be a positive integer or null')

    // Negative reps
    expect(() =>
      validateParsedWorkout({
        exercise: 'Bench Press',
        confidence: 'high',
        reps: 0,
      })
    ).toThrow('reps must be a positive integer or null')

    // Non-integer sets
    expect(() =>
      validateParsedWorkout({
        exercise: 'Bench Press',
        confidence: 'high',
        sets: -1,
      })
    ).toThrow('sets must be a positive integer or null')

    // Non-integer durationSeconds
    expect(() =>
      validateParsedWorkout({
        exercise: 'Running',
        confidence: 'high',
        durationSeconds: 0,
      })
    ).toThrow('durationSeconds must be a positive integer or null')

    // Valid workout passes
    const validWorkout: ParsedWorkout = validateParsedWorkout({
      exercise: '  Bench Press  ',
      weight: 80,
      unit: 'kg',
      reps: 10,
      sets: 3,
      durationSeconds: null,
      notes: 'Felt strong',
      confidence: 'high',
      followUpQuestion: null,
    })

    expect(validWorkout).toEqual({
      exercise: 'Bench Press',
      weight: 80,
      unit: 'kg',
      reps: 10,
      sets: 3,
      durationSeconds: null,
      notes: 'Felt strong',
      confidence: 'high',
      followUpQuestion: null,
    })
  })

  // Additional test: AI parse-workout with mocked Gemini fetch
  it('POST /api/ai/parse-workout with valid credentials calls Gemini and returns parsed workout', async () => {
    // 1. Store credentials
    const enc = await encrypt(TEST_MASTER_KEY, 'AIzaSyMockedKey12345')
    await env.CREDENTIAL_STORE.put(
      `cred:${TEST_DEVICE_TOKEN}`,
      JSON.stringify({
        provider: 'gemini',
        iv: enc.iv,
        tag: enc.tag,
        ciphertext: enc.ciphertext,
      })
    )

    // 2. Mock fetch
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  exercise: 'Incline Dumbbell Press',
                  weight: 32,
                  unit: 'kg',
                  reps: 8,
                  sets: 4,
                  durationSeconds: null,
                  notes: 'RPE 8',
                  confidence: 'high',
                  followUpQuestion: null,
                }),
              },
            ],
          },
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockGeminiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = new Request('http://localhost/api/ai/parse-workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
      body: JSON.stringify({
        message: 'Did 4 sets of 8 incline dumbbell press at 32kg, felt like RPE 8',
      }),
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      ok: true,
      data: {
        exercise: 'Incline Dumbbell Press',
        weight: 32,
        unit: 'kg',
        reps: 8,
        sets: 4,
        durationSeconds: null,
        notes: 'RPE 8',
        confidence: 'high',
        followUpQuestion: null,
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const callUrl = fetchMock.mock.calls[0][0]
    expect(callUrl).toContain('AIzaSyMockedKey12345')
  })

  // Additional test: AI test-connection with mocked Gemini fetch
  it('POST /api/ai/test-connection with valid credentials returns connection success', async () => {
    const enc = await encrypt(TEST_MASTER_KEY, 'AIzaSyMockedKey12345')
    await env.CREDENTIAL_STORE.put(
      `cred:${TEST_DEVICE_TOKEN}`,
      JSON.stringify({
        provider: 'gemini',
        iv: enc.iv,
        tag: enc.tag,
        ciphertext: enc.ciphertext,
      })
    )

    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  exercise: 'Bench Press',
                  weight: 60,
                  unit: 'kg',
                  reps: 10,
                  sets: 3,
                  durationSeconds: null,
                  notes: null,
                  confidence: 'high',
                  followUpQuestion: null,
                }),
              },
            ],
          },
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockGeminiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = new Request('http://localhost/api/ai/test-connection', {
      method: 'POST',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      ok: true,
      data: {
        provider: 'gemini',
        message: 'Connection successful',
      },
    })
  })

  // Additional test: handles Gemini 401 / 429 errors gracefully
  it('POST /api/ai/test-connection handles invalid key error from Gemini', async () => {
    const enc = await encrypt(TEST_MASTER_KEY, 'AIzaSyInvalidKey12345')
    await env.CREDENTIAL_STORE.put(
      `cred:${TEST_DEVICE_TOKEN}`,
      JSON.stringify({
        provider: 'gemini',
        iv: enc.iv,
        tag: enc.tag,
        ciphertext: enc.ciphertext,
      })
    )

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'API key not valid' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = new Request('http://localhost/api/ai/test-connection', {
      method: 'POST',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
      },
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({
      ok: false,
      error: 'API key not valid',
      code: 'INVALID_KEY',
    })
  })

  // Additional test: CORS preflight
  it('OPTIONS * returns preflight CORS response', async () => {
    const request = new Request('http://localhost/api/settings/ai-credentials', {
      method: 'OPTIONS',
      headers: {
        'Origin': TEST_ORIGIN,
      },
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(TEST_ORIGIN)
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Device-Token')
  })

  // Meal parsing tests
  it('validateParsedMeal validates valid meal object', () => {
    const raw = {
      mealName: 'Chicken and Rice',
      mealType: 'lunch',
      servingDescription: '1 bowl',
      calories: 550,
      proteinG: 45,
      carbsG: 60,
      fatG: 12,
      notes: 'Post workout',
      confidence: 'high',
      followUpQuestion: null,
    }
    const validated = validateParsedMeal(raw)
    expect(validated.mealName).toBe('Chicken and Rice')
    expect(validated.mealType).toBe('lunch')
    expect(validated.calories).toBe(550)
    expect(validated.proteinG).toBe(45)
    expect(validated.carbsG).toBe(60)
    expect(validated.fatG).toBe(12)
    expect(validated.confidence).toBe('high')
  })

  it('validateParsedMeal defaults invalid meal type and handles missing serving description', () => {
    const raw = {
      mealName: 'Apple',
      mealType: 'unknown_type',
      calories: 95,
      proteinG: 0.5,
      carbsG: 25,
      fatG: 0.3,
      confidence: 'high',
    }
    const validated = validateParsedMeal(raw)
    expect(validated.mealName).toBe('Apple')
    expect(validated.mealType).toBe('snack')
    expect(validated.servingDescription).toBe('1 serving')
  })

  it('POST /api/ai/parse-meal parses meal message when valid credentials exist', async () => {
    const enc = await encrypt(TEST_MASTER_KEY, 'valid-gemini-key')
    await env.CREDENTIAL_STORE.put(
      `cred:${TEST_DEVICE_TOKEN}`,
      JSON.stringify({
        provider: 'gemini',
        iv: enc.iv,
        tag: enc.tag,
        ciphertext: enc.ciphertext,
      })
    )

    const mockAiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  mealName: 'Greek Yogurt with Berries',
                  mealType: 'breakfast',
                  servingDescription: '1 bowl (200g)',
                  calories: 220,
                  proteinG: 20,
                  carbsG: 25,
                  fatG: 4,
                  notes: null,
                  confidence: 'high',
                  followUpQuestion: null,
                }),
              },
            ],
          },
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockAiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = new Request('http://localhost/api/ai/parse-meal', {
      method: 'POST',
      headers: {
        'X-Device-Token': TEST_DEVICE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'I had greek yogurt with mixed berries for breakfast' }),
    })

    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      ok: true,
      data: {
        mealName: 'Greek Yogurt with Berries',
        mealType: 'breakfast',
        servingDescription: '1 bowl (200g)',
        calories: 220,
        proteinG: 20,
        carbsG: 25,
        fatG: 4,
        notes: null,
        confidence: 'high',
        followUpQuestion: null,
      },
    })
  })
})
