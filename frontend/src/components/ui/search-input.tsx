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
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3]" strokeWidth={1.5} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-4 text-sm rounded-[18px] border border-[#ECECEC] bg-white focus:outline-none focus:border-[#111111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-all"
      />
    </div>
  )
}
