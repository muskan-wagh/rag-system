"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

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
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Frequently asked{" "}
            <span className="text-primary">questions</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Everything you need to know about RecruitIQ
          </p>
        </motion.div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="border border-border rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
              >
                {faq.question}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
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
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
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
