import { cn } from "@/lib/utils"

const controlBase =
  "flex w-full rounded-lg border bg-canvas text-[13px] text-ink placeholder:text-faint " +
  "outline-none transition-all duration-120 " +
  "focus:border-ink focus:bg-surface focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_7%,transparent)] " +
  "disabled:cursor-not-allowed disabled:opacity-55 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--danger)_14%,transparent)]"

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(controlBase, "h-9 px-3", className)}
      {...props}
    />
  )
}

/**
 * Label + control + hint/error, wired with the right ids so screen readers
 * announce help text and validation messages with the field.
 */
function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
  action,
}: {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label
              htmlFor={htmlFor}
              className="text-[12px] font-medium leading-none text-ink"
            >
              {label}
              {required && (
                <span className="ml-0.5 text-danger" aria-hidden>
                  *
                </span>
              )}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-[11.5px] leading-tight text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] leading-tight text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-[12px] font-medium leading-none text-ink", className)}
      {...props}
    />
  )
}

export { Input, Field, Label }
