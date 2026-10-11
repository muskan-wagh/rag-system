"use client"

import { motion } from "framer-motion"
import { MarketingSection } from "@/components/ui/marketing-section"
import { SectionHeader } from "@/components/ui/section-header"
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  AnalyticsPreview,
  AssessmentPreview,
  InterviewPreview,
  PipelinePreview,
  ScreeningPreview,
} from "@/components/landing/product-preview"

const SHOWCASE = [
  {
    value: "pipeline",
    label: "Pipeline",
    title: "Every role, one pipeline",
    body: "Open a job and see the whole funnel: who is in each stage, how many, and what is waiting on you. Each stage is a link into the filtered candidate list, so you go from overview to decision in one click.",
    preview: <PipelinePreview />,
  },
  {
    value: "screening",
    label: "AI screening",
    title: "Ranked screening with the reasoning attached",
    body: "Resumes are embedded and retrieved against the job description. Candidates come back ranked, with a per-dimension breakdown, the skills you asked for, and the gaps you should ask about in the interview.",
    preview: <ScreeningPreview />,
  },
  {
    value: "assessments",
    label: "Assessments",
    title: "Generate an assessment from the role",
    body: "Describe the skills you need and HireStack drafts a timed question set you can edit, reorder and publish. Invite eligible candidates in bulk and watch completions land in real time.",
    preview: <AssessmentPreview />,
  },
  {
    value: "interviews",
    label: "Interviews",
    title: "Video and live coding in the same room",
    body: "Schedule the round, join the video room, and push a coding problem straight into the candidate's editor. You see the code and its test results while they are still typing.",
    preview: <InterviewPreview />,
  },
  {
    value: "analytics",
    label: "Analytics",
    title: "See where candidates fall out",
    body: "Stage-by-stage distribution across your roles, plus what needs review today and what is coming up next. Click any stage to jump straight to the people in it.",
    preview: <AnalyticsPreview />,
  },
] as const

export function ProductShowcase() {
  return (
    <MarketingSection id="product" tone="surface">
      <SectionHeader
        label="Product"
        title={
          <>
            One workspace,{" "}
            <span className="text-white/45">from first CV to signed offer.</span>
          </>
        }
        description="HireStack replaces the scatter of CVs, spreadsheets, scheduling links and score sheets that a hiring process normally lives in."
      />

      <Tabs defaultValue={SHOWCASE[0].value} className="mt-14">
        <div className="flex justify-center">
          <TabsList className="max-w-full flex-nowrap overflow-x-auto rounded-full border border-white/10 bg-white/[0.035] p-1 backdrop-blur-md">
            {SHOWCASE.map((item) => (
              <TabsTab key={item.value} value={item.value} className="whitespace-nowrap">
                {item.label}
              </TabsTab>
            ))}
          </TabsList>
        </div>

        {SHOWCASE.map((item) => (
          <TabsPanel key={item.value} value={item.value} className="pt-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14"
            >
              <div>
                <h3 className="text-balance text-[22px] font-medium leading-tight tracking-[-0.025em] text-white sm:text-[27px]">
                  {item.title}
                </h3>
                <p className="mt-4 text-pretty text-[14px] leading-relaxed text-white/50 sm:text-[15px]">
                  {item.body}
                </p>
              </div>
              <div className={cn("min-w-0")}>{item.preview}</div>
            </motion.div>
          </TabsPanel>
        ))}
      </Tabs>
    </MarketingSection>
  )
}
