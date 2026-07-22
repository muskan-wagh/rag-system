import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[120px] w-full rounded-[10px] border border-border bg-[#FAFAFA] px-3 py-3 text-[14px] text-ink placeholder:text-[14px] placeholder:text-faint",
        "outline-none resize-y",
        "focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.05)]",
        "transition-all duration-120",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
