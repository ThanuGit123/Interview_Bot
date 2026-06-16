import { create } from 'zustand'

// Chat UI state. Threads list for the sidebar; messages for the active thread;
// streaming state for the in-progress assistant reply.
export const useChatStore = create((set, get) => ({
  threads: [],
  activeThreadId: null,
  messages: [],
  isStreaming: false,
  status: null, // e.g. "Reading your resume…"

  setThreads: (threads) => set({ threads }),
  addThread: (thread) => set((s) => ({ threads: [thread, ...s.threads.filter((t) => t.id !== thread.id)] })),
  patchThread: (id, patch) =>
    set((s) => ({ threads: s.threads.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  removeThread: (id) =>
    set((s) => ({
      threads: s.threads.filter((t) => t.id !== id),
      ...(s.activeThreadId === id ? { activeThreadId: null, messages: [], isStreaming: false, status: null } : {}),
    })),

  setActiveThread: (id) => set({ activeThreadId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),

  // streaming lifecycle for the assistant reply
  startAssistant: () =>
    set((s) => ({
      isStreaming: true,
      status: null,
      messages: [...s.messages, { id: '__streaming__', role: 'assistant', content: '' }],
    })),
  appendToken: (delta) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === '__streaming__' ? { ...m, content: m.content + delta } : m
      ),
    })),
  setStatus: (status) => set({ status }),
  finishAssistant: (final) =>
    set((s) => ({
      isStreaming: false,
      status: null,
      messages: s.messages.map((m) =>
        m.id === '__streaming__'
          ? { id: final?.message_id || `a-${Date.now()}`, role: 'assistant', content: final?.content ?? m.content }
          : m
      ),
    })),
  failAssistant: () =>
    set((s) => ({
      isStreaming: false,
      status: null,
      messages: s.messages.filter((m) => m.id !== '__streaming__'),
    })),

  resetActive: () => set({ activeThreadId: null, messages: [], isStreaming: false, status: null }),
}))
