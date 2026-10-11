import Link from "next/link"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="container-page flex h-16 items-center">
          <Link href="/" aria-label="HireStack home">
            <BrandLogo />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md py-20 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-surface text-muted">
            <Compass className="size-5" strokeWidth={1.5} aria-hidden />
          </span>

          <p className="mt-6 font-data text-[12px] uppercase tracking-[0.12em] text-faint">
            404
          </p>
          <h1 className="mt-2 text-[26px] font-medium tracking-[-0.02em] text-ink">
            We couldn&rsquo;t find that page
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-muted">
            The link may be out of date, or the job, candidate or assessment it pointed
            at may have been removed.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="action" render={<Link href="/dashboard" />}>
              Go to dashboard
            </Button>
            <Button variant="outline" render={<Link href="/" />}>
              Back to home
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
