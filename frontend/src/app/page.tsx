import { MarketingLayout } from "@/components/marketing-layout"
import { MarketingSection } from "@/components/ui/marketing-section"
import { LandingHero } from "@/components/landing/landing-hero"
import { ProductShowcase } from "@/components/landing/product-showcase"
import { FeaturesBento } from "@/components/landing/features-bento"
import { WorkflowSection } from "@/components/landing/workflow-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { FAQSection } from "@/components/landing/faq-section"
import { CTASection } from "@/components/landing/cta-section"

export default function Home() {
  return (
    <MarketingLayout>
      <LandingHero />
      <ProductShowcase />
      <FeaturesBento />
      <WorkflowSection />
      <HowItWorksSection />
      <MarketingSection id="faq">
        <FAQSection />
      </MarketingSection>
      <CTASection />
    </MarketingLayout>
  )
}
