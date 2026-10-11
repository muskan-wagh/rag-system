"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { BrandMark } from "@/components/brand"

export function CTASection() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.07]">
      {/* One soft bloom behind the panel. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(196,222,204,0.10),transparent_76%)] blur-[100px]" />
      </div>

      <div className="container-page section-y relative">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex max-w-2xl flex-col items-center text-center"
        >
          <span className="relative flex size-11 items-center justify-center">
            <span className="absolute inset-0 rounded-[12px] bg-[#CBE2D2]/10 ring-1 ring-inset ring-[#CBE2D2]/25" />
            <BrandMark size={40} variant="soft" className="bg-transparent ring-0" />
          </span>

          <h2 className="mt-7 text-balance text-[32px] font-medium leading-[1.08] tracking-[-0.03em] text-white sm:text-[42px]">
            Open a role and see the shortlist today
          </h2>
          <p className="mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-white/50 sm:text-[17px]">
            Create an account, paste a job description, and run your first screening.
            Candidates apply through a link you control — no setup call required.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-[14px] font-medium text-[#0A0A0A] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#CBE2D2]"
            >
              Create your account
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-6 text-[14px] font-medium text-white/80 transition-all duration-300 hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-7 text-[12.5px] text-white/45">
            Recruiting already using HireStack?{" "}
            <Link
              href="/dashboard"
              className="font-medium text-white/80 underline underline-offset-4 transition-colors hover:text-white"
            >
              Go to your dashboard
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
