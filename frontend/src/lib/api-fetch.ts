export function getAuthHeaders(): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_API_KEY
  if (!key) return {}
  return { Authorization: `Bearer ${key}` }
}

export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers)
  const authHeaders = getAuthHeaders()
  for (const [k, v] of Object.entries(authHeaders)) {
    headers.set(k, v)
  }
  if (!(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
  }
  return fetch(url, { ...options, headers })
}
