"use client"

import Link from "next/link"
import { Globe, MessageCircle, ExternalLink, Mail } from "lucide-react"

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
    { href: "/#careers", label: "Careers" },
  ],
  Resources: [
    { href: "/how-it-works", label: "Documentation" },
    { href: "/#faq", label: "Help Center" },
    { href: "/#blog", label: "Blog" },
  ],
  Legal: [
    { href: "/#privacy", label: "Privacy Policy" },
    { href: "/#terms", label: "Terms of Service" },
    { href: "/#security", label: "Security" },
  ],
}

const socials = [
  { href: "https://github.com/muskan-wagh/rag-system", icon: Globe, label: "GitHub" },
  { href: "#", icon: MessageCircle, label: "Twitter" },
  { href: "#", icon: ExternalLink, label: "LinkedIn" },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-white/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-500 shadow-md">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-base font-semibold text-foreground tracking-tight">
                Recruit<span className="text-primary">IQ</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
              AI-powered candidate discovery and ranking. Find the right candidate in seconds.
            </p>
            <div className="flex items-center gap-3">
              {socials.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 border border-border/40 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white transition-all"
                >
                  <social.icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          {Object.entries(footerSections).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} RecruitIQ. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              hello@recruitiq.ai
            </div>
            <span className="text-xs text-muted-foreground/40">|</span>
            <p className="text-xs text-muted-foreground">
              Built with Next.js, Express, Qwen3 &amp; Qdrant
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
