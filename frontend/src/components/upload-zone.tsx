"use client"

import { useState, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { Upload, FileText } from "lucide-react"

interface UploadZoneProps {
  file: File | null
  onFileSelect: (file: File | null) => void
}

export function UploadZone({ file, onFileSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function isValidFile(f: File): boolean {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    const validExt = f.name.endsWith(".pdf") || f.name.endsWith(".docx")
    return validTypes.includes(f.type) || validExt
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile && isValidFile(droppedFile)) {
        onFileSelect(droppedFile)
      }
    },
    [onFileSelect],
  )

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && isValidFile(selectedFile)) {
      onFileSelect(selectedFile)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
        dragging
          ? "border-primary bg-primary/5"
          : file
            ? "border-green-300 bg-green-50/50"
            : "border-border hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        onChange={handleChange}
        className="hidden"
      />

      <motion.div
        initial={false}
        animate={{ scale: dragging ? 1.1 : 1 }}
        className="flex flex-col items-center gap-3"
      >
        {file ? (
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-green-600" />
          </div>
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
        )}

        {!file && (
          <>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop your resume here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
                PDF
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
                DOCX
              </span>
            </div>
          </>
        )}

        {file && (
          <p className="text-xs text-green-600 font-medium">File selected</p>
        )}
      </motion.div>
    </div>
  )
}
