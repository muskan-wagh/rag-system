"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface RadarData {
  label: string
  candidateA: number
  candidateB: number
}

interface RadarChartProps {
  data: RadarData[]
  candidateALabel?: string
  candidateBLabel?: string
  size?: number
}

export function RadarChart({
  data,
  candidateALabel = "Candidate A",
  candidateBLabel = "Candidate B",
  size = 280,
}: RadarChartProps) {
  const [animated, setAnimated] = useState(false)
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 40
  const angleStep = (2 * Math.PI) / data.length

  useEffect(() => {
    setTimeout(() => setAnimated(true), 300)
  }, [])

  function getPoint(value: number, index: number) {
    const angle = angleStep * index - Math.PI / 2
    const r = radius * value
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  }

  function getPath(values: number[]) {
    const points = values.map((v, i) => getPoint(v, i))
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"
  }

  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gridLevels.map((level) => {
          const points = data.map((_, i) => getPoint(level, i))
          const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"
          return (
            <path
              key={level}
              d={path}
              fill="none"
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="1"
            />
          )
        })}

        {data.map((d, i) => {
          const p = getPoint(1, i)
          return (
            <line
              key={d.label}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="1"
            />
          )
        })}

        {data.map((d, i) => {
          const p = getPoint(1.08, i)
          return (
            <text
              key={d.label}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize="9"
            >
              {d.label}
            </text>
          )
        })}

        {animated && (
          <>
            <motion.path
              d={getPath(data.map((d) => d.candidateA))}
              fill="rgba(108, 92, 231, 0.1)"
              stroke="#6C5CE7"
              strokeWidth="2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            <motion.path
              d={getPath(data.map((d) => d.candidateB))}
              fill="rgba(167, 139, 250, 0.1)"
              stroke="#A78BFA"
              strokeWidth="2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
          </>
        )}
      </svg>
      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">{candidateALabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-xs text-muted-foreground">{candidateBLabel}</span>
        </div>
      </div>
    </div>
  )
}
