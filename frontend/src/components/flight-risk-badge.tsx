interface FlightRiskBadgeProps {
  risk: string
}

const variants: Record<string, { bg: string; text: string; dot: string }> = {
  Low: { bg: "bg-green-50 border-green-200", text: "text-green-700", dot: "bg-green-500" },
  Medium: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  High: { bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-500" },
}

export function FlightRiskBadge({ risk }: FlightRiskBadgeProps) {
  const v = variants[risk] || variants.Medium

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${v.bg} ${v.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {risk} Risk
    </span>
  )
}
