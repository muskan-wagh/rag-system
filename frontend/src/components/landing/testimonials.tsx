"use client"

import { motion } from "framer-motion"

const testimonials = [
  {
    quote: "RecruitIQ cut our candidate screening time by 70%. The semantic search finds candidates we would have missed with traditional ATS tools.",
    author: "Sarah Chen",
    role: "VP of Talent, TechCorp",
  },
  {
    quote: "The AI-powered ranking is remarkably accurate. It surfaces the best candidates consistently, and the explainable insights help us make confident hiring decisions.",
    author: "Marcus Johnson",
    role: "Head of Recruitment, InnovateInc",
  },
  {
    quote: "We went from posting a job to having ranked candidates in minutes. The application link feature alone saved us hours of manual resume collection.",
    author: "Emily Rodriguez",
    role: "Talent Acquisition Lead, CloudBase",
  },
]

export function Testimonials() {
  return (
    <section className="w-full py-16 md:py-24 border-y border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Trusted by{" "}
            <span className="text-primary">recruiters</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            See what recruitment teams are saying about RecruitIQ
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-xl border border-border p-6 flex flex-col"
            >
              <div className="flex-1">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground">{testimonial.author}</p>
                <p className="text-xs text-muted-foreground">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
