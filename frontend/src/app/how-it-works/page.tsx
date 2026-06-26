"use client"

import { HeroSection } from "@/components/how-it-works/hero-section"
import { ProblemSection } from "@/components/how-it-works/problem-section"
import { WhyBetterTable } from "@/components/how-it-works/why-better-table"
import { AiPipeline } from "@/components/how-it-works/ai-pipeline"
import { TechStack } from "@/components/how-it-works/tech-stack"
import { ArchitectureSection } from "@/components/how-it-works/architecture-section"
import { RankingBreakdown } from "@/components/how-it-works/ranking-breakdown"
import { SemanticVsKeyword } from "@/components/how-it-works/semantic-vs-keyword"
import { WinningCards } from "@/components/how-it-works/winning-cards"
import { PerformanceSection } from "@/components/how-it-works/performance-section"
import { FooterSection } from "@/components/how-it-works/footer-section"

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <ProblemSection />
      <WhyBetterTable />
      <AiPipeline />
      <TechStack />
      <ArchitectureSection />
      <RankingBreakdown />
      <SemanticVsKeyword />
      <WinningCards />
      <PerformanceSection />
      <FooterSection />
    </div>
  )
}
