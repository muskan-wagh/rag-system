import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-all [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-[#111111] text-white border-transparent",
        secondary: "bg-[#F6F6F4] text-[#6B7280] border-transparent",
        destructive: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
        outline: "border-[#ECECEC] text-[#6B7280]",
        success: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20",
        warning: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
        ghost: "bg-transparent text-[#6B7280] hover:bg-[#F6F6F4]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge }
