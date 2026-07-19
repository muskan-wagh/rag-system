"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

export function CTASection() {
  return (
    <section className="w-full py-20 md:py-28 relative overflow-hidden border-y border-border">
      <div className="mx-auto max-w-3xl px-4 md:px-6 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-muted mb-6" style={{ fontFamily: "var(--font-inter)" }}>
            <Sparkles className="h-3 w-3 text-ink" />
            Start hiring smarter today
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-ink mb-4" style={{ letterSpacing: "-0.02em", fontFamily: "var(--font-inter)" }}>
            Ready to transform your hiring?
          </h2>
          <p className="text-base md:text-lg text-muted mb-8 max-w-lg mx-auto leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
            Start finding the best candidates in seconds with AI-powered matching. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <PrimaryButton href="/sign-up" icon={<ArrowRight className="h-4 w-4" />}>
              Start Hiring Free
            </PrimaryButton>
            <SecondaryButton href="/#how-it-works">
              See How It Works
            </SecondaryButton>
          </div>
          <p className="text-xs text-faint mt-5" style={{ fontFamily: "var(--font-inter)" }}>
            Free forever. No credit card required. Setup in 2 minutes.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
