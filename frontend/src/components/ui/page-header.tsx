import type { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: React.ReactNode
}

export function PageHeader({ icon: Icon, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
