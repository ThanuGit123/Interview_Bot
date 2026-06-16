# Chatbot Redesign — Interview Bot v3

**Status:** Approved — decisions locked (Section 3). Supersedes the step-wizard UX and the hardcoded round-cycler agent.
**Relationship to other docs:** `IDEATION.md` = the WHY (still holds: memory, threads, context budget, grounding, fail-loud, zero-cost). `IMPLEMENTATION.md` = the v2 HOW (parts of it are reused; the agent + frontend sections are replaced by THIS doc). When this doc conflicts with v2 IMPLEMENTATION on the agent or the UI, **this doc wins**.
**Last updated:** 2026-06-16

---

## 1. One-liner

A single, clean **ChatGPT-style chatbot**: you chat, you drop in a resume, and one fully-agentic assistant validates it, scores it (ATS), suggests fixes, and runs an adaptive interview grounded in that resume — all in the same conversation, with **no hardcoded flows**.

## 2. What changes vs v2

| Area | v2 (now) | v3 (this doc) |
|---|---|---|
| Frontend shape | Step wizard: upload → coach → configure → chat → report (separate screens) | **One chat UI**: sidebar (New Chat / conversations / Logout) + streaming chat + input with resume upload |
| Starting an interview | Difficulty + skills selector screens | **Agentic** — user just asks; agent runs it, adapts difficulty & follow-ups itself |
| Resume entry | A required pre-step before anything | **Attach inside the chat** (📎), analyzed inline |
| Resume analysis | none | **Validate + ATS score + concrete suggestions**, as chat messages |
| Report | A separate report page | Rendered **as chat messages** (verdict/score inline) |
| Agent | `plan → act → reflect` cycling 5 fixed round types | **One tool-calling agent** + one strong system prompt; behavior driven by intent + attached resume |
| Assets panel | (was planned) | **Not built** — the resume lives in the chat, no separate panel |
| Reused unchanged | — | Auth/JWT, MongoDB, WebSocket streaming, PDF/DOCX extraction, LLM pool, structured logging |

## 3. Decisions locked (from review)

| # | Decision | Note |
|---|---|---|
| D1 | **Single agentic loop, single system prompt** handles general chat, resume analysis, and interviewing | Industry-standard tool-calling agent. No hardcoded round logic. "Keep a few prefilters" only (e.g., cheap intent/route hints, attachment detection). |
| D2 | **Resume is attached in the chat** (📎 in the input), not a pre-step | On attach: extract text (existing PDF/DOCX/TXT/MD pipeline), store, feed as grounded context for the whole thread. |
| D3 | **No separate Assets panel** | The uploaded resume and its analysis live in the conversation. |
| D4 | **Analysis = validate resume + ATS score + suggestions** | LLM judges quality (ATS score, gaps, rewrites). Any hard arithmetic (penalties, if kept) stays in code per ideation "AI judges, system does math". |
| D5 | **Adaptive interview** | Agent asks follow-ups, raises/lowers difficulty, stays grounded in the resume — all from its own reasoning, not a fixed round table. |
| D6 | **Report renders as chat messages** | No dedicated report page; verdict/score/breakdown stream into the chat. |
| D7 | **Drop the difficulty/skills selector screens** | Replaced by agentic behavior; user can still say "make it harder", "focus on React". |
| D8 | **Keep auth (login/signup) as-is** | It works; only the post-login surface changes. |
| D9 | **Build order: UI first, then backend, then e2e** | Avoids reworking the hardest screen twice. |

## 4. UI specification (Phase 1)

Reuse the existing dark design language (tokens in `IMPLEMENTATION.md` 7.2 / `index.css`): `#0B1120` bg, `#2563EB` accent, Inter font, glass panels.

### 4.1 Layout
```
┌───────────────────┬──────────────────────────────────────────────┐
│  🤖 Interview Bot │   (empty state)                                │
│                   │        What can I help you with?               │
│  [ + New Chat ]   │   Upload a resume, ask for an interview, or    │
│                   │   just chat.                                   │
│  CHATS            │                                                │
│   Today           │   🧑  user message                              │
│    • Resume review│   🤖  assistant reply (streaming token-by-token)│
│   Previous 7 days │       … 📄 resume.pdf (chip when attached)      │
│    • Mock: React  │                                                │
│   Older           │                                                │
│    • …            │   ──────────────────────────────────────────  │
│                   │   [📎] [ Message Interview Bot…        ] [ ↑ ] │
│  ───────────────  │   (📎 = upload resume: PDF/DOCX/TXT/MD ≤5MB)   │
│  ⎋  Logout        │                                                │
└───────────────────┴──────────────────────────────────────────────┘
```

### 4.2 Components
- **Sidebar** (`Sidebar.jsx`)
  - App logo + name at the top.
  - **`+ New Chat`** → creates a new thread, clears the chat panel, focuses the input.
  - **Conversation list** — `GET /api/threads`, grouped by date (Today / Previous 7 days / Older), each item = thread title (first user message or "New chat"); click → load that thread.
  - **Logout** pinned at the bottom.
- **Chat panel** (`ChatPanel.jsx`)
  - Empty state ("What can I help you with?") with 2–3 optional suggestion chips ("Review my resume", "Interview me", "Improve my summary").
  - Message list: user + assistant bubbles, markdown rendering, **token streaming** over the existing WebSocket.
  - Attached-resume chip shown on the message it was uploaded with.
  - Status line ("thinking…", "reviewing your resume…") from `status` WS events.
- **Composer** (`Composer.jsx`)
  - 📎 upload button (accept `.pdf,.docx,.txt,.md`), text area (Enter to send, Shift+Enter newline), send button, optional mic (existing Web Speech).
  - On attach: upload file → show chip → next send includes the resume context.

### 4.3 Frontend files
- New: `src/components/Sidebar.jsx`, `src/components/ChatPanel.jsx`, `src/components/Composer.jsx`, `src/components/MessageBubble.jsx`.
- Rework: `src/App.jsx` (becomes the chat shell: auth gate → sidebar + chat), keep `Auth.jsx`, `LandingPage.jsx`.
- Retire from the main flow: `ConfigureSession.jsx`, `ResumeUploader.jsx` (full-screen), `InterviewReport.jsx` page, the wizard `step` state machine. (Leave files in git history.)
- `src/services/aiService.js` + `src/hooks/useThreadSocket.js`: thread CRUD, resume upload, one socket per open thread.

## 5. Agent design (Phase 2)

### 5.1 The loop
Replace the fixed `plan → act → reflect` round-cycler with **one tool-calling agent** (LangGraph ReAct-style / `bind_tools` + tool loop):

```
incoming user turn (+ optional attached resume)
        │
        ▼
  [prefilter]  cheap, non-LLM: attachment present? thread has a resume? (a couple of flags only)
        │
        ▼
  AGENT (single system prompt, bounded context, streaming)
   ├─ reasons about intent: general / analyze-resume / interview / coach
   ├─ may call tools (loop until done):
   │    • get_resume_text(thread_id)
   │    • score_resume_ats(...)        → ATS score + section gaps + suggestions
   │    • record_interview_note(...)   → grade/notes as they happen (truth in DB)
   │    • list_asked_questions(...)    → never repeat
   │    • (optional) record_penalty(...) for counters
   ├─ streams the reply token-by-token over the WebSocket
   └─ output: the chat message (analysis / question / feedback / verdict)
        │
        ▼
  persist assistant message; update thread; background rolling summary if over threshold
```

- **No fixed round table.** The agent decides whether to ask a follow-up, switch topic, raise difficulty, or wrap up — grounded in the resume + conversation, per ideation 6.4 ("fully agentic, no deterministic shortcuts").
- **Prefilter = a few flags**, not logic that makes the agent's decisions (e.g., "a new resume was attached this turn" so the agent knows to analyze it; "thread already has a resume").

### 5.2 The single system prompt (`app/prompts/agent.md`)
One versioned, production-grade prompt covering:
- **Identity**: senior engineer who has read the candidate's resume and wants them to get hired (ideation 6.5).
- **Capabilities & intent routing**: general help · resume validation/ATS/suggestions · adaptive technical interview · coaching.
- **Grounding (anti-hallucination)**: only use the resume text + conversation; say "I don't see that in your resume" instead of inventing.
- **Interview behavior**: one question at a time, probing follow-ups, never leak answers, adapt difficulty on request and on signal, grade as you go (via tool).
- **ATS analysis behavior**: produce a score (0–100), section-by-section gaps, keyword/format issues, and concrete rewritten bullet examples.
- **Output**: clean markdown for chat; numbers come from tools/code where math matters.
- Dynamic values (does a resume exist, current focus, difficulty hint) arrive as a **late dynamic message**, never baked into the prompt (prompt-cache discipline, ideation 6.3).

### 5.3 Tools (`app/agent/tools.py`) — user-scoped, logged
- `get_resume_text(thread_id)` — the thread's resume extract (or "no resume attached").
- `score_resume_ats(thread_id)` — returns structured `{score, strengths[], gaps[], keyword_issues[], rewrite_examples[]}`.
- `record_interview_note(thread_id, topic, grade, summary)` — writes a note/grade as it happens.
- `list_asked_questions(thread_id)` — for the no-repeat rule.
- (optional) `record_penalty(thread_id, kind)` — counters server-side.

### 5.4 Context (per ideation 6.1–6.3, reuse v2 `app/core/context.py`)
`[single system prompt]` → `[running summary]` → `[last ≤N messages]` → `[late dynamic: resume? focus? difficulty]` → `[current user turn]`. Bounded token budget; rolling summary in the background; resume is **thread-isolated**.

## 6. Data model (minimal changes)

Reuse v2 collections. Adjustments:
- **`threads`**: `type` becomes effectively a soft hint (`"chat"` default); the agent is not hard-locked to a single face, but the *server still owns* thread ownership/isolation. Add `title` (first user message), `resume_id` (nullable — set when a resume is attached in this thread).
- **`messages`**: add `metadata.attachment` (e.g., `{resume_id, filename}`) so the chip can render and reconnect-reload works.
- **`resumes`**: unchanged (id, user_id, filename, file_type, extracted_text). A resume is created on attach and linked to the thread.
- **`round_grades` / notes**: keep for interview truth (the agent writes via tool). Report = synthesized from these + conversation, returned as a chat message (no `reports` page required, though we may still persist a report doc for history).

## 7. API / WebSocket contract

Reuse the v2 endpoints; the important shift is **resume upload happens within a thread**.

| Method & path | Purpose |
|---|---|
| `POST /api/auth/*` | unchanged |
| `POST /api/threads` | create a chat thread (no settings required) |
| `GET /api/threads` | sidebar list (id, title, updated_at) |
| `GET /api/threads/{id}/messages` | load a conversation (reconnect/switch) |
| `POST /api/resumes` (multipart) | upload + extract; returns `{resume_id, extracted_text}` |
| `POST /api/threads/{id}/attach-resume` | link a resume to the thread (sets `threads.resume_id`) **(new, tiny)** |
| `WS /ws/threads/{id}?token=` | client `{action:"message", text, resume_id?}`; server streams `token` / `status` / `message_complete` / `error` |

Every error → standard envelope `{error, code, message, trace_id}`. Every event also loggable.

## 8. Build plan & Definition of Done

### Phase 1 — UI shell
- [ ] Sidebar (logo, New Chat, dated conversation list, Logout)
- [ ] Chat panel with empty state + streaming bubbles + markdown
- [ ] Composer with 📎 resume upload, text, send (Enter/Shift+Enter)
- [ ] One socket per open thread; switching threads loads history over HTTP
- **DoD:** can sign in → see conversations → open one → send a message → see a streamed reply → attach a resume (chip shows). (Against existing backend; analysis comes in Phase 2.)

### Phase 2 — Agentic backend
- [ ] `app/prompts/agent.md` single prompt
- [ ] Tool-calling agent loop replacing the round-cycler
- [ ] Tools: `get_resume_text`, `score_resume_ats`, `record_interview_note`, `list_asked_questions`
- [ ] `attach-resume` endpoint + resume context wiring
- [ ] Rolling summary + bounded context reused
- **DoD:** in one chat — general Q answered; attach resume → validation + ATS score + suggestions; ask "interview me" → adaptive Qs with follow-ups + difficulty changes; grades recorded in DB; no repeated questions.

### Phase 3 — End-to-end + finish
- [ ] Full flow tested live (general → analyze → interview → verdict in chat)
- [ ] Truth checks: DB rows match chat claims; logs show tool calls + trace_ids
- [ ] Reconnect/reload, error toasts, fail-loud paths
- **DoD:** the journey works end to end, verified against DB + logs, not against the model's claims.

## 9. Non-negotiables (carried from ideation)

- **Fully agentic, no hardcoded decision logic** — the agent decides; prefilters only pass flags/state.
- **Grounded** — never invent resume facts.
- **Fail loudly** — no fake fallbacks; every error visible + traceable by `trace_id`.
- **AI judges, code does arithmetic** — ATS/quality from the LLM; any penalty math in code.
- **Isolation** — every query user-scoped; thread ownership verified before any work.
- **Zero-cost / free tiers** — Groq primary → Gemini fallback; reuse existing pool.
