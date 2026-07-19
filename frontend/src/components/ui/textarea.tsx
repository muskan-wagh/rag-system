import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-[18px] border border-[#ECECEC] bg-white px-4 py-3 text-sm text-[#111111] placeholder:text-[#A3A3A3]",
        "outline-none resize-y",
        "focus:border-[#111111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)]",
        "transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
