import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { cookies } from "next/headers"
import Script from "next/script"
import { ClerkProvider } from "@clerk/nextjs"
import { ui } from "@clerk/ui"
import { dark, shadcn } from "@clerk/ui/themes"
import "./globals.css"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  preload: false,
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL("https://hirestack.app"),
  title: {
    default: "HireStack — AI-Powered Candidate Discovery",
    template: "%s · HireStack",
  },
  description:
    "An AI-assisted hiring workspace: semantic resume screening, generated assessments, structured interviews and a gated pipeline from application to offer.",
  keywords: [
    "recruiting software",
    "candidate screening",
    "AI resume screening",
    "hiring pipeline",
    "technical assessment",
  ],
  openGraph: {
    title: "HireStack — Rank every resume. Justify every decision.",
    description:
      "Semantic resume screening, generated assessments, structured interviews and a gated hiring pipeline.",
    type: "website",
    siteName: "HireStack",
  },
  twitter: {
    card: "summary_large_image",
    title: "HireStack — AI-Powered Candidate Discovery",
    description:
      "Semantic resume screening, assessments, interviews and a gated hiring pipeline.",
  },
  robots: { index: true, follow: true },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const theme = cookieStore.get("hirestack-theme")?.value
  const isDark = theme === "dark"

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}${isDark ? " dark" : ""}`}
    >
      <body className="flex min-h-screen flex-col bg-background antialiased">
        <Script id="theme-boot" strategy="beforeInteractive">
          {`(function(){try{var c=document.cookie.split(";").map(function(s){return s.trim()}).find(function(s){return s.indexOf("hirestack-theme=")===0});var raw=c?decodeURIComponent(c.split("=")[1]):null;var choice=raw==="light"||raw==="dark"?raw:"system";var dark=choice==="dark"||(choice==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})()`}
        </Script>
        <ClerkProvider
          ui={ui}
          appearance={{
            // shadcn for brand styling + dark base when dark mode is active
            // so Clerk internals (icons, OTP, status) match the theme.
            // Our CSS-var appearance + globals.css overrides keep the
            // toggle instant on the client without a reload.
            theme: isDark ? [shadcn, dark] : shadcn,
          }}
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ClerkProvider>
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!rounded-xl !border-border !bg-surface !text-ink !font-sans !shadow-lg",
              title: "!text-[13px] !font-medium",
              description: "!text-[12px] !text-muted",
            },
          }}
        />
      </body>
    </html>
  )
}
