"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Plus } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const faqs = [
  {
    question: "How does HireStack rank candidates?",
    answer:
      "Four signals are computed independently — semantic similarity between the resume and the job description, skill coverage, experience fit and education — then combined with fixed weights of 35%, 30%, 20% and 15%. Every candidate returns the full breakdown and a written explanation, and you can override any score.",
  },
  {
    question: "What file formats can candidates submit?",
    answer:
      "PDF and DOCX, up to 5 MB per file. Candidates apply through a unique upload link tied to a specific role, so every resume lands against the right job without anyone having to file it.",
  },
  {
    question: "Can the AI advance or reject a candidate on its own?",
    answer:
      "No. Stage transitions are validated server-side: stages can never be skipped or moved backwards, and moving a candidate from Offer to Hired is reserved for recruiters. A high score can get someone further down the pipeline, but it cannot hire them.",
  },
  {
    question: "How do assessments work?",
    answer:
      "You can generate a question set from the job description or write your own. Each assessment is timed and can mix multiple-choice, coding and SQL questions. Candidates receive a personal invite link, and coding answers run against test cases in a sandbox.",
  },
  {
    question: "What happens in an interview round?",
    answer:
      "You schedule the stage and the candidate receives the invitation. The room combines video with a shared code editor, so you can push a problem and watch the code and its test results while they are still writing. Interviewers then score against a shared rubric.",
  },
  {
    question: "Where is candidate data stored?",
    answer:
      "Resumes and candidate records live in the Supabase instance and the vector store configured for your deployment. Access to the recruiter workspace is authenticated, and each job's candidates, screening runs and interviews are scoped to the recruiter who owns them.",
  },
  {
    question: "Do candidates need an account?",
    answer:
      "No. Candidates apply, take an assessment and join an interview through personal links. They never see the recruiter workspace, other candidates, scores, or internal notes.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        label="FAQ"
        title="Questions worth asking"
        description="If something here is still unclear, the architecture and performance pages go into more detail."
      />

      <div className="mt-12 divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-xl">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <div key={faq.question}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
                  className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-300 hover:bg-white/[0.03] sm:px-6"
                >
                  <span className="text-[14px] font-medium leading-snug text-white/85 transition-colors duration-300 group-hover:text-white">
                    {faq.question}
                  </span>
                  <Plus
                    className={`size-4 shrink-0 text-white/40 transition-transform duration-300 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="panel"
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 pr-12 text-[13.5px] leading-relaxed text-white/55 sm:px-6">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
