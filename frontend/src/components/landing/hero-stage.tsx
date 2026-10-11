"use client"

import type { ComponentType } from "react"
import { useId } from "react"
import {
  ArrowDown,
  ClipboardCheck,
  ListFilter,
  Radar,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* Palette lifted from the reference: near-black stage, white type, one soft
   desaturated sage glow. No saturated colour anywhere. */
const GLOW = "rgba(203, 226, 210"
const HAIRLINE = "rgba(255, 255, 255"

/* Two long curves, the way the reference has two — not a web of them. */
const ARC_LEFT = "M -6 71 C 10 64, 23 84, 46 79 C 69 74, 84 58, 106 66"
const ARC_RIGHT = "M 106 27 C 90 37, 72 14, 50 21 C 28 28, 14 48, -6 34"

const NODES = [
  { id: "match", x: 12, y: 67, side: "left", chipX: 3, chipY: 58 },
  { id: "shortlist", x: 16, y: 41, side: "left", chipX: 4, chipY: 31 },
  { id: "assessment", x: 88, y: 57, side: "right", chipX: 4, chipY: 47 },
  { id: "offer", x: 66, y: 20, side: "right", chipX: 7, chipY: 12 },
] as const

function connector(node: (typeof NODES)[number]) {
  const targetX = node.side === "left" ? node.chipX + 6 : 100 - node.chipX - 6
  return {
    x2: Number((node.x + (targetX - node.x) * 0.45).toFixed(2)),
    y2: Number((node.y + (node.chipY + 3 - node.y) * 0.45).toFixed(2)),
  }
}

const CHIPS = [
  { id: "match", icon: Radar, label: "Match score", value: "94%", delay: "0s" },
  { id: "shortlist", icon: ListFilter, label: "Shortlist", value: "12 ranked", delay: "1.4s" },
  { id: "assessment", icon: ClipboardCheck, label: "Assessment", value: "8 sent", delay: "2.6s" },
  { id: "offer", icon: ShieldCheck, label: "Offer", value: "gated", delay: "3.4s" },
] as const

const STACK = [
  "OpenAI",
  "Qdrant",
  "Supabase",
  "Gmail",
  "LiveKit",
  "Clerk",
  "Postgres",
  "Next.js",
] as const

/* ————————————————————————————————————————————
   Stage backdrop
   ———————————————————————————————————————————— */

export function StageBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#080908]" />

      {/* One soft sage bloom behind the headline. */}
      <div className="animate-aurora absolute left-1/2 top-[2%] h-[56%] w-[min(1400px,116vw)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(196,222,204,0.22),rgba(196,222,204,0.08)_46%,transparent_78%)] blur-[110px]" />

      {/* White core of the glow — the headline sits in it. */}
      <div className="absolute left-1/2 top-[13%] h-[32%] w-[min(1000px,84vw)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,255,255,0.13),rgba(255,255,255,0.04)_52%,transparent_80%)] blur-[90px]" />

      {/* Grain keeps the dark field from banding. */}
      <div className="absolute inset-0 opacity-[0.13] mix-blend-soft-light noise-bg" />

      {/* Vignette. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_78%_70%_at_50%_42%,transparent,rgba(0,0,0,0.55))]" />
    </div>
  )
}

/* ————————————————————————————————————————————
   Running lines — two curves, each drawn three times: a faint track, a slow
   crawl of dots, and a single bright dash travelling the length.
   ———————————————————————————————————————————— */

function Arc({ d, reverse }: { d: string; reverse?: boolean }) {
  return (
    <g>
      <path
        d={d}
        pathLength={100}
        fill="none"
        stroke={`${HAIRLINE},0.07)`}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d}
        pathLength={100}
        fill="none"
        stroke={`${GLOW},0.16)`}
        strokeWidth={1}
        strokeLinecap="round"
        strokeDasharray="0.12 4.2"
        vectorEffect="non-scaling-stroke"
        className={reverse ? "animate-line-flow-back" : "animate-line-flow"}
      />
      <path
        d={d}
        pathLength={100}
        fill="none"
        stroke={`${HAIRLINE},0.75)`}
        strokeWidth={1}
        strokeLinecap="round"
        strokeDasharray="4 96"
        vectorEffect="non-scaling-stroke"
        className={reverse ? "animate-line-flow" : "animate-line-flow-back"}
      />
    </g>
  )
}

export function StageOrbits() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <Arc d={ARC_LEFT} />
      <Arc d={ARC_RIGHT} reverse />

      {NODES.map((node) => {
        const end = connector(node)
        return (
          <line
            key={node.id}
            x1={node.x}
            y1={node.y}
            x2={end.x2}
            y2={end.y2}
            stroke={`${HAIRLINE},0.14)`}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}

/**
 * Node dots in HTML: the orbit layer is stretched to the stage, which would
 * turn an SVG <circle> into an ellipse.
 */
export function StageNodes() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {NODES.map((node, i) => (
        <span
          key={node.id}
          className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 shadow-[0_0_10px_1px_rgba(203,226,210,0.5)]"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            animation: `node-pulse 3.4s ease-in-out ${i * 0.5}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/** The single vertical light beam behind the headline. */
export function StageBeam() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="animate-beam absolute left-1/2 top-0 h-[88%] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.42)_16%,rgba(203,226,210,0.3)_52%,transparent)]" />
    </div>
  )
}

/* ————————————————————————————————————————————
   Floating chips
   ———————————————————————————————————————————— */

type StageChip = (typeof CHIPS)[number]

export function StageChipCard({ chip }: { chip: StageChip }) {
  const node = NODES.find((item) => item.id === chip.id)
  const Icon = chip.icon as ComponentType<{ className?: string }>

  if (!node) return null

  return (
    <div
      className="animate-float-soft pointer-events-none absolute hidden lg:block"
      style={{
        [node.side === "left" ? "left" : "right"]: `${node.chipX}%`,
        top: `${node.chipY}%`,
        animationDelay: chip.delay,
      }}
    >
      <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-[#0C0E0D]/60 px-2.5 py-1.5 backdrop-blur-md">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white/[0.05]">
          <Icon className="size-3 text-[#CBE2D2]" />
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-[10.5px] font-medium text-white/75">{chip.label}</span>
          <span className="font-data mt-0.5 text-[9.5px] text-white/35">{chip.value}</span>
        </span>
      </div>
    </div>
  )
}

export function StageChips() {
  return (
    <div className="absolute inset-0" aria-hidden>
      {CHIPS.map((chip) => (
        <StageChipCard key={chip.id} chip={chip} />
      ))}
    </div>
  )
}

/* ————————————————————————————————————————————
   Frame furniture
   ———————————————————————————————————————————— */

export function ScrollHint() {
  return (
    <a
      href="#product"
      className="group hidden items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.02] py-1.5 pl-1.5 pr-4 backdrop-blur-md transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.05] sm:inline-flex"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-inset ring-white/10">
        <ArrowDown className="animate-nudge-down size-3.5 text-white/70" />
      </span>
      <span className="text-[12px] text-white/45">Scroll to explore</span>
    </a>
  )
}

export function SectionIndicator() {
  return (
    <div className="hidden items-center gap-3 sm:flex">
      <span className="text-[12px] text-white/40">Hiring horizons</span>
      <span className="relative h-px w-24 overflow-hidden bg-white/10">
        <span className="animate-segment-sweep absolute inset-y-0 left-0 w-6 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.7),transparent)]" />
      </span>
    </div>
  )
}

/* ————————————————————————————————————————————
   Logo strip
   ———————————————————————————————————————————— */

function StackRow() {
  return (
    <div className="flex shrink-0 items-center">
      {STACK.map((name) => (
        <span key={name} className="flex shrink-0 items-center">
          <span className="px-6 text-[13px] font-medium tracking-[-0.01em] text-white/25 transition-colors duration-300 hover:text-white/55 sm:px-8 sm:text-[14px]">
            {name}
          </span>
          <span className="size-1 rounded-full bg-white/10" />
        </span>
      ))}
    </div>
  )
}

export function StackMarquee() {
  return (
    <div className="relative w-full overflow-hidden py-5">
      <div className="fade-edges-x flex w-max animate-marquee hover:[animation-play-state:paused]">
        <StackRow />
        <StackRow aria-hidden />
      </div>
    </div>
  )
}

/* ————————————————————————————————————————————
   Page stage: one backdrop for the whole document so the line-and-glow
   treatment is continuous from hero to footer.
   ———————————————————————————————————————————— */

export function PageStage() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#080908]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#080908]" />

      {/* A single soft column of light down the centre of the page. */}
      <div className="absolute left-1/2 top-0 h-full w-[72rem] -translate-x-1/2 bg-[radial-gradient(ellipse_52%_40%_at_50%_0%,rgba(196,222,204,0.08),transparent_72%)]" />
      <div className="animate-aurora absolute left-1/2 top-[30%] h-[44rem] w-[46rem] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(196,222,204,0.07),transparent_78%)] blur-[100px]" />
      <div className="animate-aurora absolute left-1/2 top-[72%] h-[40rem] w-[42rem] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(196,222,204,0.055),transparent_78%)] blur-[100px] [animation-delay:-11s]" />

      {/* The thread: one hairline for the whole document, with a highlight
          that travels down it. */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.16)_12%,rgba(203,226,210,0.13)_52%,transparent)]" />
      <div className="animate-segment-sweep absolute left-1/2 top-0 h-40 w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(203,226,210,0.55),transparent)]" />

      <div className="absolute inset-0 grid-bg opacity-[0.10] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
      <div className="absolute inset-0 opacity-[0.12] mix-blend-soft-light noise-bg" />
    </div>
  )
}

/* ————————————————————————————————————————————
   Per-section line: a single shallow curve per band, so the motif is present
   at every scroll depth without becoming a web.
   ———————————————————————————————————————————— */

const SECTION_ARC = "M -6 52 C 20 40, 44 66, 68 56 C 88 48, 98 58, 106 50"

export function SectionLines({ className }: { className?: string }) {
  const gradientId = useId()

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(203,226,210,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <path
        d={SECTION_ARC}
        pathLength={100}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={SECTION_ARC}
        pathLength={100}
        fill="none"
        stroke="rgba(203,226,210,0.14)"
        strokeWidth={1}
        strokeLinecap="round"
        strokeDasharray="0.12 5"
        vectorEffect="non-scaling-stroke"
        className="animate-line-flow"
      />
      <path
        d={SECTION_ARC}
        pathLength={100}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={1}
        strokeLinecap="round"
        strokeDasharray="3 97"
        vectorEffect="non-scaling-stroke"
        className="animate-line-flow-back"
      />
    </svg>
  )
}