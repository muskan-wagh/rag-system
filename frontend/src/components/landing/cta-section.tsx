"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

export function CTASection() {
  return (
    <section className="w-full py-20 md:py-28 relative overflow-hidden bg-gradient-to-b from-background via-primary/[0.03] to-background border-y border-border/40">
      <div className="absolute inset-0 noise-bg pointer-events-none opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/[0.05] rounded-full blur-3xl" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="mx-auto max-w-3xl px-4 md:px-6 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 backdrop-blur-sm px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm mb-6">
            <Sparkles className="h-3 w-3 text-primary" />
            Start hiring smarter today
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
            Ready to transform your hiring?
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
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
          <p className="text-xs text-muted-foreground mt-5">
            Free forever. No credit card required. Setup in 2 minutes.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
