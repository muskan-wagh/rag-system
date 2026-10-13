import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-soft text-sm font-medium text-muted",
        className
      )}
      {...props}
    />
  )
}

/**
 * Avatar Extended (Space-UI-inspired, adapted to HireStack tokens).
 * Stage ring shows the candidate's pipeline position; presence dot shows
 * live interview state. Colors come ONLY from globals.css tokens.
 */
const STAGE_RING: Record<string, string> = {
  Applied: "ring-border-strong",
  Screening: "ring-info",
  Assessment: "ring-warning",
  "Technical Round": "ring-info",
  Interview: "ring-warning",
  "Final Decision": "ring-success",
  Offer: "ring-success",
  Hired: "ring-success",
  Rejected: "ring-danger",
}

function AvatarExtended({
  stage,
  presence,
  size = "md",
  className,
  children,
}: {
  stage?: string | null
  presence?: "online" | "in-interview" | "offline" | null
  size?: "sm" | "md" | "lg"
  className?: string
  children: React.ReactNode
}) {
  const ring = (stage && STAGE_RING[stage]) || "ring-border"
  return (
    <div
      data-slot="avatar-extended"
      className={cn(
        "relative inline-flex shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background",
        ring,
        size === "sm" && "size-8",
        size === "md" && "size-10",
        size === "lg" && "size-12",
        className
      )}
    >
      <div className="flex h-full w-full overflow-hidden rounded-full">{children}</div>
      {presence && presence !== "offline" ? (
        <span
          aria-label={presence === "in-interview" ? "In interview" : "Online"}
          title={presence === "in-interview" ? "In interview" : "Online"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background",
            presence === "in-interview" ? "bg-danger" : "bg-success"
          )}
        />
      ) : null}
    </div>
  )
}

export { Avatar, AvatarFallback, AvatarExtended }
