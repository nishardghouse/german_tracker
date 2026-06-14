# German Tracker

A personal app to help an advanced (B2) learner improve spoken German, targeting two
problems: **articulating sentences** and **remembering new words**.

Two modes share one error/vocab store and a spaced-repetition schedule:

1. **Conversation** — speak (or type) to an AI partner; it replies in German and notes your
   mistakes at pattern level. Mistakes spawn drill cards (the compounding loop).
2. **Translation drills** — the AI shows an English sentence, you say/type the German;
   it's graded and scheduled with FSRS. You can add your own sentences (manually or via a
   Google Sheet inbox).

## Tech stack

**Frontend** — React 18 + TypeScript, Vite 5, Tailwind CSS v3.4, GSAP (animation),
lucide-react (icons), ts-fsrs (spaced repetition). Voice uses the browser **Web Speech
API** (`SpeechRecognition` de-DE for STT, `speechSynthesis` for TTS). State is a small
in-memory cache hydrated from the backend (no Redux/ORM).

**Backend** — Python (managed with **uv**, `.python-version` = 3.12), FastAPI + uvicorn,
Pydantic / pydantic-settings, **SQLite via stdlib `sqlite3`** (no ORM), Anthropic SDK,
httpx (for the Google Sheet CSV fetch).

**LLM** — Claude via the Anthropic SDK (key held server-side only). Structured outputs via
`messages.parse()`; streaming for the conversation reply. Cost-tiered: grading + reply +
translation on Haiku 4.5, conversation feedback on Sonnet 4.6 (all overridable in `.env`).

```
Browser (React/TS/Vite, Tailwind, GSAP, Web Speech API)
  editable field ──► /api/*  (Vite dev proxy → :8000)
        ▼
FastAPI (uv, uvicorn)
  ├─ Anthropic SDK ──► Claude (grade / conversation reply-stream / feedback / translate)
  ├─ sqlite3 ──► backend/german_tracker.db   (cards, attempts, error_patterns)
  └─ httpx ──► Google Sheet CSV              (capture inbox)
```

## API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /grade` | Grade a German translation (structured verdict). |
| `POST /conversation/reply` | Streamed German reply. |
| `POST /conversation/feedback` | Errors + coaching + drill cards for the user's message. |
| `POST /transcribe` | German STT (stub — future server-side Whisper path). |
| `GET /state` | Full store snapshot (cards, attempts, error_patterns). |
| `POST /cards`, `PUT /cards/{id}`, `POST /cards/bulk` | Create/update cards. |
| `POST /attempts` | Append an attempt. |
| `PUT /error-patterns/{category}` | Upsert an error pattern. |
| `POST /inbox/import` | Pull sentences from the Google Sheet CSV. |
| `GET /health` | Liveness + whether an API key is configured. |

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for details.

## Run it (local dev)

Two terminals:

```powershell
# Terminal 1 — backend
cd backend
uv sync
Copy-Item .env.example .env   # add your ANTHROPIC_API_KEY (+ optional GSHEET_CSV_URL)
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173 · API docs: http://localhost:8000/docs ·
Use Chrome/Edge and allow microphone access for voice.

## Status & next step: hosting

Current state: feature-complete for single-user local use — both modes, voice + editable
text input, FSRS scheduling, SQLite persistence, Google Sheet capture, cost-tiered Claude
calls. **Not yet hosted** (you run both processes locally).

To convert this into a hosted web app, the key considerations (discussed, not yet done):

- **Single deployable**: have FastAPI also serve the built frontend (`npm run build` →
  `frontend/dist`, mounted via `StaticFiles`), so it's one container/service.
- **SQLite needs a persistent disk** — avoid free tiers with ephemeral filesystems (data
  loss on restart). Use a persistent volume (Fly.io), an always-free VM (Oracle), or a
  small VPS (~€4/mo Hetzner). Or migrate the DB to managed Postgres (Neon/Supabase free)
  to use any stateless host.
- **Add auth** — it's currently fully open (no user scoping). At minimum a shared token /
  password before exposing it publicly; HTTPS comes from the platform.
- **Multi-user later** — add a `user_id` column + auth if it's ever more than you.
- **Config**: `ANTHROPIC_API_KEY`, `DB_PATH`, `CORS_ORIGINS`, model overrides,
  `GSHEET_CSV_URL` — all via env (see `backend/.env.example`).

Project notes and decisions are tracked in the assistant's memory file.
