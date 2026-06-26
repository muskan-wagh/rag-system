"use client"

import { motion } from "framer-motion"
import { Search, X, Check } from "lucide-react"

const traditionalResults = ["React Developer"]
const recruitIQResults = [
  "Frontend Engineer",
  "React Engineer",
  "JavaScript Engineer",
  "UI Developer",
  "Frontend React Developer",
]

export function SemanticVsKeyword() {
  return (
    <section className="w-full py-16 md:py-24 bg-primary/[0.01]">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Keyword Search vs{" "}
            <span className="text-primary">Semantic Search</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            See the difference when searching for the same term
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl border border-border p-6 md:p-8 shadow-sm mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Search Query</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">React Developer</span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Natural Language
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl border border-border p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10">
                <X className="h-3.5 w-3.5 text-destructive" />
              </div>
              <span className="text-sm font-semibold text-foreground">Traditional ATS</span>
            </div>

            <p className="text-xs text-muted-foreground mb-3">Finds</p>

            <div className="space-y-2">
              {traditionalResults.map((result) => (
                <div
                  key={result}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-destructive/5 border border-destructive/10"
                >
                  <X className="h-3.5 w-3.5 text-destructive/50 shrink-0" />
                  <span className="text-sm text-foreground/70">{result}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-destructive/60 leading-relaxed">
                Only finds exact keyword matches. Misses qualified candidates with different job titles.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl border border-primary/10 p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">RecruitIQ</span>
            </div>

            <p className="text-xs text-muted-foreground mb-3">Finds</p>

            <div className="space-y-2">
              {recruitIQResults.map((result, i) => (
                <motion.div
                  key={result}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10"
                >
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm text-foreground">{result}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-primary/60 leading-relaxed">
                Semantic understanding finds all relevant candidates regardless of job title wording.
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 bg-white rounded-2xl border border-border p-5 md:p-6"
        >
          <h4 className="text-sm font-semibold text-foreground mb-2">Why semantic search is more accurate</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Semantic search converts both the job description and candidate profiles into vector embeddings —
            mathematical representations of meaning. Instead of looking for exact words, it measures the
            conceptual distance between what the job needs and what each candidate offers. This means a search
            for &ldquo;React Developer&rdquo; naturally surfaces &ldquo;Frontend Engineer&rdquo; because the AI
            understands these roles share the same skills, responsibilities, and context.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
