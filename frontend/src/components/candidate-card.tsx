"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { ROUTES } from "@/lib/constants"
import type { RankingResult } from "@/lib/api"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function scoreColor(score: number) {
  if (score >= 0.8) return "from-purple-500 to-blue-500"
  if (score >= 0.6) return "from-blue-500 to-cyan-500"
  return "from-cyan-500 to-gray-500"
}

function scoreLabel(score: number) {
  if (score >= 0.8) return "Excellent"
  if (score >= 0.6) return "Strong"
  if (score >= 0.4) return "Good"
  return "Fair"
}

export function CandidateCard({ result, index }: { result: RankingResult; index: number }) {
  const { candidate, scores } = result
  const pct = Math.round(scores.overall * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -2, scale: 1.005 }}
    >
      <Link href={ROUTES.candidateDetail(candidate.id)} className="block group">
        <div className="relative">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-purple-600/10 to-blue-600/10 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
          <div className="relative glass rounded-2xl p-5 ring-1 ring-white/[0.06] group-hover:ring-white/[0.1] transition-all duration-300 cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/30 to-blue-600/30 ring-1 ring-white/[0.1]">
                  <span className="text-sm font-semibold text-white/80">
                    {getInitials(candidate.name)}
                  </span>
                </div>
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-[9px] font-bold text-white shadow-lg">
                  {index + 1}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-medium text-white truncate">{candidate.name}</h3>
                  <div className={`rounded-full bg-gradient-to-r ${scoreColor(scores.overall)} px-2 py-0.5 text-[10px] font-medium text-white`}>
                    {scoreLabel(scores.overall)}
                  </div>
                </div>
                <p className="text-xs text-white/40 line-clamp-1 mb-3">
                  {candidate.summary}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {candidate.skills.slice(0, 5).map((skill) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="text-[10px] border-white/[0.08] text-white/50 bg-white/[0.03]"
                    >
                      {skill}
                    </Badge>
                  ))}
                  {candidate.skills.length > 5 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-white/[0.08] text-white/30 bg-white/[0.03]"
                    >
                      +{candidate.skills.length - 5}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-white/30">
                  <span>{candidate.experience} yrs exp</span>
                  <span>{candidate.education.level}</span>
                  <span className="truncate">{candidate.education.field}</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18" cy="18" r="15.5"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="2.5"
                    />
                    <motion.circle
                      cx="18" cy="18" r="15.5"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${pct * 0.973} 100`}
                      initial={{ strokeDasharray: "0 100" }}
                      animate={{ strokeDasharray: `${pct * 0.973} 100` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute text-sm font-bold text-white">{pct}%</span>
                </div>
                <span className="text-[9px] text-white/30">Match</span>
              </div>

              <ExternalLink className="h-3.5 w-3.5 text-white/20 shrink-0 mt-1 group-hover:text-white/40 transition-colors" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06]">
              {[
                { label: "Skills", value: Math.round(scores.skill * 100), color: "from-purple-600 to-purple-400" },
                { label: "Experience", value: Math.round(scores.experience * 100), color: "from-blue-600 to-blue-400" },
                { label: "Education", value: Math.round(scores.education * 100), color: "from-cyan-600 to-cyan-400" },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between text-[10px] text-white/30">
                    <span>{s.label}</span>
                    <span>{s.value}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.value}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                      className={`h-full rounded-full bg-gradient-to-r ${s.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
