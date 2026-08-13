import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className ?? ""}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-danger/10 mb-4">
        <AlertTriangle className="h-5 w-5 text-danger" strokeWidth={1.5} />
      </div>
      <h3 className="text-[14px] font-medium text-ink">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted max-w-sm">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-5">
          <RotateCw className="size-3.5" strokeWidth={1.5} />
          Try again
        </Button>
      )}
    </div>
  )
}
