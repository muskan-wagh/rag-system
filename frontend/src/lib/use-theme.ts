"use client"

import { useCallback, useSyncExternalStore } from "react"

export type ThemeChoice = "light" | "dark" | "system"

const COOKIE = "hirestack-theme"
const listeners = new Set<() => void>()

interface ThemeState {
  choice: ThemeChoice
  resolved: "light" | "dark"
}

let query: MediaQueryList | null = null
let osListener: (() => void) | null = null

function mediaQuery() {
  if (typeof window === "undefined") return null
  if (!query) query = window.matchMedia("(prefers-color-scheme: dark)")
  return query
}

function prefersDark() {
  return mediaQuery()?.matches ?? false
}

function readCookie(): ThemeChoice {
  if (typeof document === "undefined") return "system"
  const raw = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.split("=")[1]
  return raw === "light" || raw === "dark" ? raw : "system"
}

function resolveChoice(choice: ThemeChoice): "light" | "dark" {
  return choice === "dark" || (choice === "system" && prefersDark()) ? "dark" : "light"
}

let state: ThemeState = { choice: "system", resolved: "light" }

function emit() {
  listeners.forEach((fn) => fn())
}

function watchSystem(choice: ThemeChoice) {
  if (osListener && query) {
    query.removeEventListener("change", osListener)
    osListener = null
  }
  if (choice !== "system") return
  const mq = mediaQuery()
  if (!mq) return
  const onChange = () => {
    const resolved = resolveChoice("system")
    document.documentElement.classList.toggle("dark", resolved === "dark")
    state = { ...state, resolved }
    emit()
  }
  mq.addEventListener("change", onChange)
  osListener = onChange
}

function commit(choice: ThemeChoice) {
  const resolved = resolveChoice(choice)
  document.documentElement.classList.toggle("dark", resolved === "dark")
  document.cookie = `${COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`
  state = { choice, resolved }
  watchSystem(choice)
  emit()
}

/**
 * The cookie stores the user's CHOICE (including "system") so the preference
 * survives reloads, and the server layout reads it to avoid a flash of the
 * wrong theme.
 *
 * `useSyncExternalStore` keeps every consumer — the nav toggle, the settings
 * page, anything that renders theme-dependent chrome — in sync from one source.
 */
export function useTheme() {
  const choice = useSyncExternalStore(
    subscribe,
    getSnapshot,
    // Server render + hydration must agree, so start from the neutral value.
    () => "system" as ThemeChoice,
  )

  const resolved = useSyncExternalStore(
    subscribe,
    () => state.resolved,
    () => "light" as "light" | "dark",
  )

  const setChoice = useCallback((next: ThemeChoice) => commit(next), [])

  return { choice, resolved, setChoice }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot() {
  return readCookie()
}

// The pre-paint script in the root layout already applied `.dark`, so mirror
// that into store state the moment the module first evaluates on the client.
if (typeof document !== "undefined") {
  const initial = readCookie()
  state = { choice: initial, resolved: resolveChoice(initial) }
  watchSystem(initial)
}
