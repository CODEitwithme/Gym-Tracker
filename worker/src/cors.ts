export function isOriginAllowed(origin: string, allowedConfig: string): boolean {
  if (!origin) return false
  if (allowedConfig === '*') return true

  const allowedList = allowedConfig
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

  if (allowedList.includes(origin)) return true

  try {
    const parsed = new URL(origin)
    // Always permit local development
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true
    }
    // Match wildcards like *.vercel.app if configured
    for (const allowed of allowedList) {
      if (allowed.startsWith('*.')) {
        const domainSuffix = allowed.slice(2)
        if (parsed.hostname.endsWith(domainSuffix)) return true
      }
    }
  } catch {
    return false
  }

  return false
}

export function corsHeaders(origin: string, allowed: string): Record<string, string> {
  const allowedOrigin = isOriginAllowed(origin, allowed) ? origin : ''
  if (!allowedOrigin) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token',
    'Access-Control-Max-Age': '86400',
  }
}

export function addCors(response: Response, origin: string, allowed: string): Response {
  const headers = new Headers(response.headers)
  const cors = corsHeaders(origin, allowed)
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function preflight(origin: string, allowed: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, allowed),
  })
}
