import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Native select styled to match Input. Native keeps keyboard behaviour,
 * screen-reader support and mobile pickers correct for free — we only take
 * over the visual chrome. `wrapperClassName` sizes the outer positioning box.
 */
function Select({
  className,
  wrapperClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        data-slot="select"
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-border bg-canvas pl-3 pr-8 text-[13px] text-ink",
          "outline-none transition-all duration-120",
          "focus:border-ink focus:bg-surface focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_7%,transparent)]",
          "disabled:cursor-not-allowed disabled:opacity-55",
          "aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint"
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  )
}

export { Select }
