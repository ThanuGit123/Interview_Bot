# Ideation Doc — Interview Bot (v2 Rebuild)

**Status:** Reviewed — decisions locked (Section 9). Ideas only — implementation comes in the separate Implementation Doc (including setup and how-to-run).
**Audience:** Junior developer + reviewers
**Last updated:** 2026-06-11
**Reference system:** ReBuddy (we reuse its proven conversation-management ideas, simplified)

> **How to read this doc:** This is the WHAT and the WHY of the rebuild. Read it fully first, understand the reasoning, add your own ideas in Section 9. The HOW (code, schemas, libraries, commands) comes in a separate Implementation Doc — do not start coding from this document.

---

## 1. Core Idea

An **AI-powered mock interview simulator**. A candidate uploads their resume, and an AI interviewer conducts a realistic, multi-round technical interview personalized to that resume — then delivers an honest, hiring-style report card.

**One-liner:** "Practice a real FAANG-style interview against an AI that actually read your resume."

## 2. Why this product exists

- Candidates have no realistic way to practice interviews — LeetCode tests coding, not interviewing. Mock interviews with humans are expensive and hard to schedule.
- Generic question banks don't match the candidate's background. Real interviewers dig into *your* projects, *your* stack.
- Candidates need brutally honest feedback (what was wrong, what the right answer was, hire/no-hire) — friends and mentors sugarcoat.

## 3. What the experience is (user journey)

1. **Sign up / Log in** — every candidate has an account; their interviews belong to them.
2. **Home page** — the candidate's space: start a new interview, see past chats/interviews, continue unfinished ones.
3. **Upload resume / any document** — PDF, Word, or plain text. The system extracts the text and reads who you are.
4. **Talk about your document (Resume Coach)** — before (or instead of) interviewing, the candidate can chat *about* the uploaded document: "How can I improve this resume?", "What's weak here?", "Rewrite my summary for a backend role." The system reads the intent from the user's message and answers as a coach — supportive and constructive, grounded strictly in what the document actually says.
5. **Choose difficulty** — Basic / Medium / Hard; sets interview length and intensity.
6. **Pick target skills** — the system extracts skills from the resume; the candidate chooses which to be grilled on.
7. **The interview (chat)** — a conversation cycling through realistic round types: project deep-dive, core technical concepts, algorithms (with code editor), system design, behavioral.
8. **Realism pressure** — countdown timer, hints at a score cost, tab-switch detection. (Honest framing: tab detection is a browser signal, so it's *deterrence* — it discourages casual cheating and is recorded server-side, but a determined cheater can suppress it. The referee-grade signals are the ones the server can verify itself: response timing and answer quality.)
9. **The verdict** — score out of 100, per-skill metrics, what went well/improve, correct answers explained, study topics, and Hire / Lean Hire / No Hire.
10. **History** — every chat (interviews AND coaching conversations) and report saved to the user's account. Log out, come back — it's all there.

## 4. Core principles (what we will NOT compromise on)

- **Personalized, not generic** — every question traces back to the candidate's resume or chosen skills.
- **The interviewer must not forget** — question 12 as sharp and context-aware as question 1. No repeats, no drift.
- **The verdict must be trustworthy** — scoring is consistent and explainable. Penalty math is done by the system, never guessed by the AI.
- **The system is the referee** — interview state, scoring, and anti-cheat live on the server, not in the candidate's browser.
- **Everything is visible** — every AI call, decision, and error is a structured log line. If quality drops, we can see why.
- **Fail loudly** — if something breaks, the user is told; no fake fallback answers.
- **Zero cost (learning phase)** — every service and tool must be free: free database tier, free LLM tier, open-source libraries, nothing needing a credit card. Paid upgrades are a later decision.

## 5. Known weaknesses of the current version

| Area | Weakness | Why it matters |
|------|----------|----------------|
| No users | Anyone is anonymous; nothing belongs to anyone | Can't save, resume, or track anything per person |
| No database | Nothing stored server-side; refresh = interview gone | The product has no memory of its own users |
| Interviewer memory | Whole transcript re-sent every turn as one text blob | AI forgets rules, repeats questions, quality drops as interview grows |
| Trust model | Browser controls round count, penalties, "interview over" | The referee is the player — anti-cheat is decorative |
| Scoring | One AI guess over the whole transcript, including penalty arithmetic | Inconsistent, unexplainable scores; AI is bad at math |
| Visibility | Zero logging | Impossible to debug or improve quality |
| Duplication | Two backends that disagree | Double maintenance, drift, confusion |
| Resume input | Only plain text accepted | Real resumes are PDFs |

---

## 6. Key concepts we are adopting — what they are and WHY

> Read this section carefully before the phases. These are the ideas the whole rebuild stands on. If you understand these, every phase below will make sense.

### 6.1 OpenAI-style messages — what and why

**What it is:** The conversation is stored and sent to the AI as a **list of structured messages**, each with a role and content:

```
[
  { role: "system",    content: "You are a strict technical interviewer..." },
  { role: "user",      content: "My answer is..." },
  { role: "assistant", content: "Good. Next question..." }
]
```

- `system` = the rules and persona. The AI treats this with the highest authority.
- `user` = what the candidate says.
- `assistant` = what the interviewer (AI) said before.

**Why we keep this style (instead of one big text blob like today):**
1. **It's the industry standard.** Every major LLM provider (OpenAI, Anthropic, Groq, Google) speaks this format. Models are *trained* on it — they genuinely behave better when roles are separated.
2. **Rules stay strong.** Today our rules are buried inside a giant user message, so the AI forgets them. In a system message, rules keep their authority on every single turn.
3. **It's easy to manage.** A list of messages can be counted, trimmed, summarized, and stored one-by-one. A text blob can't.
4. **Portability.** If we ever switch LLM provider, nothing about our conversation data changes.
5. **Proven in-house.** ReBuddy runs production conversations exactly this way.

### 6.2 Threads — what and why

**What it is:** Every interview is a **thread** — one conversation with its own ID, owned by the server. All messages, state (current round, penalties), and the AI's memory of that conversation hang off that thread ID.

**Why:**
- The server becomes the single source of truth. The browser just displays the thread; it can refresh, crash, or reconnect and nothing is lost.
- "Resume an unfinished interview" and "view past chats" become natural — they're just threads in the database.
- It's how ReBuddy (and basically every chat product: ChatGPT, Claude, etc.) models conversations. One user → many threads → many messages.

### 6.3 Token budget + running summary — what and why

**What it is:** Tokens are the units the AI reads (roughly word-pieces); every model has a limit, and more tokens = slower and lower quality on small models. So per turn we send the AI a **fixed-size context**:

```
[system prompt]          ← rules, persona, target skills (always, never trimmed)
[running summary]        ← short recap of everything older: rounds done, questions asked, performance so far
[last few messages]      ← most recent exchanges, word-for-word
[current answer]         ← what we're evaluating now
```

When the conversation grows past a threshold, older messages get compressed into the running summary instead of being re-sent.

**Why:**
- **This is the fix for "the LLM forgets everything."** Small models lose the plot when the prompt grows huge — important rules drown in the middle. A short, structured context keeps the AI sharp at question 20, not just question 2.
- **No repeated questions** — the asked-questions list rides along every turn, far more reliable than hoping the AI re-reads a 10-page transcript.
- **Flat cost and speed** — prompt size stays roughly constant every turn instead of growing forever.
- ReBuddy production numbers for reference: ~8k token cap, last ~10 messages verbatim, summary for anything older.

**The database is the memory's source of truth — not the summary.** The summary is written by an LLM, and LLMs can mis-remember. So the facts that must never be wrong — which questions were asked, what grade each round got, penalty counts — are stored as **structured records in the DB** (written deterministically as they happen). The running summary is narrative color on top ("candidate is strong on system design, shaky on complexity analysis"). If the summary is ever wrong, the facts in the DB still are not. Corrupted memory must not be able to compound.

**Prompt caching (a free bonus of this structure):** LLM providers cache the *unchanged beginning* of a prompt — if the start of our message list is byte-identical across calls, those tokens are processed nearly free and much faster. Our fixed context structure earns this automatically, with one discipline: **stable things first, changing things last.** The system prompt (persona + rules) never changes mid-interview → always the cached prefix. Dynamic bits (current round info, timestamps, the latest answer) go at the END of the message list, never injected into the system prompt. ReBuddy does exactly this in production (e.g., the current date rides as a late separate message precisely to protect the cached prefix). Zero cost to adopt — it's purely about ordering.

### 6.4 Plan → Act → Reflect (the agent loop) — what and why

**What it is:** Instead of one prompt that does everything at once ("evaluate the answer AND pick the next question AND follow 12 rules"), the interviewer works in three small steps each turn:

- **Plan** — decide *what this turn should do*: which round type is next, which target skill to test, what difficulty. This is a decision, made from the interview state — not from vibes.
- **Act** — *do it*: generate the question, or evaluate the candidate's answer. The agent can use **tools** here — small, focused abilities like "read the resume," "list questions already asked," "save this round's grade to the DB."
- **Reflect** — *check the output before sending*: Did I repeat a question? Did I follow the difficulty rule? Is the feedback specific or generic? If the check fails, fix it once before the candidate ever sees it.

**Why we keep this (instead of one big prompt like today):**
1. **One prompt doing five jobs does all five badly.** Splitting into small steps means each step has one job and one clear instruction — quality goes up, especially on small free-tier models.
2. **Reflect is our quality gate.** Today, if the AI repeats a question or ignores difficulty, the user sees it. With a reflect step, the system catches its own mistakes first.
3. **Plan makes the interview deterministic where it should be.** Round order, skill coverage, and difficulty are *decisions we control in the plan step* — not things we beg the AI to remember in a prompt.
4. **Tools keep facts out of prompts.** Instead of stuffing the resume and full history into every prompt, the agent fetches exactly what it needs, when it needs it.
5. **It's the simplest real agent pattern.** We deliberately stop here — no multi-agent swarms, no deep agent trees. A junior can hold the whole loop in their head, debug it, and extend it. That's the point.

**The loop is fully agentic — decided in review:** plan, act, and reflect are all the agent's own reasoning steps, every turn. We deliberately do NOT replace any step with hard-coded deterministic logic — a rigid rule engine deciding what the agent "should" think disturbs the flow and defeats the point of an agent that adapts to the candidate (a weak answer might deserve a follow-up probe, not blindly the next round type). The agent reads the interview state and decides; the system gives it the state and the rules, not the conclusions.

**How we keep the full loop affordable (without cutting steps):**
- **Prompt caching does the heavy lifting** (Section 6.3) — all three steps share the same stable system-prompt prefix, so the repeated portion of each call is processed nearly free. Multi-call loops benefit from caching the most.
- **Bounded context** (Section 6.3) — every step works on the same small, fixed-size context, so three calls of ~2k tokens, not three calls of a growing transcript.
- **Plan and reflect are short steps** — they output decisions and checks (a few lines), not essays. Small outputs keep the extra calls cheap and fast.
- **Deep agents are explicitly future, not now** — if the product someday needs multi-agent hierarchies or long autonomous flows, that's a later upgrade decided on evidence, not a learning-phase choice.

**The API key & provider pool (rate-limit resilience):** one free key will hit limits; the system should never die because of it. So LLM access is a **pool with an ordered fallback chain**:

```
key/provider 1 (primary)  →  rate-limited?  →  fallback 2  →  fallback 3  →  Gemini (last resort)
```

- Every entry in the chain is just a configured credential + model in the environment file — adding or removing one is config, not code (LangChain's fallback chaining handles the switching automatically).
- A rate-limit response triggers an **instant, silent failover** to the next entry; the candidate never notices. The pool returns to the primary when it recovers.
- Every LLM log line records **which pool entry served the call** (Section 6.6) — so we can see exactly when and how often we're falling over, and whether we need more capacity.
- **Important caution on filling the pool:** stacking multiple free keys from one provider using different emails violates that provider's terms of service — if detected, ALL those keys can be banned together, killing the product in one stroke. The resilient way to fill the chain is **different providers** (Groq, Gemini, and other genuinely free tiers), each with its own legitimate key — same fallback mechanics, no ban risk, and a provider outage only costs one link in the chain instead of all of them.

**LangChain carries the plumbing:** we don't hand-roll API handling. LangChain manages the model calls — retries, timeouts, and the **Groq → Gemini fallback** (one configured chain, automatic failover) — and prompts are **loaded dynamically as versioned templates** (edit/version the prompt without touching code), with tools bound through the standard LangChain/LangGraph interfaces. The junior learns one framework that handles all of it.

### 6.5 The persona — what and why

**What it is:** The bot is **one character** with a defined personality, written into the single system prompt. It is not a faceless API — it's a person the candidate is talking to. The persona we maintain:

> **A senior engineer who has interviewed hundreds of candidates and genuinely wants you to get hired.** Professional, warm but honest, never fake-nice, never cruel. They have *read your resume carefully* and everything they say connects back to it.

The same character shows different faces depending on what the user's message asks for (intent — Section 6.4 Plan step reads it):

- **When interviewing:** rigorous and composed, like a real panel interviewer. Asks one clear question at a time, probes follow-ups, doesn't leak answers, doesn't comfort mid-question. Pressure with respect.
- **When coaching on the resume:** a good coach — encouraging, specific, and constructive. Interacts *with the resume itself*: quotes the actual line or section it's talking about, explains why it's weak or strong, and shows a concrete better version. Celebrates what's good before fixing what's not.
- **When giving the verdict/feedback:** honest like a mentor, not a judge — every criticism comes with the correct answer or the way to improve, never just "wrong."
- **Always, in every face:** grounded in the uploaded document and the conversation. If something isn't in the resume, the persona says "I don't see that in your resume — tell me about it," never invents it.

**Mode isolation — the thread decides which faces are allowed (important):** intent-reading alone has a hole: mid-interview, a candidate could ask "as my coach, what's the right answer here?" and an obedient intent-driven bot would hand them the answer, penalty-free. So the **thread type locks the allowed faces** — the server tells the prompt which mode this thread is in:
- **Interview thread** → interviewer face locked on. Coaching requests get a polite deferral: "Good question — let's go through that after the interview." Asking doesn't break the interview; it just doesn't leak answers.
- **Coaching thread** → coach face, freely intent-driven.

The user's input is still the key *within* what the thread permits — but the system, not the candidate, is the referee of mode. This is something the existing app (and naive chatbots generally) don't do, and it's what makes a single prompt safe.

**Why a defined persona matters (and why it lives in the prompt):**
1. **Consistency is the product.** Without a written persona, the bot's tone drifts every turn — formal, then chatty, then robotic. A defined character in the system prompt keeps every reply recognizably the same "person" across a 20-question interview and a coaching chat.
2. **Trust.** Candidates accept brutal feedback from someone who clearly read their resume and wants them to win. The same feedback from a cold, generic bot feels like noise.
3. **It's the cheapest quality lever we have.** No code, no infrastructure — purely how well the persona is written into the prompt. This is exactly the "excellent production-grade prompt" decision from review: persona + intent handling + grounding rules, all maintained in one versioned prompt.
4. **The Reflect step can check it.** "Did this reply sound like our persona? Did it quote the resume when coaching?" — a written persona gives Reflect something concrete to verify against.

### 6.6 Structured logging — what and why

**What it is:** Every meaningful event is one machine-readable JSON log line with fields — not a `print()`:

```
{"event": "llm_call", "interview_id": "...", "user_id": "...", "round": 4, "tokens_in": 1480, "tokens_out": 220, "latency_ms": 900}
```

**Why:** When a user says "my score was weird," we can replay exactly what happened: which context was built, what the AI was asked, what it answered, what was scored, what penalty applied. Without this, every bug report is a guessing game. Carrying `user_id` + `interview_id` on every line means one interview can be traced end-to-end with a single search. Free, open-source (structlog), and the same approach ReBuddy uses in production.

### 6.7 Error handling — what and why

**What it is:** When anything fails, the error travels **two connected paths at once**:

1. **Into the logs** — full detail: what failed, where, the stack trace, which user/interview, all under a `trace_id` (Section 6.6).
2. **Into the API response** — the caller (frontend, or a developer testing the endpoint) gets a proper error response, every time, in one consistent shape:

```
{ "error": true, "code": "LLM_TIMEOUT", "message": "The interviewer did not respond in time", "trace_id": "abc123" }
```

**The relation between the two paths is the `trace_id`:** the response tells the developer *that* it failed and roughly why; the same `trace_id` searched in the logs tells them *exactly* why. One ID connects what the user saw to what the system knows.

**The rules (idea-level):**
- **No error is ever swallowed.** No empty `catch`, no returning fake/mock data when something breaks (today's app does exactly this — skill extraction silently returns made-up skills when the backend is down).
- **Every endpoint fails in the same shape.** A developer who has seen one error response has seen them all — same fields, always.
- **Errors are honest but safe.** The message says what happened in human words ("the interviewer didn't respond, try again"); internal details (stack traces, prompts, connection strings) stay in the logs, never in the response.
- **The frontend shows errors, never hides them.** If the backend says error, the user sees a real error state — not a spinner forever, not pretend-success.

**Why this matters, especially for a developer learning to build software:** errors that surface immediately in the POST response are noticed and fixed the same day. Errors that get swallowed become "weird behavior" reported weeks later with no trail. The discipline — every failure visible in the response, every detail findable in the logs by `trace_id` — is what separates debuggable software from guesswork. It is also the enforcement of our "fail loudly" core principle (Section 4).

---

## 7. Build Direction — phases (in order)

> Each phase says what we build and why it must come in this order. Implementation details (schemas, commands, code) → Implementation Doc.

### Phase 1 — Database first (MongoDB, free tier)

**Idea:** The product gets a memory. Users, interviews, chats, messages, reports live in MongoDB — not in the browser.

**Why first:** every other phase (auth, history, threads, resumable interviews) needs somewhere to store things. No DB = nothing else can be real.

**Why MongoDB:** free to start (Atlas M0 tier — no card needed), flexible documents fit chat data naturally, and LangGraph supports a MongoDB-backed checkpointer, so the AI's conversation state lives in the same free database.

**Getting the free database (idea-level):** create a free Atlas account → create the free M0 cluster → create a DB user and allow your IP → put the connection string in the environment file (never in code). Local-dev alternative: free MongoDB Community installed locally.

**What we store (collections):** `users`, `interviews` (settings, status, round, penalties, report), `messages` (OpenAI-style `{role, content}`, linked to interview), `resumes`.

**Migrations — and why we keep them even though Mongo is "schema-less":** migration files are small versioned scripts that create collections, indexes, and seed data, run in order. They give us (1) a reproducible database on any machine, (2) a written history of every DB change, (3) a habit that scales when the team grows. First migration: users + interviews + messages with their indexes.

### Phase 2 — Users, login and logout

**Idea:** Sign-up, login, logout pages; every API call knows who is calling; every interview, chat, and report is tied to a `userId`.

**Why now:** everything we store from here on must belong to someone. Adding ownership later means migrating every record — adding it now is free.

### Phase 3 — Structured logs & error handling everywhere

**Idea:** Apply Sections 6.6 and 6.7 across the backend from day one: request received (with trace id), LLM call made, context built, score recorded, penalty applied — and every error logged in full AND returned in the consistent error response shape, linked by `trace_id`.

**Why now, before features:** logging added "later" never covers the early code, and the phases after this one (context, agent) are exactly the ones we'll need to debug.

### Phase 4 — Frontend rebuild (login → home → chat → report)

**Idea:** A real multi-page product instead of a single wizard:
- **Login / Sign-up** — the front door.
- **Home page** — greeting, "Start new interview," list of past interviews/chats from the DB (ChatGPT-style sidebar of past chats), resume unfinished ones.
- **Chat page** — the interview: chat window, code editor on coding rounds (the AI judges code by reading it, like a whiteboard interview — no execution), voice input (free browser speech-to-text), timer, hint button, progress. History loads from the server — refresh or re-login never loses anything.
- **Report page** — the verdict, reachable from history.

**Why this order:** the frontend consumes what Phases 1–2 created (accounts, stored history). Building UI before the data exists means building it twice.

**Rework warning (planned, not a surprise):** the chat page built here starts on plain request/response; Phase 7 upgrades it to WebSocket streaming. To avoid building the hardest screen twice, the streaming message contract (what events flow over the socket) is agreed *before* this phase builds the chat page — the first version is then deliberately thin plumbing that the WebSocket swap replaces cleanly.

### Phase 5 — Context management (the interviewer's memory)

**Idea:** Apply Sections 6.1–6.3: thread per interview, OpenAI-style message list with a real system prompt, fixed token budget, running summary for older rounds. UI-only noise (hint popups, cheat warnings) never enters the AI's context — those are counters in the DB.

**What the AI sees each turn:** system prompt → running summary → last few exchanges → current answer. Constant size at question 2 or question 20.

**Why before the agent phase:** the agent (Phase 6) thinks *using* this context. Memory must work before the brain.

### Phase 6 — The agentic interviewer (LangChain + LangGraph)

**Idea:** Apply Section 6.4: one LangGraph agent per interview turn running plan → act → reflect, with small tools (read resume section, list asked questions, record round grade), and **one single production-grade system prompt** — the persona (Section 6.5), rules, difficulty behavior, output format, and role handling defined once, versioned, never buried in user messages. The prompt is **intent-driven within the thread's mode** (Section 6.5 mode isolation): it reads what the user is asking for and shows the right face of the same persona — but only a face the thread type allows — while staying strictly grounded — it answers only from the uploaded document and the conversation, never inventing facts (anti-hallucination rules written into the prompt and checked in the Reflect step).

**Scoring is split — and why:** the agent grades each answer per round against a rubric and saves it as it happens (Act step, via a tool). The **final score is computed by the system** from those per-round grades plus penalty math (tab switches, hints). The AI judges quality; the system does arithmetic. AIs are good judges and bad accountants — today's "AI, please deduct 10 points per tab switch" produces different math every run.

**Deliberately NOT in scope:** multi-agent systems, deep agent hierarchies, autonomous long-running agents. Simple, debuggable, junior-ownable.

### Phase 7 — Live streaming over WebSockets

**Idea:** The interviewer talks live — words appear as the AI generates them, like a real person typing.

**How it works (idea-level):**
- Chat page opens → frontend opens **one WebSocket connection** per interview — a phone line that stays open, instead of knocking on the door (HTTP request) for every message.
- Candidate's answer goes up the socket; the AI's reply **streams back token-by-token** (LangChain/LangGraph support streaming natively); the UI appends words as they arrive.
- The same socket carries **live events** beyond text: "interviewer is thinking…", round changed, timer warnings, penalty applied.
- If the socket drops (refresh, bad network), the client reconnects and reloads history from the DB — nothing lost, because the server owns the state (Phases 1 + 5 make this free).

**Why:** hides LLM latency, feels like a real conversation, and gives us a channel for realism features (typing indicator, live timer) that request/response can't do. **Cost: zero** — WebSockets are built into browsers and our backend framework.

### Phase 8 — Document upload, extraction & Resume Coach mode

**Idea (part 1 — any document in):** Candidates upload their real documents — PDF, Word, or plain text. The server extracts the text with **free open-source extractors** (the exact same ones ReBuddy already uses in production for its document tools — zero cost, battle-tested in-house). The extracted text becomes the `resume` record in the DB; everything downstream (skills, questions, coaching) works off it.

**Why:** real resumes are PDFs and Word files. Asking users for plain text is asking them to do our job. And since ReBuddy already solved extraction, we copy a working idea instead of inventing one.

**Idea (part 2 — talk about your document):** A second conversation mode, **Resume Coach**. After uploading, the candidate can open a chat *about the document itself*:
- "How can I improve this resume?"
- "What looks weak for a backend role?"
- "Suggest a better way to present my project X."
- "Rewrite my summary section."

The coach reads the extracted document, points at specific lines/sections, and suggests concrete upgrades — supportive and constructive, the opposite energy of the interviewer.

**Why this matters:**
- Same upload, double the value: practice the interview AND fix the resume that gets you the interview.
- It reuses everything we already built: threads (a coaching chat is just another thread), context management, streaming, the agent loop. Only the **system prompt changes** — which is exactly why prompts are versioned per mode (Phase 6).
- Coaching chats are saved to history like any other thread.

**Prompt discipline (important — decided in review):** We maintain **one single, excellent, production-grade system prompt** rather than separate prompts per mode. **The user's input is the key**: the prompt instructs the AI to read the user's intent from their message — answering an interview question gets interviewer behavior; asking "how do I improve this?" gets coach behavior. The prompt must be carefully engineered and versioned, with explicit anti-hallucination rules: ground every claim in the uploaded document and the conversation, point at specific sections when suggesting changes, say "I don't see that in your resume" instead of inventing, and never blur roles mid-task (no resume tips in the middle of grading an answer). The Reflect step (Section 6.4) double-checks these rules before anything reaches the user.

### Phase 9 — Additional product ideas (proposed — team to confirm)

- **Resume interviews** — continue an unfinished interview from the home page (thread state makes this nearly free).
- **Progress over time** — every report is in the DB per user → simple "your scores over time" view.
- **Rate limiting** — fair daily quota per user; keeps us inside the free LLM tier.

---

## 8. Summary at a glance

| # | Phase | Core idea | Why |
|---|-------|-----------|-----|
| 1 | Database (MongoDB free) | Product gets server-side memory; migrations from day one | Everything else needs storage; reproducible DB |
| 2 | Auth (login/logout) | Every record belongs to a user | Ownership added later = painful migration |
| 3 | Logs + error handling | Every event = JSON log; every error logged AND returned in one consistent response shape, linked by trace_id | Errors get noticed and fixed same-day, not discovered weeks later |
| 4 | Frontend rebuild | Login → home (past chats) → chat → report, all DB-backed | UI consumes real accounts + history |
| 5 | Context management | Thread + OpenAI-style messages + token budget + running summary | Fixes "AI forgets/repeats"; flat cost; sharp at any length |
| 6 | Agentic interviewer | Full plan → act → reflect agentic loop, tools, one versioned prompt with thread-locked modes; AI grades, system does the math | Each step one job; the agent adapts to the candidate; self-checks every turn; caching + bounded context keep it affordable |
| 7 | WebSocket streaming | Live token-by-token replies + live interview events | Real-conversation feel; hides latency; free |
| 8 | Documents + Resume Coach | PDF/Word upload with free extractors (ReBuddy's proven ones); coaching answers driven by user intent | Real files in; double value from one upload; same single prompt, grounded in the document |
| 9 | Extras | Resumable interviews, progress view, rate limits | Product polish within free tiers |

**The whole rebuild in three sentences:** Give the product a memory (DB + users) and eyes (logs). Give the interviewer a memory (threads + token-budgeted context with a running summary) and a disciplined way of thinking (plan → act → reflect with tools and one strong, versioned, production-grade system prompt that reads the user's intent). Then make it feel alive (WebSocket streaming) and feed it real documents (extraction + Resume Coach) — all of it on free tiers.

**Borrowing from ReBuddy (the rule):** wherever ReBuddy already solved a problem we have — document extraction, context management, thread/message modeling, structured logging — we take the *idea* from there first instead of inventing a new one. The plans and patterns exist in-house; this doc decides WHAT we take, the Implementation Doc will show HOW.

## 9. Decisions made (locked during review)

| Question | Decision | Why |
|----------|----------|-----|
| Auth method | **Email + password only** | Simplest to build and understand; sessions via token; Google login can come later |
| Old Node backend | **Delete in Phase 1** | One brain, one backend (Python/LangGraph). Git history keeps it if we ever need to look back |
| LLM provider | **Key & provider pool: Groq primary → ordered fallbacks → Gemini last resort** | Rate-limited entry triggers instant silent failover to the next; chain is pure config; logs record which entry served each call. Fill the chain with different providers' free tiers — multi-accounting one provider risks a collective ban (see 6.4) |
| Coach vs Interviewer prompt | **One single production-grade system prompt, intent-driven** | The user's message is the key: the system reads what the user is asking (interview me / improve my resume / explain this) and responds in the right role. One excellent, carefully engineered prompt with strict anti-hallucination rules — grounded only in the uploaded document and the conversation, never inventing facts |
| Mode isolation | **Thread type locks the persona's allowed faces** | Prevents mid-interview "coach me" answer-extraction; intent works within the mode the server set. The system stays the referee |
| Prompt caching | **Stable prefix first, dynamic content last — always** | Providers process the unchanged prompt beginning nearly free and faster; pure ordering discipline, zero cost (ReBuddy-proven) |
| Agent loop | **Full plan → act → reflect agentic loop, every turn — no deterministic shortcuts** | Hard-coded plan logic disturbs the agent's adaptive flow. Cost is managed by prompt caching + bounded context + short plan/reflect outputs; deep agents = future only |
| Coding rounds | **AI reads and judges the code — no execution** | Like a real whiteboard interview: logic, correctness, complexity judged by reading. Zero cost, zero sandbox/security risk. Code execution is a possible future upgrade |
| Voice input | **Keep it** | Browser speech-to-text is built-in and free; talking adds realism. Carries into the new chat page |
| Interview quota | **No limit for now** | Keep it simple during the learning phase. Known risk: one heavy user can exhaust the free LLM tier — revisit if rate limits start hurting |

## 10. Open questions / team inputs needed

<!-- Junior dev + reviewers: add your ideas and questions here after reading -->
- **Timer enforcement** — the timer stays as a feature; to discuss as a team: should the server enforce time (records start time, refuses answers after expiry — keeps "the system is the referee" honest), or is the browser countdown display enough for the learning phase?
-

## 11. Out of scope for this doc

Code, schemas, endpoints, library versions, folder structures, setup commands → **Implementation Doc** (provided separately). Nothing in this document is an instruction to write code.
