"use client"

import Link from "next/link"
import { Sparkles, Mail } from "lucide-react"

const footerSections = {
  Product: [
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#faq", label: "FAQ" },
  ],
  Company: [
    { href: "https://github.com/muskan-wagh/rag-system", label: "GitHub" },
    { href: "/#about", label: "About" },
  ],
  Resources: [
    { href: "/how-it-works", label: "Documentation" },
    { href: "/#faq", label: "Help Center" },
  ],
  Legal: [
    { href: "/#privacy", label: "Privacy Policy" },
    { href: "/#terms", label: "Terms of Service" },
  ],
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-info">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>
                RecruitIQ
              </span>
            </Link>
            <p className="text-sm text-muted leading-relaxed max-w-xs mb-6" style={{ fontFamily: "var(--font-inter)" }}>
              AI-powered candidate discovery and ranking. Find the right candidate in seconds.
            </p>
          </div>

          {Object.entries(footerSections).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-[11px] font-medium text-faint uppercase mb-4" style={{ letterSpacing: "0.06em", fontFamily: "var(--font-inter)" }}>
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted hover:text-ink transition-colors"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-faint" style={{ fontFamily: "var(--font-inter)" }}>
            &copy; {new Date().getFullYear()} RecruitIQ. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-faint" style={{ fontFamily: "var(--font-inter)" }}>
              <Mail className="h-3 w-3" />
              hello@recruitiq.ai
            </div>
            <span className="text-xs text-border">|</span>
            <p className="text-xs text-faint" style={{ fontFamily: "var(--font-inter)" }}>
              Built with Next.js, Express, Qwen3 &amp; Qdrant
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
