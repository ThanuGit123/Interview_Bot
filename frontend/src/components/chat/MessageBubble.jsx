import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Gauge, User, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MessageBubble({ message, onPreview }) {
  const isUser = message.role === 'user'
  const isStreamingEmpty = !isUser && message.id === '__streaming__' && !message.content

  return (
    <div className={cn('flex animate-fade-in gap-3 px-4 py-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/10">
          <Gauge className="h-[18px] w-[18px]" />
        </div>
      )}

      <div className={cn('flex min-w-0 max-w-[680px] flex-col', isUser ? 'items-end' : 'items-start')}>
        {!isUser && <span className="mb-1 pl-1 text-xs font-medium text-muted-foreground">Caliber</span>}

        <div
          className={cn(
            'rounded-2xl text-[15px] leading-[1.7]',
            isUser
              ? 'bg-primary px-4 py-2.5 text-primary-foreground'
              : 'border border-border/70 bg-card px-4 py-3 shadow-sm'
          )}
        >
          {message.attachment && (
            <button
              type="button"
              onClick={() => onPreview?.(message.attachment)}
              className={cn(
                'mb-2 inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                isUser ? 'bg-background/25 hover:bg-background/40' : 'bg-muted hover:bg-accent'
              )}
              title="Preview resume"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[200px] truncate">{message.attachment.filename}</span>
            </button>
          )}

          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreamingEmpty ? (
            <span className="inline-block h-4 w-2 animate-blink rounded-sm bg-primary align-middle" />
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}
