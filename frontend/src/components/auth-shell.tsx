import Link from "next/link"
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

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
    <div className="relative min-h-screen flex flex-col bg-background overflow-hidden">
      {/* ——— Background: Vercel/Linear style ——— */}
      <div className="absolute inset-0 grid-bg opacity-60 dark:opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)]" />
      <div
        className="absolute -top-48 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full pointer-events-none blur-3xl bg-primary/[0.07] dark:bg-white/[0.06]"
        aria-hidden
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-[min(560px,80vw)] bg-gradient-to-r from-transparent via-border-strong to-transparent pointer-events-none"
        aria-hidden
      />

      {/* ——— Top bar ——— */}
      <header className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 pt-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary-solid text-white dark:text-black transition-transform duration-150 group-hover:scale-105">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            HireStack
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-muted hover:text-ink hover:bg-hover-tone transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      {/* ——— Center card ——— */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-[420px] animate-rise-in">
          <div className="rounded-2xl border border-border bg-card shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
            <div className="h-px bg-gradient-to-r from-transparent via-border-strong/60 to-transparent" />
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <div className="flex flex-col items-center text-center mb-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-solid text-white dark:text-black mb-4 shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </span>
                <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink">
                  {title}
                </h1>
                <p className="mt-1.5 text-sm leading-5 text-muted">{subtitle}</p>
              </div>

              <div className="w-full [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full [&_.cl-main]:w-full">
                {children}
              </div>

              <div className="mt-6 pt-5 border-t border-border flex items-center justify-center text-center">
                {footerSwitch}
              </div>
            </div>
          </div>

          {/* Trust row — Linear/Vercel footnote */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-faint">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Protected by Clerk</span>
            <span className="mx-1">·</span>
            <Link href="/#pricing" className="hover:text-muted transition-colors">
              Terms
            </Link>
            <span>·</span>
            <Link href="/#faq" className="hover:text-muted transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </main>

      {/* ——— Bottom bar ——— */}
      <footer className="relative z-10 pb-6 flex items-center justify-center gap-2 text-xs text-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
        All systems operational
        <span className="mx-1">·</span>© 2026 HireStack
      </footer>
    </div>
  )
}
