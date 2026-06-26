import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface IconBoxProps {
  icon: LucideIcon
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "solid" | "light"
}

const sizeClasses = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-xl",
}

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
}

const variantClasses = {
  solid: "bg-primary text-primary-foreground",
  light: "bg-primary/10 text-primary",
}

export function IconBox({ icon: Icon, className, size = "md", variant = "solid" }: IconBoxProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
    </div>
  )
}
