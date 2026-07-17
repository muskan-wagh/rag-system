"use client"

import { useAuth } from "@clerk/nextjs"
import { apiFetch } from "@/lib/api-fetch"

export function useApiFetch() {
  const { getToken } = useAuth()

  async function authFetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers)
    const token = await getToken()

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    return apiFetch(url, { ...options, headers })
  }

  return { apiFetch: authFetch }
}
