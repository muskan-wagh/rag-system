import Link from "next/link"

const footerLinks = {
  Product: [
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#faq", label: "FAQ" },
  ],
  Company: [
    { href: "https://github.com/muskan-wagh/rag-system", label: "GitHub" },
  ],
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-foreground tracking-tight">
                Recruit<span className="text-primary">IQ</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              AI-powered candidate discovery and ranking. Find the right candidate in seconds.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                {title}
              </h4>
              <ul className="space-y-2">
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

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} RecruitIQ. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with Next.js, Express, Qwen3, FastEmbed &amp; Qdrant
          </p>
        </div>
      </div>
    </footer>
  )
}
