"use client"

import { MarketingLayout } from "@/components/marketing-layout"
import { LandingHero } from "@/components/landing/landing-hero"
import { LogoWall } from "@/components/landing/logo-wall"
import { MetricsSection } from "@/components/landing/metrics-section"
import { FeaturesBento } from "@/components/landing/features-bento"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { WhyHireStack } from "@/components/landing/why-hirestack"
import { WorkflowSection } from "@/components/landing/workflow-section"
import { Testimonials } from "@/components/landing/testimonials"
import { SecuritySection } from "@/components/landing/security-section"
import { FAQSection } from "@/components/landing/faq-section"
import { CTASection } from "@/components/landing/cta-section"

export default function Home() {
  return (
    <MarketingLayout>
      <LandingHero />
      <LogoWall />
      <MetricsSection />
      <FeaturesBento />
      <ProductShowcase />
      <WhyHireStack />
      <WorkflowSection />
      <Testimonials />
      <SecuritySection />
      <FAQSection />
      <CTASection />
    </MarketingLayout>
  )
}
