# Technical Architecture & Research

**Status:** Reference — drives the v3 chatbot build (see `CHATBOT_REDESIGN.md` for the product spec).
**Purpose:** Capture the architecture research and the chosen frontend/backend stack and patterns, so the build is consistent and nothing has to be re-discovered.
**Reference:** Patterns are adapted from an in-house production conversational system (frontend + backend) we operate. We borrow its *patterns*, not its heavyweight infrastructure — this app stays on free tiers.
**Last updated:** 2026-06-16

---

## 1. Guiding principle

**Borrow proven patterns, skip heavyweight infra.** The production reference system runs on Next.js + Postgres + pgvector + Redis + paid embedding/rerank services. That is overkill (and not free) for this app. We keep the existing, working FastAPI + MongoDB + LangGraph + Groq/Gemini backend and a Vite + React frontend, and we adopt the reference system's *patterns* for the chat UI, the agent loop, streaming, prompts, and context.

| Concern | Reference system | This app |
|---|---|---|
| Frontend framework | Next.js (App Router) | **Vite + React** (already set up — no rewrite) |
| UI kit | shadcn/ui + Tailwind | **shadcn/ui + Tailwind** ✅ adopt |
| State | Zustand (persisted, user-scoped) | **Zustand** ✅ adopt |
| Backend | FastAPI | **FastAPI** ✅ already |
| Agent | LangGraph | **LangGraph** ✅ already |
| LLM | Anthropic primary + fallbacks | **Groq primary → Gemini** (free) |
| DB | Postgres + pgvector + Redis | **MongoDB** (free Atlas) ✅ keep |
| Doc RAG | Voyage embeddings + Cohere rerank | **Not needed** (resume fits in context) |
| Error tracking | Sentry | **structlog only** (free) |

**Deliberately skipped:** Next.js migration, Postgres, Redis, pgvector, paid embeddings/reranking, Sentry. If multi-document RAG is ever needed, add a vector store then — not now.

---

## 2. Frontend stack (production-grade, Vite)

| Layer | Library | Notes |
|---|---|---|
| Framework | React 19 + Vite | already in repo |
| Styling | **Tailwind CSS 3** | utility-first; design tokens as CSS variables |
| Components | **shadcn/ui** | Radix-based, copy-in components in `components/ui/` |
| Class merge | `cn()` = `twMerge(clsx(...))` | the one util every component uses |
| State | **Zustand** (+ persist) | chat/threads/auth stores, user-scoped keys |
| Markdown | **react-markdown + remark-gfm** | assistant messages render as GFM |
| Icons | **lucide-react** | already in |
| Animation | framer-motion | already in (use sparingly) |
| Realtime | native **WebSocket** + a reconnecting hook | one socket per open thread |
| HTTP | `fetch` wrapper | attaches JWT, parses the `{error,...}` envelope |

### 2.1 shadcn/ui setup (Vite)
- Install Tailwind, then `npx shadcn@latest init` → base color **slate**, **CSS variables** on, alias `@/components` and `@/lib/utils`.
- Vite needs the `@` path alias in `vite.config.js` + `jsconfig.json`:
  ```js
  // vite.config.js
  import path from 'path'
  export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: { port: 3000, strictPort: true },
  })
  ```
- `cn()` helper:
  ```js
  // src/lib/utils.js
  import { clsx } from 'clsx'
  import { twMerge } from 'tailwind-merge'
  export function cn(...inputs) { return twMerge(clsx(inputs)) }
  ```
- Theme via CSS variables in `index.css` (`:root` + `.dark`), default to dark. Reuse the existing palette: bg `#0B1120`, accent `#2563EB`, Inter font.
- Add only the components we use: `button`, `input`, `textarea`, `scroll-area`, `avatar`, `dropdown-menu`, `dialog`, `tooltip`, `separator`, `skeleton`, `sonner` (toasts).

### 2.2 Folder structure
```
frontend/src/
├── components/
│   ├── ui/                 # shadcn components (generated)
│   └── chat/
│       ├── Sidebar.jsx     # logo, New Chat, dated thread list, Logout
│       ├── ChatPanel.jsx   # message list + empty state + streaming
│       ├── MessageBubble.jsx
│       └── Composer.jsx    # 📎 resume upload + textarea + send
├── lib/
│   ├── utils.js            # cn()
│   ├── services/api.js     # fetch wrapper (auth + error envelope)
│   └── hooks/useThreadSocket.js  # reconnecting WS, token streaming
├── store/
│   ├── authStore.js
│   └── chatStore.js        # threads, messages, active thread (zustand persist)
├── pages/ (Auth, Landing)  # keep existing auth/landing
├── App.jsx                 # auth gate → chat shell (Sidebar + ChatPanel)
└── index.css               # Tailwind + design tokens
```

### 2.3 Key patterns to replicate

**API wrapper** — single place that adds the JWT and surfaces the error envelope:
```js
// src/lib/services/api.js
const BASE = 'http://localhost:8000/api'
function authHeaders() {
  const t = localStorage.getItem('careerForgeToken')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
export async function api(path, { method = 'GET', body, isForm } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...authHeaders() },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = 'Request failed'
    try { const e = await res.json(); msg = e.message || msg } catch {}
    throw new Error(msg)               // fail loud — never fake data
  }
  return res.json()
}
```

**Reconnecting WebSocket hook** — one socket per open thread, stable refs, capped reconnect, token streaming:
```js
// src/lib/hooks/useThreadSocket.js  (shape)
export function useThreadSocket(threadId, { onToken, onStatus, onComplete, onError }) {
  const wsRef = useRef(null); const attempts = useRef(0)
  useEffect(() => {
    if (!threadId) return
    let closedByUs = false
    const connect = () => {
      const token = localStorage.getItem('careerForgeToken')
      const ws = new WebSocket(`ws://localhost:8000/api/ws/threads/${threadId}?token=${token}`)
      wsRef.current = ws
      ws.onmessage = (e) => {
        const { event_type, data } = JSON.parse(e.data)
        if (event_type === 'token') onToken?.(data.delta)
        else if (event_type === 'status') onStatus?.(data)
        else if (event_type === 'message_complete') onComplete?.(data)
        else if (event_type === 'error') onError?.(data)
      }
      ws.onclose = (ev) => {
        if (!closedByUs && !ev.wasClean && attempts.current < 3) {
          attempts.current++; setTimeout(connect, 1000 * attempts.current)
        }
      }
    }
    connect()
    return () => { closedByUs = true; wsRef.current?.close(1000) }
  }, [threadId])
  const send = (payload) => wsRef.current?.send(JSON.stringify(payload))
  return { send }
}
```

**Streaming render** — append `token` deltas to the in-progress bubble; on `message_complete` replace with the authoritative content (the server owns truth). Reconnect → reload history via `GET /api/threads/{id}/messages`.

**Design system** — CSS variables for colors/spacing/radii/shadows; dark by default; markdown rendered in a `prose prose-invert` container.

---

## 3. Backend stack (keep + upgrade the agent)

Reuse the working backend (`backend/app/`): auth/JWT, MongoDB, structlog, error envelope, WebSocket streaming, PDF/DOCX extraction, LLM pool. The **only major change is the agent**: replace the hardcoded 5-round cycler with a single tool-calling loop.

### 3.1 The agent loop — tool-calling (replaces plan→act→reflect rounds)
A minimal, production-standard LangGraph loop: the model decides; tools execute; loop until no more tool calls. No hardcoded round table.
```python
# app/agent/graph.py (shape)
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode          # or a hand-rolled tool node

class ChatState(TypedDict):
    messages: Annotated[list, add_messages]
    thread_id: str
    user_id: str

llm = get_llm().bind_tools(TOOLS)                 # Groq→Gemini pool, tools bound

async def agent_node(state):
    return {"messages": [await llm.ainvoke(state["messages"])]}

def route(state):                                  # the only branch
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END

g = StateGraph(ChatState)
g.add_node("agent", agent_node)
g.add_node("tools", ToolNode(TOOLS))
g.set_entry_point("agent")
g.add_conditional_edges("agent", route, {"tools": "tools", END: END})
g.add_edge("tools", "agent")                       # loop back after tools
graph = g.compile(checkpointer=mongo_checkpointer) # bounded by recursion_limit
```
- **Decision-making lives in the prompt + the model**, not in code. A couple of cheap *prefilters* only pass flags (e.g., "a resume is attached to this thread"), they don't make the agent's choices.
- Bound the loop with LangGraph's `recursion_limit` so a free-tier model can never loop forever.

### 3.2 Tools (`app/agent/tools.py`) — small, user-scoped, logged
- `get_resume_text(thread_id)` — the thread's resume extract (or "none attached").
- `score_resume_ats(thread_id)` — returns `{score, strengths[], gaps[], keyword_issues[], rewrite_examples[]}`.
- `record_interview_note(thread_id, topic, grade, summary)` — writes a grade/note as it happens (truth in DB).
- `list_asked_questions(thread_id)` — for the no-repeat rule.
Each takes `user_id`/`thread_id`, filters every query by them, and logs start/result.

### 3.3 One system prompt (`app/prompts/agent.md`)
A single versioned markdown prompt: identity/persona, capability + intent routing (general chat · resume validation/ATS/suggestions · adaptive interview · coaching), grounding/anti-hallucination, interview behavior (one question, follow-ups, adapt difficulty, grade via tool), ATS-analysis behavior (score + gaps + rewrites), and output format. Dynamic values (resume present? current focus? difficulty hint) arrive as a **late dynamic message**, never baked into the prompt — keeps the cached prefix stable.

### 3.4 Context assembly (reuse `app/core/context.py`)
Order = `[system prompt]` → `[running summary]` → `[last ≤N messages, token-budgeted]` → `[late dynamic: resume/focus/difficulty]` → `[current turn]`. Rolling summary runs in the background past a threshold. Resume is thread-isolated. This both keeps the model sharp at turn 20 and earns prompt caching (stable prefix first, dynamic last).

### 3.5 WebSocket streaming (reuse existing, no Redis)
Single-user app → stream directly from the graph over the socket with `astream_events(version="v2")`; map `on_chat_model_stream → token`, `on_tool_start → status`, graph end → `message_complete`. Producer/consumer `asyncio.Queue` with a 15s heartbeat `ping` keeps the connection alive through LLM/tool stalls. (The reference system fans this through Redis pub/sub for multi-tenant scale — unnecessary here.)

### 3.6 LLM pool (reuse `app/core/llm.py`)
`primary.with_fallbacks([...])` — Groq primary → Gemini last; entries are pure config in `.env` (`LLM_POOL=...`). Log which entry served each call (`pool_entry`). Cheap tasks (e.g., the rolling summary) can use the cheapest model.

### 3.7 Data model (minimal changes from v2)
- `threads`: add `title` (first user message) and nullable `resume_id` (set when a resume is attached in this thread). `type` becomes a soft hint, default `"chat"`.
- `messages`: add `metadata.attachment` (`{resume_id, filename}`) so the chip renders and reconnect-reload works.
- `resumes`, `round_grades`/notes, checkpointer collections: unchanged.

---

## 4. What we adopt vs skip (summary)

**Adopt:** shadcn/ui + Tailwind + `cn()`, Zustand stores, reconnecting WS hook, fetch wrapper with auth + error envelope, react-markdown, tool-calling agent loop, markdown-file system prompt, bounded context with rolling summary, `astream_events` token streaming, LLM fallback pool, structured logging, strict user/thread isolation.

**Skip (and why):** Next.js (Vite already works), Postgres/Redis/pgvector (Mongo + in-context resume is enough, and free), paid embeddings/reranking (no large-corpus RAG need), Sentry (structlog covers a learning project).

---

## 5. Build order (detail in `CHATBOT_REDESIGN.md`)

1. **Phase 1 — UI:** Tailwind + shadcn scaffold → Sidebar / ChatPanel / Composer (with resume upload) → wire to existing backend (streaming works).
2. **Phase 2 — Backend:** single system prompt + tool-calling agent + tools (incl. ATS) + attach-resume + context wiring.
3. **Phase 3 — E2E:** general chat → resume analyze/ATS → adaptive interview → verdict, all verified against DB + logs.

---

## 6. Non-negotiables (carried from the ideation doc)

Fully agentic (no hardcoded decision logic — prefilters pass flags only) · grounded (never invent resume facts) · fail loudly (no fake fallbacks; every error traceable by `trace_id`) · AI judges quality, code does arithmetic · every query user-scoped, thread ownership verified · zero-cost/free tiers.
