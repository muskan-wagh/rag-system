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
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" strokeWidth={1.5} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border border-input bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ring transition-all duration-120"
      />
    </div>
  )
}
