# Interview Bot v2 — Project Structure & How to Run

**Status:** Draft — structure and run workflow defined; remaining sections to be filled from team input
**Audience:** The junior developer AND the AI coding agent (this file is written to be readable by both — feed it, together with `docs/IDEATION.md`, as context to the agentic coding tool)
**Companion docs:** `docs/IDEATION.md` (the WHAT and WHY — read first) · `docs/IMPLEMENTATION.md` (the HOW — coming separately)

---

## 1. Target folder structure

Everything lives under the repository root `Interview_Bot/`. Three top-level areas: `frontend/`, `backend/`, `docs/`.

```
Interview_Bot/
├── docs/                          # MASTER DOCS FOLDER — the source of truth for all decisions
│   ├── IDEATION.md                # What we build and why (read this first, always)
│   ├── STRUCTURE_AND_RUN.md       # This file — layout + how to run
│   └── IMPLEMENTATION.md          # How to build it, phase by phase (provided separately)
│
├── frontend/                      # React + Vite single-page app
│   ├── src/
│   │   ├── pages/                 # One folder per screen: Login, Home, Chat, Report
│   │   ├── components/            # Reusable UI pieces (chat bubble, code editor, timer, sidebar)
│   │   ├── services/              # All backend communication (HTTP + WebSocket) — UI never calls APIs directly
│   │   ├── store/                 # Client state (current user, active thread, messages)
│   │   └── hooks/                 # Reusable logic (voice input, socket connection, timer display)
│   ├── .env.example               # Frontend env template (API URL) — copy to .env, never commit .env
│   └── package.json
│
├── backend/                       # Python FastAPI + LangChain/LangGraph (the ONLY backend — old Node one is deleted)
│   ├── app/
│   │   ├── main.py                # App entry: middleware, startup, route mounting — nothing else
│   │   ├── api/                   # Thin HTTP/WebSocket endpoints — receive, validate, delegate, respond
│   │   ├── agent/                 # The LangGraph agent: plan → act → reflect nodes, tools, graph wiring
│   │   ├── prompts/               # AI-related home: versioned system prompts (the persona lives here, not in code)
│   │   ├── services/              # Business logic: interviews, scoring math, document extraction, auth
│   │   ├── models/                # Pydantic request/response models + DB document shapes
│   │   ├── core/                  # Config (env loading), logging setup, error envelope, LLM provider pool
│   │   └── db/                    # Mongo connection + collection access
│   ├── migrations/                # Versioned, ordered scripts: collections, indexes, seed data
│   ├── tests/                     # Tests mirror the app/ layout
│   ├── .env.example               # Backend env template (Mongo URI, LLM keys pool, JWT secret)
│   └── requirements.txt           # Everything the backend needs — pip install, nothing more
│
├── .gitignore
└── README.md                      # One screen: what this is + the two-terminal run commands below
```

**Everything is local — no deployment.** This project runs only on the developer's machine: no Docker, no servers, no cloud hosting. The backend is plain Python (`requirements.txt` + `.env`), the frontend is plain Vite, and the database is MongoDB Atlas' free cluster (or a local MongoDB install) reached via the connection string in `.env`. Deployment is a future topic that does not exist in the learning phase.

**Rules the structure enforces (for human and AI alike):**
- **Prompts are files in `backend/app/prompts/`, not strings in code.** All AI-related assets (system prompt, persona) live in the backend next to the agent that uses them. Editing the persona never means touching Python.
- **`api/` stays thin.** If an endpoint contains logic, the logic is in the wrong place — move it to `services/` or `agent/`.
- **The frontend talks to the backend only through `src/services/`.** One place to see every API call that exists.
- **Both sides keep env templates.** `frontend/.env.example` and `backend/.env.example` list every variable each side needs; real values go in the local `.env` copies, which are gitignored and NEVER committed. If a variable is not in the example file, it doesn't exist.
- **Every implementation logs — no exceptions.** Every backend module that does anything meaningful starts with `import structlog` and logs its events (start, success, failure with trace_id — IDEATION Sections 6.6/6.7). Code that does work silently is incomplete: it MUST NOT be accepted from the AI agent or merged. If it happened and the logs don't show it, it didn't happen.
- **The old `backend/` (Node.js) and `backend_python/` folders are replaced by this layout** — one backend, one brain (IDEATION Section 9).

## 2. How to run — two terminals, always

Everything starts from the repository root `Interview_Bot/`. Development uses **two terminals side by side** — one per side of the app — so you always *see* what the system is doing.

**Terminal 1 — backend (with logs):**
```bash
cd Interview_Bot/backend
pip install -r requirements.txt    # first time only (inside a virtualenv)
uvicorn app.main:app --reload
```
This starts the API; it connects to MongoDB using the connection string in `.env` (Atlas free cluster, or local MongoDB if installed). **Keep this terminal visible while you work** — every structured log line (LLM calls, context built, scores recorded, errors with trace_id) streams here live. This terminal is where you watch the system think; if something breaks, the trace_id on screen is your starting point (IDEATION Section 6.7).

**Terminal 2 — frontend:**
```bash
cd Interview_Bot/frontend
npm install        # first time only
npm run dev
```
Vite prints a local URL — open it in the browser. Hot reload: edit a file, the page updates.

**The workflow:** click in the browser (Terminal 2's app) → watch what actually happens in Terminal 1's logs. Every feature you build, you verify in both places: the UI behaves AND the logs show the right events with no errors. "It looks fine in the browser" is never enough on its own.

**First-time setup (once):** copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`, fill in real values (Mongo URI, LLM keys). Run migrations once before first start (exact command in IMPLEMENTATION.md).

## 3. Working with the AI coding agent (agentic coding)

The junior builds this WITH an AI coding agent (e.g., the free Antigravity IDE). The docs in this repo are written to be the agent's context as much as the human's. The working rules:

1. **Feed the docs first.** Every session, the agent gets `docs/IDEATION.md` + this file (+ `IMPLEMENTATION.md` when it exists) as context before any task. The agent must follow the locked decisions in IDEATION Section 9 — they are not suggestions.
2. **One phase, one task at a time.** Ask the agent for small, single-purpose changes that match the current phase (IDEATION Section 7). Never "build the whole backend" — that produces unreviewable output.
3. **The human reviews every diff.** The junior reads what the agent wrote before accepting it. If you can't explain a line, ask the agent to explain it — understanding is the point of the learning phase.
4. **Verify by running, not by trusting.** After every accepted change: run both terminals, exercise the feature, read the logs. The agent saying "done" is not evidence; Terminal 1 showing the right events with no errors is.
5. **Never accept code that breaks the doc's rules** — swallowed errors, fake fallback data, logic in `api/`, prompts hard-coded in Python, secrets in code, or **modules without structlog logging**. These are the exact failures IDEATION exists to prevent; an AI agent will happily produce them if not held to the docs.
6. **Docs stay current.** When a real decision changes during building, the change goes into the docs first (IDEATION Section 9 or IMPLEMENTATION.md), then into code — so the agent's context never lies.

**Writing style for these docs (why they work for AI too):** explicit file paths, one decision per line, consistent names (always `thread`, never sometimes `session`), and rules stated as MUST/NEVER — both a junior and a coding agent can execute that without guessing.

## 4. To be added (from team input)

<!-- The remaining sections will be dictated and filled in here -->
-

