"use client"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Search, Database, GitBranch, BarChart3, Sparkles, Check } from "lucide-react"

interface PipelineStep {
  id: string
  icon: typeof Brain
  label: string
  purpose: string
  extracts?: string[]
  why?: string
  example?: string
  details: string[]
}

const pipelineSteps: PipelineStep[] = [
  {
    id: "gpt-oss",
    icon: Brain,
    label: "Qwen3 Next 80B A3B",
    purpose: "Reads and understands the job description.",
    extracts: ["Skills", "Experience", "Responsibilities", "Education", "Hiring priorities"],
    details: [
      "Parses unstructured job descriptions into structured recruiter requirements.",
      "Identifies required vs. preferred qualifications.",
      "Outputs a structured query for the semantic search pipeline.",
    ],
  },
  {
    id: "fastembed",
    icon: Search,
    label: "FastEmbed",
    purpose: "Converts job descriptions and candidate profiles into numerical vector embeddings.",
    why: "Allows semantic similarity instead of keyword matching.",
    example: '"React Developer" will also understand "Frontend Engineer", "UI Developer", "JavaScript Engineer"',
    details: [
      "Runs locally with zero external API calls for embedding generation.",
      "Produces high-dimensional vectors that capture semantic meaning.",
      "Enables the system to find candidates based on meaning, not exact keywords.",
    ],
  },
  {
    id: "qdrant",
    icon: Database,
    label: "Qdrant",
    purpose: "Stores vector embeddings and performs ultra-fast semantic similarity search.",
    why: "Instead of searching words, it searches meaning. This is what makes RecruitIQ different from traditional ATS.",
    details: [
      "Purpose-built vector database optimized for similarity search.",
      "Returns the most semantically relevant candidates in milliseconds.",
      "Scales to thousands of candidate profiles with consistent performance.",
    ],
  },
  {
    id: "hybrid-ranking",
    icon: GitBranch,
    label: "Hybrid Ranking Engine",
    purpose: "Combines multiple ranking signals into a single, transparent score.",
    details: [
      "Semantic Similarity: How well the candidate matches the job meaning.",
      "Skill Match: Overlap between required and candidate skills.",
      "Experience Match: Years and relevance of professional experience.",
      "Education Match: Degree level and field alignment.",
    ],
  },
  {
    id: "explainability",
    icon: BarChart3,
    label: "AI Explanation Engine",
    purpose: "Uses Qwen3 Next 80B A3B to explain every recommendation in plain language.",
    why: 'Instead of "Score = 92", RecruitIQ explains WHY.',
    example:
      'Candidate ranked #1 because: Excellent React experience, AWS expertise, Meets experience requirement, Strong education match, High semantic similarity',
    details: [
      "Generates natural language explanations for each ranking.",
      "Highlights specific strengths and gaps for every candidate.",
      "Builds recruiter trust through transparent, auditable decisions.",
    ],
  },
  {
    id: "ranked-results",
    icon: Sparkles,
    label: "Ranked Candidates",
    purpose: "Delivers ranked candidates with detailed score breakdowns and AI explanations.",
    details: [
      "Candidates sorted by overall match score.",
      "Drill down into individual scores for skill, experience, education, and semantic match.",
      "Compare candidates side-by-side with AI-generated insights.",
    ],
  },
]

interface PipelineSheetProps {
  stepId: string | null
  onClose: () => void
}

export function PipelineSheet({ stepId, onClose }: PipelineSheetProps) {
  const step = pipelineSteps.find((s) => s.id === stepId)

  const Icon = step?.icon || Brain

  return (
    <Sheet open={!!stepId} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="bg-white/90 backdrop-blur-xl border-l border-border w-full max-w-md">
        <AnimatePresence mode="wait">
          {step && (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{step.label}</h2>
                  <p className="text-xs text-muted-foreground">Pipeline Component</p>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto">
                <div className="bg-white rounded-xl border border-border p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Purpose</h3>
                  <p className="text-sm text-foreground leading-relaxed">{step.purpose}</p>
                  {step.extracts && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {step.extracts.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {step.why && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Why</h3>
                    <p className="text-sm text-foreground leading-relaxed">{step.why}</p>
                  </div>
                )}

                {step.example && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Example</h3>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{step.example}</p>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-border p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">How it works</h3>
                  <div className="space-y-2.5">
                    {step.details.map((detail, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground/80 leading-relaxed">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}

export { pipelineSteps }
