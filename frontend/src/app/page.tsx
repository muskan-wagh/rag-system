"use client"

import { MarketingLayout } from "@/components/marketing-layout"
import { LandingHero } from "@/components/landing/landing-hero"
import { LogoWall } from "@/components/landing/logo-wall"
import { FeaturesBento } from "@/components/landing/features-bento"
import { WorkflowSection } from "@/components/landing/workflow-section"
import { WhyBetterTable } from "@/components/how-it-works/why-better-table"
import { SemanticVsKeyword } from "@/components/how-it-works/semantic-vs-keyword"
import { WinningCards } from "@/components/how-it-works/winning-cards"
import { Testimonials } from "@/components/landing/testimonials"
import { FAQSection } from "@/components/landing/faq-section"
import { CTASection } from "@/components/landing/cta-section"

export default function Home() {
  return (
    <MarketingLayout>
      <LandingHero />
      <LogoWall />
      <FeaturesBento />
      <WhyBetterTable />
      <WorkflowSection />
      <SemanticVsKeyword />
      <WinningCards />
      <Testimonials />
      <FAQSection />
      <CTASection />
    </MarketingLayout>
  )
}
