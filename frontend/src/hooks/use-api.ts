"use client"

import { useAuth } from "@clerk/nextjs"
import { createApiClient } from "@/lib/api"

export function useApi() {
  const { getToken } = useAuth()
  return createApiClient(getToken)
}
