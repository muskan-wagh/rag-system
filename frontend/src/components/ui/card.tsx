import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-surface border border-border rounded-xl transition-all duration-120 hover:border-border-hover",
        className
      )}
      {...props}
    />
  )
}

export { Card }
