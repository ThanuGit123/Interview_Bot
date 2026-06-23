import { useEffect, useRef, useState } from 'react'
import { notifyError, notifySuccess, notifyWarning } from '@/lib/notify'
import { Gauge, FileSearch, Sparkles, MessagesSquare, PenLine } from 'lucide-react'
import MessageBubble from './MessageBubble'
import Composer from './Composer'
import ResumePreview from './ResumePreview'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/store/chatStore'
import { useThreadSocket } from '@/lib/hooks/useThreadSocket'
import * as api from '@/lib/services/api'

const SUGGESTIONS = [
  { icon: FileSearch, label: 'ATS score & fixes', sub: 'Review my resume out of 100', text: 'Review my resume and give me an ATS score out of 100 with concrete fixes.' },
  { icon: Sparkles, label: 'Highlight my skills', sub: 'What to lead with in interviews', text: 'Based on my resume, which skills should I highlight for interviews?' },
  { icon: MessagesSquare, label: 'Mock interview', sub: 'One question at a time', text: 'Interview me based on my resume. Ask one question to start.' },
  { icon: PenLine, label: 'Improve a bullet', sub: 'Rewrite one line stronger', text: 'Pick one bullet from my resume and rewrite it to be stronger and quantified.' },
]

export default function ChatPanel({ ensureThread }) {
  const {
    activeThreadId, messages, isStreaming, status,
    addMessage, setMessages, startAssistant, appendToken, setStatus, finishAssistant, failAssistant, patchThread,
    addTool, patchTool, addSource, user
  } = useChatStore()
  const viewportRef = useRef(null)
  const reconnectedRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const [previewResume, setPreviewResume] = useState(null)
  
  const [dashboardData, setDashboardData] = useState(null)
  const isEmpty = messages.length === 0

  useEffect(() => {
    if (isEmpty) {
      api.getDashboard().then(data => setDashboardData(data)).catch(console.error)
    }
  }, [isEmpty])

  // drop the pending attachment when switching threads
  useEffect(() => {
    setPendingAttachment(null)
  }, [activeThreadId])

  const { send } = useThreadSocket(activeThreadId, {
    onOpen: async () => {
      setStatus(null)
      if (reconnectedRef.current && activeThreadId) {
        reconnectedRef.current = false
        notifySuccess('Reconnected')
        try {
          const msgs = await api.getThreadMessages(activeThreadId)
          setMessages(
            (msgs || []).map((m, i) => ({
              id: m.id || `m-${i}`,
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content || '',
              attachment: m.metadata?.attachment,
            }))
          )
        } catch (_) {
          /* keep current view */
        }
      }
    },
    onToken: (delta) => appendToken(delta),
    onStatus: (d) => setStatus(d?.message || null),
    onToolCall: (d) => addTool(d),
    onToolResult: (d) => patchTool(d),
    onSource: (d) => addSource(d),
    onComplete: (d) => finishAssistant(d),
    onTitle: (d) => {
      if (activeThreadId && d?.title) patchThread(activeThreadId, { title: d.title })
    },
    onReconnecting: (n) => {
      reconnectedRef.current = true
      setStatus(`Reconnecting (${n}/3)…`)
      if (n === 1) notifyWarning('Connection lost — reconnecting…')
    },
    onClosed: () => setStatus(null),
    onError: (d) => {
      failAssistant()
      notifyError({ message: d?.message, traceId: d?.trace_id }, 'Something went wrong')
    },
  })

  useEffect(() => {
    const v = viewportRef.current
    if (v) v.scrollTop = v.scrollHeight
  }, [messages, status])

  const trySend = (payload, tries = 0) => {
    if (send(payload)) return true
    if (tries < 15) {
      setTimeout(() => trySend(payload, tries + 1), 200)
      return true
    }
    failAssistant()
    notifyError({ message: 'Not connected. Please try again.' })
    return false
  }

  const sendText = async (text) => {
    let tid = activeThreadId
    if (!tid) {
      tid = await ensureThread()
      if (!tid) return
    }
    const attachment = pendingAttachment ? { ...pendingAttachment } : undefined
    addMessage({ id: `u-${Date.now()}`, role: 'user', content: text, attachment })
    if (attachment) setPendingAttachment(null)
    if (!useChatStore.getState().threads.find((t) => t.id === tid)?.title) {
      patchThread(tid, { title: text.slice(0, 40) })
    }
    startAssistant()
    trySend({ action: 'answer', text, resume_id: attachment?.resume_id })
  }

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const res = await api.uploadResume(file)
      let tid = activeThreadId
      if (!tid) {
        tid = await ensureThread(res.resume_id)
      } else {
        await api.attachResume(tid, res.resume_id)
      }
      if (!tid) return
      setPendingAttachment({ resume_id: res.resume_id, filename: res.filename })
      notifySuccess('Resume attached', 'Ask anything or pick an action below.')
    } catch (e) {
      notifyError(e, 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const isReturning = dashboardData?.latest_score != null || (dashboardData?.weak_topics && dashboardData.weak_topics.length > 0)
  const userName = dashboardData?.name || 'there'

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
            {isReturning ? (
              <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex flex-col items-center justify-center">
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl text-foreground">Welcome back, {userName}!</h1>
                  {dashboardData.target_role && (
                     <p className="mt-2 text-base text-muted-foreground">
                       Targeting: <span className="font-semibold text-primary">{dashboardData.target_role}</span> {dashboardData.target_company && `at ${dashboardData.target_company}`}
                     </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {/* Stats Card */}
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-4">
                      <Gauge className="h-4 w-4" /> ATS Match Score
                    </h3>
                    {dashboardData.latest_score ? (
                      <div className="flex items-end gap-3">
                        <span className="text-4xl font-bold text-foreground">{dashboardData.latest_score}</span>
                        <span className="text-sm text-muted-foreground mb-1 block">/ 100</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent scores.</p>
                    )}
                    
                    {dashboardData.recent_scores?.length > 1 && (
                      <div className="mt-6">
                        <div className="flex items-end gap-1.5 h-16 w-full mt-2">
                          {dashboardData.recent_scores.map((item, idx) => (
                            <div key={idx} className="relative flex-1 group flex flex-col justify-end h-full">
                              <div 
                                className="w-full bg-primary/20 hover:bg-primary/40 rounded-t-sm transition-all"
                                style={{ height: `${Math.max(item.score, 10)}%` }}
                              ></div>
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] py-0.5 px-1.5 rounded">
                                {item.score}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5 text-center uppercase tracking-wider">Score History</p>
                      </div>
                    )}
                  </div>

                  {/* Insights Card */}
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-4">
                      <Sparkles className="h-4 w-4" /> Actionable Insights
                    </h3>
                    {dashboardData.weak_topics?.length > 0 ? (
                      <div className="flex-1 flex flex-col justify-center">
                        <p className="text-sm text-foreground mb-3">
                          Based on your last interview, you struggled most with:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {dashboardData.weak_topics.map(topic => (
                            <span key={topic} className="bg-destructive/10 text-destructive text-xs font-medium px-2 py-1 rounded-md capitalize">
                              {topic}
                            </span>
                          ))}
                        </div>
                        <button 
                          onClick={() => sendText(`Let's do a mock interview focusing specifically on ${dashboardData.weak_topics.join(" and ")}.`)}
                          className="mt-4 text-xs font-medium text-primary hover:underline text-left"
                        >
                          Practice these topics →
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <p className="text-sm text-muted-foreground">Upload a resume or start an interview to get insights.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => sendText("Let's do a full mock interview.")}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MessagesSquare className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-foreground">Start Mock Interview</span>
                  </button>
                  <button
                    onClick={() => sendText("Review my resume and give me an ATS score out of 100 with concrete fixes.")}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileSearch className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-foreground">ATS Score & Fixes</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/10">
                  <Gauge className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl text-foreground">What can I help you with?</h1>
                <p className="mt-2.5 max-w-md text-center text-[15px] text-muted-foreground">
                  Upload your resume for an ATS review, sharpen your skills, or start a mock interview.
                </p>
                <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendText(s.text)}
                      className="group flex items-start gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-all duration-300 hover:border-primary/30 hover:bg-gradient-to-br hover:from-card hover:to-primary/5 hover:shadow-soft hover:-translate-y-0.5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground shadow-sm">
                        <s.icon className="h-[20px] w-[20px]" />
                      </span>
                      <span className="min-w-0 mt-0.5">
                        <span className="block text-[15px] font-semibold text-foreground tracking-tight">{s.label}</span>
                        <span className="block truncate text-[13px] text-muted-foreground mt-0.5">{s.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="flex-1" viewportRef={viewportRef}>
            <div className="mx-auto w-full max-w-3xl py-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} onPreview={setPreviewResume} />
              ))}
              {status && !isStreaming && (
                <div className="px-4 py-1 pl-14 text-xs text-muted-foreground">
                  <span className="animate-pulse">{status}</span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <Composer
          onSend={sendText}
          onUpload={handleUpload}
          disabled={isStreaming}
          uploading={uploading}
          pendingAttachment={pendingAttachment}
          onRemoveAttachment={() => setPendingAttachment(null)}
          onPreviewAttachment={setPreviewResume}
        />
      </div>

      {previewResume && (
        <ResumePreview
          resumeId={previewResume.resume_id}
          filename={previewResume.filename}
          onClose={() => setPreviewResume(null)}
        />
      )}
    </div>
  )
}
