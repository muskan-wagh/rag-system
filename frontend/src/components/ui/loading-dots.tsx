import { cn } from "@/lib/utils"

interface LoadingDotsProps {
  className?: string
  size?: "sm" | "md"
}

const dotSizes = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
}

export function LoadingDots({ className, size = "sm" }: LoadingDotsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-full bg-primary/60 animate-bounce-dot",
            dotSizes[size]
          )}
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  )
}
