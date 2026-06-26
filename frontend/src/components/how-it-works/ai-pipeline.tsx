"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowDown, ArrowRight, ChevronRight } from "lucide-react"
import { PipelineSheet, pipelineSteps } from "./pipeline-sheet"
import { cn } from "@/lib/utils"

export function AiPipeline() {
  const [selectedStep, setSelectedStep] = useState<string | null>(null)

  return (
    <>
      <section className="w-full py-16 md:py-24 bg-primary/[0.01]">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Interactive AI <span className="text-primary">Pipeline</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
              Click any component to learn how it powers your candidate search
            </p>
          </motion.div>

          <div className="hidden lg:flex items-center justify-center">
            {pipelineSteps.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.id} className="flex items-center">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -6 }}
                    onClick={() => setSelectedStep(step.id)}
                    className={cn(
                      "group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white border border-border card-hover cursor-pointer text-left",
                      "hover:border-primary/20 hover:shadow-lg"
                    )}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10 group-hover:bg-primary group-hover:ring-primary/30 transition-all duration-300">
                      <Icon className="h-6 w-6 text-primary group-hover:text-white transition-all duration-300" />
                    </div>
                    <span className="text-xs font-medium text-foreground text-center max-w-[100px] leading-tight">
                      {step.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors flex items-center gap-0.5">
                      Learn more <ChevronRight className="h-3 w-3" />
                    </span>
                  </motion.button>
                  {i < pipelineSteps.length - 1 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 + 0.3, duration: 0.4 }}
                      className="flex items-center mx-2"
                      style={{ transformOrigin: "left" }}
                    >
                      <div className="h-px w-10 bg-border" />
                      <ArrowRight className="h-4 w-4 text-primary/30 -ml-2" />
                    </motion.div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="lg:hidden space-y-3 max-w-md mx-auto">
            {pipelineSteps.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <button
                    onClick={() => setSelectedStep(step.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border border-border card-hover hover:border-primary/20 hover:shadow-md text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">{step.label}</span>
                      <span className="text-xs text-muted-foreground/60">Click to learn more</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </button>
                  {i < pipelineSteps.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="h-3.5 w-3.5 text-primary/20" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <PipelineSheet stepId={selectedStep} onClose={() => setSelectedStep(null)} />
    </>
  )
}
