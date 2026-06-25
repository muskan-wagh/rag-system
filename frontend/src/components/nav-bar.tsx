"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Menu, Sparkles } from "lucide-react"
import { ROUTES } from "@/lib/constants"
import { useState } from "react"

const navItems = [
  { href: ROUTES.candidates, label: "Search" },
  { href: ROUTES.compare, label: "Compare" },
]

export function NavBar() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-white/[0.06]">
      <div className="flex h-14 items-center px-4 md:px-6 max-w-7xl mx-auto">
        <Link href={ROUTES.home} className="mr-8 flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="hidden sm:inline text-gradient text-base">AI Recruiter</span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {navItems.map((item) => (
              <NavigationMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <NavigationMenuLink
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "bg-transparent data-active:bg-white/[0.08] data-active:text-white data-active:shadow-none",
                      "hover:bg-white/[0.06] hover:text-white",
                      "text-muted-foreground",
                    )}
                    active={isActive(item.href)}
                  >
                    {item.label}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
            Sign In
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
          >
            Get Started
          </Button>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>} />
          <SheetContent side="right" className="glass-heavy border-l border-white/[0.06]">
            <div className="flex flex-col gap-1 mt-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheetOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-white/[0.08] text-white"
                      : "text-muted-foreground hover:text-white hover:bg-white/[0.04]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-3 border-white/[0.06]" />
              <Button variant="ghost" size="sm" className="justify-start text-muted-foreground">
                Sign In
              </Button>
              <Button
                size="sm"
                className="mt-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
              >
                Get Started
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
