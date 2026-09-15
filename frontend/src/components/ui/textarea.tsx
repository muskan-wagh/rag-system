import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[88px] w-full max-w-full rounded-md border border-border bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-[13px] placeholder:text-faint",
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
