import type { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: React.ReactNode
}

export function PageHeader({ icon: _Icon, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-lg font-medium text-[#111111]">{title}</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
