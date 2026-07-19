import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-[8px] border border-border bg-surface px-[14px] py-[10px] text-sm text-ink",
        "placeholder:text-sm placeholder:text-faint outline-none",
        "focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.05)]",
        "transition-all duration-120",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#FAFAFA] disabled:text-faint",
        className
      )}
      {...props}
    />
  )
}

export { Input }
