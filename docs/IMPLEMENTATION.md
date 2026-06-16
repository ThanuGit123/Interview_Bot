# Implementation Doc — Interview Bot v2

**Status:** Active — Parts 0–8 written
**Audience:** The junior developer AND the AI coding agent (feed with `IDEATION.md` + `STRUCTURE_AND_RUN.md` as context)
**Rule:** This doc says HOW. If a HOW ever conflicts with a WHY in `IDEATION.md`, IDEATION wins — stop and raise it.

---

# Part 0 — Phase-wise implementation plan

Build strictly in this order. Each part below maps to an IDEATION phase, ends with a Definition of Done, and must be verified (run + logs) before the next part starts.

| Order | This doc | IDEATION phase | What exists when it's done |
|---|---|---|---|
| 1 | Part 1 — Database & migrations | Phase 1 | Mongo connected, 6 collections + validators + indexes, runner, leakage test |
| 2 | Part 2 — Auth | Phase 2 | Signup/login/logout, JWT, every endpoint knows its user |
| 3 | Part 3 — Logging & errors | Phase 3 | structlog everywhere, trace middleware, one error envelope |
| 4 | Part 4 — Context management | Phase 5 | OpenAI-style assembly, trimming, rolling summary, prompt-cache ordering |
| 5 | Part 5 — The agent | Phase 6 | plan → act → reflect graph, tools, checkpointer, system scoring |
| 6 | Part 6 — WebSocket streaming | Phase 7 | Long-lived socket, token streaming, live events, reconnect |
| 7 | Part 7 — Frontend & UI | Phase 4 (+7) | Login → Home → Chat → Report against the real API |
| 8 | Part 8 — Documents & coach | Phase 8 | PDF/DOCX extraction, coach intent on coaching threads |

(Frontend lands late deliberately: by then the API, streaming contract, and auth are real, so the chat page is built once — the IDEATION Phase 4 "rework warning" handled by sequencing.)

## 0.1 Architecture flow charts (text — read these until they feel obvious)

**The big picture — who talks to whom:**
```
┌──────────────┐   HTTPS (login, upload,   ┌─────────────────────────────┐
│   Browser    │   history, report)        │      FastAPI backend        │
│  React/Vite  │ ─────────────────────────►│  api/ → services/ → db/     │
│              │                           │            │                │
│  Chat page   │   WebSocket (one per      │       agent/ graph          │
│              │   open thread: answers ►, │   plan → act → reflect      │
│              │   ◄ tokens/status/events) │     │            │          │
└──────────────┘                           └─────┼────────────┼──────────┘
                                                 │            │
                                       ┌─────────▼──┐   ┌─────▼─────────────┐
                                       │  LLM pool  │   │  MongoDB (Atlas)  │
                                       │ Groq → …   │   │ users · threads · │
                                       │ → Gemini   │   │ messages · grades │
                                       └────────────┘   │ reports · ckpts   │
                                                         └───────────────────┘
```

**One interview turn — end to end:**
```
candidate types answer
        │
        ▼ (WebSocket frame {action:"answer", text})
verify JWT + thread ownership ──fail──► error event + close 4401
        │ ok
        ▼
save user message (messages collection)
        │
        ▼
BUILD CONTEXT  (Part 4)
  [system prompt] + [running summary] + [last ≤10 msgs] + [round info] + [answer]
        │
        ▼
AGENT GRAPH    (Part 5)
  plan ──► act (tools: resume, asked-questions, record grade) ──► reflect
                ▲                                                  │
                └────────── retry once if problems ◄───────────────┘
        │  (every LLM chunk during act streams down the socket as `token`)
        ▼
save assistant message + grade already recorded by tool
        │
        ▼
`message_complete` event ──► UI replaces streamed text with authoritative content
        │
        ▼ (background, non-blocking)
summary task if threshold passed ──► update threads.running_summary
```

**Final question → report:**
```
last answer graded ──► scoring.py (plain Python):
  base from round_grades − 10×tab_switches − 5×hints  =  overall_score
        │
        ▼
LLM writes the WORDS (feedback, breakdown) — numbers come from code
        │
        ▼
reports collection ──► `report_ready` event ──► UI fetches report via HTTP
```

**Auth — every request:**
```
login: email+password ──► bcrypt verify ──► JWT {sub: user_id, exp}
every HTTP call:   Authorization header ──► get_current_user() ──► user_id
every WS connect:  ?token= in URL ──► verify BEFORE accept()
every DB query:    repository function forces {_id, user_id} filter   ← isolation lives here
```

---

# Part 1 — Database & Migrations

## 1.1 The isolation model — read this before the schemas

MongoDB has **no row-level security** (RLS is a Postgres feature). In Mongo, isolation is enforced in the **application layer**, and this project treats that as a hard contract:

**THE RULES (MUST — no exceptions, the AI agent must never generate code that violates these):**

1. **Every document that belongs to a user carries `user_id`.** No exceptions, even where it looks redundant (e.g., `messages` already has `thread_id` — it STILL carries `user_id`). Redundancy is the defense.
2. **Every query is scoped.** No query ever runs on a user-owned collection without `user_id` in the filter; thread content queries additionally include `thread_id`. There is no "get by id alone" on user data — it is always `{_id: ..., user_id: current_user}`.
3. **All DB access goes through repository functions in `app/db/`.** Services and the agent NEVER call pymongo directly. Every repository function takes `user_id` as a required argument and puts it in the filter itself — so an unscoped query is impossible to write by accident.
4. **Thread ownership is verified before any thread work.** Before loading messages, building context, or invoking the agent graph: fetch the thread as `{_id: thread_id, user_id: current_user}` — if it returns nothing, respond 404 (not 403 — don't confirm the thread exists) and log it with trace_id.
5. **Context is thread-isolated.** The context builder loads ONLY: this thread's messages, this thread's running summary, this thread's resume. Never another thread's anything — a user's own other interviews are just as off-limits to the context as another user's.
6. **The LangGraph checkpointer is keyed by our thread `_id`.** Thread IDs are random UUIDs (unguessable), and rule 4 has already verified ownership before the graph is ever invoked.
7. **IDs are UUID strings generated by us** (not Mongo ObjectIds) — random, unguessable, same format everywhere (DB, API, logs, checkpointer).

**Leakage test (write it early, run it always):** create two users A and B, a thread each; assert B cannot read A's thread, messages, resume, or report through ANY endpoint (expect 404), and assert A's coaching thread context never contains text from A's interview thread.

## 1.2 Connecting to MongoDB

**Option A — Atlas free tier (recommended, works from any machine):**
1. Create a free account at mongodb.com/atlas → create an **M0 (free) cluster** — no card needed.
2. Database Access → create a DB user (username + strong password).
3. Network Access → add your current IP (or `0.0.0.0/0` only during the learning phase).
4. Cluster → Connect → Drivers → copy the connection string.

**Option B — local install:** install MongoDB Community Edition; the URI is `mongodb://localhost:27017`.

**The URI lives in `backend/.env` (never in code, never committed):**
```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/interview_bot
MONGODB_DB=interview_bot
```

**Connection module — `app/db/client.py` (the ONLY place a Mongo client is created):**
```python
import os
import structlog
from pymongo import MongoClient

logger = structlog.get_logger(__name__)
_client: MongoClient | None = None

def get_db():
    global _client
    if _client is None:
        _client = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=5000)
        _client.admin.command("ping")          # fail loudly at startup, not on first query
        logger.info("mongodb_connected", db=os.environ["MONGODB_DB"])
    return _client[os.environ["MONGODB_DB"]]
```

**Smoke-test the connection before anything else:**
```bash
cd Interview_Bot/backend
python -c "from app.db.client import get_db; print(get_db().list_collection_names())"
```
Success: prints `[]` (empty DB) or collection names, plus the `mongodb_connected` log line. Failure: a clear exception within 5 seconds — fix the URI/IP-allowlist before continuing.

## 1.3 The collections — what and why

Six collections we own (+ LangGraph's own). `_id` is always a UUID string; timestamps are UTC ISO strings.

### `users`
| Field | Type | Notes |
|---|---|---|
| `_id` | string (UUID) | |
| `email` | string | **unique index**; lowercase before save |
| `password_hash` | string | bcrypt hash — NEVER the plain password |
| `name` | string | |
| `created_at`, `updated_at` | string | |

### `resumes`
| Field | Type | Notes |
|---|---|---|
| `_id` | string (UUID) | |
| `user_id` | string | owner — **indexed** |
| `filename`, `file_type` | string | `"pdf" \| "docx" \| "txt"` |
| `extracted_text` | string | what the AI reads |
| `created_at` | string | |

### `threads` — one conversation (interview OR coaching)
| Field | Type | Notes |
|---|---|---|
| `_id` | string (UUID) | doubles as the checkpointer thread id |
| `user_id` | string | owner |
| `type` | string | `"interview" \| "coaching"` — locks persona faces; set at creation, NEVER changed |
| `resume_id` | string | |
| `status` | string | `"active" \| "completed" \| "abandoned"` |
| `settings` | object | `{difficulty, max_questions, time_limit_minutes, selected_skills[]}` |
| `current_round` | int | server-owned — the client never sends round numbers |
| `counters` | object | `{tab_switches: int, hints_used: int}` — server-incremented |
| `running_summary` | string | narrative memory — color, not truth |
| `summary_covers_until` | int | how many messages the summary already covers (rolling-window pointer, Part 4) |
| `asked_questions` | array | structured truth for the no-repeat rule — appended via agent tool |
| `started_at` | string | server-recorded start (timer input) |
| `created_at`, `updated_at` | string | |

**Indexes:** `(user_id, created_at desc)`, `(user_id, status)`.

### `messages`
| Field | Type | Notes |
|---|---|---|
| `_id` | string (UUID) | |
| `thread_id`, `user_id` | string | scoping pair (rule 1 redundancy) |
| `role` | string | `"user" \| "assistant"` — system prompt is NOT stored as a message |
| `content` | string | |
| `metadata` | object | `{round, tokens_in, tokens_out, pool_entry}` |
| `created_at` | string | |

**Indexes:** `(thread_id, created_at)`, `(user_id)`.
UI-only events (hint shown, cheat warning) are NOT messages — they update `threads.counters`.

### `round_grades` — the AI's per-round judgment, recorded as it happens
| Field | Type | Notes |
|---|---|---|
| `_id` | string (UUID) | |
| `thread_id`, `user_id` | string | |
| `round` | int | **unique with thread_id** |
| `round_type` | string | `"project" \| "technical" \| "coding" \| "design" \| "behavioral"` |
| `question`, `grade`, `feedback_summary` | string | grade: `"correct" \| "partial" \| "wrong"` |
| `created_at` | string | |

**Index:** `(thread_id, round)` **unique**.

### `reports`
| Field | Type | Notes |
|---|---|---|
| `_id` | string (UUID) | |
| `thread_id` | string | **unique** — one report per interview |
| `user_id` | string | |
| `overall_score` | int | computed by the SYSTEM from round_grades minus penalty math — never asked of the LLM |
| `metrics` | object | four metrics, each `"strong" \| "average" \| "weak"` |
| `detailed_feedback` | object | `{what_went_well: [], what_to_improve: []}` |
| `recommended_topics` | array | |
| `verdict` | string | `"hire" \| "lean_hire" \| "no_hire"` |
| `penalties` | object | `{tab_switches, hints_used, points_deducted}` |
| `question_breakdown` | array | `{question, answer_summary, correctness, explanation}` |
| `created_at` | string | |

**Indexes:** `thread_id` unique; `(user_id, created_at desc)`.

### Checkpointer collections — owned by LangGraph
The MongoDB checkpointer library creates and manages its own collections. Our migrations do NOT touch them.

## 1.4 Schema validation

Every collection is created **with a `$jsonSchema` validator** so Mongo itself rejects malformed documents (missing `user_id`, wrong enum, unknown role) — the second defense line after Pydantic:
```python
USERS_VALIDATOR = {
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["_id", "email", "password_hash", "created_at"],
    "properties": {"email": {"bsonType": "string"}, "password_hash": {"bsonType": "string"}},
  }
}
db.create_collection("users", validator=USERS_VALIDATOR)
```

## 1.5 The migration system

```
backend/migrations/
├── runner.py
├── m001_create_users.py
├── m002_create_resumes.py
├── m003_create_threads.py
├── m004_create_messages.py
├── m005_create_round_grades.py
└── m006_create_reports.py
```

**Every migration file has exactly this shape:**
```python
"""Create users collection with validator and unique email index."""
import structlog
logger = structlog.get_logger(__name__)

def up(db):
    db.create_collection("users", validator=USERS_VALIDATOR)
    db.users.create_index("email", unique=True)
    logger.info("migration_applied", migration="m001_create_users")
```

**The runner algorithm:** connect via `MONGODB_URI` → read `schema_migrations` collection (`{_id: "m001_create_users", applied_at}`) → list `m*.py` in order → run pending `up(db)` → record each → structlog every step → any failure stops the run.

**Rules:** append-only (never edit an applied migration — fix forward with a new one); sequential numbering; the filename is the identity.

## 1.6 How to run and how to VERIFY everything was created

```bash
cd Interview_Bot/backend
python -m migrations.runner
```
Expected logs: `migrations_start pending=6` … `migrations_done applied=6 skipped=0`. Second run must log `applied=0 skipped=6` (idempotency proof).

**Verification — never assume, check (mongosh or Atlas UI → Collections):**
```javascript
use interview_bot
show collections
// expect: users, resumes, threads, messages, round_grades, reports, schema_migrations

db.users.getIndexes()                    // expect unique index on email
db.messages.getIndexes()                 // expect (thread_id, created_at) and (user_id)
db.round_grades.getIndexes()             // expect unique (thread_id, round)

db.getCollectionInfos({name: "users"})[0].options.validator   // validator attached?

db.schema_migrations.find()              // 6 records, one per migration

// validator rejection test — this insert MUST fail:
db.users.insertOne({name: "no email or hash"})
```
Every check above passing = Part 1's database genuinely exists. Any failure → fix the migration, drop the dev DB, re-run from empty.

## 1.7 Definition of done — Part 1
- [ ] Connection smoke test passes (1.2)
- [ ] Runner applies 6 migrations clean from empty; second run is a no-op
- [ ] All 1.6 verification checks pass (collections, indexes, validators, rejection test)
- [ ] Repository layer in `app/db/` exposes ONLY user-scoped functions
- [ ] Two-user leakage test passes
- [ ] Everything logs via structlog

---

# Part 2 — Auth (email + password, JWT)

**Endpoints (`app/api/auth.py`):**
| Endpoint | In | Out |
|---|---|---|
| `POST /api/auth/signup` | `{email, password, name}` | `{access_token, user}` |
| `POST /api/auth/login` | `{email, password}` | `{access_token, user}` |
| `POST /api/auth/logout` | (token) | `{ok: true}` |
| `GET /api/auth/me` | (token) | `{user}` |

**Rules:**
- Passwords hashed with **bcrypt** (`passlib`); plain passwords never logged, never stored, never returned.
- JWT signed with `JWT_SECRET` from `.env`; payload = `{sub: user_id, exp}`; expiry ~7 days (learning phase).
- One FastAPI dependency `get_current_user()` decodes the token and loads the user — **every non-auth endpoint declares it**. No endpoint reads `user_id` from the request body, ever (isolation rule 2 starts here).
- Login failures return the same message for "no such email" and "wrong password" (don't leak which).
- Logout: client discards the token; server logs the event. (Token blacklisting is out of scope for the learning phase.)
- WebSocket auth: token passed as `?token=` query param at connect time, verified before `accept()` completes the handshake (Part 6).

**Definition of done:** signup → login → `me` round-trip works from curl; wrong password rejected; protected endpoint without token → 401 in the standard error envelope; all events logged.

---

# Part 3 — Logging & error handling

**structlog setup (`app/core/logging.py`):** JSON renderer, ISO timestamps, configured once at startup. Every module starts with `logger = structlog.get_logger(__name__)`.

**Trace middleware (`app/core/middleware.py`):** every request gets a `trace_id` (UUID); after auth, `user_id` is bound too — `structlog.contextvars.bind_contextvars(trace_id=..., user_id=...)` makes every log line in that request carry both automatically. Thread endpoints additionally bind `thread_id`.

**The error envelope (`app/core/errors.py`)** — every error, every endpoint, same shape:
```json
{ "error": true, "code": "LLM_TIMEOUT", "message": "The interviewer did not respond in time", "trace_id": "abc123" }
```
Implemented as FastAPI exception handlers: one for our typed `AppError(code, message, status)`, one catch-all for unexpected exceptions (logs full traceback, returns code `INTERNAL` — internals never leak into the response). The same envelope is sent as an `error` event over WebSocket.

**What gets logged (minimum):** request start/end with latency; LLM call (model, pool entry, tokens in/out, latency); context build (messages kept, summary used, tokens); grade recorded; penalty applied; every error with traceback.

**Definition of done:** hit any endpoint → Terminal 1 shows request logs with trace_id; force an error → response envelope's trace_id finds the full traceback in the logs.

---

# Part 4 — Context management (the interviewer's memory)

This is the heart. The pattern is production-proven; the numbers are scaled to our free-tier models.

**Config (`app/core/config.py`):**
```python
MAX_HISTORY_MESSAGES = 10      # cap by count first
MAX_HISTORY_TOKENS   = 4000    # then by tokens (small free models — half of the 8k production reference)
SUMMARY_THRESHOLD    = 20      # messages in thread before summarization kicks in
KEEP_RECENT          = 8       # messages always kept verbatim
```

**Token counting:** `tiktoken` with the `o200k_base` encoding as a good-enough approximation across providers; count per message + 4 tokens overhead each.

**Assembly — the exact message order, every turn (prompt-cache discipline — stable first, dynamic last):**
```
1. SystemMessage  — THE system prompt from app/prompts/ (persona, rules)   [never changes mid-thread → cached prefix]
2. SystemMessage  — "Conversation so far: {running_summary}"               [changes rarely]
3. ...trimmed history (last ≤10 messages, ≤4000 tokens, newest kept)...
4. SystemMessage  — dynamic context: current round, round type, difficulty, time remaining   [changes every turn → late]
5. HumanMessage   — the candidate's current answer
```
Never inject dynamic values into message 1 — that destroys the cache prefix.

**The rolling summary (background, non-blocking):**
1. After each turn, if `message_count - summary_covers_until > SUMMARY_THRESHOLD`: fire an `asyncio.create_task` (the candidate never waits on it).
2. The task takes messages from `summary_covers_until` up to `len(messages) - KEEP_RECENT`, renders them as plain text, and calls the **cheapest model in the pool** with a structured summarizer prompt:
   - Required output sections: `[ROUNDS COVERED] [QUESTIONS ASKED] [CANDIDATE PERFORMANCE] [PENDING]`
   - Keep: question topics, grades given, candidate strengths/weaknesses shown. Drop: greetings, filler, raw code dumps.
   - 4–8 sentences, past tense. The OLD summary is passed in and merged — the new summary replaces it.
3. Store: update `threads.running_summary` and `threads.summary_covers_until = window_end` in one update.
4. Log: `summary_updated covers_until=N tokens=M`.

**Remember (IDEATION 6.3):** the summary is color. The no-repeat list lives in `threads.asked_questions`, grades in `round_grades` — structured truth the summary cannot corrupt.

**Definition of done:** a 25-message test thread shows: prompt token count flat across turns (logged), summary updated in background, asked-questions array complete, and the assembled context (log it at debug level) has the exact 5-part order above.

---

# Part 5 — The agent (plan → act → reflect)

## 5.0 THE AGENTIC LOOP — the full walk (read this flowchart until every box is obvious)

```
 INPUT ARRIVES
 ┌────────────────────────────────────────────────────────────────────┐
 │  WebSocket frame: {action: "answer", text: "...candidate's answer"}│
 │  (the client sends ONLY this — no round numbers, no counters,      │
 │   no isFinal flag. The SERVER knows all of that. Always.)          │
 └────────────────────────────────────────────────────────────────────┘
        │
        ▼
 GATE — before anything thinks
 ┌────────────────────────────────────────────────────────────────────┐
 │  JWT valid?  →  thread {_id, user_id} exists for THIS user?        │
 │  thread.status == "active"?   time not expired (started_at)?       │
 │  any NO → `error` event + log with trace_id. Nothing else runs.    │
 └────────────────────────────────────────────────────────────────────┘
        │ all yes
        ▼
 PERSIST FIRST, THINK SECOND
 ┌────────────────────────────────────────────────────────────────────┐
 │  insert into messages: {thread_id, user_id, role:"user", content}  │
 │  (if the process dies right now, the answer is already safe)       │
 └────────────────────────────────────────────────────────────────────┘
        │
        ▼
 LOAD CONTEXT — everything the agent will know, and WHERE it comes from
 ┌────────────────────────────────────────────────────────────────────┐
 │  app/prompts/interviewer.md  → THE system prompt (persona, rules)  │
 │                                 [byte-identical every turn →       │
 │                                  this is the cached prefix]        │
 │  threads.running_summary     → "story so far" (narrative color)    │
 │  messages (this thread ONLY) → last ≤10 msgs, trimmed to ≤4k toks  │
 │  threads.* (server truth)    → current_round, type, settings,      │
 │                                 time remaining  [dynamic → LAST,   │
 │                                 never inside the system prompt]    │
 │  NOTHING ELSE. Not another thread. Not another user. Ever.         │
 └────────────────────────────────────────────────────────────────────┘
        │ assembled message list (Part 4 order: 1.static 2.summary
        │                          3.history 4.dynamic 5.answer)
        ▼
 ╔════════════════════ THE LOOP (LangGraph) ═════════════════════════╗
 ║                                                                    ║
 ║  PLAN  (1 LLM call, output is SHORT — a decision, not prose)       ║
 ║  ┌──────────────────────────────────────────────────────────────┐  ║
 ║  │ reads: summary + asked_questions + last answer + round state │  ║
 ║  │ decides: {round_type, target_skill, follow_up: yes/no}       │  ║
 ║  │ (follow_up = "their answer deserves a probe, not the next    │  ║
 ║  │  round type" — THIS is why plan is an LLM, not an if-chain)  │  ║
 ║  └──────────────────────────────────────────────────────────────┘  ║
 ║        │ plan dict into state                                      ║
 ║        ▼                                                           ║
 ║  ACT  (1 LLM call — the only one the candidate "hears")            ║
 ║  ┌──────────────────────────────────────────────────────────────┐  ║
 ║  │ does: evaluate the answer + produce feedback + next question │  ║
 ║  │       (coaching thread → coach the resume instead)           │  ║
 ║  │ tools it may call (all user-scoped, all logged):             │  ║
 ║  │   get_resume_text ········ ground claims in the document     │  ║
 ║  │   list_asked_questions ··· never repeat (DB truth, not LLM   │  ║
 ║  │                            memory)                           │  ║
 ║  │   record_round_grade ····· grade lands in round_grades NOW,  │  ║
 ║  │                            not at report time + appends the  │  ║
 ║  │                            question to asked_questions       │  ║
 ║  │ every chunk it generates → `token` event down the socket     │  ║
 ║  │ (the candidate watches it type — latency hidden)             │  ║
 ║  └──────────────────────────────────────────────────────────────┘  ║
 ║        │ draft reply into state                                    ║
 ║        ▼                                                           ║
 ║  REFLECT  (1 LLM call, output: {ok, problems[]})                   ║
 ║  ┌──────────────────────────────────────────────────────────────┐  ║
 ║  │ checks the draft:  repeated question? difficulty rule kept?  │  ║
 ║  │ feedback specific (not "good job")? persona consistent?      │  ║
 ║  │ grounded in resume — nothing invented? format correct?       │  ║
 ║  └──────────────────────────────────────────────────────────────┘  ║
 ║        │                                                           ║
 ║   ok? ─┼─ yes ──────────────────────────► EXIT LOOP                ║
 ║        └─ no, and retry_count == 0                                 ║
 ║              └──► back to ACT with problems attached               ║
 ║                   (ONE retry. then best effort ships. NEVER an     ║
 ║                    infinite loop on a free tier.)                  ║
 ╚════════════════════════════════════════════════════════════════════╝
        │ final reply
        ▼
 WRITE BACK — what changed in the world
 ┌────────────────────────────────────────────────────────────────────┐
 │  messages           ← assistant reply (+tokens/pool_entry meta)    │
 │  round_grades       ← already written DURING act (by the tool)     │
 │  threads            ← current_round +1, updated_at                 │
 │  socket             ← `message_complete` {authoritative content}   │
 │                       `round_update` {current_round, type, total}  │
 └────────────────────────────────────────────────────────────────────┘
        │
        ▼ (background — candidate is NOT waiting on this)
 SUMMARY TASK (only if messages since summary_covers_until > 20)
 ┌────────────────────────────────────────────────────────────────────┐
 │  cheapest pool model compresses older msgs →                       │
 │  [ROUNDS COVERED][QUESTIONS ASKED][PERFORMANCE][PENDING]           │
 │  threads.running_summary ← new text                                │
 │  threads.summary_covers_until ← window end                         │
 │  (summary = color. asked_questions & round_grades = truth.         │
 │   a bad summary can NEVER corrupt the no-repeat rule or the score) │
 └────────────────────────────────────────────────────────────────────┘

 SPECIAL TURN — the last answer (server decides: current_round == max)
 ┌────────────────────────────────────────────────────────────────────┐
 │  same loop, then:                                                  │
 │  scoring.py (NO LLM):  base(round_grades) − 10×tabs − 5×hints      │
 │  one LLM call writes the WORDS of the report (never the numbers)   │
 │  reports ← document   →  socket: `report_ready` → UI fetches HTTP  │
 └────────────────────────────────────────────────────────────────────┘
```

**Mode lock, visible in the flow:** `threads.type` rides into the dynamic context (box 4 of the assembly). On an interview thread, ACT's instructions only permit the interviewer face — a "please coach me" answer gets a polite deferral, and REFLECT checks for face-bleed. On a coaching thread, the same loop runs with the coach face unlocked. Same graph, same prompt file, different permissions — decided by the server at thread creation, never by the message.

**Graph state (`app/agent/state.py`):**
```python
class InterviewAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    thread_id: str
    user_id: str
    thread_type: str            # "interview" | "coaching" — locks the persona's allowed faces
    plan: dict                  # output of plan node
    draft: str                  # output of act node
    reflection: dict            # output of reflect node
    retry_count: int
```

**Nodes (each one LLM call, each logged with tokens/latency):**
- **`plan`** — input: dynamic context + summary + asked-questions list. Output (short, structured): `{round_type, target_skill, difficulty_note, follow_up: bool}` — including the judgment call "does the last answer deserve a follow-up probe instead of the next round type?"
- **`act`** — executes the plan: evaluates the candidate's answer AND generates the next question (or coaches, on coaching threads). May call tools. Output: the draft reply.
- **`reflect`** — checks the draft against explicit criteria: repeated question? difficulty rule followed? feedback specific? persona consistent? grounded in resume? Output: `{ok: bool, problems: [...]}`.
- **Edges:** `plan → act → reflect` → conditional: `ok` → END; not ok and `retry_count == 0` → back to `act` with the problems attached (retry once, then send best effort — never loop forever).

**Tools (`app/agent/tools.py`) — small, user-scoped, all logged:**
- `get_resume_text(thread_id)` — the thread's resume extract
- `list_asked_questions(thread_id)` — from `threads.asked_questions`
- `record_round_grade(thread_id, round, round_type, question, grade, feedback_summary)` — writes `round_grades` AND appends to `asked_questions`
- `record_hint_given(thread_id)` / counters via service layer

**The system prompt file (`app/prompts/interviewer.md`) — the exact skeleton to write:**
```markdown
# IDENTITY
You are <name>, a senior engineer who has interviewed hundreds of candidates
and genuinely wants this candidate to get hired. Professional, warm but honest,
never fake-nice, never cruel. You have read their resume carefully.

# MODE (provided per-thread by the system — obey it absolutely)
You are told: thread_type = interview | coaching.
- interview: ONLY the interviewer face. If asked for coaching/answers mid-interview,
  defer politely: "Good question — let's go through that after the interview."
- coaching: the coach face. Encouraging, specific, constructive.

# FACES
## Interviewer: one clear question at a time; probing follow-ups; never leak answers;
   pressure with respect; obey the difficulty rule given in the dynamic context.
## Coach: quote the EXACT resume line you discuss; explain why weak/strong;
   show a concrete better version; celebrate the good before fixing the bad.

# GROUNDING (anti-hallucination — absolute)
- Every claim about the candidate comes from their resume text or this conversation.
- Not in the resume? Say "I don't see that in your resume — tell me about it."
- Never invent projects, numbers, technologies, or quotes.

# OUTPUT FORMAT (interview evaluation turns)
### Feedback
(specific evaluation; if wrong, show the correct approach with a short snippet)
### Next Question
(one question, matching the plan you were given)
```
This file is versioned in git like code. Editing tone/rules = editing this file only. The dynamic values (round, difficulty, skills, time, thread_type) are NEVER written into this file — they arrive as the late dynamic message (Part 4 assembly, slot 4), keeping this file byte-identical = the cached prefix.

**The hint flow (the `{action: "hint"}` frame):** does NOT run the full graph. One small LLM call: system prompt + the current open question + "give a subtle 1–2 sentence nudge, never the answer." Server increments `threads.counters.hints_used`, then sends two events: `penalty {kind: "hint", counters}` and `message_complete` with the hint text (rendered as a 💡 bubble, stored as a message with `metadata.kind: "hint"` — and EXCLUDED from future context assembly, IDEATION 6.3 clean-context rule).

**Checkpointer:** `langgraph-checkpoint-mongodb` `MongoDBSaver`, `thread_id` = our thread UUID (ownership verified before every invoke — Part 1 rule 4).

**The LLM pool (`app/core/llm.py`):** primary Groq model `.with_fallbacks([...])` chaining the configured fallback entries, Gemini last. Every call logs which entry served (`pool_entry` — also stored in message metadata). Entries are pure config from `.env`:
```
LLM_POOL=groq:llama-3.1-8b-instant,gemini:gemini-2.0-flash
GROQ_API_KEY=...
GEMINI_API_KEY=...
```

**Scoring (`app/services/scoring.py`) — plain Python, no LLM:**
```
base   = mean over round_grades: correct=100, partial=50, wrong=0
penalty = 10 * tab_switches + 5 * hints_used
overall = max(0, round(base) - penalty)
verdict: >=75 hire | >=55 lean_hire | else no_hire   (tune later, but in code)
```
The final-report LLM call writes the *words* (feedback, breakdown explanations); the *numbers* come from this function. The report stores both transparently.

**Definition of done:** full 5-question interview via API: round types rotate, no repeated questions, grades land in `round_grades` as they happen, reflect-retry observable in logs when forced, report numbers reproducible by hand from the grades + counters.

---

# Part 6 — Long-lived WebSocket + streaming

One socket per open thread, alive for the whole conversation.

**Endpoint:** `WS /ws/threads/{thread_id}?token=<JWT>`
- Verify the JWT and thread ownership (rule 4) BEFORE `accept()` — unauthorized connects are closed with code 4401 and logged.
- Socket lifetime = the chat page being open. The client sends answers as JSON over the socket; the server streams events back.

**The event protocol — every frame is one JSON object:**
```json
{ "event_type": "...", "thread_id": "...", "data": { ... } }
```

| event_type | data | When |
|---|---|---|
| `token` | `{delta: "text chunk"}` | each streamed LLM chunk of the reply |
| `status` | `{state: "thinking" \| "planning" \| "checking", message: "Reviewing your answer…"}` | node/tool transitions — the "typing indicator" feed |
| `round_update` | `{current_round, round_type, total}` | when the round advances |
| `penalty` | `{kind: "tab_switch" \| "hint", counters: {...}}` | server acknowledges a recorded penalty |
| `message_complete` | `{message_id, content, round}` | the full reply (authoritative — UI replaces accumulated tokens with this) |
| `report_ready` | `{report_id}` | final question evaluated; client fetches the report via HTTP |
| `error` | the standard error envelope (Part 3) | anything fails |
| `ping` | `{}` | heartbeat — every 15s of silence |

**Server mechanics (the production-proven pattern):**
- **Decouple producer from consumer with `asyncio.Queue`.** The graph runs `astream_events(..., version="v2")` and pushes events into the queue; the socket loop pulls with `asyncio.wait_for(queue.get(), timeout=15)` — on `TimeoutError` it sends `ping` instead. This keeps the connection alive through 15–45s LLM/tool stalls without proxies killing it.
- **Event mapping:** `on_chat_model_stream` → `token` (extract the text delta from the chunk); `on_tool_start` → `status` with a friendly message from a small lookup dict (`{"record_round_grade": "Noting your score…"}`); graph end → `message_complete`.
- **Terminal events** (`report_ready`, fatal `error`) — after sending, the server closes cleanly.
- Every event sent is loggable at debug; every error event also logs at error level with trace_id.

**Client mechanics (`frontend/src/hooks/useThreadSocket.js`):**
- Open on chat-page mount with the stored JWT in the URL; close on unmount.
- `onmessage`: switch on `event_type` — append `token` deltas to the in-progress bubble; show `status` as the typing indicator; on `message_complete` replace the accumulated text with the authoritative content and persist to the store.
- **Reconnect:** on unclean close, retry max 3 times with exponential backoff (`delay × attempt`); after a terminal event, do NOT reconnect. On successful reconnect, **reload history via HTTP** (`GET /api/threads/{id}/messages`) — the server owns state, so nothing is lost.
- The hint button and tab-switch reports also go over the socket (`{action: "hint"}` / `{action: "tab_switch"}`) so penalties come back as `penalty` events — the server does the counting.

**Definition of done:** answers stream word-by-word; kill the network mid-reply → client reconnects and the conversation is intact; idle 60s → pings visible in logs and the socket stays alive; unauthorized token → 4401 close, logged.

---

# Part 7 — Frontend & UI design

## 7.1 UI — how it is NOW (for contrast)
One single page, a wizard with no identity: Upload resume (txt only) → difficulty cards → skill chips → chat panel with timer/hints/editor → report card. No login, no navigation, history only in localStorage, refresh loses the interview, errors silently faked.

## 7.2 The design language — taken from the EXISTING UI (do not invent a new one)

The v1 app already has a visual identity. The v2 screens — whether hand-built or generated with **Google Stitch** — MUST reuse it so the product stays recognizable. These are the actual tokens from `frontend/src/index.css`:

| Token | Value | Used for |
|---|---|---|
| Background | `#0B1120` (primary), `#111827`, `#1E293B` | page, panels, inputs |
| Accent | `#2563EB` (primary), `#3B82F6` (secondary) | buttons, links, active states |
| Headline gradient | `#60A5FA → #2563EB` (left to right, clipped to text) | app title, big numbers |
| Text | `#F8FAFC` (primary), `#94A3B8` (secondary) | |
| Status | success `#10B981` · warning `#F59E0B` · danger `#EF4444` | scores, timer, penalties |
| Border | `rgba(255,255,255,0.08)` | panel edges |
| Font | **Inter** (Google Fonts), weights 300–700 | everything |
| Panel style | glassmorphism: translucent bg + `backdrop-filter: blur(12px)` + 16px radius | all cards/panels |
| Mood | dark, calm, slightly futuristic; subtle radial blue/purple glows in corners | |

**Generating screens with Google Stitch — the working method:**
1. Keep every screen **basic**: one clear purpose, the layouts in 7.3 below, nothing decorative beyond the design language.
2. Paste the design language into every Stitch prompt. Reusable prefix:
   > "Dark-mode web app screen, background #0B1120, glassmorphism cards (blur, 16px radius, faint white border), Inter font, blue accent #2563EB, headline text with gradient #60A5FA→#2563EB, secondary text #94A3B8, subtle blue radial glow top-right. Clean, minimal, professional."
3. Then describe ONE screen per prompt using its wireframe from 7.3 (e.g., "Login screen: centered glass card with app logo 'Interview Bot', email and password fields, primary blue Log in button, 'Sign up' link below").
4. Generated output is a starting point — Thanusha reviews it against the wireframe and the token table, fixes drift (wrong colors, extra elements), and only then wires it to the real services.

## 7.3 UI — how it WILL BE (rough design)

Dark theme stays. The app becomes 4 routed pages behind login.

**Login / Signup**
```
┌──────────────────────────────────────────┐
│              🤖 Interview Bot            │
│        Your AI interview trainer         │
│                                          │
│   ┌────────────────────────────────┐     │
│   │ Email                          │     │
│   │ Password                       │     │
│   │        [ Log in ]              │     │
│   │  No account? Sign up           │     │
│   └────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

**Home — sidebar layout (persists across Chat too)**
```
┌──────────┬───────────────────────────────────────┐
│ + New    │  Welcome back, Thanusha               │
│ Interview│                                       │
│          │  [ ▶ Continue: Interview, Round 3/5 ] │
│ CHATS    │                                       │
│ ▸ Jun 10 │  Score over time:   ▂▄▅▆█             │
│   78 Hire│                                       │
│ ▸ Jun 08 │  ┌─────────────┐ ┌─────────────┐      │
│   62 Lean│  │ New         │ │ Improve     │      │
│ ▸ Coach  │  │ Interview   │ │ my Resume   │      │
│   chat   │  └─────────────┘ └─────────────┘      │
│          │                                       │
│ ⚙ Logout │  (cards → upload → difficulty →       │
│          │   skills → chat)                      │
└──────────┴───────────────────────────────────────┘
```

**Chat — the hero screen (interview thread)**
```
┌──────────┬───────────────────────────────────────┐
│ (sidebar │ Round 3/5 · Coding · ⏱ 12:40 · ● live │
│ collapsed│───────────────────────────────────────│
│ to icons)│ 🤖 ### Feedback ...                   │
│          │    ### Next Question ...              │
│          │ 🧑 my answer...                        │
│          │ 🤖 typing▌        ← streamed tokens   │
│          │───────────────────────────────────────│
│          │ [Monaco editor — coding rounds only]  │
│          │───────────────────────────────────────│
│          │ [🎤] [ type your answer…    ] [Send]  │
│          │ [💡 Hint −5pts]                       │
└──────────┴───────────────────────────────────────┘
```
Coaching threads: same shell, no timer/rounds/editor — just the conversation, with the resume viewable in a right rail.

**Report**
```
┌───────────────────────────────────────────────┐
│   ◯ 78/100        Verdict: LEAN HIRE          │
│   penalties: −10 (1 tab switch)               │
│   Project ████░ Strong   Technical ███░░ Avg  │
│   ▸ What went well   ▸ What to improve        │
│   ▸ Q-by-Q breakdown (expandable)             │
│   [Download transcript] [Practice again]      │
└───────────────────────────────────────────────┘
```

## 7.4 Frontend structure rules
- Pages in `src/pages/` (Login, Home, Chat, Report); API + socket code ONLY in `src/services/` and `src/hooks/`; state in `src/store/` (current user, active thread, messages).
- Auth token in localStorage; a fetch wrapper attaches it — **no silent fallbacks anywhere** (delete the old mock-data habits).

**Error toasts — the frontend half of error handling (mandatory):**
- One `<Toast>` component (danger `#EF4444` for errors, warning `#F59E0B` for penalties/timer, success `#10B981`), rendered once at app root, fed by a small toast store.
- **Every** failure path shows a toast — there is no error the user doesn't see:
  - HTTP: the fetch wrapper checks `response.ok` AND the `{error: true}` envelope → toast with `message` + small `trace_id` line ("The interviewer did not respond in time · trace abc123").
  - WebSocket: `error` events → same toast; unclean disconnect → "Connection lost — reconnecting (2/3)…" warning toast; reconnect success → success toast.
  - Unexpected JS crashes: a React error boundary around the routes → full-screen "Something broke" panel with the error message, instead of a white page.
- The `trace_id` shown in the toast is the SAME id in the backend logs — a user screenshot of a toast is enough to find the exact failure in Terminal 1 (Part 3).
- Toasts inform; they never replace state. A failed send leaves the typed answer in the input box so nothing the user wrote is lost.
- Voice input (Web Speech API) and tab-switch detection (`visibilitychange` → socket `tab_switch` action) carry over from v1 — but the server does the counting.

**Definition of done:** full journey — signup → upload → interview with live streaming → report → logout → login → history shows the interview and the report reopens. Refresh mid-interview resumes it.

---

# Part 8 — Documents & coach mode

**Extraction (`app/services/documents.py`):** PDF via **PyMuPDF** (`fitz`), DOCX via **python-docx**, TXT read directly. Free, open-source, production-proven. Upload endpoint validates type + size (≤5 MB), extracts, stores `resumes` doc, returns `resume_id`. Extraction failure → standard error envelope (`EXTRACTION_FAILED`) — never a silent empty resume.

**Skills:** `POST /api/resumes/{id}/skills` — JSON-mode LLM call returns 10–15 skills for the picker.

**Coach mode:** creating a thread with `type: "coaching"` is the entire switch — same agent graph, same context pipeline; the system prompt receives the thread type and unlocks the coach face (IDEATION 6.5 mode isolation). Coach replies must quote the resume section they discuss (reflect checks this).

**Definition of done:** real PDF resume → correct extracted text in DB → skills extracted → coaching chat quotes actual resume lines → interview thread refuses coaching requests politely.

---

# Part 9 — How to debug ANYTHING (step by step — keep this open while building)

When something doesn't work, check these four places **in this order**. The answer is always in one of them.

## 9.1 Browser Console — is the frontend crashing?
1. In the browser, **right-click anywhere → Inspect** (or F12 / Cmd+Option+I on Mac).
2. Click the **Console** tab.
3. **Red lines** = JavaScript errors. Read the FIRST red line (later ones are usually fallout from the first). It names the file and line — click it to jump to the code.
4. Yellow lines are warnings — note them, but they rarely break things.
5. Our own `console.error` lines from the fetch wrapper also land here, with the trace_id.

## 9.2 Network tab — did the request actually happen, and what came back?
1. Same Inspect window → **Network** tab. Keep it open, then click the thing that's broken (reproduce it).
2. Each row = one request. **Red rows / status 4xx–5xx = failures.** Click the row:
   - **Headers** — the URL actually called (typo? wrong port?), the method, and whether the `Authorization` header is present.
   - **Payload** — what the frontend actually sent (is the body what you expected?).
   - **Response** — what the backend answered. Our error envelope appears here: `{"error": true, "code": ..., "trace_id": ...}` → copy that trace_id.
3. Status decoder: `401` not logged in / token missing · `404` wrong URL or not your thread (isolation working!) · `422` request body doesn't match the Pydantic model · `500` backend exception — go to the backend logs.
4. **WebSocket frames:** filter the Network tab by **WS**, click the socket row → **Messages** tab. Every frame the socket sent and received is listed live — you can literally watch the `token` events stream. If the socket row shows close code `4401`, your token was rejected.

## 9.3 Backend logs (Terminal 1) — what did the server think?
1. The uvicorn terminal IS the log viewer. Every request logs start/end; every error logs a full traceback.
2. Have a trace_id from a toast or the Network tab? **Search the terminal for it** (Cmd+F in the terminal) — you'll find every log line of that exact request, including the traceback.
3. Reading an exception: read the traceback **bottom-up** — the last line is the error type and message; the lines above show the path through our files (look for lines mentioning `app/...`, not library code).
4. No log line at all for your request? The request never reached the backend → the bug is in the frontend URL/port or the backend isn't running.

## 9.4 The database — is the data actually there?
`mongosh` (or Atlas → Browse Collections):
```javascript
use interview_bot
db.threads.find({user_id: "<id>"}).sort({created_at: -1}).limit(1)   // did the thread update?
db.messages.find({thread_id: "<id>"}).sort({created_at: 1})          // is the conversation stored?
db.round_grades.find({thread_id: "<id>"})                            // did grades land?
```
The UI can lie (stale state); the database cannot. When the UI and DB disagree, the DB is the truth and the bug is in between.

**The debugging chain in one line:** toast trace_id → Network tab response → Terminal 1 search → mongosh. Four hops, any bug found.

---

# Part 10 — Official documentation (use it — don't guess)

**The rule for Thanusha AND the AI coding agent:** before implementing against any library — and whenever an error comes from inside one — **web-search the official docs first** (Antigravity can search the web; use it). Library APIs change; guessed syntax produces ghost bugs. Pattern: search `"<library> <topic> site:<official docs domain>"`.

| Topic | Official source |
|---|---|
| LangChain (Python) | python.langchain.com |
| LangGraph (graphs, checkpointers, streaming `astream_events`) | langchain-ai.github.io/langgraph |
| LangChain Groq integration | python.langchain.com/docs/integrations/chat/groq |
| LangChain Google Gemini integration | python.langchain.com/docs/integrations/chat/google_generative_ai |
| Groq API + rate limits | console.groq.com/docs |
| Gemini API + rate limits | ai.google.dev/gemini-api/docs |
| MongoDB (queries, indexes, $jsonSchema validators) | mongodb.com/docs/manual |
| PyMongo driver | pymongo.readthedocs.io |
| MongoDB Atlas setup | mongodb.com/docs/atlas |
| FastAPI (incl. WebSockets, dependencies, exception handlers) | fastapi.tiangolo.com |
| structlog | structlog.org |
| passlib (bcrypt) | passlib.readthedocs.io |
| PyJWT | pyjwt.readthedocs.io |
| tiktoken | github.com/openai/tiktoken |
| PyMuPDF (PDF extraction) | pymupdf.readthedocs.io |
| python-docx | python-docx.readthedocs.io |
| React | react.dev |
| Vite | vite.dev |
| Monaco editor (React) | github.com/suren-atoyan/monaco-react |

Production patterns not covered by this doc (e.g., "FastAPI WebSocket auth best practice", "LangGraph MongoDB checkpointer setup"): search the official source above FIRST; blogs and Stack Overflow only to understand, never to copy blindly.

---

# Part 11 — IDEATION → IMPLEMENTATION coverage map (nothing forgotten)

| IDEATION item | Implemented in |
|---|---|
| Phase 1 — MongoDB + migrations | Part 1 (connect 1.2 · schemas 1.3 · validators 1.4 · runner 1.5 · verify 1.6) |
| Phase 2 — auth, login/logout | Part 2 |
| Phase 3 — structlog + error handling, trace_id relation | Part 3 (backend) + Part 7.4 toasts (frontend) + Part 9 (how to check) |
| Phase 4 — frontend (login→home→chat→report) | Part 7 (wireframes 7.3, rules 7.4, design language 7.2) |
| Phase 5 — context (OpenAI-style, token budget, rolling summary, prompt caching) | Part 4 + flowchart 5.0 |
| Phase 6 — full plan→act→reflect agentic loop, tools, persona prompt, mode lock, system scoring | Part 5 (walk 5.0, state/nodes/tools, scoring) |
| Phase 7 — long-lived WebSocket streaming | Part 6 (protocol, heartbeat, reconnect) |
| Phase 8 — PDF/DOCX extraction + Resume Coach | Part 8 |
| Phase 9 extras — resumable interviews | free via threads/status + Home "Continue" card (7.3) |
| Phase 9 extras — progress over time | Home score chart (7.3) reading `reports (user_id, created_at)` |
| Phase 9 extras — rate limiting | deliberately NOT built — "no quota for now" decision (IDEATION §9); revisit on first rate-limit pain |
| Key & provider pool (Groq→…→Gemini) | Part 5 `app/core/llm.py` + `LLM_POOL` env |
| Anti-cheat counters server-side | Part 6 socket actions → `penalty` events; Part 5 scoring |
| Voice input kept | Part 7.4 |
| Timer (open question in IDEATION §10) | gate checks `started_at` in 5.0 — server-enforced; display in chat header |
| Persona (IDEATION 6.5) | `app/prompts/interviewer.md` — full authoring skeleton in Part 5 (identity, mode, faces, grounding, output format); reflect checks persona consistency (5.0) |
| Hints (−5 pts, subtle nudge) | Part 5 hint flow — single small LLM call, server-side counter, penalty + message events, excluded from future context |
| Zero cost / everything local | STRUCTURE_AND_RUN (no Docker, free tiers) |

---

# Part 12 — Agentic build playbook (how to turn this doc into working code)

This is how Thanusha drives the AI coding agent through Parts 1–8 without chaos.

## 12.1 Task size — the golden rule

**One task = one file or one tightly-related group of files = one agent prompt = one review = one verify.**
"Build Part 1" is NOT a task. Part 1 decomposes like this (every part decomposes the same way):

```
P1-T1  app/db/client.py (get_db + ping)            verify: smoke test (1.2)
P1-T2  migrations/runner.py                        verify: runs on empty DB, logs
P1-T3  m001..m006 migration files (one task EACH)  verify: mongosh checks (1.6)
P1-T4  app/db/repositories.py (user-scoped funcs)  verify: unscoped call impossible
P1-T5  tests/test_isolation.py (two-user leakage)  verify: pytest passes
```

## 12.2 The task prompt template (paste this shape into the agent every time)

```
CONTEXT (read first):
- docs/IDEATION.md            — decisions are LOCKED (Section 9)
- docs/IMPLEMENTATION.md      — Part <N>, section <X> is the spec for this task
- docs/STRUCTURE_AND_RUN.md   — folder rules, logging rule, no-Docker rule
- <existing files this task touches or builds on>

TASK (one thing):
Implement <exact file path>: <2–3 sentences of what it does, referencing the spec section>.

CONSTRAINTS (non-negotiable):
- import structlog; log start/success/failure with trace-able fields
- errors raise AppError → the standard envelope; NEVER swallow, NEVER fake data
- all DB access user-scoped via repositories (isolation rules, Part 1.1)
- follow the naming glossary (12.4); no new names for existing concepts
- do NOT touch any file outside this task's scope

VERIFY (do this and show me the output):
<the exact command(s): run it, curl it, mongosh it — from the part's DoD>
```

Why this works: the agent gets the spec, the boundaries, and the proof-of-done in one message — nothing to guess, nothing to improvise.

## 12.3 The API contract (single source of truth — frontend and backend are both built FROM this table)

| # | Method & path | Auth | Request body | Success response |
|---|---|---|---|---|
| 1 | `POST /api/auth/signup` | — | `{email, password, name}` | `{access_token, user}` |
| 2 | `POST /api/auth/login` | — | `{email, password}` | `{access_token, user}` |
| 3 | `POST /api/auth/logout` | JWT | — | `{ok: true}` |
| 4 | `GET /api/auth/me` | JWT | — | `{user}` |
| 5 | `POST /api/resumes` | JWT | multipart file (pdf/docx/txt ≤5MB) | `{resume_id, filename, chars_extracted}` |
| 6 | `POST /api/resumes/{id}/skills` | JWT | — | `{skills: ["...", ...]}` |
| 7 | `POST /api/threads` | JWT | `{type: "interview"\|"coaching", resume_id, settings?}` | `{thread}` |
| 8 | `GET /api/threads` | JWT | — | `{threads: [...]}` (home sidebar/history) |
| 9 | `GET /api/threads/{id}/messages` | JWT | — | `{messages: [...]}` (reconnect reload) |
| 10 | `GET /api/reports/{thread_id}` | JWT | — | `{report}` |
| 11 | `WS /ws/threads/{id}?token=` | JWT in URL | client frames: `{action: "answer"\|"hint"\|"tab_switch", text?}` | server events: Part 6 table |

Every error from any of these: the standard envelope `{error, code, message, trace_id}`. Any endpoint not in this table does not exist — adding one means adding it HERE first.

## 12.4 Naming glossary (one name per concept — both human and agent stick to it)

| Always say | Never say |
|---|---|
| `thread` | session, conversation, chat (in code) |
| `message` | chat entry, turn |
| `round` / `round_type` | question number, stage |
| `round_grade` | score (reserved for the report's number), mark |
| `running_summary` | memory, history summary |
| `report` / `overall_score` / `verdict` | result, evaluation |
| `pool_entry` | provider, fallback key |
| `trace_id` | request id, correlation id |
| `resume` | document, CV (in code) |

## 12.5 The session loop (every coding session, same shape)

```
1. Pick the next task (12.1 order). Tell the agent ONLY that task (12.2 template).
2. Agent writes code → Thanusha READS the diff (understand every line — ask the agent to explain).
3. Run the VERIFY step yourself. Watch Terminal 1.
4. Green → commit with message "P1-T3: m003 threads migration". Red → give the agent
   the exact error output (Part 9 tells you where to find it), let it fix, re-verify.
5. Part's DoD fully checked → next part. NEVER skip ahead with a half-done part.
```

---

# Build order recap

Part 1 → verify → Part 2 → verify → … → Part 8. Never two parts in flight at once. Every part ends with its Definition of Done checked against running code and Terminal 1 logs — not against the AI agent's claim that it works. When stuck: Part 9. When unsure of a library: Part 10. When prompting the agent: Part 12.
