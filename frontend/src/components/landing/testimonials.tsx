"use client"

import { motion } from "framer-motion"
import { Quote } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const testimonials = [
  {
    quote: "RecruitIQ cut our candidate screening time by 70%. The semantic search finds candidates we would have missed with traditional ATS tools.",
    author: "Sarah Chen",
    role: "VP of Talent",
    company: "TechCorp",
    avatar: "SC",
    color: "from-primary to-accent",
  },
  {
    quote: "The AI-powered ranking is remarkably accurate. It surfaces the best candidates consistently, and the explainable insights help us make confident hiring decisions.",
    author: "Marcus Johnson",
    role: "Head of Recruitment",
    company: "InnovateInc",
    avatar: "MJ",
    color: "from-blue-500 to-indigo-400",
  },
  {
    quote: "We went from posting a job to having ranked candidates in minutes. The application link feature alone saved us hours of manual resume collection.",
    author: "Emily Rodriguez",
    role: "Talent Acquisition Lead",
    company: "CloudBase",
    avatar: "ER",
    color: "from-amber-500 to-orange-400",
  },
]

export function Testimonials() {
  return (
    <section className="w-full py-20 md:py-28 relative overflow-hidden border-y border-border/40 bg-gradient-to-b from-background via-primary/[0.01] to-background">
      <div className="absolute inset-0 noise-bg pointer-events-none opacity-20" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Testimonials"
          title="Trusted by"
          highlight="recruiters"
          description="See what recruitment teams are saying about RecruitIQ"
        />

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.06)" }}
              className="glass-card rounded-2xl p-6 md:p-8 flex flex-col relative"
            >
              <Quote className="h-8 w-8 text-primary/10 absolute top-6 right-6" />
              <div className="flex-1">
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 relative z-10">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white text-xs font-bold`}>
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{testimonial.author}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
