"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"

const GITHUB_URL = "https://github.com/muskan-wagh/rag-system"

/** Brand icons are not shipped by lucide-react, so the GitHub mark is inline. */
function GitHubGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

const columns = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/#product" },
      { label: "Hiring pipeline", href: "/#pipeline" },
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "Technical performance", href: "/performance" },
      { label: "Architecture guide", href: "/how-it-works" },
      { label: "Common questions", href: "/#faq" },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Recruiter sign in", href: "/sign-in" },
      { label: "Create an account", href: "/sign-up" },
      { label: "Candidate sign in", href: "/sign-in" },
      { label: "Submit a resume", href: "/upload" },
    ],
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-white/[0.07]">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-10 sm:gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <span className="flex items-center gap-2.5">
              <span className="relative flex size-8 items-center justify-center">
                <span className="absolute inset-0 rounded-[10px] bg-[#CBE2D2]/10 ring-1 ring-inset ring-[#CBE2D2]/25" />
                <svg
                  viewBox="0 0 16 16"
                  className="relative size-3.5 text-[#CBE2D2]"
                  fill="currentColor"
                  aria-hidden
                >
                  <rect x="1" y="1.75" width="14" height="3" rx="1.5" />
                  <rect x="3.5" y="6.5" width="9" height="3" rx="1.5" opacity="0.66" />
                  <rect x="6" y="11.25" width="4" height="3" rx="1.5" opacity="0.38" />
                </svg>
              </span>
              <span className="text-[15px] font-medium tracking-[-0.01em] text-white">
                HireStack
              </span>
            </span>
            <p className="mt-4 text-[13px] leading-relaxed text-white/45">
              An AI-assisted hiring workspace: semantic candidate screening,
              structured assessments, and a gated pipeline from application to
              offer.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-[12.5px] font-medium text-white/80 transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
            >
              <GitHubGlyph className="size-3.5 text-white/70" />
              View source
              <ExternalLink className="size-3 text-white/40" aria-hidden />
            </a>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-white/50 transition-colors duration-300 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-white/40">
            © {new Date().getFullYear()} HireStack. Built with Next.js, Supabase and pgvector.
          </p>
          <p className="text-[12px] text-white/30">
            Candidate data is processed only for the recruiting workflow you configure.
          </p>
        </div>
      </div>
    </footer>
  )
}
