import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center text-[13px] font-medium whitespace-nowrap transition-all duration-120 outline-none select-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-white hover:bg-ink-hover active:scale-[0.98] border border-transparent rounded-[8px]",
        outline:
          "bg-transparent text-ink border-border hover:bg-[#F3F4F6] active:scale-[0.98] rounded-[8px]",
        secondary:
          "bg-transparent text-ink border-border hover:bg-[#F3F4F6] active:scale-[0.98] rounded-[8px]",
        ghost:
          "bg-transparent text-muted hover:text-ink border-transparent rounded-[8px]",
        destructive:
          "bg-transparent text-danger border-transparent rounded-[8px]",
        link: "text-ink underline-offset-4 hover:underline border-transparent rounded-[8px]",
      },
      size: {
        default: "h-9 gap-2 px-[18px]",
        xs: "h-7 gap-1 px-2.5 rounded-md text-xs",
        sm: "h-8 gap-1.5 px-3.5 rounded-md text-xs",
        lg: "h-10 gap-2 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
