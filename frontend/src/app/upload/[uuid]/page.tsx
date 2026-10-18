"use client"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { UploadZone } from "@/components/upload-zone"
import { readApiResponse, toReadableError } from "@/lib/http"

export default function UploadPage() {
  const params = useParams()
  const uuid = params.uuid as string

  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState("")
  const [candidateName, setCandidateName] = useState("")

  const handleUpload = useCallback(async () => {
    if (!file) return

    setUploading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("resume", file)

      const res = await fetch(`/api/upload/${uuid}`, {
        method: "POST",
        body: formData,
      })

      const data = await readApiResponse<{ name?: string }>(res, `/api/upload/${uuid}`);

      if (data.success) {
        setUploaded(true)
        setCandidateName(data.data?.name || "Your resume")
      } else {
        setError(data.error || "Upload failed. Please try again.")
      }
    } catch (err) {
      setError(toReadableError(err, "Failed to connect to server. Please try again."))
    } finally {
      setUploading(false)
    }
  }, [file, uuid])

  if (uploaded) {
    return (
      <div className="min-h-[calc(100vh-0.75rem)] bg-gradient-to-b from-success/10 to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="bg-surface rounded-2xl p-10 border border-success shadow-lg">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-success/12 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">Application Submitted!</h1>
            <p className="text-sm text-muted mb-6">
              Thank you, {candidateName}. Your resume has been received and is being processed.
            </p>
            <div className="bg-success/10 rounded-xl p-4 text-xs text-success">
              You can close this page. The recruiter will review your application.
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-0.75rem)] bg-gradient-to-b from-[#170C2B]/5 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Submit Your Resume</h1>
              <p className="text-xs text-muted">Upload your resume to apply for this position</p>
            </div>
          </div>

          <UploadZone file={file} onFileSelect={setFile} />

          {file && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-[10px] text-muted">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-[10px] text-muted hover:text-destructive transition-colors shrink-0"
              >
                Remove
              </button>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 p-3 rounded-xl bg-danger/8 border border-danger/25 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
              <p className="text-xs text-danger">{error}</p>
            </motion.div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="mt-5 w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary-solid text-primary-solid-text text-sm font-medium hover:bg-primary-solid/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Submit Resume
              </>
            )}
          </button>

          <p className="mt-4 text-[10px] text-center text-muted">
            Supported formats: PDF, DOCX &bull; Max size: 5MB
          </p>
        </div>
      </motion.div>
    </div>
  )
}
