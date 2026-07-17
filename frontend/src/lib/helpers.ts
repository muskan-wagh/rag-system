export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function getInitials(name?: string): string {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-50 text-blue-700 border-blue-200",
  shortlisted: "bg-purple-50 text-purple-700 border-purple-200",
  screening: "bg-orange-50 text-orange-700 border-orange-200",
  "interview scheduled": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "interview completed": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "technical round": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "hr round": "bg-yellow-50 text-yellow-700 border-yellow-200",
  offered: "bg-green-50 text-green-700 border-green-200",
  hired: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  interview: "bg-yellow-50 text-yellow-700 border-yellow-200",
}

export function getStatusColor(status?: string): string {
  const s = (status || "").toLowerCase()
  return STATUS_COLORS[s] || "bg-gray-50 text-gray-700 border-gray-200"
}

export function getFlightRiskColor(risk?: string): "destructive" | "default" | "outline" {
  const r = (risk || "").toLowerCase()
  if (r === "high") return "destructive"
  if (r === "medium") return "default"
  return "outline"
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
