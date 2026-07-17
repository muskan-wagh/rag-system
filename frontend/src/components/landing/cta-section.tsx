"use client"

import { motion } from "framer-motion"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="w-full py-16 md:py-24 bg-primary/[0.02] border-y border-border">
      <div className="mx-auto max-w-3xl px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
            Ready to transform your hiring?
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            Start finding the best candidates in seconds with AI-powered matching.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              Get Started Free
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
