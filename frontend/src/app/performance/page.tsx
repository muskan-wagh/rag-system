import type { Metadata } from "next"
import {
  PerformanceHero,
  ArchitectureSection,
  PipelineSection,
  ProblemsSection,
  OptimizationsSection,
  ReliabilitySection,
  DashboardSection,
  EmbeddingsSection,
  ResultsSection,
  RemainingSection,
  TechnicalReportSection,
} from "@/components/performance/sections"

export const metadata: Metadata = {
  title: "Performance & Architecture — HireStack",
  description:
    "Measured staging results: concurrent resume processing, API responsiveness, and embedding compatibility.",
}

export default function PerformancePage() {
  return (
    <div className="flex flex-col divide-y divide-border">
      <PerformanceHero />
      <ArchitectureSection />
      <PipelineSection />
      <ProblemsSection />
      <OptimizationsSection />
      <ReliabilitySection />
      <DashboardSection />
      <EmbeddingsSection />
      <ResultsSection />
      <RemainingSection />
      <TechnicalReportSection />
    </div>
  )
}
