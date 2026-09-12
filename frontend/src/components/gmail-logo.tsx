import { cn } from "@/lib/utils"

interface GmailLogoProps {
  className?: string
}

/**
 * Multicolor Gmail-style envelope mark (blue / red / yellow / green),
 * drawn with strokes so it stays crisp at small sizes and works on
 * both light and dark surfaces. Decorative — pair with visible text.
 */
export function GmailLogo({ className }: GmailLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path
        d="M2.5 5.5v13a1 1 0 0 0 1 1H12"
        stroke="#4285F4"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 5.5v13a1 1 0 0 1-1 1H12"
        stroke="#34A853"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 6l9 6.8"
        stroke="#EA4335"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 6l-9 6.8"
        stroke="#FBBC05"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
