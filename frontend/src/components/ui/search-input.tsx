"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  inputRef,
}: SearchInputProps) {
  return (
    <div className={cn("relative flex-1 max-w-md", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring/40 transition-all"
      />
    </div>
  )
}
