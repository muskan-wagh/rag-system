"use client"

import { useMemo } from "react"
import { useAuth } from "@clerk/nextjs"
import { createApiClient } from "@/lib/api"

export function useApi() {
  const { getToken } = useAuth()
  return useMemo(() => createApiClient(getToken), [getToken])
}
