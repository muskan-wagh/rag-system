import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand"

export function AuthShell({
  title,
  subtitle,
  children,
  footerSwitch,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footerSwitch: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Restrained backdrop: one hairline and one soft bloom. */}
      <div
        className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-48 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(560px,80vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-border-strong to-transparent"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-5 sm:px-6">
        <Link href="/" aria-label="HireStack home">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle className="size-9" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-hover-tone hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
            Back to home
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-[420px] animate-rise-in">
          <div className="edge-light overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <div className="mb-6 flex flex-col items-center text-center">
                <h1 className="text-[22px] font-medium leading-7 tracking-[-0.02em] text-ink">
                  {title}
                </h1>
                <p className="mt-1.5 text-[13.5px] leading-5 text-muted">{subtitle}</p>
              </div>

              <div className="w-full [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full [&_.cl-main]:w-full">
                {children}
              </div>

              <div className="mt-6 flex items-center justify-center border-t border-border pt-5 text-center">
                {footerSwitch}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-faint">
            <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
            <span>Authentication secured by Clerk</span>
            <span aria-hidden>·</span>
            <Link href="/#faq" className="transition-colors hover:text-muted">
              How your data is handled
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-center pb-6 text-[12px] text-faint">
        © {new Date().getFullYear()} HireStack
      </footer>
    </div>
  )
}
