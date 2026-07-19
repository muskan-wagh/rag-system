"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex items-center gap-1 bg-surface-secondary p-1 rounded-full",
        className
      )}
      {...props}
    />
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "inline-flex items-center justify-center px-4 py-1.5 text-xs font-medium transition-all rounded-full cursor-pointer",
        "text-muted hover:text-ink",
        "data-selected:bg-white data-selected:text-ink data-selected:shadow-[0_1px_2px_rgba(10,10,10,0.04)]",
        className
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("flex-1 overflow-y-auto pt-6", className)}
      {...props}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTab,
  TabsPanel,
}
