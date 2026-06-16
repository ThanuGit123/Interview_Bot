import { toast } from 'sonner'

// Every failure shows a toast; if the backend gave a trace_id, show it small
// underneath so a screenshot is enough to find the exact failure in the logs.
export function notifyError(err, fallback = 'Something went wrong') {
  const message = err?.message || fallback
  const trace = err?.traceId
  toast.error(message, trace ? { description: `trace ${trace}` } : undefined)
}

export function notifySuccess(message, description) {
  toast.success(message, description ? { description } : undefined)
}

export function notifyWarning(message, description) {
  toast.warning(message, description ? { description } : undefined)
}
