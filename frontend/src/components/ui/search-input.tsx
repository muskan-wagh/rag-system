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
      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" strokeWidth={1.5} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3.5 text-[13px] text-ink outline-none transition-colors duration-120 placeholder:text-faint focus:border-border-hover"
      />
    </div>
  )
}
