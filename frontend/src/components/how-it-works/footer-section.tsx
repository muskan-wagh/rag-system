"use client";

import { motion } from "framer-motion";
import { GitBranch } from "lucide-react";
import Link from "next/link";

const links = [
  {
    icon: GitBranch,
    label: "GitHub",
    href: "https://github.com/muskan-wagh/rag-system",
  },
];

export function FooterSection() {
  return (
    <footer className="w-full border-t border-border bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-10 md:py-14">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center md:items-start gap-2"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-base font-semibold text-foreground tracking-tight">
                Recruit<span className="text-primary">IQ</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              AI-Powered Recruitment Intelligence
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-1"
          >
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 pt-6 border-t border-border text-center md:text-left"
        >
          <p className="text-[11px] text-muted-foreground/60">
            Built with Next.js, Express, GPT-OSS-120B, FastEmbed, and Qdrant
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
