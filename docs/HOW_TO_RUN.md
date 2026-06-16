# How to Run Caliber (Interview Bot)

Two terminals: **backend** (FastAPI, port 8000) and **frontend** (Vite/React, port 3000).
Open the browser at **http://localhost:3000**.

---

## 1. Backend (Terminal 1)

```bash
cd Interview_Bot
cd backend
```

**Activate the virtual environment:**

```bash
source venv/bin/activate
```

**If `venv` doesn't exist yet** (first time / fresh clone), create it with Python 3.12 (the code uses 3.10+ syntax), then install dependencies:

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> If `python3.12` isn't found, install it (macOS: `brew install python@3.12`) or use any Python ≥ 3.10.

**Make sure `backend/.env` exists** with at least:

```
MONGODB_URI=...            # MongoDB Atlas connection string
MONGODB_DB=interview_bot
JWT_SECRET=...             # any long random string
GROQ_API_KEY=...           # primary LLM
MISTRAL_API=...            # fallback (optional)
CEREBRAS_API=...           # fallback (optional)
```

**(First time only) apply DB migrations:**

```bash
python -m migrations.runner
```

**Run the server:**

```bash
uvicorn app.main:app --port 8000 --reload
```

✅ Expect: `Uvicorn running on http://127.0.0.1:8000` and a `llm_pool_initialized` log line.

---

## 2. Frontend (Terminal 2)

```bash
cd Interview_Bot
cd frontend
npm install
npm run dev
```

✅ Expect: `Local: http://localhost:3000/`. Open that URL.

> The frontend talks to the backend at `localhost:8000`. If you change the backend port, update the URLs in `frontend/src/lib/services/api.js` and `frontend/src/lib/hooks/useThreadSocket.js`.

---

## Notes

- **Ports:** backend = **8000**, frontend = **3000**. (On macOS, port 5000 is taken by AirPlay — that's why the backend uses 8000.)
- **LLM fallback chain:** Groq `llama-3.3-70b-versatile` → Mistral `mistral-large-latest` → Cerebras `gpt-oss-120b`, built automatically from whichever keys are in `.env`.
- **New Python deps:** after a `git pull`, re-run `pip install -r requirements.txt` inside the venv.
- **Hard-refresh** the browser (Cmd+Shift+R) after UI changes to clear cached JS.
- **Stop a server:** `Ctrl+C` in its terminal. **Deactivate the venv:** `deactivate`.

---

## Quick reference

| | Backend | Frontend |
|---|---|---|
| Folder | `Interview_Bot/backend` | `Interview_Bot/frontend` |
| Setup | `source venv/bin/activate` (or create + `pip install -r requirements.txt`) | `npm install` |
| Run | `uvicorn app.main:app --port 8000 --reload` | `npm run dev` |
| URL | http://localhost:8000 | http://localhost:3000 |
