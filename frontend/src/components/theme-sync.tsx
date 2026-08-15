"use client"

import { useEffect } from "react"

export function ThemeSync() {
  useEffect(() => {
    const hasCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("hirestack-theme="))
    if (!hasCookie && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark")
      document.cookie =
        "hirestack-theme=dark; path=/; max-age=31536000; samesite=lax"
    }
  }, [])

  return null
}
