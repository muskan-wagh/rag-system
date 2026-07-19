import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:-translate-y-[6px]",
        className
      )}
      {...props}
    />
  )
}

export { Card }
