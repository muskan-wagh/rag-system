import { cn } from "@/lib/utils"

interface PanelHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function PanelHeader({ title, description, action, className }: PanelHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-medium tracking-tight text-ink sm:text-[14px]">{title}</h2>
        {description && <p className="mt-px truncate text-[11px] text-muted sm:text-[12px]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
