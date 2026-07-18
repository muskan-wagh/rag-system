import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import "./globals.css"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
})

export const metadata: Metadata = {
  title: "RecruitIQ — AI-Powered Candidate Discovery",
  description:
    "AI-powered candidate discovery and ranking. Find the right candidate in seconds.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col antialiased bg-background">
        <ClerkProvider
          appearance={{
            theme: shadcn,
          }}
        >
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </ClerkProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
