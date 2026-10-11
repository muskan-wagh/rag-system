import { MarketingNav } from "@/components/marketing-nav"
import { MarketingFooter } from "@/components/marketing-footer"
import { PageStage } from "@/components/landing/hero-stage"

/**
 * The public site is a single dark stage: `dark` flips every token-based
 * surface to its dark value, and `stage-scope` re-points the surface tokens at
 * translucent glass so panels sit on the line-and-glow backdrop. The hero
 * paints its own backdrop over this one at the top of the page.
 */
export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark stage-scope flex min-h-screen flex-col bg-canvas text-ink">
      <MarketingNav />
      <PageStage />
      <main className="relative z-10 flex-1 pt-[72px] sm:pt-[80px]">{children}</main>
      <MarketingFooter />
    </div>
  )
}