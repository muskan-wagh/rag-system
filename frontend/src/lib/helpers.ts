export function getInitials(name?: string): string {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export { getStatusColor, CANDIDATE_STATUS } from "./candidate-status"

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


