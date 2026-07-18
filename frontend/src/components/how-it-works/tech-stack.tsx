"use client"

import { motion } from "framer-motion"
import { Globe, Server, Brain, Search, Database, Palette } from "lucide-react"
import { cn } from "@/lib/utils"

const techs = [
  { icon: Globe, name: "Next.js", desc: "Modern frontend for a fast recruiter experience.", color: "from-blue-500/10 to-blue-600/5", iconColor: "text-blue-600" },
  { icon: Server, name: "Express.js", desc: "Backend APIs and AI orchestration.", color: "from-gray-500/10 to-gray-600/5", iconColor: "text-gray-600" },
  { icon: Brain, name: "Qwen3 Next 80B A3B", desc: "Parses JDs, generates explanations and hiring insights.", color: "from-purple-500/10 to-purple-600/5", iconColor: "text-purple-600" },
  { icon: Search, name: "FastEmbed", desc: "Generates embeddings locally for semantic search.", color: "from-primary/10 to-accent/5", iconColor: "text-success" },
  { icon: Database, name: "Qdrant", desc: "Stores and searches vector embeddings.", color: "from-amber-500/10 to-amber-600/5", iconColor: "text-amber-600" },
  { icon: Palette, name: "Tailwind CSS", desc: "Modern enterprise UI with consistent design system.", color: "from-cyan-500/10 to-cyan-600/5", iconColor: "text-cyan-600" },
]

export function TechStack() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Technology <span className="text-primary">Stack</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Built with modern, battle-tested technologies
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {techs.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="group card-hover"
            >
              <div className={cn(
                "relative bg-white rounded-2xl border border-border p-5 h-full overflow-hidden",
              )}>
                <div className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br",
                  tech.color
                )} />
                <div className="relative">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl bg-muted mb-3 group-hover:bg-white/50 transition-colors",
                  )}>
                    <tech.icon className={cn("h-5 w-5", tech.iconColor)} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{tech.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tech.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
