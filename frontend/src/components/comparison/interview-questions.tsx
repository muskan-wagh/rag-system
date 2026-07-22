"use client"

import { motion } from "framer-motion"
import { MessageSquareText } from "lucide-react"
import { cn } from "@/lib/utils"

interface InterviewQuestionsProps {
  questions: string[]
}

export function InterviewQuestions({ questions }: InterviewQuestionsProps) {
  if (!questions || questions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-white rounded-2xl border border-border p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <MessageSquareText className="h-4 w-4 text-purple-500" strokeWidth={1.5} />
        <h3 className="text-sm font-medium text-ink">Interview Questions</h3>
      </div>

      <div className="space-y-3">
        {questions.map((question, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl",
              i % 2 === 0 ? "bg-purple-50/50" : "bg-transparent",
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-medium text-purple-600">
              {i + 1}
            </span>
            <p className="text-xs text-ink leading-relaxed">{question}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
