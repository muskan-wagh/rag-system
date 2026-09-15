import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-8 sm:py-10", className)}>
      <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-surface-secondary">
        <Icon className="size-4 text-faint" strokeWidth={1.5} />
      </div>
      <h3 className="mb-0.5 text-[13px] font-medium text-ink">{title}</h3>
      <p className="max-w-xs text-center text-[12px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
