import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#111111] text-white hover:bg-[#2A2A2A] shadow-sm active:scale-[0.97]",
        outline:
          "border-[#ECECEC] bg-white text-[#111111] hover:bg-[#F6F6F4] hover:border-[#D4D4D4] active:scale-[0.97]",
        secondary:
          "bg-[#F6F6F4] text-[#111111] hover:bg-[#ECECEC] active:scale-[0.97]",
        ghost:
          "bg-transparent text-[#6B7280] hover:bg-[#F6F6F4] hover:text-[#111111]",
        destructive:
          "bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20",
        link: "text-[#111111] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4 rounded-full",
        xs: "h-7 gap-1 px-2.5 rounded-full text-xs",
        sm: "h-8 gap-1.5 px-3.5 rounded-full text-xs",
        lg: "h-10 gap-2 px-5 rounded-full",
        icon: "size-9 rounded-full",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-10 rounded-full",
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
