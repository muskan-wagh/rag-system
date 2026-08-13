import { clerkMiddleware } from "@clerk/nextjs/server"

const PUBLIC_PREFIXES = ["/upload", "/sign-in", "/sign-up", "/api"]

const isPublicPath = (pathname: string): boolean => {
  if (pathname === "/" || pathname === "/how-it-works") return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicPath(req.nextUrl.pathname)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}
