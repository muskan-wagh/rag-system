import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-[18px] border border-[#ECECEC] bg-white px-4 py-2 text-sm text-[#111111]",
        "placeholder:text-[#A3A3A3] outline-none",
        "focus:border-[#111111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)]",
        "transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
