import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground/60 outline-none",
        "focus:border-ring/40 focus:ring-2 focus:ring-ring/20",
        "transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
