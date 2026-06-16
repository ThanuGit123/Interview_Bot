import { useEffect, useState } from 'react'
import { notifyError } from './lib/notify'
import Auth from './components/Auth'
import LandingPage from './components/LandingPage'
import Sidebar from './components/chat/Sidebar'
import ChatPanel from './components/chat/ChatPanel'
import TopBar from './components/chat/TopBar'
import { Toaster } from './components/ui/sonner'
import { useChatStore } from './store/chatStore'
import * as api from './lib/services/api'

const TOKEN_KEY = 'careerForgeToken'

export default function App() {
  const [view, setView] = useState(localStorage.getItem(TOKEN_KEY) ? 'app' : 'landing')
  const [booting, setBooting] = useState(!!localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const { setThreads, addThread, setActiveThread, setMessages, resetActive, patchThread, removeThread } = useChatStore()

  // Session restore: keep the user logged in across refreshes unless the token is invalid.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setBooting(false)
      return
    }
    api
      .me()
      .then((u) => {
        setUser(u)
        setView('app')
        setBooting(false)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('careerForgeUserId')
        setView('auth')
        setBooting(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshThreads = async () => {
    try {
      const data = await api.listThreads()
      setThreads(
        (data || []).map((t) => ({ id: t.id, title: t.title || null, date: t.date }))
      )
    } catch (e) {
      // non-fatal for the shell
      console.error('listThreads failed', e)
    }
  }

  useEffect(() => {
    if (view === 'app') refreshThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const handleLoggedIn = async () => {
    try {
      setUser(await api.me())
    } catch (_) {
      /* non-fatal */
    }
    setView('app')
  }

  const ensureThread = async (resumeId) => {
    try {
      const payload = resumeId ? { resume_id: resumeId, type: 'chat' } : { type: 'chat' }
      const { thread_id } = await api.createThread(payload)
      addThread({ id: thread_id, title: null, date: new Date().toISOString().slice(0, 10) })
      setActiveThread(thread_id)
      setMessages([])
      return thread_id
    } catch (e) {
      notifyError(e, 'Could not start a new chat')
      return null
    }
  }

  const newChat = () => {
    resetActive()
  }

  const selectThread = async (id) => {
    setActiveThread(id)
    setMessages([])
    try {
      const msgs = await api.getThreadMessages(id)
      setMessages(
        (msgs || []).map((m, i) => ({
          id: m._id || m.id || `m-${i}`,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
          attachment: m.metadata?.attachment,
        }))
      )
    } catch (e) {
      notifyError(e, 'Could not load this conversation')
    }
  }

  const handleRename = async (id, title) => {
    const t = (title || '').trim()
    if (!t) return
    patchThread(id, { title: t }) // optimistic
    try {
      await api.renameThread(id, t)
    } catch (e) {
      notifyError(e, 'Rename failed')
    }
  }

  const handleDelete = async (id) => {
    removeThread(id) // optimistic
    try {
      await api.deleteThread(id)
    } catch (e) {
      notifyError(e, 'Delete failed')
      refreshThreads()
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('careerForgeUserId')
    resetActive()
    setThreads([])
    setUser(null)
    setView('auth')
  }

  if (booting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (view === 'landing') return <LandingPage onGetStarted={() => setView('auth')} />
  if (view === 'auth') return <Auth onLoginSuccess={handleLoggedIn} onBack={() => setView('landing')} />

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        onNewChat={newChat}
        onSelect={selectThread}
        onLogout={logout}
        onRename={handleRename}
        onDelete={handleDelete}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar onLogout={logout} user={user} />
        <ChatPanel ensureThread={ensureThread} />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
