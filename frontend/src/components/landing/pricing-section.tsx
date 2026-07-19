"use client"

import { motion } from "framer-motion"
import { Check, ArrowRight } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"
import { PrimaryButton } from "@/components/ui/primary-button"

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for getting started with AI-powered hiring",
    features: [
      "Up to 50 candidates/month",
      "Basic resume parsing",
      "Smart ranking",
      "Email support",
    ],
    cta: "Get Started",
    href: "/sign-up",
  },
  {
    name: "Professional",
    price: "$49",
    period: "/month",
    description: "For growing teams that need advanced hiring tools",
    features: [
      "Up to 500 candidates/month",
      "Advanced AI parsing",
      "Semantic search",
      "Side-by-side comparison",
      "Bias detection",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/sign-up",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For organizations with complex hiring needs",
    features: [
      "Unlimited candidates",
      "Custom AI models",
      "SSO & SCIM",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "On-premise deployment",
    ],
    cta: "Contact Sales",
    href: "/sign-up",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function PricingSection() {
  return (
    <section id="pricing" className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Pricing"
          title="Simple, transparent"
          highlight="pricing"
          description="Choose the plan that fits your team. No hidden fees."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={cardVariants}
              className={`relative ${plan.popular ? "md:-mt-4 md:mb-4" : ""}`}
            >
              <div className={`rounded-xl p-6 h-full flex flex-col bg-surface border ${plan.popular ? "border-ink" : "border-border"} hover:border-border-hover transition-all duration-120`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="inline-flex items-center gap-1 rounded-[6px] bg-info px-4 py-1 text-xs font-medium text-white" style={{ fontFamily: "var(--font-inter)" }}>
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-medium text-ink mb-1" style={{ fontFamily: "var(--font-inter)" }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="font-data text-3xl font-medium text-ink">{plan.price}</span>
                    {plan.period && <span className="text-sm text-muted" style={{ fontFamily: "var(--font-inter)" }}>{plan.period}</span>}
                  </div>
                  <p className="text-sm text-muted mt-2" style={{ fontFamily: "var(--font-inter)" }}>{plan.description}</p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-ink shrink-0 mt-0.5" strokeWidth={1.5} />
                      <span className="text-sm text-ink" style={{ fontFamily: "var(--font-inter)" }}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <PrimaryButton href={plan.href} className="w-full justify-center">
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
