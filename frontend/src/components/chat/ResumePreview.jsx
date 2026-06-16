import { useEffect, useState } from 'react'
import { X, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import * as api from '@/lib/services/api'

export default function ResumePreview({ resumeId, filename, onClose }) {
  const isPdf = (filename || '').toLowerCase().endsWith('.pdf')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [text, setText] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrl
    setLoading(true)
    setError(null)
    setPdfUrl(null)
    setText('')

    const loadText = async () => {
      const r = await api.getResume(resumeId)
      if (!cancelled) setText(r.extracted_text || '')
    }

    const load = async () => {
      try {
        if (isPdf) {
          try {
            const blob = await api.getResumeFile(resumeId)
            objectUrl = URL.createObjectURL(blob)
            if (!cancelled) setPdfUrl(objectUrl)
          } catch (_) {
            // Older resumes have no stored file — fall back to the extracted text.
            await loadText()
          }
        } else {
          await loadText()
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load resume')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [resumeId, isPdf])

  return (
    <aside className="flex h-full w-[460px] shrink-0 flex-col border-l border-border bg-card/40 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{filename || 'Resume'}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Close preview">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-destructive">{error}</div>
      ) : isPdf && pdfUrl ? (
        <iframe title="Resume preview" src={pdfUrl} className="h-full w-full flex-1 border-0 bg-white" />
      ) : (
        <ScrollArea className="flex-1">
          <pre className="whitespace-pre-wrap break-words p-4 font-sans text-[13px] leading-relaxed text-foreground/90">
            {text}
          </pre>
        </ScrollArea>
      )}
    </aside>
  )
}
