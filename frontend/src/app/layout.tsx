import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { cookies } from "next/headers"
import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import "./globals.css"
import { Toaster } from "sonner"
import { ThemeSync } from "@/components/theme-sync"

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
  title: "RecruitIQ — AI-Powered Candidate Discovery",
  description:
    "AI-powered candidate discovery and ranking. Find the right candidate in seconds.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const theme = cookieStore.get("recruitiq-theme")?.value
  const isDark = theme === "dark"

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}${isDark ? " dark" : ""}`}
    >
      <body className="min-h-screen flex flex-col antialiased bg-background">
        <ThemeSync />
        <ClerkProvider
          appearance={{
            theme: shadcn,
          }}
        >
          {children}
        </ClerkProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
