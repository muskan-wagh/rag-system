import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-xl bg-[#F6F6F4] animate-pulse-soft", className)}
      {...props}
    />
  )
}

export { Skeleton }
