"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const faqs = [
  {
    question: "How does RecruitIQ rank candidates?",
    answer: "RecruitIQ uses a hybrid ranking engine that combines semantic similarity (via vector embeddings) with weighted scoring across skills, experience, and education. The result is ranked by overall fit rather than just keyword matches.",
  },
  {
    question: "What file formats are supported for resume uploads?",
    answer: "RecruitIQ supports PDF and DOCX formats for resume uploads, with a maximum file size of 5MB per upload.",
  },
  {
    question: "How accurate is the AI parsing?",
    answer: "The AI parser extracts structured data from resumes with high accuracy — including skills, experience timelines, education history, and certifications. It uses advanced LLMs for understanding complex resume formats.",
  },
  {
    question: "Can I compare multiple candidates side by side?",
    answer: "Yes, RecruitIQ's comparison view lets you select multiple candidates and see an AI-powered head-to-head analysis with score breakdowns, strengths, and weaknesses relative to your job description.",
  },
  {
    question: "How does the resume dropbox feature work?",
    answer: "Generate a unique application link from the dashboard and share it anywhere (email, LinkedIn, career page). Candidates upload their resume through a simple interface, and it's automatically parsed and added to your database.",
  },
  {
    question: "Is my data secure and private?",
    answer: "Absolutely. RecruitIQ is SOC 2 compliant and GDPR ready. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Your candidate data is never used for training our AI models.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-20" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/[0.03] rounded-full blur-3xl" />

      <div className="mx-auto max-w-3xl px-4 md:px-6 relative">
        <SectionHeader
          label="FAQ"
          title="Frequently asked"
          highlight="questions"
          description="Everything you need to know about RecruitIQ"
        />

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="glass-card rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-foreground hover:bg-white/30 transition-colors text-left"
              >
                {faq.question}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-300 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
