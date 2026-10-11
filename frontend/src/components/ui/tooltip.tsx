"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

function TooltipProvider({ delay = 350, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />
}

/**
 * Wraps any trigger. Keep the trigger itself focusable so the tooltip is
 * reachable by keyboard — this only wires the positioning and chrome.
 */
function Tooltip({
  label,
  side = "top",
  sideOffset = 6,
  children,
  className,
}: {
  label: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children as React.ReactElement} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset}>
          <TooltipPrimitive.Popup
            data-slot="tooltip-content"
            className={cn(
              "z-50 max-w-[16rem] rounded-lg border border-border bg-ink px-2.5 py-1.5",
              "text-[11.5px] font-medium leading-snug text-canvas shadow-md",
              "transition-[transform,opacity] duration-150 ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.96] data-ending-style:opacity-0",
              className,
            )}
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipProvider }
