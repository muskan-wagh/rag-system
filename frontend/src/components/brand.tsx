import { cn } from "@/lib/utils"

export function BrandMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-[7px] bg-primary-solid text-primary-foreground shrink-0",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="font-data font-medium" style={{ fontSize: Math.round(size * 0.42) }}>
        RQ
      </span>
    </span>
  )
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <span className="text-[15px] font-medium tracking-tight text-ink">RecruitIQ</span>
      )}
    </span>
  )
}
