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
    <div className={cn("flex flex-col items-center justify-center py-20 px-6", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F6F6F4] mb-5">
        <Icon className="h-6 w-6 text-[#A3A3A3]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-medium text-[#111111] mb-1">{title}</h3>
      <p className="text-sm text-[#6B7280] text-center max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
