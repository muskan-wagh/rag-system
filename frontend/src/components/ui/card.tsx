import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "bg-surface text-ink transition-all duration-150",
  {
    variants: {
      variant: {
        /** Default panel: hairline border + whisper of elevation. */
        default: "rounded-xl border border-border shadow-xs",
        /** Flush panel for nested content inside an already-raised surface. */
        flush: "rounded-lg border border-border/70",
        /** Recessed panel used for code, previews and read-only data. */
        sunken: "rounded-xl border border-border bg-canvas",
        /** Interactive card that lifts on hover. */
        interactive:
          "rounded-xl border border-border shadow-xs hover:border-border-hover hover:shadow-md",
        /** Elevated hero card used in marketing compositions. */
        feature: "rounded-2xl border border-border shadow-md",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4 sm:p-5",
        lg: "p-5 sm:p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
    },
  }
)

function Card({
  className,
  variant,
  padding,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1 px-4 pt-4 sm:px-5 sm:pt-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-[14px] font-medium leading-tight tracking-tight text-ink", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-[12px] leading-relaxed text-muted", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-4 sm:p-5", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 border-t border-border px-4 py-3 sm:px-5",
        className
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
